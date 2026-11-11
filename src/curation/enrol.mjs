/*
 * Enrol a repository in bioReportR's community curation, as far as GitHub allows it to be automated - see §6 of
 * notes/curation-token-exchange.md. Uses the GitHub CLI, gh, signed in as someone who administers the repository.
 *
 * Usage: node src/curation/enrol.mjs --repo <owner/name> --endpoint <token exchange URL> --app <GitHub App slug>
 *            [--category <name>] [--dry-run]
 *
 * It enables the repository's Discussions, finds the category - by default General, which GitHub creates when
 * Discussions are enabled - checks the token exchange's acceptance of the site's origin, and writes the project's
 * static/curation/config.json. It reports what only a person can do: installing the App, and creating the category if
 * another is named, or General is missing. --dry-run changes nothing.
 */

import {execFileSync} from "child_process";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const parseArgs = function (argv) {
    // General is one of the categories GitHub creates when Discussions are enabled, and is open-ended, so that anyone may
    // start a thread in it - as each person's first note on a taxon does
    const options = {category: "General", dryRun: false};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--dry-run") {
            options.dryRun = true;
        } else if (argv[i].startsWith("--")) {
            options[argv[i].substring(2)] = argv[++i];
        }
    }
    return options;
};

/**
 * Call GitHub's API through the GitHub CLI.
 * @param {String[]} args - The arguments of `gh api`
 * @return {Object} The parsed response
 */
const gh = function (args) {
    let output;
    try {
        output = execFileSync("gh", ["api", ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]});
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error("The GitHub CLI, gh, is not installed, or not on the PATH - install it, and sign it in with " +
                "\"gh auth login\" - see §5.1 of notes/curation-token-exchange.md");
        } else {
            throw error;
        }
    }
    return output.trim() ? JSON.parse(output) : {};
};

const report = {done: [], todo: []};

const main = async function () {
    const options = parseArgs(process.argv.slice(2));
    if (!options.repo || !options.endpoint || !options.app) {
        throw new Error("Usage: node src/curation/enrol.mjs --repo <owner/name> --endpoint <URL> --app <slug> [--category <name>] [--dry-run]");
    }
    const [owner, name] = options.repo.split("/");
    const endpoint = options.endpoint.replace(/\/$/, "");

    // 1. Discussions
    const repo = gh([`repos/${owner}/${name}`]);
    if (repo.has_discussions) {
        report.done.push("Discussions are enabled");
    } else if (options.dryRun) {
        report.todo.push("Enable Discussions (not done, since this is a dry run)");
    } else {
        gh(["-X", "PATCH", `repos/${owner}/${name}`, "-F", "has_discussions=true"]);
        report.done.push("Enabled Discussions");
    }

    // 2. The category, and the ids for config.json. Discussions just enabled may take a moment to gain GitHub's
    // standard categories, so they are looked for a few times
    const lookUp = () => gh(["graphql", "-f", `query=query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) { id discussionCategories(first: 50) { nodes { id name } } }
    }`, "-F", `owner=${owner}`, "-F", `name=${name}`]).data;
    let data = lookUp();
    let category = data.repository.discussionCategories.nodes.find(node => node.name === options.category);
    for (let attempt = 0; !category && repo.has_discussions === false && !options.dryRun && attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        data = lookUp();
        category = data.repository.discussionCategories.nodes.find(node => node.name === options.category);
    }
    if (category) {
        report.done.push(`The category "${options.category}" exists`);
    } else {
        report.todo.push(`Create the discussion category "${options.category}", with the Open-ended discussion format, at ` +
            `https://github.com/${owner}/${name}/discussions/categories/new - then run this again`);
    }

    // 3. The App
    report.todo.push(`Make sure the App is installed on ${options.repo}, choosing it under "Only select repositories", at ` +
        `https://github.com/apps/${options.app}/installations/new`);

    // 4. The site's origin, as the token exchange sees it
    let origin = null;
    try {
        origin = new URL(gh([`repos/${owner}/${name}/pages`]).html_url).origin;
    } catch (error) {
        report.todo.push("GitHub Pages is not set up for the repository, so its site's origin could not be checked");
    }
    if (origin) {
        const response = await fetch(endpoint + "/token", {method: "OPTIONS", headers: {"Origin": origin}});
        if (response.status === 204) {
            report.done.push(`The token exchange allows the site's origin, ${origin}`);
        } else {
            report.todo.push(`Add ${origin} to ALLOWED_ORIGINS of the token exchange, and redeploy it - see §3.5 of notes/curation-token-exchange.md`);
        }
    }

    // 5. config.json
    if (category) {
        const config = {backend: "github", repository: options.repo, repositoryId: data.repository.id, category: options.category,
            categoryId: category.id, oauthEndpoint: endpoint};
        const file = path.join(projectDir, "static/curation/config.json");
        if (options.dryRun) {
            report.done.push("Would write static/curation/config.json:\n" + JSON.stringify(config, null, 4));
        } else {
            fs.mkdirSync(path.dirname(file), {recursive: true});
            fs.writeFileSync(file, JSON.stringify(config, null, 4) + "\n");
            report.done.push("Wrote static/curation/config.json - build the site and commit it");
        }
    }
};

main().then(() => {
    console.log("Done:\n  " + report.done.join("\n  "));
    console.log(report.todo.length ? "To do:\n  " + report.todo.join("\n  ") : "Nothing left to do");
}).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
