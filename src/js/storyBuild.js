/* eslint-env node */
"use strict";

// Build the material of a story map from the HTML knitted from its R Markdown panes - the step between knitting and
// rendering the story page statically with Infusion 6's hydrate.js. In place of the former reknit.js, which wove the
// panes into a page template, this writes small files which the story page's Single File Components fetch:
//   - <out>/panes.json - one record per pane, in order of the `weight` of its front matter, holding its front matter,
//     its `paneKey`, the name of its file, and any members of its <viz_data>/<paneKey>-mapData.json
//   - <out>/<paneKey>.html - the section of each pane, without the pandoc page around it, and without the data of
//     its map widgets, which are folded into mapData.json
//   - <out>/<paneKey>-data.html - any widgets of a pane bearing an mx_widgetId, e.g. a chart driving a slider, which
//     are shown in the pane's data pane beside the map
//   - <out>/mapData.json - a single map style, holding every source and layer of every pane's map once, together
//     with the layers, camera and fill patterns of each pane
// Usage: node storyBuild.js <contentDir> <vizDataDir> <outDir>
// e.g. from a bioReportR project, node src/js/storyBuild.js content/story viz_data static/story
// This is notionally part of the bioReportR package, and is copied between
// bioReportR projects by copyFrameworkOut.sh

const fs = require("fs"),
    path = require("path"),
    yaml = require("js-yaml"),
    JSON5 = require("json5"),
    linkedom = require("linkedom");

/**
 * Load Infusion 6 for a project - from the checkout named for "infusion-6" by the project's moduleOverrides.json5, if
 * it has one, as do Infusion 6's tools run from its package.json, or else as installed by npm
 * @param {String} projectDir - The directory holding the project's package.json
 * @return {Object} Infusion 6's `fluid`
 */
const loadInfusion6 = function (projectDir) {
    const overridesFile = path.join(projectDir, "moduleOverrides.json5");
    const overrides = fs.existsSync(overridesFile) ? JSON5.parse(fs.readFileSync(overridesFile, "utf8")) : [];
    const override = overrides.find(entry => entry.moduleName === "infusion-6");
    return require(override ? path.resolve(projectDir, override.baseDir) : "infusion-6");
};

const fluid = loadInfusion6(path.resolve(__dirname, "../.."));

const bioreportr = fluid.registerNamespace("bioreportr");
fluid.registerNamespace("bioreportr.storyBuild");

/**
 * Copy an object, omitting some of its members.
 * @param {Object} record - The object
 * @param {String[]} keys - The members to be omitted
 * @return {Object} The copy
 */
bioreportr.storyBuild.censorKeys = (record, keys) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));

/**
 * Parse the YAML front matter of an R Markdown file.
 * @param {String} text - The text of the file
 * @return {Object} The front matter, or an empty object if there is none
 */
bioreportr.storyBuild.frontMatter = function (text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? yaml.load(match[1]) : {};
};

/**
 * Find the panes of a story, in order of the weight of their front matter.
 * @param {String} contentDir - The directory holding each pane's .Rmd file and the .html knitted from it
 * @return {Object[]} A record for each pane, with members `paneKey`, `htmlFile` and `frontMatter`
 */
bioreportr.storyBuild.findPanes = function (contentDir) {
    const panes = fs.readdirSync(contentDir).filter(file => file.endsWith(".Rmd")).map(file => {
        const paneKey = path.basename(file, ".Rmd");
        const frontMatter = bioreportr.storyBuild.frontMatter(fs.readFileSync(path.join(contentDir, file), "utf8"));
        return {paneKey, htmlFile: path.join(contentDir, paneKey + ".html"), frontMatter};
    }).filter(pane => fs.existsSync(pane.htmlFile));
    return panes.sort((a, b) => (parseFloat(a.frontMatter.weight) || 0) - (parseFloat(b.frontMatter.weight) || 0));
};

/**
 * Create an empty accumulation of the maps of a story's panes.
 * @return {Object} The accumulation, with members `sources`, `layers` and `panes`, each keyed by id
 */
bioreportr.storyBuild.makeMapData = function () {
    return {sources: {}, layers: {}, fillPatterns: {}, panes: {}};
};

/**
 * Remove the map widgets from a pane, folding their sources and layers into the accumulated map data. Each source
 * and layer is held once, however many panes' maps hold it. The plotly widgets which are not maps are left in place.
 * @param {Element} container - The pane's markup
 * @param {String} paneKey - The pane's key
 * @param {Object} mapData - The accumulated map data
 */
bioreportr.storyBuild.extractMaps = function (container, paneKey, mapData) {
    [...container.querySelectorAll(".html-widget.plotly")].forEach(widget => {
        const dataNode = widget.id ? container.querySelector(`[data-for="${widget.id}"]`) : null;
        const mapbox = dataNode ? JSON.parse(dataNode.textContent)?.x?.layout?.mapbox : null;
        if (mapbox) {
            Object.assign(mapData.sources, mapbox.style.sources);
            const paneLayers = {};
            mapbox.style.layers.forEach(layer => {
                mapData.layers[layer.id] = layer;
                paneLayers[layer.id] = 1;
                const fillPattern = layer.paint?.["fill-pattern"];
                if (fillPattern) {
                    mapData.fillPatterns[fillPattern] = 1;
                }
            });
            mapData.panes[mapbox.style.id || paneKey] = {layers: paneLayers, center: mapbox.center, zoom: mapbox.zoom};
            widget.remove();
            dataNode.remove();
        }
    });
};

/**
 * Remove from a pane the widgets bearing an `mx_widgetId` in their layout's metadata, e.g. a chart driving a slider,
 * which the story page shows in the pane's data pane beside the map rather than in its section.
 * @param {Element} container - The pane's markup, from which its maps have been removed
 * @return {Object} Members `markup`, the markup of the widgets together with their data, and `widgetIds`, their ids
 */
bioreportr.storyBuild.extractDataWidgets = function (container) {
    const widgetIds = [];
    const markup = [...container.querySelectorAll(".html-widget.plotly")].map(widget => {
        const dataNode = widget.id ? container.querySelector(`[data-for="${widget.id}"]`) : null;
        const widgetId = dataNode ? JSON.parse(dataNode.textContent)?.x?.layout?.meta?.mx_widgetId : null;
        let togo = "";
        if (widgetId) {
            widgetIds.push(widgetId);
            widget.setAttribute("data-widget-id", widgetId);
            togo = widget.outerHTML + dataNode.outerHTML;
            widget.remove();
            dataNode.remove();
        }
        return togo;
    }).join("\n");
    return {markup, widgetIds};
};

/**
 * Extract the section of a knitted pane, ready to be rendered by the story page. Its content other than its heading
 * is enclosed in a column, so that the page can lay it out beside the map, and any fixed dimensions are removed from
 * its plotly widgets, so that they can be resized.
 * @param {Document} document - The knitted pane
 * @param {String} paneKey - The pane's key
 * @param {Object} mapData - The accumulated map data, into which the pane's maps are folded
 * @return {Object} Members `section`, the markup of the pane's section, and `data`, the result of
 * `bioreportr.storyBuild.extractDataWidgets`
 */
bioreportr.storyBuild.extractSection = function (document, paneKey, mapData) {
    const container = document.querySelector(".main-container");
    container.querySelector("#header")?.remove();
    container.querySelectorAll(".html-widget.plotly").forEach(widget => widget.removeAttribute("style"));
    bioreportr.storyBuild.extractMaps(container, paneKey, mapData);
    const data = bioreportr.storyBuild.extractDataWidgets(container);
    const section = container.querySelector(".section.level2");
    section.classList.add("mxcw-paneKey-" + paneKey);
    const children = [...section.childNodes].filter(node => node.tagName !== "H2");
    const inner = document.createElement("div");
    inner.setAttribute("class", "mxcw-sectionInner");
    const column = document.createElement("div");
    column.setAttribute("class", "mxcw-sectionColumn");
    children.forEach(child => column.appendChild(child));
    inner.appendChild(column);
    section.appendChild(inner);
    return {section: section.outerHTML, data};
};

/**
 * Compose the accumulated map data into a single map style, with the layers highlighting a selection last.
 * @param {Object} mapData - The accumulated map data
 * @return {Object} The map data to be written, with members `style`, `panes` and `fillPatterns`
 */
bioreportr.storyBuild.composeMapData = function (mapData) {
    const layers = Object.values(mapData.layers);
    layers.sort((a, b) => (+a.id.endsWith("-highlight")) - (+b.id.endsWith("-highlight")));
    return {
        style: {version: 8, sources: mapData.sources, layers},
        panes: mapData.panes,
        fillPatterns: mapData.fillPatterns
    };
};

/**
 * Read the members of a pane's map data file which configure its pane, and the ids of its selectable layers.
 * @param {String} vizDataDir - The directory holding each pane's <paneKey>-mapData.json
 * @param {String} paneKey - The pane's key
 * @return {Object} Members `view` and `regionField` of the file, if any, and `selectableRegions`, the ids of its
 * layers marked as selectable
 */
bioreportr.storyBuild.paneMapData = function (vizDataDir, paneKey) {
    const file = path.join(vizDataDir, paneKey + "-mapData.json");
    let togo = {};
    if (fs.existsSync(file)) {
        const plotData = JSON5.parse(fs.readFileSync(file, "utf8"));
        togo = {
            ...(plotData.view ? {view: plotData.view} : {}),
            ...(plotData.regionField ? {regionField: plotData.regionField} : {}),
            selectableRegions: (plotData.layers || []).filter(layer => layer.metadata?.selectable).map(layer => layer.id)
        };
    }
    return togo;
};

bioreportr.storyBuild.isLocalRef = ref => !!ref && !/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(ref);

/**
 * Find the local files referred to by the images of a pane's section.
 * @param {String} section - The markup of the section
 * @return {String[]} The references, relative to the knitted pane
 */
bioreportr.storyBuild.localRefs = function (section) {
    const {document} = linkedom.parseHTML("<div>" + section + "</div>");
    return [...document.querySelectorAll("img[src], source[src]")].map(node => node.getAttribute("src")).filter(bioreportr.storyBuild.isLocalRef);
};

/**
 * Copy the files referred to by the panes and their maps, which are relative to the knitted panes, so that they lie at
 * the same paths relative to the material written.
 * @param {String} contentDir - The directory holding the knitted panes
 * @param {String} outDir - The directory to which the material is written
 * @param {Set<String>} assets - The references
 */
bioreportr.storyBuild.copyAssets = function (contentDir, outDir, assets) {
    assets.forEach(ref => {
        const from = path.join(contentDir, decodeURIComponent(ref));
        if (fs.existsSync(from)) {
            const to = path.join(outDir, decodeURIComponent(ref));
            fs.mkdirSync(path.dirname(to), {recursive: true});
            fs.copyFileSync(from, to);
            console.log("Copied " + from + " to " + to);
        } else {
            console.log("Warning: file " + from + " referred to by a pane was not found");
        }
    });
};

/**
 * Write a file, reporting its size.
 * @param {String} file - The file to be written
 * @param {String} text - Its text
 */
bioreportr.storyBuild.write = function (file, text) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text, "utf8");
    console.log("Written " + Buffer.byteLength(text) + " bytes to " + file);
};

/**
 * Build the material of a story map.
 * @param {String} contentDir - The directory holding the panes' .Rmd files and the .html knitted from them
 * @param {String} vizDataDir - The directory holding the panes' map data files
 * @param {String} outDir - The directory to which the material is written
 * @return {Object[]} The records written to panes.json
 */
bioreportr.storyBuild.build = function (contentDir, vizDataDir, outDir) {
    const mapData = bioreportr.storyBuild.makeMapData();
    const assets = new Set();
    const panes = bioreportr.storyBuild.findPanes(contentDir).map(({paneKey, htmlFile, frontMatter}) => {
        const {document} = linkedom.parseHTML(fs.readFileSync(htmlFile, "utf8"));
        const {section, data} = bioreportr.storyBuild.extractSection(document, paneKey, mapData);
        bioreportr.storyBuild.localRefs(section).forEach(ref => assets.add(ref));
        bioreportr.storyBuild.write(path.join(outDir, paneKey + ".html"), section + "\n");
        const dataFile = data.markup ? paneKey + "-data.html" : null;
        if (dataFile) {
            bioreportr.storyBuild.write(path.join(outDir, dataFile), "<div class=\"mxcw-dataPane-widgets\">" + data.markup + "</div>\n");
        }
        // The knit hook of the front matter is R's concern alone
        const rest = bioreportr.storyBuild.censorKeys(frontMatter, ["knit", "paneHandlerLayers"]);
        const paneHandlerLayers = frontMatter.paneHandlerLayers;
        return {...rest, ...bioreportr.storyBuild.paneMapData(vizDataDir, paneKey), paneKey, file: paneKey + ".html",
            dataFile, widgetIds: data.widgetIds, layers: paneHandlerLayers || []};
    });
    Object.values(mapData.sources).filter(source => source.type === "image" && bioreportr.storyBuild.isLocalRef(source.url))
        .forEach(source => assets.add(source.url));
    bioreportr.storyBuild.copyAssets(contentDir, outDir, assets);
    bioreportr.storyBuild.write(path.join(outDir, "panes.json"), JSON.stringify(panes, null, 2) + "\n");
    bioreportr.storyBuild.write(path.join(outDir, "mapData.json"), JSON.stringify(bioreportr.storyBuild.composeMapData(mapData)) + "\n");
    return panes;
};

module.exports = bioreportr.storyBuild;

if (require.main === module) {
    const [contentDir, vizDataDir, outDir] = process.argv.slice(2);
    if (outDir === undefined) {
        console.error("Usage: node storyBuild.js <contentDir> <vizDataDir> <outDir>");
        process.exitCode = 1;
    } else {
        bioreportr.storyBuild.build(contentDir, vizDataDir, outDir);
    }
}
