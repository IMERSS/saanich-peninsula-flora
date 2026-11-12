/* eslint-env node */

"use strict";

// Consolidate the community's curation notes - each a comment on a thread of the project's GitHub Discussions, in the
// category named by static/curation/config.json - into the files read by the story page:
//   - <out>/taxa.csv - one row for each author's latest note of each type, "provenance" or "taxonomy", on each taxon
//   - <out>/observations.csv - one row for each author's latest note on each observation, e.g. correcting its position
//   - <out>/claimStatus.json - {"<claimId>": "consolidated", ...} for every claim consolidated into either file
// A curations.csv left by an earlier version, which held only notes on the provenance of taxa, is removed.
// The files are written into static/curation, and into docs/curation if the site has been built, so that they are
// published at once and survive the next build. Run by .github/workflows/curation.yml - see
// notes/community-curation-design.md.
// Usage: GITHUB_TOKEN=<token> node src/js/consolidateCuration.js
//    or: node src/js/consolidateCuration.js --from <file>, consolidating the threads held in a JSON file, as an array of
//        discussions each with its `title` and `comments`, as fetched - for testing
// This is notionally part of the bioReportR package, and is copied between bioReportR projects by copyFrameworkOut.sh

const fs = require("fs"),
    path = require("path"),
    yaml = require("js-yaml");

const projectDir = path.resolve(__dirname, "../..");
const marker = "# bioreportr-curation";
const votes = ["yes", "no", "no opinion"];
// The types of note on a taxon - a note written before types were introduced is on its provenance
const taxonTypes = ["provenance", "taxonomy"];
const files = {
    taxa: {
        file: "taxa.csv",
        key: note => note.taxonId + "|" + note.type,
        columns: ["taxonId", "taxonName", "type", "claimId", "author", "submitted", "present", "planted", "waif", "comment", "url"]
    },
    observations: {
        file: "observations.csv",
        key: note => note.recordId,
        columns: ["recordId", "taxonId", "taxonName", "claimId", "author", "submitted", "lat", "long", "comment", "url"]
    }
};
// The file written by an earlier version, removed once its notes are consolidated into taxa.csv
const legacyFile = "curations.csv";

/**
 * Query GitHub's GraphQL API.
 * @param {String} token - A token with read access to the repository's discussions
 * @param {String} query - The query
 * @param {Object} variables - Its variables
 * @return {Promise<Object>} The data of the response
 */
const graphql = async function (token, query, variables) {
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {"Authorization": "bearer " + token, "Content-Type": "application/json"},
        body: JSON.stringify({query, variables})
    });
    const result = await response.json();
    if (!response.ok || result.errors) {
        throw new Error("GitHub GraphQL query failed: " + JSON.stringify(result.errors || response.statusText));
    }
    return result.data;
};

/**
 * Fetch every thread of the curation category, with all of its comments.
 * @param {String} token - A token with read access to the repository's discussions
 * @param {Object} config - The contents of static/curation/config.json
 * @return {Promise<Object[]>} The threads, each with its `title` and `comments`, each comment with `body`, `createdAt`,
 * `url` and `author`
 */
const fetchThreads = async function (token, config) {
    const [owner, name] = config.repository.split("/");
    let categoryId = config.categoryId;
    if (!categoryId) {
        const data = await graphql(token, `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) { discussionCategories(first: 50) { nodes { id name } } }
        }`, {owner, name});
        categoryId = data.repository.discussionCategories.nodes.find(category => category.name === config.category)?.id;
        if (!categoryId) {
            throw new Error("No discussion category named " + config.category + " in " + config.repository);
        }
    }
    const comment = "nodes { body createdAt url author { login } }";
    const threads = [];
    let after = null;
    do {
        const data = await graphql(token, `query($owner: String!, $name: String!, $categoryId: ID!, $after: String) {
            repository(owner: $owner, name: $name) {
                discussions(first: 50, after: $after, categoryId: $categoryId) {
                    nodes { id title comments(first: 100) { ${comment} pageInfo { hasNextPage endCursor } } }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`, {owner, name, categoryId, after});
        const page = data.repository.discussions;
        for (const discussion of page.nodes) {
            const comments = [...discussion.comments.nodes];
            let more = discussion.comments.pageInfo;
            while (more.hasNextPage) {
                const next = await graphql(token, `query($id: ID!, $after: String) {
                    node(id: $id) { ... on Discussion { comments(first: 100, after: $after) { ${comment} pageInfo { hasNextPage endCursor } } } }
                }`, {id: discussion.id, after: more.endCursor});
                comments.push(...next.node.comments.nodes);
                more = next.node.comments.pageInfo;
            }
            threads.push({title: discussion.title, comments});
        }
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    return threads;
};

/**
 * Read a coordinate of a corrected position, as written by the page - a decimal number within its range, or else blank.
 * @param {Any} value - The value of the field
 * @param {Number} limit - The coordinate's greatest magnitude, 90 for a latitude and 180 for a longitude
 * @return {String} The coordinate, or the empty string if none was given or it is invalid
 */
const coordinate = function (value, limit) {
    const number = value === undefined || value === null || value === "" ? NaN : Number(value);
    return Number.isFinite(number) && Math.abs(number) <= limit ? String(number) : "";
};

/**
 * Read the note held by a comment, if it is a curation note - its fenced YAML block beginning with the marker.
 * @param {Object} comment - The comment, with `body`, `createdAt`, `url` and `author`
 * @return {Object|null} The note, as a row of taxa.csv or observations.csv with its `kind`, "taxa" or "observations",
 * or null if the comment holds none, or an invalid one
 */
const parseNote = function (comment) {
    const block = [...(comment.body || "").matchAll(/```ya?ml\r?\n([\s\S]*?)```/g)].map(match => match[1]).find(text => text.trim().startsWith(marker));
    let note = null;
    if (block && comment.author) {
        try {
            const fields = yaml.load(block) || {};
            const answer = value => votes.includes(String(value)) ? String(value) : "no opinion";
            const common = {
                taxonId: String(fields.taxonId ?? ""),
                taxonName: String(fields.taxonName ?? ""),
                claimId: String(fields.claimId ?? ""),
                author: comment.author.login,
                submitted: comment.createdAt,
                comment: String(fields.comment ?? ""),
                url: comment.url
            };
            const type = String(fields.type ?? "provenance");
            if (!fields.claimId) {
                note = null;
            } else if (type === "observation" && fields.recordId) {
                // A position is kept only if both its coordinates are valid
                const lat = coordinate(fields.lat, 90), long = coordinate(fields.long, 180);
                const valid = lat !== "" && long !== "";
                note = {kind: "observations", ...common, recordId: String(fields.recordId), lat: valid ? lat : "", long: valid ? long : ""};
            } else if (taxonTypes.includes(type) && fields.taxonId) {
                const provenance = type === "provenance";
                note = {kind: "taxa", ...common, type,
                    present: provenance ? answer(fields.present) : "",
                    planted: provenance ? answer(fields.planted) : "",
                    waif: provenance ? answer(fields.waif) : ""};
            }
        } catch (error) {
            console.log("Skipping a comment whose note could not be read, at " + comment.url + ": " + error.message);
        }
    }
    return note;
};

/**
 * Consolidate the notes of every thread - only the latest note of each author on each subject is kept, a subject being
 * a taxon and a type of note on it, or an observation, since a fresh submission displaces the author's earlier one,
 * should its deletion have failed or two threads exist for a subject.
 * @param {Object[]} threads - The threads, as fetched by `fetchThreads`
 * @return {Object<String, Object[]>} The rows of taxa.csv, as `taxa`, ordered by taxon, type and then most recent first,
 * and of observations.csv, as `observations`, ordered by record and then most recent first
 */
const consolidate = function (threads) {
    const latest = {taxa: new Map(), observations: new Map()};
    threads.flatMap(thread => thread.comments).map(parseNote).filter(note => note).forEach(({kind, ...note}) => {
        const key = files[kind].key(note) + "|" + note.author;
        const current = latest[kind].get(key);
        if (!current || note.submitted > current.submitted) {
            latest[kind].set(key, note);
        }
    });
    const bySubject = (a, b) => a.localeCompare(b, "en", {numeric: true});
    const recent = (a, b) => b.submitted.localeCompare(a.submitted);
    return {
        taxa: [...latest.taxa.values()].sort((a, b) => bySubject(a.taxonId, b.taxonId) || a.type.localeCompare(b.type) || recent(a, b)),
        observations: [...latest.observations.values()].sort((a, b) => bySubject(a.recordId, b.recordId) || recent(a, b))
    };
};

/**
 * Render rows as CSV, quoting every field which needs it.
 * @param {Object[]} rows - The rows
 * @param {String[]} columns - The columns, in order
 * @return {String} The CSV, with a header of `columns`
 */
const toCSV = function (rows, columns) {
    const quote = value => {
        const text = String(value ?? "");
        return /[",\r\n]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
    };
    return [columns.join(","), ...rows.map(row => columns.map(column => quote(row[column])).join(","))].join("\n") + "\n";
};

/**
 * Write the consolidated files into each directory, reporting whether any changed. A legacy curations.csv is removed.
 * @param {Object<String, Object[]>} consolidated - The rows of each file, as returned by `consolidate`
 * @param {String[]} dirs - The directories to write into
 * @return {Boolean} `true` if any file changed
 */
const writeFiles = function (consolidated, dirs) {
    const claims = [...consolidated.taxa, ...consolidated.observations].map(row => row.claimId);
    const claimStatus = Object.fromEntries(claims.map(claimId => [claimId, "consolidated"]));
    const texts = {
        [files.taxa.file]: toCSV(consolidated.taxa, files.taxa.columns),
        [files.observations.file]: toCSV(consolidated.observations, files.observations.columns),
        "claimStatus.json": JSON.stringify(claimStatus, null, 4) + "\n"
    };
    let changed = false;
    dirs.forEach(dir => {
        Object.entries(texts).forEach(([file, text]) => {
            const target = path.join(dir, file);
            if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== text) {
                fs.mkdirSync(dir, {recursive: true});
                fs.writeFileSync(target, text);
                console.log("Written " + path.relative(projectDir, target) + ", consolidating " + claims.length + " notes in all");
                changed = true;
            }
        });
        const legacy = path.join(dir, legacyFile);
        if (fs.existsSync(legacy)) {
            fs.unlinkSync(legacy);
            console.log("Removed " + path.relative(projectDir, legacy) + ", superseded by " + files.taxa.file);
            changed = true;
        }
    });
    return changed;
};

module.exports = {files, parseNote, consolidate, toCSV, writeFiles};

if (require.main === module) {
    const fromIndex = process.argv.indexOf("--from");
    const config = JSON.parse(fs.readFileSync(path.join(projectDir, "static/curation/config.json"), "utf8"));
    const threads = fromIndex !== -1 ? Promise.resolve(JSON.parse(fs.readFileSync(process.argv[fromIndex + 1], "utf8"))) :
        process.env.GITHUB_TOKEN ? fetchThreads(process.env.GITHUB_TOKEN, config) : Promise.reject(new Error("GITHUB_TOKEN is not set"));
    threads.then(fetched => {
        const dirs = [path.join(projectDir, "static/curation"), ...fs.existsSync(path.join(projectDir, "docs")) ? [path.join(projectDir, "docs/curation")] : []];
        const changed = writeFiles(consolidate(fetched), dirs);
        console.log(changed ? "The consolidated notes have changed" : "The consolidated notes are unchanged");
    }).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
