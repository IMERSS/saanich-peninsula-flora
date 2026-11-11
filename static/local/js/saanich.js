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

// The summaries and behaviours particular to the story of the Saanich Peninsula's vascular plants which are not those
// of a single pane of its own - the atlas's tiles, panel and tooltips of the groups of species, the summary of a map
// cell, and the opening of the extirpation risk pane on its top species. They are configured onto the story page by
// saanich-story.vue. The three panes of this story alone each have a Single File Component of their own beside it,
// e.g. static/local/story/saanich-lostPlantsPane.vue

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

fluid.registerNamespace("saanich.atlas");
fluid.registerNamespace("saanich.statusTooltip");

// Show checklist entries under the project's accepted names, including annotations such as ssp. and var.
saanich.inatRowToScientific = hortis.rowToScientific;
hortis.rowToScientific = row => row.scientificName || saanich.inatRowToScientific(row);

saanich.locale = "en-CA";

// Counts are shown plainly, without separators of thousands
// Shared with the story page's own summaries - see bioreportr.tip in static/bioreportr/js/story.js
saanich.formatCount = bioreportr.formatCount;

saanich.year = bioreportr.year;

saanich.obsDateComparator = bioreportr.obsDateComparator;

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

/** The atlas's tiles of the three groups of species **/

saanich.statusColours = bioreportr.statusColours;

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

// Each tile is a link which selects its group
saanich.atlas.tiles = [{
    status: "confirmed",
    name: "Confirmed",
    meaning: "Reported historically and found again since 2000."
}, {
    status: "unconfirmed",
    name: "Historical",
    meaning: "Reported in the past but not recorded since 2000."
}, {
    status: "new",
    name: "Newly reported",
    meaning: "Added new to the flora from recent reports."
}];

/**
 * Render the tile for one group of species.
 * @param {Object} tile - One entry of `saanich.atlas.tiles`
 * @param {TaxonRow[]} taxa - The species of this group
 * @param {Boolean} pressed - Whether the group is selected
 * @return {String} The markup for the tile
 */
saanich.atlas.renderTile = function (tile, taxa, pressed) {
    return `<button type="button" class="saanich-status-link saanich-status-tile" data-status="${tile.status}" aria-pressed="${pressed}" style="--tip-colour:${saanich.statusColours[tile.status]}">
        <span class="saanich-tile-name">${tile.name}</span>
        <span class="saanich-tile-count">${saanich.formatCount(taxa.length)} <small>species</small></span>
        <span class="saanich-tile-meaning">${tile.meaning}</span>
    </button>`;
};

/**
 * Render the tiles of the three groups of species, computed from the site's data.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {String|null} selectedStatus - The selected group, if any
 * @return {String} The markup of the tiles
 */
saanich.atlas.tilesMarkup = function (taxaRows, selectedStatus) {
    return saanich.atlas.tiles.map(tile => saanich.atlas.renderTile(tile, saanich.taxaOfStatus(taxaRows, tile.status),
        tile.status === selectedStatus)).join("");
};

saanich.atlas.sectionInserts = tiles => ({"saanich-status-tiles": tiles});

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
        togo = `<div class="mxcw-solow-taxon-pane saanich-atlas-taxon-pane">
  <div class="mxcw-taxon-image">${hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)}</div>
  <div class="mxcw-taxon-info">
    <div class="saanich-atlas-facts">
      <div class="mxcw-taxon-name">${hortis.dataTable.encode((taxon.scientificName || taxon.iNaturalistTaxonName) + (taxon.commonName ? ` (${taxon.commonName})` : ""))}</div>
      <dl class="mxcw-taxon-fields">
        <dt>Date first seen:</dt> <dd>${bioreportr.eventDay(records[0].eventDate)}</dd>
        <dt>Date last seen:</dt> <dd>${bioreportr.eventDay(fluid.peek(records).eventDate)}</dd>
        <dt>Total records:</dt> <dd>${saanich.formatCount(records.length)}</dd>
        ${saanich.atlas.field("Status", saanich.atlas.statusLabels[taxon.reportingStatus])}
      </dl>
      ${bioreportr.georefNote(records)}
    </div>
    ${saanich.atlas.historyMarkup(records, taxon.id)}
  </div>
</div>`;
    }
    return togo;
};

/** The history of a plant's records, charted in the atlas's panel - only there, since the extirpation risk pane's panel
    has no room for it beside its slider **/

// The first decade charted, that of the earliest records of the flora, so that every plant is charted on the same span
saanich.atlas.firstDecade = 1850;

saanich.atlas.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

/**
 * Count the records of a plant in each decade from `saanich.atlas.firstDecade` to the present, and in each month.
 * @param {Object[]} records - The plant's dated records
 * @param {Number} [thisYear] - The present year
 * @return {Object} Members `decades`, {decade, count}[], and `months`, Number[12]
 */
saanich.atlas.history = function (records, thisYear = new Date().getFullYear()) {
    const first = saanich.atlas.firstDecade;
    const decades = [];
    for (let decade = first; decade <= thisYear; decade += 10) {
        decades.push({decade, count: 0});
    }
    const months = new Array(12).fill(0);
    records.forEach(record => {
        const [year, month] = String(record.eventDate).split("-").map(Number);
        const index = Math.floor((year - first) / 10);
        if (index >= 0 && index < decades.length) {
            ++decades[index].count;
        }
        if (month >= 1 && month <= 12) {
            ++months[month - 1];
        }
    });
    return {decades, months};
};

/**
 * Render a row of columns, each showing its value on hovering.
 * @param {Object[]} columns - The columns, each with `value`, `title`, and `label`, shown beneath it if not empty
 * @param {String} kind - The kind of chart, which names its class
 * @return {String} The markup of the chart
 */
saanich.atlas.columns = function (columns, kind) {
    // On a square root scale, so that the few records of earlier decades still show beside the many of recent ones
    const max = Math.sqrt(Math.max(...columns.map(column => column.value), 1));
    const slots = columns.map(column => `<span class="saanich-history-slot" title="${column.title}">` +
        `<span class="saanich-history-bar${column.value ? "" : " saanich-history-empty"}" style="height:${Math.sqrt(column.value) / max * 100}%"></span>` +
        `<span class="saanich-history-label">${column.label}</span></span>`).join("");
    return `<div class="saanich-history-chart saanich-history-${kind}">${slots}</div>`;
};

/**
 * Render the history of a plant's observations - how many were made in each decade, and in each month of the year - as
 * one chart at a time, chosen by its tabs. The tabs are radio buttons, so that they work without script, the chart shown
 * being picked by CSS - see the styles in saanich-story.vue.
 * @param {Object[]} records - The plant's dated records
 * @param {String} taxonId - The plant's id, naming its tabs apart from any other panel's
 * @return {String} The markup of the charts and their tabs
 */
saanich.atlas.historyMarkup = function (records, taxonId) {
    const {decades, months} = saanich.atlas.history(records);
    const count = n => saanich.formatCount(n) + (n === 1 ? " observation" : " observations");
    const decadeColumns = decades.map(({decade, count: n}) => ({value: n, title: `${decade}s: ${count(n)}`,
        label: decade % 50 === 0 ? String(decade) : ""}));
    const monthColumns = months.map((n, month) => ({value: n, title: `${saanich.atlas.monthNames[month]}: ${count(n)}`,
        label: saanich.atlas.monthNames[month][0]}));
    const name = "saanich-history-" + taxonId;
    const tab = (kind, label, checked) => `<input type="radio" class="saanich-history-${kind}-tab" id="${name}-${kind}" name="${name}"${checked ? " checked" : ""}>` +
        `<label for="${name}-${kind}">${label}</label>`;
    return `<div class="saanich-history">
      <div class="saanich-history-tabs"><span class="saanich-history-heading">Observations by:</span>${tab("decade", "Decade", true)}${tab("month", "Month", false)}</div>
      ${saanich.atlas.columns(decadeColumns, "decades")}
      ${saanich.atlas.columns(monthColumns, "months")}
    </div>`;
};

// The panel is shown only on the atlas pane and only while a plant with records is selected
saanich.atlas.panelVisible = (markup, activePaneKey, atlasPane) => !!markup && activePaneKey === atlasPane;

/** Summaries of the groups of species, shown on hovering over a tile or a row of the map's legend **/

// The bars and headings of the summaries are those of the summary of a map cell - see bioreportr.cellTooltip
saanich.statusTooltip.bars = bioreportr.tip.bars;

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
    `<div class="mxcw-tip-title">${name} <span>${saanich.formatCount(count)} species</span></div>${body}`;

saanich.statusTooltip.heading = bioreportr.tip.heading;

saanich.firstRecorder = record => (record.recordedBy || "Unknown").split(";")[0].trim() || "Unknown";

saanich.statusTooltip.renderers = {
    // When each historically reported species was first found again since 2000, and who found the most of them again
    confirmed: function (taxa, byTaxon) {
        const periods = [["2000–2004", 2000, 2004], ["2005–2009", 2005, 2009], ["2010–2014", 2010, 2014], ["2015–2019", 2015, 2019], ["2020 on", 2020, Infinity]];
        const refound = taxa.map(taxon => (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator)
            .find(record => parseInt(record.eventDate, 10) >= 2000)).filter(record => record);
        const counts = {};
        refound.forEach(record => {
            const recorder = saanich.firstRecorder(record);
            counts[recorder] = (counts[recorder] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return saanich.statusTooltip.frame("Confirmed", taxa.length,
            saanich.statusTooltip.heading("Species by when first found again") +
            saanich.statusTooltip.bars(periods.map(([label, min, max]) => [label, refound.filter(record => {
                const year = parseInt(record.eventDate, 10);
                return year >= min && year <= max;
            }).length])) +
            saanich.statusTooltip.heading("Observers who found the most species again") + saanich.statusTooltip.bars(top));
    },
    new: function (taxa, byTaxon) {
        // Each species' first record in the atlas, among those made since 2000
        const reports = taxa.map(taxon => ({taxon, first: (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator)[0]}))
            .filter(report => report.first && parseInt(report.first.eventDate, 10) >= 2000);
        const counts = {};
        reports.forEach(report => {
            const recorder = saanich.firstRecorder(report.first);
            counts[recorder] = (counts[recorder] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return saanich.statusTooltip.frame("Newly reported", taxa.length,
            saanich.statusTooltip.heading("Observers with most added records since 2000") + saanich.statusTooltip.bars(top));
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
            saanich.statusTooltip.heading("Species by date last recorded") +
            saanich.statusTooltip.bars(eras.map(([label, min, max]) => [label, records.filter(list => lastYear(list) >= min && lastYear(list) <= max).length])) +
            saanich.statusTooltip.heading("Past records by month, a guide to when to look") + saanich.statusTooltip.months(months) +
            `<div class="mxcw-tip-note">${withLocality} species have a recorded locality to search, and ${withSpecimen} have a specimen to consult.</div>`);
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

/** The checklist's icons of reporting status **/

/**
 * Decorate a checklist row with an icon of its taxon's reporting status, as hortis.blitzChecklistDecoration does, but
 * referring to the icons by the ids the story page gives them, which carry the prefix `imerss-i-`. Without it the
 * icons refer to symbols which don't exist, and show nothing.
 * @param {TaxonRow} row - The checklist's taxon row
 * @return {VNode|null} The icon, or null if the taxon has no reporting status
 */
saanich.checklistDecoration = function (row) {
    const node = hortis.blitzChecklistDecoration(row);
    const use = node?.children.find(child => child.tag === "use");
    if (use && !use.attrs.href.startsWith("#imerss-i-")) {
        use.attrs.href = "#imerss-i-" + use.attrs.href.substring(1);
    }
    return node;
};

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

/** The camera of a pane opened from one without a map **/

// Whether the map was shown by the previous pane, by map
saanich.mapWasShown = new WeakMap();

/**
 * Place the map on the active pane's camera again once it has its full size, when the previous pane hid it - e.g. on
 * moving from Lost Plants to the Atlas. The story page moves the camera as the pane opens, when the map is still without
 * size, which leaves it centred in the wrong place once the map has grown. Harvey's pane frames itself - see
 * saanich.remembering.frame.
 * @param {maplibregl.Map} map - The story's map, once ready
 * @param {Object} mapData - The story's map data, with each pane's camera
 * @param {Object} activePane - The active pane's settings, with its `paneKey` and `visibleMap`
 */
saanich.recentre = function (map, mapData, activePane) {
    if (!map || !activePane) {
        return;
    }
    const wasShown = saanich.mapWasShown.get(map);
    saanich.mapWasShown.set(map, !!activePane.visibleMap);
    const camera = mapData?.panes?.[activePane.paneKey];
    if (wasShown === false && activePane.visibleMap && camera?.center && activePane.paneKey !== "Remembering") {
        hortis.libreMap.afterLayout(map, () => {
            map.resize();
            map.jumpTo({center: camera.center, zoom: camera.zoom});
        });
    }
};

/** The species of the Community Science pane, which open on the Atlas **/

// The iNaturalist place and taxon of the Community Science pane's panels - see paneOverrides in saanich-story.vue
saanich.inatSpecies = {placeId: 81137, taxonId: 211194, lookup: null};

/**
 * Look up the iNaturalist taxa of the species shown by the Community Science pane's panels, which name each by its
 * common name alone, by the same query the panels make. Made once, on the first click.
 * @param {Window} window - The window holding the story page
 * @return {Promise<Map<String, Object>>} Map of lower-cased common name to the taxon's `id` and scientific `name`
 */
saanich.inatSpecies.byName = function (window) {
    if (!saanich.inatSpecies.lookup) {
        const {placeId, taxonId} = saanich.inatSpecies;
        saanich.inatSpecies.lookup = window.fetch(`https://api.inaturalist.org/v1/observations/species_counts?verifiable=true&place_id=${placeId}&taxon_id=${taxonId}&per_page=500`)
            .then(response => response.json())
            .then(data => new Map(data.results.filter(result => result.taxon.preferred_common_name)
                .map(result => [result.taxon.preferred_common_name.toLowerCase(), {id: String(result.taxon.id), name: result.taxon.name}])));
    }
    return saanich.inatSpecies.lookup;
};

/**
 * Find the atlas's taxon for a species of iNaturalist - the same taxon, or else the atlas's taxon of that scientific name
 * or one beneath it, e.g. Pseudotsuga menziesii var. menziesii for iNaturalist's Pseudotsuga menziesii.
 * @param {Object<String, TaxonRow>} rowById - The atlas's taxa
 * @param {Object} taxon - The iNaturalist taxon, with its `id` and scientific `name`
 * @return {TaxonRow|undefined} The atlas's taxon, preferring one of its summary
 */
saanich.inatSpecies.atlasRow = function (rowById, taxon) {
    if (rowById[taxon.id]) {
        return rowById[taxon.id];
    }
    const named = Object.values(rowById).filter(row => {
        const scientific = row.scientificName || "";
        return scientific === taxon.name || scientific.startsWith(taxon.name + " ");
    });
    return named.find(row => row.inSummary) || named[0];
};

/**
 * Open the Atlas on the species of a card of the Community Science pane, if it is one of the atlas's taxa.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {HTMLElement} card - The card clicked
 * @param {Window} window - The window holding the story page
 */
saanich.inatSpecies.open = function (storyPage, card, window) {
    const name = card.querySelector(".inat-observation-label-title")?.textContent.trim().toLowerCase();
    if (name) {
        saanich.inatSpecies.byName(window).then(byName => {
            const taxon = byName.get(name);
            const row = taxon && saanich.inatSpecies.atlasRow(storyPage.taxa.rowById, taxon);
            if (row) {
                window.location.hash = "pane:Status&taxon:" + row.id;
            }
        }, error => console.error("Could not look up the species of the Community Science pane", error));
    }
};

/**
 * Whether a card of the Community Science pane stands for a species, as do those of its "Most common" tab, rather than
 * an observation.
 * @param {Element} card - The card
 * @return {Boolean} `true` if the card is shown under the "Most common" tab
 */
saanich.inatSpecies.isSpeciesCard = function (card) {
    const tab = [...card.closest(".mxcw-inat-components").querySelectorAll("li")].find(item => /selected/.test(item.className));
    return !!tab && tab.textContent.trim() === "Most common";
};

// The story pages whose Community Science cards already open their species
saanich.inatSpecies.bound = new WeakSet();

/**
 * Listen for clicks on the cards of the Community Science pane, which the iNaturalist panels render outside the story
 * page's own handling of clicks in its panes.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Window} window - The window holding the story page
 */
saanich.inatSpecies.bind = function (storyPage, window) {
    if (!saanich.inatSpecies.bound.has(storyPage)) {
        saanich.inatSpecies.bound.add(storyPage);
        // Caught as it descends, before the card's own handler. Only the cards of "Most common" are species, whose own link
        // to iNaturalist is broken, and open the atlas instead - those of "Recent" and "Most favourited" are observations,
        // whose own handler opens them on iNaturalist in another window
        window.document.addEventListener("click", event => {
            const card = event.target.closest?.(".mxcw-inat-components article");
            if (card && saanich.inatSpecies.isSpeciesCard(card)) {
                event.preventDefault();
                event.stopPropagation();
                saanich.inatSpecies.open(storyPage, card, window);
            }
        }, true);
    }
};

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

