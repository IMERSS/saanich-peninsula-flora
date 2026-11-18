/*
Copyright 2026 IMERSS
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

// The summaries and behaviours particular to the story of the Saanich Peninsula's vascular plants which are not those
// of a single pane of its own - the formatting of its tables, the period of its records, the legend and markers of its
// map, and the opening of the extirpation risk pane on its top species. They are configured onto the story page by
// saanich-story.vue. The atlas and the panes this story shares with the other bioReportR stories are defined in
// static/bioreportr/sfc, e.g. bioreportr-atlasPanel.vue, and its pane in memory of Harvey Janszen beside saanich-story.vue

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");


// Show checklist entries under the project's accepted names, including annotations such as ssp. and var.
saanich.inatRowToScientific = hortis.rowToScientific;
hortis.rowToScientific = row => row.scientificName || saanich.inatRowToScientific(row);

/** Formatters of the cells of the tables **/

/**
 * Render the date of a record - iNaturalist's records carry a full timestamp, of which only the date is shown.
 * @param {String} value - The record's eventDate
 * @return {String} The markup of the cell
 */
saanich.formatDate = function (value) {
    return hortis.dataTable.encode(bioreportr.eventDay(value));
};

/**
 * Flag a taxon of which some records lack coordinates, and so cannot be mapped.
 * @param {Number} value - The number of the taxon's records without coordinates
 * @param {Object} row - The taxon's row, with `n_obs` its number of records
 * @return {String} The markup of the cell, empty if every record is georeferenced
 */
saanich.formatUnmapped = function (value, row) {
    return value > 0 ? `<span class="mxcw-georef-flag" title="${value} of ${row.n_obs} records have no coordinates">⚠ ${value}</span>` : "";
};

/**
 * Annotate each taxon with its number of records, and of those which can't be mapped.
 * @param {Object[]} taxaRows - The taxa
 * @param {VizPackage} pkg - The data package
 * @return {Object[]} The taxa, each copied with members `n_obs` and `n_unmapped`
 */
saanich.annotateGeoref = function (taxaRows, pkg) {
    const result = hortis.query(pkg, {from: "obs", groupBy: ["iNaturalistTaxonId"],
        measures: {total: {count: true}, unmapped: {count: true, filter: [{not: {all: bioreportr.coordinatePredicates}}]}}});
    const counts = new Map();
    for (let g = 0; g < result.groups; ++g) {
        counts.set(String(result.keys.iNaturalistTaxonId[g]), {total: result.measures.total[g], unmapped: result.measures.unmapped[g]});
    }
    return taxaRows.map(taxon => {
        const entry = counts.get(taxon.id) || {total: 0, unmapped: 0};
        return {...taxon, n_obs: entry.total, n_unmapped: entry.unmapped};
    });
};

/**
 * Find the first and last years of the records.
 * @param {VizPackage} pkg - The data package
 * @param {Object[]} [listedPredicates] - The predicates of the list's own records, which alone are counted - see
 * bioreportr.storyPage.listedPredicates
 * @return {Object} Members `first` and `last`, Infinity and -Infinity if no record has a year
 */
saanich.recordPeriod = function (pkg, listedPredicates = []) {
    const year = {year: "eventDate"};
    // Of the list's own records alone, not those of the taxa kept off it - see bioreportr.storyPage.listedPredicates
    const result = hortis.query(pkg, {from: "obs", where: listedPredicates, measures: {first: {min: year}, last: {max: year}}});
    return {first: isNaN(result.first) ? Infinity : result.first, last: isNaN(result.last) ? -Infinity : result.last};
};

/**
 * The period of the extirpation risk analysis, which always runs over the period of the records.
 * @param {Object} period - The period of the records, as returned by `saanich.recordPeriod`
 * @return {Object} The analysis's `baselineYear` and `analysisYear`, as for `bioreportr.solowBayesFactor`
 */
saanich.solowParams = period => ({baselineYear: period.first, analysisYear: period.last});

/** The markers of records on the map **/

/**
 * Determine whether markers are shown in place of the grid - whilst few enough records fall within the viewport. A
 * selected record keeps its marker at any zoom (see hortis.libreMap.markerRows), but zooming out until more records are
 * in view brings the grid back beneath it, rather than leaving the map empty but for that marker until it is deselected.
 * @param {Boolean} gridVisible - Whether the grid is visible
 * @param {Number} inView - The number of filtered records within the viewport
 * @param {Number} threshold - The number of records within the viewport at most which markers are shown
 * @param {Object|null} selectedRecord - The selected record, if any
 * @return {Boolean} `true` if markers are shown in place of the grid
 */
saanich.showMarkers = function (gridVisible, inView, threshold, selectedRecord) {
    return inView <= threshold && (!!selectedRecord || gridVisible && inView > 0);
};

/**
 * Render the legend of the map's grid, which counts records of every type of evidence, not only observations.
 * @param {...any} args - The arguments of hortis.libreMap.obsGridLegendMarkup
 * @return {String} The legend's markup
 */
saanich.obsGridLegendMarkup = function (...args) {
    return hortis.libreMap.obsGridLegendMarkup(...args)
        .replace("title=\"Number of observations falling within each grid cell\">Observation count", "title=\"Number of records falling within each grid cell\">Record count")
        .replace(/ observations"/g, " records\"");
};

/**
 * The first time the extirpation risk pane is shown with real data, select the species at the top of its list unless
 * one has already been chosen - the map is then fitted to its records, see bioreportr.atlas.fitToTaxon.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Boolean} isShown - Whether the pane is showing
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 * @param {Object[]} displayRows - The rows of the species list, in their displayed order
 */
saanich.selectTopSpecies = function (storyPage, isShown, loaded, displayRows) {
    if (isShown && loaded && !storyPage.topSpeciesSelected && displayRows.length > 0) {
        storyPage.topSpeciesSelected = true;
        // Deferred since an effect may not write signals
        fluid.invokeLater(() => {
            const table = storyPage.solowTaxa.taxaTable;
            if (!table.selectedRow) {
                table.selectedRow = displayRows[0];
            }
        });
    }
};

