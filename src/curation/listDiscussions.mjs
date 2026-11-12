/*
 * List a repository's Discussion categories with their ids, and check the category named in the project's
 * static/curation/config.json against them. Uses the GitHub CLI, gh, signed in as anyone who can read the repository.
 * It only reads, and changes nothing.
 *
 * Usage: node src/curation/listDiscussions.mjs [--repo <owner/name>]
 *
 * --repo defaults to the repository named in config.json. The id of each category is the categoryId which config.json
 * holds. Renaming a category in GitHub keeps its id, but a category created afresh has a new one.
 */

import {execFileSync} from "child_process";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = path.join(projectDir, "static/curation/config.json");

const parseArgs = function (argv) {
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            options[argv[i].substring(2)] = argv[++i];
        }
    }
    return options;
};

/**
 * Read the project's curation settings, if it has any.
 * @return {Object} The parsed config.json, or an empty object if there is none
 */
const readConfig = function () {
    return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
};

/**
 * Look up a repository's id and Discussion categories through the GitHub CLI.
 * @param {String} owner - The repository's owner
 * @param {String} name - The repository's name
 * @return {Object} The repository's `id`, `hasDiscussionsEnabled` and `discussionCategories.nodes`
 */
const lookUp = function (owner, name) {
    let output;
    try {
        output = execFileSync("gh", ["api", "graphql", "-f", `query=query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                id
                hasDiscussionsEnabled
                discussionCategories(first: 100) {
                    nodes { id name slug isAnswerable }
                }
            }
        }`, "-F", `owner=${owner}`, "-F", `name=${name}`], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]});
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error("The GitHub CLI, gh, is not installed, or not on the PATH - install it, and sign it in with " +
                "\"gh auth login\" - see §5.1 of notes/curation-token-exchange.md");
        } else {
            throw error;
        }
    }
    return JSON.parse(output).data.repository;
};

const main = function () {
    const options = parseArgs(process.argv.slice(2));
    const config = readConfig();
    const repo = options.repo || config.repository;
    if (!repo || !repo.includes("/")) {
        throw new Error("Usage: node src/curation/listDiscussions.mjs [--repo <owner/name>] - no repository is named in " +
            configPath);
    }
    const [owner, name] = repo.split("/");
    const repository = lookUp(owner, name);
    console.log(`Repository ${repo}, id ${repository.id}, Discussions ${repository.hasDiscussionsEnabled ? "enabled" : "disabled"}`);
    const categories = repository.discussionCategories.nodes;
    for (const category of categories) {
        // An answerable category is in the Question and Answer format, unsuited to curation's open-ended threads
        console.log(`  ${category.id}  ${category.name}${category.isAnswerable ? "  (Q&A format)" : ""}`);
    }
    if (config.repository === repo) {
        const byId = categories.find(category => category.id === config.categoryId);
        const byName = categories.find(category => category.name === config.category);
        if (config.repositoryId !== repository.id) {
            console.log(`config.json's repositoryId ${config.repositoryId} differs from the repository's id ${repository.id}`);
        }
        if (byId && byId.name === config.category) {
            console.log(`config.json's category "${config.category}" and its categoryId ${config.categoryId} agree`);
        } else if (byId) {
            console.log(`config.json's categoryId ${config.categoryId} belongs to the category "${byId.name}", ` +
                `not "${config.category}" - set its category to "${byId.name}"` +
                (byName ? `, or its categoryId to ${byName.id}, the id of "${config.category}"` : ""));
        } else if (byName) {
            console.log(`config.json's categoryId ${config.categoryId} matches no category - set it to ${byName.id}, ` +
                `the id of "${config.category}"`);
        } else {
            console.log(`Neither config.json's category "${config.category}" nor its categoryId ${config.categoryId} ` +
                "matches a category of the repository");
        }
    }
};

main();
