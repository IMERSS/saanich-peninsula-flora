/*
Copyright 2026 IMERSS
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

/* global maplibregl */

// The panes and summaries particular to the story of the Saanich Peninsula's vascular plants, ported to Infusion 6 from
// the Infusion 4 static/local/js/saanich.js - the gallery of lost plants, the atlas's tiles, panel and tooltips of the
// groups of species, the summary of a map cell, the photographs of Harvey Janszen's pane, and the opening of the
// extirpation risk pane on its top species. They are configured onto the story page by saanich-story.vue

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

fluid.registerNamespace("saanich.lostPlants");
fluid.registerNamespace("saanich.atlas");
fluid.registerNamespace("saanich.statusTooltip");
fluid.registerNamespace("saanich.cellTooltip");
fluid.registerNamespace("saanich.remembering");

// Show checklist entries under the project's accepted names, including annotations such as ssp. and var.
saanich.inatRowToScientific = hortis.rowToScientific;
hortis.rowToScientific = row => row.scientificName || saanich.inatRowToScientific(row);

saanich.locale = "en-CA";

saanich.formatCount = count => count.toLocaleString(saanich.locale);

saanich.year = eventDate => String(eventDate ?? "").substring(0, 4);

saanich.obsDateComparator = (a, b) => a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0;

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
 * Note on each taxon of the summary its number of records and how many of them lack coordinates, for the table of
 * taxa. The rows are copied, with these display values held in the browser alone.
 * @param {TaxonRow[]} taxaRows - The taxa of the summary
 * @param {Object[]} obsRows - All records
 * @return {TaxonRow[]} The copied taxa, with members `n_obs` and `n_unmapped`
 */
saanich.annotateGeoref = function (taxaRows, obsRows) {
    const counts = new Map();
    obsRows.forEach(record => {
        const entry = counts.get(record.iNaturalistTaxonId) || {total: 0, unmapped: 0};
        entry.total++;
        entry.unmapped += bioreportr.hasCoordinates(record) ? 0 : 1;
        counts.set(record.iNaturalistTaxonId, entry);
    });
    return taxaRows.map(taxon => {
        const entry = counts.get(taxon.id) || {total: 0, unmapped: 0};
        return {...taxon, n_obs: entry.total, n_unmapped: entry.unmapped};
    });
};

/**
 * Group dated records by their taxon.
 * @param {Object[]} obsRows - All records
 * @return {Map<String, Object[]>} The dated records of each taxon id
 */
saanich.groupRecords = function (obsRows) {
    const byTaxon = new Map();
    obsRows.forEach(obs => {
        if (obs.eventDate) {
            const records = byTaxon.get(obs.iNaturalistTaxonId) || [];
            records.push(obs);
            byTaxon.set(obs.iNaturalistTaxonId, records);
        }
    });
    return byTaxon;
};

/**
 * Find the taxa of the summary holding a reporting status.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {String} status - The reporting status
 * @return {TaxonRow[]} The taxa
 */
saanich.taxaOfStatus = function (taxaRows, status) {
    return taxaRows.filter(taxon => taxon.inSummary && taxon.reportingStatus === status);
};

/** The gallery of lost plants **/

/**
 * Select the plants of the gallery from the site's data, highest extirpation probability first. A native species
 * which is historically reported but unconfirmed is shown if its Solow EP is at least `minEP` or it has no more than
 * `maxRecords` records.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Object[]} obsRows - All records
 * @param {Object} options - Members `minEP` and `maxRecords`
 * @return {Object[]} The selected plants, each with members `taxon`, `nRecords`, `nUnmapped` and `lastRecorded`
 */
saanich.lostPlants.select = function (taxaRows, obsRows, options) {
    const sightings = new Map();
    obsRows.forEach(obs => {
        const entry = sightings.get(obs.iNaturalistTaxonId) || {nRecords: 0, nUnmapped: 0, lastRecorded: NaN};
        const year = parseInt(obs.eventDate, 10);
        entry.nRecords++;
        entry.nUnmapped += bioreportr.hasCoordinates(obs) ? 0 : 1;
        entry.lastRecorded = Number.isNaN(entry.lastRecorded) ? year : Math.max(entry.lastRecorded, year || entry.lastRecorded);
        sightings.set(obs.iNaturalistTaxonId, entry);
    });
    return taxaRows
        .filter(taxon => taxon.inSummary && taxon.introduction_status === "native" && taxon.reportingStatus === "unconfirmed")
        .map(taxon => ({taxon, ...(sightings.get(taxon.id) || {nRecords: 0, nUnmapped: 0, lastRecorded: NaN})}))
        .filter(({taxon, nRecords}) => +taxon.solow_EP >= options.minEP || nRecords > 0 && nRecords <= options.maxRecords)
        .sort((a, b) => +b.taxon.solow_EP - +a.taxon.solow_EP || a.taxon.scientificName.localeCompare(b.taxon.scientificName));
};

/**
 * Find a photo of a taxon which may be republished. iNaturalist records no licence code for a photo with all rights
 * reserved, and photos licensed against derivatives are passed over since the gallery crops them to squares. The
 * taxon's default photo is preferred, followed by the others curated for it.
 * @param {Object} taxon - A taxon record from the iNaturalist API
 * @return {Object|undefined} The photo record, if there is an openly licensed one
 */
saanich.lostPlants.licensedPhoto = function (taxon) {
    const photos = [taxon.default_photo, ...(taxon.taxon_photos || []).map(entry => entry.photo)];
    return photos.find(photo => photo?.license_code && !photo.license_code.includes("-nd"));
};

/**
 * Render one plant of the gallery.
 * @param {Object} plant - A plant as selected by `saanich.lostPlants.select`
 * @param {Object} photo - Its photo record from the iNaturalist API
 * @return {String} The markup for the plant
 */
saanich.lostPlants.renderCard = function (plant, photo) {
    const encode = hortis.dataTable.encode;
    const name = encode(plant.taxon.scientificName);
    const details = [plant.taxon.commonName, plant.lastRecorded && "last recorded " + plant.lastRecorded].filter(Boolean).join(" · ");
    const unmapped = plant.nRecords > 0 && plant.nUnmapped === plant.nRecords ? "<span class=\"saanich-lost-unmapped\">⚠ no mapped records</span>" : "";
    const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
    return `<button type="button" class="saanich-lost-card" data-taxon-id="${encode(plant.taxon.id)}">
        <img src="${encode(photo.medium_url)}" alt="${name}" loading="lazy">
        <span class="saanich-lost-name">${name}</span>
        <span class="saanich-lost-details">${encode(details)}</span>
        ${unmapped}
        <span class="saanich-lost-credit">${encode(credit)}</span>
    </button>`;
};

/**
 * Fill the gallery with those selected plants which have an openly licensed photo, a batch at a time, observing
 * iNaturalist's requested limit of about one request per second. The cards are written to the component's `cards`
 * as each batch arrives. Nothing is fetched until the real data has loaded, and a later run supersedes an earlier.
 * @param {fluid.component} that - The component holding the gallery, with members `cards`, `batchSize` and `batchDelay`
 * @param {Object[]} plants - The plants, as selected by `saanich.lostPlants.select`
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 */
saanich.lostPlants.load = function (that, plants, loaded) {
    if (loaded) {
        saanich.lostPlants.fetchCards(that, plants);
    }
};

/**
 * Fetch the photos of the plants of a gallery from iNaturalist and render their cards - see `saanich.lostPlants.load`.
 * @param {fluid.component} that - The component holding the gallery
 * @param {Object[]} plants - The plants, as selected by `saanich.lostPlants.select`
 * @return {Promise} A promise which resolves once every batch has been fetched
 */
saanich.lostPlants.fetchCards = async function (that, plants) {
    const run = (saanich.lostPlants.runs.get(that) || 0) + 1;
    saanich.lostPlants.runs.set(that, run);
    const current = () => saanich.lostPlants.runs.get(that) === run;
    const {batchSize, batchDelay} = that;
    let cards = [];
    for (let start = 0; start < plants.length && current(); start += batchSize) {
        const batch = plants.slice(start, start + batchSize);
        const ids = batch.map(plant => plant.taxon.id).join(",");
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/taxa/${ids}?per_page=${batchSize}`);
            const taxa = (await response.json()).results;
            const photos = Object.fromEntries(taxa.map(taxon => [String(taxon.id), saanich.lostPlants.licensedPhoto(taxon)]));
            cards = cards.concat(batch.filter(plant => photos[plant.taxon.id]).map(plant => saanich.lostPlants.renderCard(plant, photos[plant.taxon.id])));
            if (current()) {
                that.cards = cards;
            }
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        } catch (error) {
            console.error("Could not fetch photos from iNaturalist", error);
            start = plants.length;
        }
    }
};

// The latest run of loading each gallery, so that a later run supersedes an earlier
saanich.lostPlants.runs = new WeakMap();

saanich.lostPlants.markup = cards => "<div class=\"saanich-lost-gallery\">" + cards.join("") + "</div>";

saanich.lostPlants.count = cards => String(cards.length);

/**
 * Open the extirpation risk pane with a plant chosen in the gallery selected, bringing its row into view.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} taxonId - The id of the plant's taxon
 * @param {String} targetPane - The key of the pane listing a species' records
 * @param {Document} dokkument - The document holding the story page
 * @param {Window} window - The window holding the story page
 */
saanich.lostPlants.showTaxon = function (storyPage, taxonId, targetPane, dokkument, window) {
    const table = storyPage.solowTaxa.taxaTable;
    const row = table.rows.find(candidate => candidate.id === taxonId);
    if (row) {
        storyPage.selectPane(targetPane);
        table.selectedRow = row;
        // Bring the selected row into view once the table has its size in the newly visible pane
        window.requestAnimationFrame(() => {
            const index = table.displayRows.indexOf(row);
            const scrollEl = dokkument.querySelector(".mxcw-solow-taxa .hortis-dataTable-scroll");
            if (index >= 0 && scrollEl) {
                scrollEl.scrollTop = index * table.rowHeight;
            }
        });
    }
};

/** The atlas's tiles of the three groups of species **/

saanich.statusColours = {confirmed: "#5a96d2", unconfirmed: "#decb90", new: "#7562b4"};

/**
 * Find the period covered by the dated records.
 * @param {Object[]} obsRows - All records
 * @return {Object} The earliest and latest years, as `first` and `last` - infinite while there are no dated records
 */
saanich.recordPeriod = function (obsRows) {
    return obsRows.reduce((period, obs) => {
        const year = parseInt(obs.eventDate, 10);
        return Number.isFinite(year) ? {first: Math.min(period.first, year), last: Math.max(period.last, year)} : period;
    }, {first: Infinity, last: -Infinity});
};

/**
 * The period of the extirpation risk analysis, which always runs over the period of the records.
 * @param {Object} period - The period of the records, as returned by `saanich.recordPeriod`
 * @return {Object} The analysis's `baselineYear` and `analysisYear`, as for `bioreportr.solowBayesFactor`
 */
saanich.solowParams = period => ({baselineYear: period.first, analysisYear: period.last});

/**
 * Divide a span of years into bins of equal width. There are always at least two, e.g. while the records are still
 * loading and the end of the span is unknown.
 * @param {Number} start - The first year of the first bin
 * @param {Number} end - The last year to be covered
 * @param {Number} width - The width of each bin in years
 * @return {Number[]} The first year of each bin
 */
saanich.atlas.yearBins = function (start, end, width) {
    const count = Number.isFinite(end) ? Math.ceil((end - start + 1) / width) : 0;
    return fluid.iota(Math.max(2, count)).map(index => start + index * width);
};

// Each tile is a link which selects its group, and carries a small chart of the question that matters for that group
saanich.atlas.tiles = [{
    status: "confirmed",
    name: "Confirmed",
    meaning: "Reported historically and found again since 2000.",
    caption: "First found again",
    bins: lastYear => saanich.atlas.yearBins(2000, lastYear, 5),
    year: records => parseInt(records.find(record => parseInt(record.eventDate, 10) >= 2000)?.eventDate, 10)
}, {
    status: "unconfirmed",
    name: "Historical",
    meaning: "Reported in the past but not recorded since 2000.",
    caption: "Last recorded",
    bins: () => saanich.atlas.yearBins(1860, 1999, 20),
    year: records => parseInt(fluid.peek(records).eventDate, 10)
}, {
    status: "new",
    name: "Newly reported",
    meaning: "Additions to the flora from recent reports.",
    caption: "Earliest record in this atlas",
    bins: lastYear => saanich.atlas.yearBins(2000, lastYear, 5),
    year: records => parseInt(records[0].eventDate, 10)
}];

/**
 * Render the tile for one group of species.
 * @param {Object} tile - One entry of `saanich.atlas.tiles`
 * @param {TaxonRow[]} taxa - The species of this group
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @param {Boolean} pressed - Whether the group is selected
 * @param {Number} lastYear - The latest year of the records
 * @return {String} The markup for the tile
 */
saanich.atlas.renderTile = function (tile, taxa, byTaxon, pressed, lastYear) {
    const bins = tile.bins(lastYear);
    const counts = bins.map(() => 0);
    const width = bins[1] - bins[0];
    taxa.forEach(taxon => {
        const records = byTaxon.get(taxon.id);
        const year = records ? tile.year(records.slice().sort(saanich.obsDateComparator)) : NaN;
        const index = Math.floor((year - bins[0]) / width);
        if (index >= 0 && index < counts.length) {
            counts[index]++;
        }
    });
    const max = Math.max(...counts, 1);
    const columns = counts.map(count => `<span style="height:${count / max * 100}%"></span>`).join("");
    // Each label starts beneath the bar for the period beginning in that year, and every other bar is labelled to leave room
    const axis = bins.filter((bin, index) => index % 2 === 0).map(bin => `<span>${bin}</span>`).join("");
    return `<button type="button" class="saanich-status-link saanich-status-tile" data-status="${tile.status}" aria-pressed="${pressed}" style="--tip-colour:${saanich.statusColours[tile.status]}">
        <span class="saanich-tile-name">${tile.name}</span>
        <span class="saanich-tile-count">${saanich.formatCount(taxa.length)} <small>species</small></span>
        <span class="saanich-tile-meaning">${tile.meaning}</span>
        <span class="saanich-tile-caption">${tile.caption}, species per ${width} years</span>
        <span class="saanich-tile-chart" style="--tile-bins:${counts.length}">${columns}</span>
        <span class="saanich-tile-axis" style="--tile-bins:${counts.length}">${axis}</span>
    </button>`;
};

/**
 * Render the tiles of the three groups of species, computed from the site's data.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @param {String|null} selectedStatus - The selected group, if any
 * @param {Number} lastYear - The latest year of the records
 * @return {String} The markup of the tiles
 */
saanich.atlas.tilesMarkup = function (taxaRows, byTaxon, selectedStatus, lastYear) {
    return saanich.atlas.tiles.map(tile => saanich.atlas.renderTile(tile, saanich.taxaOfStatus(taxaRows, tile.status), byTaxon,
        tile.status === selectedStatus, lastYear)).join("");
};

saanich.atlas.sectionInserts = (tiles, lostCount) => ({"saanich-status-tiles": tiles, "saanich-lost-count": lostCount});

/** The atlas's panel of the plant chosen in the checklist **/

/**
 * Resolve the taxon chosen in the checklist's search, whose state held in the URL records only its id.
 * @param {Object<String, TaxonRow>} rowById - Taxon rows indexed by id
 * @param {Object|null} search - The search's state, a taxon row or a record holding its `id`
 * @return {TaxonRow|null} The taxon's row, or null if none is chosen
 */
saanich.atlas.resolveTaxon = function (rowById, search) {
    return search && rowById[search.id] || null;
};

saanich.atlas.statusLabels = {confirmed: "Confirmed", unconfirmed: "Historical", new: "New"};

saanich.atlas.field = (label, value) => value ? `<dt>${label}:</dt> <dd>${hortis.dataTable.encode(value)}</dd>` : "";

/**
 * Find the dated records of a taxon and of any taxa beneath it, in date order.
 * @param {Object[]} obsRows - All records
 * @param {Object<String, TaxonRow>} rowById - Taxon rows indexed by id
 * @param {TaxonRow|null} taxon - The selected taxon
 * @return {Object[]} The records found
 */
saanich.atlas.taxonRecords = function (obsRows, rowById, taxon) {
    const isWithin = id => {
        let within = false;
        for (let row = rowById[id]; row && !within; row = row.parent) {
            within = row === taxon;
        }
        return within;
    };
    return taxon ? obsRows.filter(obs => obs.eventDate && isWithin(obs.iNaturalistTaxonId)).sort(saanich.obsDateComparator) : [];
};

/**
 * Render the panel of the plant or group chosen in the checklist.
 * @param {TaxonRow|null} taxon - The chosen taxon
 * @param {Object[]} records - Its dated records
 * @return {String} The panel's markup, empty if no taxon with records is chosen
 */
saanich.atlas.panelMarkup = function (taxon, records) {
    let togo = "";
    if (taxon && records.length > 0) {
        togo = `<div class="mxcw-solow-taxon-pane">
  <div class="mxcw-taxon-image">${hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)}</div>
  <div class="mxcw-taxon-info">
    <div class="mxcw-taxon-name">${hortis.dataTable.encode(taxon.scientificName || taxon.iNaturalistTaxonName)}</div>
    <dl class="mxcw-taxon-fields">
      ${saanich.atlas.field("Common name", taxon.commonName)}
      <dt>Date first seen:</dt> <dd>${bioreportr.eventDay(records[0].eventDate)}</dd>
      <dt>Date last seen:</dt> <dd>${bioreportr.eventDay(fluid.peek(records).eventDate)}</dd>
      <dt>Total records:</dt> <dd>${saanich.formatCount(records.length)}</dd>
      ${saanich.atlas.field("Status", saanich.atlas.statusLabels[taxon.reportingStatus])}
    </dl>
    ${bioreportr.georefNote(records)}
  </div>
</div>`;
    }
    return togo;
};

// The panel is shown only on the atlas pane and only while a plant with records is selected
saanich.atlas.panelVisible = (markup, activePaneKey, atlasPane) => !!markup && activePaneKey === atlasPane;

/** Summaries of the groups of species, shown on hovering over a tile or a row of the map's legend **/

/**
 * Render a set of horizontal bars.
 * @param {Array[]} entries - The bars to render, as [label, value, text] triples, `text` optionally replacing the value shown
 * @return {String} The markup for the bars
 */
saanich.statusTooltip.bars = function (entries) {
    const encode = hortis.dataTable.encode;
    const max = Math.max(...entries.map(([, value]) => value), 1);
    return `<div class="saanich-tip-bars">${entries.map(([label, value, text]) => `
        <span class="saanich-tip-label" title="${encode(label)}">${encode(label)}</span>
        <span class="saanich-tip-track"><span class="saanich-tip-bar" style="width:${value / max * 100}%"></span></span>
        <span class="saanich-tip-value">${text || saanich.formatCount(value)}</span>`).join("")}</div>`;
};

/**
 * Render a row of twelve columns, one for each month of the year.
 * @param {Number[]} counts - The value for each month
 * @return {String} The markup for the columns
 */
saanich.statusTooltip.months = function (counts) {
    const max = Math.max(...counts, 1);
    return `<div class="saanich-tip-months">${counts.map((count, month) => `
        <span class="saanich-tip-month" title="${count}"><span class="saanich-tip-column" style="height:${count / max * 100}%"></span><span>${"JFMAMJJASOND"[month]}</span></span>`).join("")}</div>`;
};

saanich.statusTooltip.frame = (name, count, body) =>
    `<div class="saanich-tip-title">${name} <span>${saanich.formatCount(count)} species</span></div>${body}`;

saanich.statusTooltip.heading = text => `<div class="saanich-tip-heading">${text}</div>`;

saanich.firstRecorder = record => (record.recordedBy || "Unknown").split(";")[0].trim() || "Unknown";

saanich.statusTooltip.renderers = {
    confirmed: function (taxa, byTaxon) {
        const bins = [["1–9", 1, 9], ["10–99", 10, 99], ["100–999", 100, 999], ["1,000+", 1000, Infinity]];
        const sizes = taxa.map(taxon => (byTaxon.get(taxon.id) || []).length);
        return saanich.statusTooltip.frame("Confirmed", taxa.length,
            saanich.statusTooltip.heading("Species by number of records") +
            saanich.statusTooltip.bars(bins.map(([label, min, max]) => [label, sizes.filter(size => size >= min && size <= max).length])));
    },
    new: function (taxa, byTaxon) {
        const reports = taxa.map(taxon => ({taxon, first: (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator)[0]})).filter(report => report.first);
        const counts = {};
        reports.forEach(report => {
            const recorder = saanich.firstRecorder(report.first);
            counts[recorder] = (counts[recorder] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const latest = reports.sort((a, b) => b.first.eventDate.localeCompare(a.first.eventDate)).slice(0, 3);
        return saanich.statusTooltip.frame("Newly reported", taxa.length,
            saanich.statusTooltip.heading("Observers with the earliest atlas record of the most species") + saanich.statusTooltip.bars(top) +
            saanich.statusTooltip.heading("Most recent additions, by earliest record in this atlas") +
            `<ul class="saanich-tip-list">${latest.map(report => `<li><i>${hortis.dataTable.encode(report.taxon.scientificName)}</i> ${saanich.year(report.first.eventDate)}, ${hortis.dataTable.encode(saanich.firstRecorder(report.first))}</li>`).join("")}</ul>`);
    },
    unconfirmed: function (taxa, byTaxon) {
        const eras = [["Before 1900", 0, 1899], ["1900–1949", 1900, 1949], ["1950–1979", 1950, 1979], ["1980–1999", 1980, 1999]];
        const records = taxa.map(taxon => (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator)).filter(list => list.length > 0);
        const lastYear = list => parseInt(fluid.peek(list).eventDate, 10);
        const months = new Array(12).fill(0);
        records.flat().forEach(record => {
            const month = parseInt(record.eventDate.substring(5, 7), 10);
            if (month >= 1 && month <= 12) {
                months[month - 1]++;
            }
        });
        const withLocality = records.filter(list => list.some(record => record.locality)).length;
        const withSpecimen = records.filter(list => list.some(record => /specimen/i.test(record.basisOfRecord))).length;
        return saanich.statusTooltip.frame("Historical", taxa.length,
            saanich.statusTooltip.heading("Species by when last recorded") +
            saanich.statusTooltip.bars(eras.map(([label, min, max]) => [label, records.filter(list => lastYear(list) >= min && lastYear(list) <= max).length])) +
            saanich.statusTooltip.heading("Past records by month, a guide to when to look") + saanich.statusTooltip.months(months) +
            `<div class="saanich-tip-note">${withLocality} species have a recorded locality to search, and ${withSpecimen} have a specimen to consult.</div>`);
    }
};

/**
 * Render the summary of a group of species. Each summary is rendered once, since it depends only on the site's data.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @param {Object<String, String>} cache - The summaries already rendered, by status
 * @param {String} status - The group's reporting status
 * @return {String|null} The summary's markup, or null if there is no such group
 */
saanich.statusTooltip.render = function (taxaRows, byTaxon, cache, status) {
    const renderer = saanich.statusTooltip.renderers[status];
    if (renderer && !cache[status]) {
        cache[status] = `<div class="saanich-tip saanich-tip-visible" style="--tip-colour:${saanich.statusColours[status]}">` +
            renderer(saanich.taxaOfStatus(taxaRows, status), byTaxon) + "</div>";
    }
    return cache[status] || null;
};

saanich.statusTooltip.makeCache = () => ({});

/**
 * Find which group of species an element in the page refers to, if any - a tile of the atlas or a row of the legend
 * of a map coloured by status.
 * @param {Element} element - The element under the pointer
 * @return {String|null} The group's reporting status, or null if there is none
 */
saanich.statusTooltip.statusFor = function (element) {
    const link = element.closest?.(".saanich-status-link");
    const row = element.closest?.(".mxcw-map .mxcw-region-legend [data-selects=\"status\"]");
    return link ? link.dataset.status : row ? row.dataset.key : null;
};

/**
 * Report the group of species under the pointer to the tooltip. The listeners are bound to the document, since the
 * tiles and the legend are rerendered beneath them.
 * @param {fluid.component} that - The tooltip, a hortis.withTooltip
 * @param {Document} dokkument - The document
 * @return {Object} A record of the listeners, to be supplied to `saanich.statusTooltip.unbind`
 */
saanich.statusTooltip.bind = function (that, dokkument) {
    const move = event => that.hoverAt(saanich.statusTooltip.statusFor(event.target), event);
    const leave = event => {
        if (!event.relatedTarget || !saanich.statusTooltip.statusFor(event.relatedTarget)) {
            that.hoverAt(null);
        }
    };
    dokkument.addEventListener("mousemove", move);
    dokkument.addEventListener("mouseout", leave);
    return {dokkument, move, leave};
};

saanich.statusTooltip.unbind = function (record) {
    record.dokkument.removeEventListener("mousemove", record.move);
    record.dokkument.removeEventListener("mouseout", record.leave);
};

/** The summary of a map cell **/

saanich.cellTooltip.statuses = [["unconfirmed", "Historical"], ["new", "Newly reported"], ["confirmed", "Confirmed"]];

saanich.cellTooltip.plural = (count, noun) => `${saanich.formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;

saanich.cellTooltip.section = (heading, status, body) =>
    `<div class="saanich-cell-section" style="--tip-colour:${saanich.statusColours[status]}">${saanich.statusTooltip.heading(heading)}${body}</div>`;

/**
 * Find the earliest record of each taxon across the whole atlas, whatever filters are applied.
 * @param {Object[]} obsRows - All records
 * @return {Map<String, Object>} The earliest record of each taxon id
 */
saanich.cellTooltip.earliestRecords = function (obsRows) {
    const earliest = new Map();
    obsRows.forEach(record => {
        const current = earliest.get(record.iNaturalistTaxonId);
        if (record.eventDate && (!current || record.eventDate < current.eventDate)) {
            earliest.set(record.iNaturalistTaxonId, record);
        }
    });
    return earliest;
};

/**
 * Render the summary of a grid cell, leading with what matters most to the search for lost plants: the historical
 * species recorded there, followed by what has newly been found there and what is well documented. This replaces
 * hortis.renderVizGridTooltip, which listed taxa alone.
 * @param {Object} grid - The grid of records, whose buckets index the records gridded
 * @param {Object<String, TaxonRow>} rowById - Taxon rows indexed by id
 * @param {Object[]} gridRows - The records gridded, which the grid's buckets index
 * @param {Map<String, Object>} earliest - The earliest record of each taxon across the atlas
 * @param {String} cellId - The id of the cell
 * @return {String|null} The markup for the summary, or null if the cell holds no records
 */
saanich.cellTooltip.render = function (grid, rowById, gridRows, earliest, cellId) {
    const bucket = grid.buckets[cellId];
    let togo = null;
    if (bucket) {
        const encode = hortis.dataTable.encode;
        const plants = Object.entries(bucket.byTaxonId).filter(([taxonId]) => rowById[taxonId]).map(([taxonId, obsIndices]) => {
            const records = obsIndices.map(index => gridRows[index]).filter(record => record?.eventDate).sort(saanich.obsDateComparator);
            return {taxon: rowById[taxonId], count: obsIndices.length, first: records[0], last: fluid.peek(records)};
        });
        const inStatus = status => plants.filter(plant => plant.taxon.reportingStatus === status);
        const name = plant => plant.taxon.scientificName || plant.taxon.iNaturalistTaxonName;
        const more = (list, shown) => list.length > shown ? `<div class="saanich-tip-note">and ${list.length - shown} more</div>` : "";
        const recorder = plant => (plant.last?.recordedBy || "").split(";")[0].trim();

        const segments = saanich.cellTooltip.statuses.map(([status, label]) => ({status, label, count: inStatus(status).length})).filter(segment => segment.count > 0);
        const colour = segment => saanich.statusColours[segment.status];
        const bars = segments.map(segment => `<span style="flex:${segment.count};background:${colour(segment)}"></span>`).join("");
        const keys = segments.map(segment => `<span><i style="background:${colour(segment)}"></i>${segment.label} ${segment.count}</span>`).join("");
        const stack = `<div class="saanich-cell-stack">${bars}</div><div class="saanich-cell-key">${keys}</div>`;

        const historical = inStatus("unconfirmed").sort((a, b) => +b.taxon.solow_EP - +a.taxon.solow_EP);
        // A newly reported species is identified by its earliest record anywhere, not by whatever was last seen in this cell
        const fresh = inStatus("new").map(plant => ({...plant, earliest: earliest.get(plant.taxon.id)})).filter(plant => plant.earliest)
            .sort((a, b) => b.earliest.eventDate.localeCompare(a.earliest.eventDate));
        const confirmed = inStatus("confirmed").sort((a, b) => b.count - a.count);

        const sections = [
            historical.length && saanich.cellTooltip.section("Lost plants recorded here: records, and year last seen", "unconfirmed",
                saanich.statusTooltip.bars(historical.slice(0, 4).map(plant => [name(plant), plant.count,
                    `${plant.count} · ${plant.last ? saanich.year(plant.last.eventDate) : "?"}`])) + more(historical, 4)),
            fresh.length && saanich.cellTooltip.section("Newly reported species here: earliest record in this atlas", "new",
                `<ul class="saanich-tip-list">${fresh.slice(0, 3).map(plant => `<li><i>${encode(name(plant))}</i> ${saanich.year(plant.earliest.eventDate)}${recorder(plant) ? ", " + encode(recorder(plant)) : ""}${plant.first?.eventDate === plant.earliest.eventDate ? " (here)" : ""}</li>`).join("")}</ul>` + more(fresh, 3)),
            confirmed.length && saanich.cellTooltip.section("Most recorded confirmed species", "confirmed",
                saanich.statusTooltip.bars(confirmed.slice(0, 3).map(plant => [name(plant), plant.count])) + more(confirmed, 3))
        ].filter(Boolean).join("");

        togo = `<div class="saanich-cell-tip">
            <div class="saanich-tip-title">${saanich.formatCount(plants.length)} species <span>${saanich.cellTooltip.plural(bucket.obsCount, "record")}</span></div>
            ${stack}${sections}
        </div>`;
    }
    return togo;
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

/** The pane in memory of Harvey Janszen **/

saanich.remembering.imagePath = "../local/images/remembering/";

saanich.remembering.journals = [
    {file: "1973-1981.png", caption: "Flora of Saturna, ca. 1973–1981"},
    {file: "1981-1996.png", caption: "Journal, ca. 1981–1996"},
    {file: "1996-2000.png", caption: "Journal, ca. 1996–2000"},
    {file: "1999-2003.png", caption: "Unbound field notes, ca. 1999–2003"},
    {file: "2003-2017.png", caption: "Field notes, ca. 2003–2017"}
];

saanich.remembering.renderFigure = function (file, caption, className, alt = caption) {
    return `<figure class="${className}"><img src="${saanich.remembering.imagePath}${file}" alt="${alt}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
};

saanich.remembering.markup = `<div class="saanich-remembering">
    <div class="saanich-remembering-photos">
        ${saanich.remembering.renderFigure("harvey-and-hannah.jpg", "Harvey Janszen and Hannah Carpendale searching for <i>Platanthera unalascensis</i> on Stockade Hill, Galiano Island, July 2020",
        "saanich-remembering-lead", "Harvey Janszen and Hannah Carpendale searching for an orchid on Stockade Hill, Galiano Island")}
        ${saanich.remembering.renderFigure("HJ.png", "Harvey Janszen, Galiano Island, May 3, 2019", "saanich-remembering-portrait")}
    </div>
    <h3>Harvey’s field journals</h3>
    <div class="saanich-remembering-journals">
        ${saanich.remembering.journals.map(journal => saanich.remembering.renderFigure(journal.file, journal.caption, "saanich-remembering-journal")).join("")}
    </div>
</div>`;

saanich.remembering.getMarkup = () => saanich.remembering.markup;

saanich.paneMarkup = (galleryMarkup, rememberingMarkup) => ({LostPlants: galleryMarkup, Remembering: rememberingMarkup});

/** Clicks and the opening of the extirpation risk pane **/

/**
 * Handle a click within a pane - on a tile of the atlas, which selects or clears its group of species, or on a plant of
 * the gallery, which opens the extirpation risk pane on it.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Event} event - The click
 * @param {String} targetPane - The key of the pane listing a species' records
 * @param {Window} window - The window holding the story page
 */
saanich.paneClick = function (storyPage, event, targetPane, window) {
    const tile = event.target.closest(".saanich-status-link");
    const card = event.target.closest(".saanich-lost-card");
    if (tile) {
        const status = tile.dataset.status;
        storyPage.selectedStatus = storyPage.selectedStatus === status ? null : status;
    } else if (card) {
        saanich.lostPlants.showTaxon(storyPage, card.dataset.taxonId, targetPane, event.target.ownerDocument, window);
    }
};

// The story pages whose extirpation risk pane has been opened on its top species
saanich.topSpeciesSelected = new WeakSet();

/**
 * The first time the extirpation risk pane is shown with real data, select the species at the top of its list unless
 * one has already been chosen, and have the map fitted to its records - see `saanich.fitToTaxon`.
 * @param {bioreportr.storyPage} storyPage - The story page, whose `solowFitTaxon` is written with a request to fit the species
 * @param {Boolean} isShown - Whether the pane is showing
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 * @param {Object[]} displayRows - The rows of the species list, in their displayed order
 */
saanich.selectTopSpecies = function (storyPage, isShown, loaded, displayRows) {
    if (isShown && loaded && !saanich.topSpeciesSelected.has(storyPage) && displayRows.length > 0) {
        saanich.topSpeciesSelected.add(storyPage);
        // Deferred since an effect may not write signals
        fluid.invokeLater(() => {
            const table = storyPage.solowTaxa.taxaTable;
            if (!table.selectedRow) {
                table.selectedRow = displayRows[0];
                storyPage.solowFitTaxon = {taxon: displayRows[0]};
            }
        });
    }
};

/**
 * Fit the map to the records of a taxon which have coordinates. Each request is a fresh object, so that the same taxon
 * may be fitted again after the map has moved.
 * @param {maplibregl.Map} map - The story's map, once its style has applied
 * @param {Object|null} request - The request, holding the taxon's row as `taxon`, or null if the map is not to be fitted
 * @param {Object[]} obsRows - All records
 * @param {Number} duration - The duration in milliseconds of the map's smooth move to the records
 */
saanich.fitToTaxon = function (map, request, obsRows, duration) {
    const taxon = request?.taxon;
    // The map may only just have been shown, in a pane which hid it
    map.resize();
    const points = taxon ? bioreportr.solowObsForTaxon(obsRows, taxon).map(bioreportr.obsPoint).filter(point => point) : [];
    if (points.length > 0) {
        const bounds = points.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(points[0], points[0]));
        map.fitBounds(bounds, {padding: 80, maxZoom: 11, duration, essential: true});
    }
};

/** The opening timeline, in memory of plants **/

// The opening pane of the story: plants' key moments appear across the landscape as a timeline plays, starting from a
// random year on each visit. Everything is derived from the site's data whenever it loads
fluid.registerNamespace("saanich.traces");

saanich.traces.kinds = {
    first: {
        label: "First noted",
        significance: "The earliest record of this plant in the atlas.",
        icon: `<path d="M12 3 C18 8 18 15 12 21 C6 15 6 8 12 3 Z" fill="#dfeef3" fill-opacity="0.3" stroke="#dfeef3" stroke-width="1.4"/>`
    },
    found: {
        label: "Seen again",
        significance: "The first record since 2000 of a plant known from earlier reports.",
        icon: `<path d="M12 22V12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><path d="M12 12C12 7 8 5 3 5C3 10 7 13 12 12Z" fill="#5a96d2" stroke="#ffffff" stroke-width="1"/><path d="M12 12C12 7 16 5 21 5C21 10 17 13 12 12Z" fill="#5a96d2" stroke="#ffffff" stroke-width="1"/>`
    },
    last: {
        label: "Last seen",
        significance: "The last known record in this atlas. Is it still out there?",
        icon: `<g fill="none" stroke="#decb90" stroke-width="1.4" stroke-linecap="round"><path d="M12 23V3"/><path d="M12 9L6 4M12 9L18 4M12 15L5 10M12 15L19 10"/></g><g fill="#decb90"><circle cx="6" cy="4" r="1.5"/><circle cx="19" cy="10" r="1.5"/></g>`
    },
    fresh: {
        label: "Newly noticed",
        significance: "The earliest record in this atlas of a plant newly added to the flora.",
        icon: `<g fill="#7562b4" stroke="#ffffff" stroke-width="0.9"><path d="M12 12C7 9 8 3 12 1.5C16 3 17 9 12 12Z"/><path d="M12 12C17 9 22 12 22 17C18 21 13 17 12 12Z"/><path d="M12 12C7 9 2 12 2 17C6 21 11 17 12 12Z"/></g><circle cx="12" cy="12" r="2.2" fill="#FDF2CE"/>`
    }
};

saanich.traces.icon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true">${saanich.traces.kinds[kind].icon}</svg>`;

// How many seconds a marker takes to fade away: the last record of a plant lingers
saanich.traces.life = kind => kind === "last" ? 18 : 12;

saanich.traces.playIcons = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>`
};

/**
 * One key moment in the record of a species, shown as a marker on the map.
 * @typedef {Object} TraceEvent
 * @property {TaxonRow} taxon - The species
 * @property {String} kind - The kind of moment, a key of `saanich.traces.kinds`
 * @property {Object} record - The record of the moment
 * @property {Number} year - The year of the record
 */

/**
 * Derive the events of the timeline: each marks a key moment in the record of a species, and is shown only if the record
 * concerned can be mapped. A record which is both the first and last of a lost plant appears once, as its last.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @return {TraceEvent[]} The events, in date order
 */
saanich.traces.buildEvents = function (taxaRows, byTaxon) {
    const events = [];
    const add = (taxon, kind, record) => {
        if (record && bioreportr.hasCoordinates(record)) {
            events.push({taxon, kind, record, year: parseInt(record.eventDate, 10)});
        }
    };
    taxaRows.filter(taxon => taxon.inSummary).forEach(taxon => {
        const records = (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator);
        if (records.length > 0) {
            const first = records[0], last = fluid.peek(records);
            if (taxon.reportingStatus === "unconfirmed") {
                add(taxon, "last", last);
                add(taxon, "first", first === last ? null : first);
            } else if (taxon.reportingStatus === "confirmed") {
                const found = records.find(record => parseInt(record.eventDate, 10) >= 2000);
                add(taxon, "found", found);
                add(taxon, "first", first === found ? null : first);
            } else if (taxon.reportingStatus === "new") {
                add(taxon, "fresh", first);
            }
        }
    });
    return events.filter(event => Number.isFinite(event.year)).sort((a, b) => saanich.obsDateComparator(a.record, b.record));
};

/**
 * Format the date of a record in full, or as its year alone if it has no day.
 * @param {String} eventDate - The date of the record
 * @return {String} The formatted date
 */
saanich.traces.formatDate = function (eventDate) {
    const [year, month, day] = eventDate.substring(0, 10).split("-").map(Number);
    return day ? new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(saanich.locale, {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"}) :
        String(year);
};

/**
 * Render the card shown on hovering over a marker, with a space for its photo.
 * @param {TraceEvent} event - The event of the marker
 * @return {String} The markup of the card
 */
saanich.traces.renderCard = function (event) {
    const {taxon, kind, record} = event;
    const encode = hortis.dataTable.encode;
    const recorder = (record.recordedBy || "").split(";")[0].trim();
    const common = taxon.commonName ? `<div class="saanich-trace-common">${encode(taxon.commonName)}</div>` : "";
    const place = record.locality ? `<div>${encode(record.locality)}</div>` : "";
    return `<div class="saanich-trace-photo"></div><div class="saanich-trace-kind" data-kind="${kind}">${saanich.traces.icon(kind)}${saanich.traces.kinds[kind].label}</div>
        <div class="saanich-trace-name">${encode(taxon.scientificName)}</div>${common}
        <div>${saanich.traces.formatDate(record.eventDate)}${recorder ? ", " + encode(recorder) : ""}</div>${place}
        <div class="saanich-trace-significance">${saanich.traces.kinds[kind].significance}</div>
        <div class="saanich-trace-action">Click to find this plant &rarr;</div>`;
};

/**
 * Compute the classes of the story's left pane while the timeline shows: the map takes the whole column, and its
 * markers freeze while the timeline is paused or being dragged.
 * @param {Boolean} active - Whether the timeline's pane is showing
 * @param {Boolean} paused - Whether the timeline is paused
 * @param {Boolean} scrubbing - Whether the timeline's slider is being dragged
 * @return {String} The classes
 */
saanich.traces.leftPaneClass = function (active, paused, scrubbing) {
    const classes = [];
    if (active) {
        classes.push("saanich-traces-active");
    }
    if (active && (paused || scrubbing)) {
        classes.push("saanich-traces-still");
    }
    return classes.join(" ");
};

/**
 * The state of the playback of a timeline, which runs outside the framework on timers and on markers of the map.
 * @typedef {Object} TraceState
 * @property {bioreportr.storyPage} storyPage - The story page
 * @property {maplibregl.Map} map - The story's map
 * @property {Window} window - The window holding the story page
 * @property {TraceEvent[]} events - The events, in date order
 * @property {Number} firstYear - The year of the earliest event
 * @property {Number} lastYear - The year of the latest event
 * @property {Number} index - The index of the next event to be shown
 * @property {Set<maplibregl.Marker>} markers - The markers on the map
 * @property {Number} holding - The number of markers, or the card, on which the pointer rests, which holds the timeline while positive
 * @property {Number|null} timer - The timer of the next step
 * @property {TraceEvent|null} cardEvent - The event whose card is shown
 * @property {Number|null} hideTimer - The timer hiding the card once the pointer has left it and its marker
 * @property {HTMLElement|null} heldMarker - The element of the marker whose card is shown
 * @property {Object} overlay - The elements which change during playback - `year`, `play`, `slider` and `card`
 */

// The state of each timeline, by its component
saanich.traces.states = new WeakMap();

/**
 * Create the elements laid over the map: the year, the controls of the timeline, the key and the card shown on hover.
 * @param {HTMLElement} mapElement - The element holding the map
 * @param {Number} firstYear - The year of the earliest event
 * @param {Number} lastYear - The year of the latest event
 * @return {Object} The elements which change during playback
 */
saanich.traces.createOverlay = function (mapElement, firstYear, lastYear) {
    const dokkument = mapElement.ownerDocument;
    const overlay = dokkument.createElement("div");
    overlay.className = "saanich-traces-overlay";
    overlay.innerHTML = `<div class="saanich-traces-year"></div>
        <div class="saanich-traces-controls">
            <button type="button" class="saanich-traces-play"></button>
            <input type="range" class="saanich-traces-slider" min="${firstYear}" max="${lastYear}" step="1" aria-label="Year">
        </div>
        <div class="saanich-traces-key">${["last", "first", "found", "fresh"].map(kind =>
        `<span data-kind="${kind}">${saanich.traces.icon(kind)}${saanich.traces.kinds[kind].label}</span>`).join("")}</div>`;
    mapElement.appendChild(overlay);
    const card = dokkument.createElement("div");
    card.className = "saanich-trace-card";
    card.setAttribute("role", "tooltip");
    dokkument.body.appendChild(card);
    return {year: overlay.querySelector(".saanich-traces-year"), play: overlay.querySelector(".saanich-traces-play"),
        slider: overlay.querySelector(".saanich-traces-slider"), card};
};

/**
 * Show on the play button whether the timeline is paused.
 * @param {fluid.component} that - The timeline
 * @param {Boolean} paused - Whether the timeline is paused
 */
saanich.traces.showPlayback = function (that, paused) {
    const state = saanich.traces.states.get(that);
    if (state) {
        const {play} = state.overlay, action = paused ? "Play" : "Pause";
        play.innerHTML = saanich.traces.playIcons[action.toLowerCase()];
        play.setAttribute("aria-label", action);
        play.title = action;
    }
};

/**
 * Bind the play button and the slider. Playback holds while the slider is dragged, and carries on from the new position
 * when it is let go.
 * @param {fluid.component} that - The timeline, whose `paused` and `scrubbing` are written
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.bindControls = function (that, state) {
    const {play, slider} = state.overlay;
    const release = () => {
        that.scrubbing = false;
    };
    play.addEventListener("click", () => {
        that.paused = !that.paused;
    });
    slider.addEventListener("pointerdown", () => {
        that.scrubbing = true;
    });
    slider.addEventListener("input", () => {
        that.scrubbing = true;
        saanich.traces.seek(state, Number(slider.value));
    });
    slider.addEventListener("change", release);
    // Not on the slider, since the pointer may be let go anywhere and a click which moves nothing fires no change
    state.window.addEventListener("pointerup", release);
    state.window.addEventListener("pointercancel", release);
};

/**
 * Show a year on the timeline's label and slider.
 * @param {TraceState} state - The state of the playback
 * @param {Number} year - The year
 */
saanich.traces.showYear = function (state, year) {
    const {year: label, slider} = state.overlay;
    label.textContent = year;
    slider.value = year;
    slider.style.setProperty("--saanich-progress", ((year - state.firstYear) / Math.max(1, state.lastYear - state.firstYear) * 100) + "%");
};

/**
 * Show the card of a marker beside it, on whichever side it fits.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event of the marker
 * @param {HTMLElement} element - The element of the marker
 */
saanich.traces.showCard = function (state, event, element) {
    const {card} = state.overlay, {innerWidth, innerHeight} = state.window;
    saanich.traces.cancelHide(state);
    saanich.traces.holdMarker(state, element);
    card.innerHTML = saanich.traces.renderCard(event);
    card.classList.add("saanich-trace-card-visible");
    const anchor = element.getBoundingClientRect(), box = card.getBoundingClientRect();
    // Close beside the marker, so that the pointer can cross to the card before it hides
    const gap = saanich.traces.cardGap;
    const fitsRight = anchor.right + gap + box.width <= innerWidth - 8;
    card.style.left = (fitsRight ? anchor.right + gap : Math.max(8, anchor.left - box.width - gap)) + "px";
    card.style.top = Math.min(Math.max(8, anchor.top - 16), innerHeight - box.height - 8) + "px";
    saanich.traces.loadPhoto(state, event);
};

// The lookups of each taxon's photo, by taxon id
saanich.traces.photos = new Map();

/**
 * Look up an openly licensed photo of a taxon on iNaturalist, once only for each taxon.
 * @param {String} taxonId - The id of the taxon
 * @param {Function} fetch - The window's `fetch`
 * @return {Promise<Object|undefined>} Resolves to the photo record, or undefined if there is none or it cannot be fetched
 */
saanich.traces.photoFor = function (taxonId, fetch) {
    if (!saanich.traces.photos.has(taxonId)) {
        saanich.traces.photos.set(taxonId, fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`)
            .then(response => response.json())
            .then(body => saanich.lostPlants.licensedPhoto(body.results[0]))
            .catch(() => undefined));
    }
    return saanich.traces.photos.get(taxonId);
};

/**
 * Fill in the photo of the card being shown, unless another card has replaced it in the meantime.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event shown on the card
 */
saanich.traces.loadPhoto = function (state, event) {
    const encode = hortis.dataTable.encode;
    state.cardEvent = event;
    saanich.traces.photoFor(event.taxon.id, state.window.fetch.bind(state.window)).then(photo => {
        const holder = state.overlay.card.querySelector(".saanich-trace-photo");
        if (state.cardEvent === event && holder) {
            if (photo) {
                const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
                holder.innerHTML = `<img src="${encode(photo.medium_url)}" alt=""><span>${encode(credit)}</span>`;
            } else {
                holder.remove();
            }
        }
    });
};

// The distance in pixels between a marker and its card
saanich.traces.cardGap = 4;

// The time in milliseconds for which a card stays once the pointer has left its marker, so that it may be reached
saanich.traces.hideDelay = 350;

saanich.traces.hideCard = function (state) {
    saanich.traces.cancelHide(state);
    saanich.traces.holdMarker(state, null);
    state.overlay.card.classList.remove("saanich-trace-card-visible");
};

saanich.traces.cancelHide = function (state) {
    state.window.clearTimeout(state.hideTimer);
    state.hideTimer = null;
};

/**
 * Hide the card once the pointer has stayed away from both it and its marker for a moment.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.scheduleHide = function (state) {
    saanich.traces.cancelHide(state);
    state.hideTimer = state.window.setTimeout(() => saanich.traces.hideCard(state), saanich.traces.hideDelay);
};

/**
 * Hold the marker whose card is shown, so that it doesn't fade away whilst the pointer is on the card.
 * @param {TraceState} state - The state of the playback
 * @param {HTMLElement|null} element - The marker's element, or null if no card is shown
 */
saanich.traces.holdMarker = function (state, element) {
    if (state.heldMarker && state.heldMarker !== element) {
        state.heldMarker.classList.remove("saanich-trace-held");
    }
    state.heldMarker = element;
    if (element) {
        element.classList.add("saanich-trace-held");
    }
};

/**
 * Bind the card, which holds the timeline while the pointer rests on it, and opens its species when clicked.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.bindCard = function (state) {
    const {card} = state.overlay;
    card.addEventListener("mouseenter", () => {
        state.holding++;
        saanich.traces.cancelHide(state);
    });
    card.addEventListener("mouseleave", () => {
        state.holding = Math.max(0, state.holding - 1);
        saanich.traces.scheduleHide(state);
    });
    card.addEventListener("click", () => {
        if (state.cardEvent) {
            const taxon = state.cardEvent.taxon;
            saanich.traces.hideCard(state);
            saanich.traces.openTaxon(state.storyPage, taxon, state.window);
        }
    });
};

/**
 * Open the extirpation risk pane on a species, with its row in view and the map fitted to its records.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {TaxonRow} taxon - The species
 * @param {Window} window - The window holding the story page
 */
saanich.traces.openTaxon = function (storyPage, taxon, window) {
    saanich.lostPlants.showTaxon(storyPage, taxon.id, "Solow", window.document, window);
    // Once the map has taken up its size in the newly visible pane
    window.requestAnimationFrame(() => {
        const row = storyPage.solowTaxa.taxaTable.selectedRow;
        if (row) {
            storyPage.solowFitTaxon = {taxon: row};
        }
    });
};

/**
 * Place the marker for one event on the map. It fades away by itself, unless held open by the pointer resting on it.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event to show
 * @param {Number} [age] - How many seconds into its fade the marker should begin
 */
saanich.traces.addMarker = function (state, event, age = 0) {
    const element = state.window.document.createElement("div");
    element.className = "saanich-trace";
    element.dataset.kind = event.kind;
    element.innerHTML = `<div class="saanich-trace-mark" style="animation-duration: ${saanich.traces.life(event.kind)}s; animation-delay: ${-age}s">${saanich.traces.icon(event.kind)}</div>`;
    const marker = new maplibregl.Marker({element}).setLngLat(bioreportr.obsPoint(event.record)).addTo(state.map);
    state.markers.add(marker);
    element.addEventListener("mouseenter", () => {
        state.holding++;
        saanich.traces.showCard(state, event, element);
    });
    element.addEventListener("mouseleave", () => {
        state.holding = Math.max(0, state.holding - 1);
        saanich.traces.scheduleHide(state);
    });
    element.addEventListener("click", () => saanich.traces.openTaxon(state.storyPage, event.taxon, state.window));
    element.firstElementChild.addEventListener("animationend", () => {
        marker.remove();
        state.markers.delete(marker);
    });
};

/**
 * Remove every marker from the map, and the card of any.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.clearMarkers = function (state) {
    state.markers.forEach(marker => marker.remove());
    state.markers.clear();
    state.holding = 0;
    saanich.traces.hideCard(state);
};

// The time in milliseconds before the next event: the quiet stretches of the record pass more slowly than the busy ones,
// though never for long
saanich.traces.delayAfter = (event, next) => Math.min(1600, 600 + Math.max(0, next.year - event.year) * 200);

// The time in milliseconds before trying again to show an event, while the timeline is held
saanich.traces.retryDelay = 300;

/**
 * Show the next event, unless the timeline is held, and schedule the step after.
 * @param {fluid.component} that - The timeline
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.step = function (that, state) {
    let delay = saanich.traces.retryDelay;
    if (!that.paused && !that.scrubbing && state.holding === 0 && !state.window.document.hidden) {
        const event = state.events[state.index];
        saanich.traces.addMarker(state, event);
        saanich.traces.showYear(state, event.year);
        state.index = (state.index + 1) % state.events.length;
        delay = saanich.traces.delayAfter(event, state.events[state.index]);
    }
    state.timer = state.window.setTimeout(() => saanich.traces.step(that, state), delay);
};

// As many markers as playback could have left on the map, at its quickest and with the longest fade
saanich.traces.trailLength = 30;
// Far enough into its fade that a marker has finished appearing, so that it shows even while the timeline is frozen
saanich.traces.trailStartAge = 1.2;

/**
 * Lay out the markers playback would have left on the map by the time it reached a given event, each as far through its
 * fade as it would then be.
 * @param {TraceState} state - The state of the playback
 * @param {Number} end - The index following the most recent event to show
 */
saanich.traces.placeTrail = function (state, end) {
    const {events} = state;
    let age = saanich.traces.trailStartAge;
    for (let i = end - 1; i >= Math.max(0, end - saanich.traces.trailLength); --i) {
        if (age < saanich.traces.life(events[i].kind)) {
            saanich.traces.addMarker(state, events[i], age);
        }
        if (i > 0) {
            age += saanich.traces.delayAfter(events[i - 1], events[i]) / 1000;
        }
    }
};

/**
 * Move the timeline to the end of a given year, in either direction.
 * @param {TraceState} state - The state of the playback
 * @param {Number} year - The year to move to
 */
saanich.traces.seek = function (state, year) {
    const next = state.events.findIndex(event => event.year > year);
    const end = next === -1 ? state.events.length : next;
    state.index = end % state.events.length;
    saanich.traces.clearMarkers(state);
    saanich.traces.placeTrail(state, end);
    saanich.traces.showYear(state, year);
};

/**
 * Create the state of a timeline once its map and events are ready, starting from a random year.
 * @param {fluid.component} that - The timeline
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {maplibregl.Map} map - The story's map
 * @param {TraceEvent[]} events - The events, in date order
 * @param {Window} window - The window holding the story page
 * @return {TraceState} The state of the playback
 */
saanich.traces.createState = function (that, storyPage, map, events, window) {
    const firstYear = events[0].year, lastYear = fluid.peek(events).year;
    const startYear = firstYear + Math.floor(Math.random() * (lastYear - firstYear + 1));
    const state = {storyPage, map, window, events, firstYear, lastYear, markers: new Set(), holding: 0, timer: null, cardEvent: null,
        hideTimer: null, heldMarker: null,
        index: Math.max(0, events.findIndex(event => event.year >= startYear)),
        overlay: saanich.traces.createOverlay(map.getContainer(), firstYear, lastYear)};
    saanich.traces.states.set(that, state);
    saanich.traces.bindControls(that, state);
    saanich.traces.bindCard(state);
    saanich.traces.showPlayback(that, that.paused);
    return state;
};

/**
 * Start or stop the timeline as its pane is shown or left, once the map and the real data are ready.
 * @param {fluid.component} that - The timeline
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {maplibregl.Map|undefined} map - The story's map, once its style has applied
 * @param {TraceEvent[]} events - The events, in date order
 * @param {Boolean} active - Whether the timeline's pane is showing
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 * @param {Window} window - The window holding the story page
 */
saanich.traces.control = function (that, storyPage, map, events, active, loaded, window) {
    const ready = map && loaded && events.length > 0;
    const state = ready ? saanich.traces.states.get(that) ?? saanich.traces.createState(that, storyPage, map, events, window) :
        saanich.traces.states.get(that);
    if (state) {
        window.clearTimeout(state.timer);
        saanich.traces.clearMarkers(state);
        if (active) {
            const camera = bioreportr.storyMap.firstCamera(storyPage.mapData);
            if (camera) {
                map.jumpTo({center: camera.center, zoom: camera.zoom});
            }
            // Begun outside the effect, so that pausing, which is read here and by each step, does not restart the timeline
            state.timer = window.setTimeout(() => {
                // Someone returning to a timeline they paused finds it as they left it
                if (that.paused) {
                    saanich.traces.placeTrail(state, state.index || state.events.length);
                }
                saanich.traces.step(that, state);
            }, 0);
        }
    }
};
