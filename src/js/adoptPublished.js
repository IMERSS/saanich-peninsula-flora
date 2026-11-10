/* eslint-env node */

"use strict";

// Run before "hugo --cleanDestinationDir", which deletes every file of the published site, docs, that the build does
// not produce - everything not copied from static or rendered from content and layouts. Only directories whose names
// begin with "." are kept. The one rule for what may live in docs is therefore that it must have a source from which
// the build produces it.
// GitHub Pages breaks that rule in one way: saving a custom domain in a repository's settings commits a file CNAME to
// the root of its publishing source, here docs. Such files, written into docs by the host, are adopted into static
// before the build, so that the build publishes them again rather than deleting them. A file of the same name already
// in static which differs from the published one stops the build, since it is not clear which is meant.
// Usage: node src/js/adoptPublished.js <publishDir> <staticDir>
// This is notionally part of the bioReportR package, and is copied between bioReportR projects by copyFrameworkOut.sh

const fs = require("fs"),
    path = require("path");

// Files which a host writes into the root of the published site
const hostFiles = ["CNAME", ".nojekyll"];

/**
 * Adopt into the static directory any file which a host has written into the published site.
 * @param {String} publishDir - The directory of the published site
 * @param {String} staticDir - The directory of the site's static files
 * @return {String[]} The names of the files adopted
 */
const adoptPublished = function (publishDir, staticDir) {
    return hostFiles.filter(name => {
        const published = path.join(publishDir, name);
        const source = path.join(staticDir, name);
        let adopt = false;
        if (fs.existsSync(published)) {
            if (!fs.existsSync(source)) {
                fs.copyFileSync(published, source);
                console.log("Adopted " + published + " written by the host into " + source + " - commit it there");
                adopt = true;
            } else if (!fs.readFileSync(published).equals(fs.readFileSync(source))) {
                throw new Error(published + " differs from " + source + " - make them agree before building, since " +
                    "the build would replace the published file with the one in " + staticDir);
            }
        }
        return adopt;
    });
};

module.exports = adoptPublished;

if (require.main === module) {
    const [publishDir, staticDir] = process.argv.slice(2);
    if (staticDir === undefined) {
        console.error("Usage: node adoptPublished.js <publishDir> <staticDir>");
        process.exitCode = 1;
    } else {
        adoptPublished(publishDir, staticDir);
    }
}
