<script src="../js/story.js"></script>
<script src="../js/solow.js"></script>
<script>
"use strict";

// The Download list panel, at the foot of the checklist beside the Records panel beneath the map. It exports the taxa of
// the records which the story page's filters select - a region, a shape drawn or a cell chosen on the map, a recorder,
// a period, a group of species or an open question of the Atlas, or a taxon chosen in the checklist - as a formatted
// checklist, printed or saved as PDF, or as CSV. Each taxon is given with what is known of it within that selection:
// when it was first and last seen there and by whom, whether it has been seen there since the story's recentYear, its
// status across the story, and the earlier accounts which treated it. Nothing is computed until a list is asked for. It
// is made a member `list` of the story page by bioreportr.atlasPanel

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
fluid.registerNamespace("bioreportr.list");

fluid.def("bioreportr.list", {
    $layers: "fluid.component",
    // Settings which a project may override:
    // The columns of the printed checklist, naming columns of bioreportr.list.columnDefs - a download holds every column
    printColumns: ["tick", "name"],
    // The rank under which the taxa are grouped
    groupRank: "family",
    // The name of the story's whole area, for a list of all of it
    areaName: "the whole study area",
    // The title of the site, heading the printed checklist - by default the page's own, e.g. "Flora of the ..."
    siteTitle: null,
    // The name with which every downloaded checklist's file begins, before "_checklist_" and the date - by default the
    // site's title, e.g. "Flora-of-the-Saanich-Peninsula"
    fileStem: null,
    // What the list will hold, as the panel's header says it
    label: "$compute:bioreportr.list.label({storyPage}.recordsLabel)",
    notice: "",
    print: "$method:bioreportr.list.print({self}, {storyPage}, {global})",
    download: "$method:bioreportr.list.download({self}, {storyPage})"
});

bioreportr.list.label = recordsLabel => recordsLabel?.text || "";

/**
 * Read the present value of a member of a component, as read outside any computation - unwrapping its proxy, and reading
 * a member which arrives as its reactive cell, e.g. one defined by a reference to another, through the cell.
 * @param {any} value - The member as read
 * @return {any} Its value
 */
bioreportr.list.read = function (value) {
    let togo = fluid.unwrapProxy(value);
    // A reference to a member defined by a reference arrives as a cell of a cell
    for (let i = 0; i < 4 && togo && typeof(togo.get) === "function" && "cellId" in togo; ++i) {
        togo = fluid.unwrapProxy(togo.get());
    }
    return togo;
};

/**
 * Compute the rows of the list from the records the story page's filters now select.
 * @param {bioreportr.list} that - The list
 * @param {bioreportr.storyPage} storyPage - The story page
 * @return {Object[]|null} The rows, grouped and sorted, or `null` while the page has not settled its selection
 */
bioreportr.list.currentRows = function (that, storyPage) {
    const read = bioreportr.list.read;
    const selection = read(storyPage.finalFilteredObs);
    // While the page has not yet settled its selection of records, there is no list to give
    if (!selection || !selection.selection || fluid.isUnavailable(selection)) {
        return null;
    }
    const stats = bioreportr.list.stats(read(storyPage.pkg), selection);
    return bioreportr.list.rows(stats, read(storyPage.taxa.rowById), read(storyPage.statusById) || {}, read(storyPage.recentYear),
        read(that.groupRank), read(storyPage.curation?.historyById), read(storyPage.curationHistorySources), {}, [], {});
};

/**
 * Show a word of feedback beside the panel's buttons for a few seconds.
 * @param {bioreportr.list} that - The list
 * @param {String} text - The feedback
 */
bioreportr.list.notify = function (that, text) {
    that.notice = text;
    setTimeout(() => that.notice = "", 4000);
};

/**
 * Describe what narrows the list beyond its place, for its printed heading - e.g. a taxon chosen in the checklist, a
 * group of species, a recorder or a map cell, as the Records bar names them.
 * @param {bioreportr.list} that - The list
 * @param {bioreportr.storyPage} storyPage - The story page
 * @return {Array[]} Each part of the query, as its label and its value
 */
bioreportr.list.query = function (that, storyPage) {
    const read = bioreportr.list.read;
    const region = read(storyPage.selectedRegion);
    const label = read(storyPage.recordsLabel)?.title || "";
    const others = label.split(" · ").filter(part => part && part !== region && part !== "drawn area");
    return others.length ? [["Narrowed to", others.join("; ")]] : [];
};

/**
 * Title the list by the place and filters of its records.
 * @param {bioreportr.list} that - The list
 * @param {bioreportr.storyPage} storyPage - The story page
 * @return {String} The title, e.g. "Plants of Elk/Beaver Lake Regional Park"
 */
bioreportr.list.title = function (that, storyPage) {
    const read = bioreportr.list.read;
    const place = bioreportr.list.place(read(storyPage.selectedRegion), read(storyPage.map.polygonDraw.filterState), read(that.areaName));
    const label = read(storyPage.recordsLabel)?.title || "";
    const others = label.split(" · ").filter(part => part && part !== storyPage.selectedRegion && part !== "drawn area");
    return ["Plants of " + place, ...others].join(" · ");
};

/**
 * Summarise the records of each taxon of a selection, by one query grouping them by taxon: their number, how many have
 * coordinates, the years of the first and last, and the last record itself.
 * @param {VizPackage} pkg - The data package
 * @param {Selection|null} selection - The records
 * @return {Map<String, Object>|null} The summary of each taxon, by its id, with members `records`, `mapped`, `firstYear`,
 * `lastYear` and `lastRecord`, a row object - or `null` if there is no selection
 */
bioreportr.list.stats = function (pkg, selection) {
    let togo = null;
    if (selection) {
        const year = {year: "eventDate"};
        const result = hortis.query(pkg, {from: "obs", groupBy: ["iNaturalistTaxonId"], measures: {
            records: {count: true}, mapped: {count: true, filter: bioreportr.coordinatePredicates},
            firstYear: {min: year}, lastYear: {max: year}, rows: {rows: true}
        }}, selection);
        const obs = fluid.unwrapProxy(pkg).tables.obs;
        const days = obs.columns.eventDate.days;
        const {offsets, values} = result.measures.rows;
        togo = new Map();
        for (let g = 0; g < result.groups; ++g) {
            // The last record is the latest dated, or failing any date, the last catalogued
            let last = -1, lastDay = -Infinity;
            for (let i = offsets[g]; i < offsets[g + 1]; ++i) {
                const day = days[values[i]];
                if (last === -1 || day > lastDay) {
                    last = values[i];
                    lastDay = isNaN(day) ? lastDay : day;
                }
            }
            togo.set(String(result.keys.iNaturalistTaxonId[g]), {
                records: result.measures.records[g], mapped: result.measures.mapped[g],
                firstYear: result.measures.firstYear[g], lastYear: result.measures.lastYear[g],
                lastRecord: last === -1 ? null : hortis.qdl.rowObject(obs, last)
            });
        }
    }
    return togo;
};

/**
 * Determine whether a taxon is on the story's checklist - one of the taxa of its summary.
 * @param {TaxonRow} row - The taxon
 * @return {Boolean} `true` if it is
 */
bioreportr.list.inSummary = row => !!row.inSummary && String(row.inSummary) !== "0" && String(row.inSummary) !== "false";

/**
 * Find the entry of the checklist under which a taxon's records are listed - the taxon itself if it is on the
 * checklist, or else its nearest ancestor which is, e.g. a species for a record of a form not listed.
 * @param {TaxonRow} row - The taxon
 * @return {TaxonRow|null} The entry, or `null` if neither the taxon nor any of its ancestors is listed
 */
bioreportr.list.entryOf = function (row) {
    let move = row;
    while (move && !bioreportr.list.inSummary(move)) {
        move = move.parent;
    }
    return move || null;
};

/**
 * Combine the summaries of the records of two taxa listed under one entry.
 * @param {Object} a - One summary, or undefined
 * @param {Object} b - The other
 * @return {Object} Their combination
 */
bioreportr.list.combine = function (a, b) {
    const min = (x, y) => isNaN(x) ? y : isNaN(y) ? x : Math.min(x, y);
    const max = (x, y) => isNaN(x) ? y : isNaN(y) ? x : Math.max(x, y);
    return a ? {
        records: a.records + b.records, mapped: a.mapped + b.mapped,
        firstYear: min(a.firstYear, b.firstYear), lastYear: max(a.lastYear, b.lastYear),
        lastRecord: !(b.lastYear <= a.lastYear) && !isNaN(b.lastYear) ? b.lastRecord : a.lastRecord
    } : {...b};
};

/**
 * The status of a taxon within the selection - new to the story, as its summary says, or else seen there since the
 * recent year, not seen since, or recorded there only without dates.
 * @param {String} regionalStatus - The taxon's reporting status, as hortis.reportingStatusById gives it
 * @param {Number} lastYear - The year of its last record within the selection, NaN if none is dated
 * @param {Number} recentYear - The year from which a record counts as recent
 * @return {String} One of "new", "confirmed", "historical" or "undated"
 */
bioreportr.list.hereStatus = (regionalStatus, lastYear, recentYear) => regionalStatus === "new" ? "new" :
    isNaN(lastYear) ? "undated" : lastYear >= recentYear ? "confirmed" : "historical";

/**
 * Compute the rows of the list - one for each taxon of the checklist with records in the selection, and if the list
 * includes them, one for each other taxon with records there, marked as not on the checklist.
 * @param {Map<String, Object>|null} stats - The summary of the records of each taxon - see bioreportr.list.stats
 * @param {Object<String, TaxonRow>} rowById - The taxa, by id
 * @param {Object<String, String>} statusById - The reporting status of each taxon, by id
 * @param {Number} recentYear - The year from which a record counts as recent
 * @param {String} groupRank - The rank under which the rows are grouped
 * @param {Object<String, Object>} historyById - The history of the curatorial accounts of each taxon, by id
 * @param {Object[]} sources - The sources of those accounts - see the story's curationHistorySources
 * @param {Object<String, Set<String>>} questionTaxa - The ids of the taxa of each open question, by its key
 * @param {Object[]} openQuestions - The open questions, each with its `key` and `short` description
 * @param {Object<String, String[]>} decoded - The list's settings
 * @return {Object[]} The rows, sorted by their group and then by name
 */
bioreportr.list.rows = function (stats, rowById, statusById, recentYear, groupRank, historyById, sources, questionTaxa, openQuestions, decoded) {
    const togo = [];
    stats = fluid.unwrapProxy(stats);
    if (stats) {
        const all = (decoded.listing || []).includes("all");
        const bare = fluid.unwrapProxy(rowById), history = fluid.unwrapProxy(historyById) || {};
        const byEntry = new Map();
        stats.forEach((summary, id) => {
            const row = bare[id];
            if (row) {
                const entry = bioreportr.list.entryOf(row) || (all ? row : null);
                if (entry) {
                    byEntry.set(entry.id, bioreportr.list.combine(byEntry.get(entry.id), summary));
                }
            }
        });
        const questions = fluid.unwrapProxy(questionTaxa) || {};
        const questionLabels = Object.fromEntries(fluid.makeArray(fluid.unwrapProxy(openQuestions)).map(question => [question.key, question.short || question.key]));
        byEntry.forEach((summary, id) => {
            const taxon = bare[id];
            const regionalStatus = statusById[id] || "";
            const group = groupRank === "family" ? hortis.familyNameOf(taxon) :
                hortis.ancestorAtRank(taxon, groupRank)?.iNaturalistTaxonName || "Unplaced";
            togo.push({
                taxon, group, ...summary,
                listed: bioreportr.list.inSummary(taxon),
                regionalStatus,
                here: bioreportr.list.hereStatus(regionalStatus, summary.lastYear, recentYear),
                sources: (sources || []).filter(source => history[id]?.[source.field]),
                questions: Object.keys(questions).filter(key => questions[key].has(String(id))),
                questionLabels
            });
        });
        const name = row => hortis.rowToScientific(row.taxon) || "";
        togo.sort((a, b) => a.group.localeCompare(b.group) || name(a).localeCompare(name(b)));
    }
    return togo;
};

/** The columns **/

// A taxon's scientific name in italics, without its rank - which the name itself makes plain
bioreportr.list.nameMarkup = row => `<em>${hortis.renderSpeciesName(hortis.encodeHTML(hortis.rowToScientific(row) || ""))}</em>`;

bioreportr.list.html = text => hortis.encodeHTML(String(text ?? ""));

// The first recorder of a record, as the Atlas's summaries give it
bioreportr.list.recorder = record => record ? bioreportr.firstRecorder(record) : "";

bioreportr.list.year = value => isNaN(value) || value === null || value === undefined ? "" : String(value);

// Each column, with its heading, the markup of a row's cell, and the text of its cell in a download. `printOnly` marks
// a column blank on the screen, e.g. a box to tick in the field
bioreportr.list.columnDefs = {
    tick: {label: "✓", printOnly: true, markup: () => "<span class=\"mxcw-list-tick\" aria-hidden=\"true\"></span>", text: () => ""},
    name: {
        label: "Taxon",
        markup: row => `<button type="button" class="mxcw-list-taxon" data-list-action="taxon" data-taxon="${row.taxon.id}">` +
            `${bioreportr.list.nameMarkup(row.taxon)}</button>${row.taxon.commonName ? ` <span class="mxcw-list-common">${bioreportr.list.html(row.taxon.commonName)}</span>` : ""}` +
            (row.listed ? "" : " <span class=\"mxcw-list-unlisted\" title=\"Recorded here, but not on the checklist\">not on checklist</span>"),
        text: row => hortis.rowToScientific(row.taxon)
    },
    common: {label: "Common name", markup: row => bioreportr.list.html(row.taxon.commonName), text: row => row.taxon.commonName || ""},
    here: {
        label: "Here",
        markup: row => `<span class="mxcw-list-here mxcw-list-here-${row.here}" title="${bioreportr.list.hereTitles[row.here]}"></span>`,
        text: row => row.here
    },
    records: {label: "Records here", markup: row => String(row.records), text: row => row.records},
    firstSeen: {label: "First seen here", markup: row => bioreportr.list.year(row.firstYear), text: row => bioreportr.list.year(row.firstYear)},
    lastSeen: {
        label: "Last seen here",
        markup: row => `${bioreportr.list.year(row.lastYear)}${row.lastRecord ? ` <span class="mxcw-list-recorder">${bioreportr.list.html(bioreportr.list.recorder(row.lastRecord))}</span>` : ""}`,
        text: row => bioreportr.list.year(row.lastYear)
    },
    lastRecorder: {label: "Last recorded by", markup: row => bioreportr.list.html(bioreportr.list.recorder(row.lastRecord)),
        text: row => bioreportr.list.recorder(row.lastRecord)},
    locality: {label: "Last locality", markup: row => bioreportr.list.html(row.lastRecord?.locality), text: row => row.lastRecord?.locality || ""},
    status: {label: "Status", markup: row => bioreportr.list.html(bioreportr.list.statusLabels[row.regionalStatus] || ""),
        text: row => bioreportr.list.statusLabels[row.regionalStatus] || ""},
    introduction: {label: "Native or exotic", markup: row => bioreportr.list.html(bioreportr.atlas.provenanceLabels?.[row.taxon.introduction_status] || ""),
        text: row => row.taxon.introduction_status || ""},
    conservation: {label: "Conservation status", markup: row => bioreportr.list.html(bioreportr.list.conservation(row.taxon)),
        text: row => bioreportr.list.conservation(row.taxon)},
    voucher: {label: "Voucher", markup: row => bioreportr.list.html(bioreportr.list.voucherLabels[row.taxon.provenance_status] || ""),
        text: row => row.taxon.provenance_status || ""},
    ep: {label: "EP", markup: row => bioreportr.list.html(bioreportr.list.ep(row.taxon.solow_EP)), text: row => bioreportr.list.ep(row.taxon.solow_EP)},
    sources: {
        label: "Treated by",
        markup: row => row.sources.map(source => `<abbr title="${bioreportr.list.html(source.source + (source.year ? ", " + source.year : ""))}">` +
            `${bioreportr.list.html(source.abbreviation || source.source)}</abbr>`).join(" "),
        text: row => row.sources.map(source => source.abbreviation || source.source).join(" ")
    },
    questions: {
        label: "?",
        markup: row => row.questions.length ? `<span class="mxcw-list-question" title="${bioreportr.list.html(row.questions.map(key =>
            row.questionLabels[key] || key).join("; "))}">?</span>` : "",
        text: row => row.questions.join(" ")
    },
    notes: {label: "Notes", printOnly: true, markup: () => "", text: () => ""}
};

bioreportr.list.hereTitles = {confirmed: "Seen here in recent years", historical: "Not seen here in recent years",
    new: "Newly reported in the flora", undated: "Recorded here, without a date"};

bioreportr.list.statusLabels = {confirmed: "Confirmed", unconfirmed: "Historical", new: "New"};

bioreportr.list.voucherLabels = {voucher: "Vouchered", no_voucher: "No voucher", unknown: "Unknown"};

bioreportr.list.conservation = function (taxon) {
    const bcList = /^exotic$/i.test(String(taxon.bc_list || "").trim()) ? "" : taxon.bc_list;
    return [taxon.provincial_status, bcList, taxon.national_status && "COSEWIC " + taxon.national_status,
        taxon.sara_status && "SARA " + taxon.sara_status].filter(Boolean).join(", ");
};

bioreportr.list.ep = value => value === "" || value === null || value === undefined || isNaN(Number(value)) ? "" : Number(value).toFixed(2);

/**
 * Describe the place of the list - the region chosen, the area drawn, or the story's whole area.
 * @param {String|null} region - The region chosen
 * @param {Object[]} polygons - The areas drawn
 * @param {String} areaName - The name of the story's whole area
 * @return {String} The place
 */
bioreportr.list.place = function (region, polygons, areaName) {
    const drawn = fluid.makeArray(fluid.unwrapProxy(polygons)).length > 0;
    return region && drawn ? region + ", within the area drawn" : region ? region : drawn ? "the area drawn on the map" : areaName;
};

/** Downloading, printing and sharing **/

// Every column of a download, in its order
bioreportr.list.downloadColumns = ["name", "common", "introduction", "conservation"];

/**
 * Download the list as CSV, every column of it, with its group and the taxon's id.
 * @param {bioreportr.list} that - The list
 */
bioreportr.list.download = function (that, storyPage) {
    const rows = bioreportr.list.currentRows(that, storyPage);
    if (!rows) {
        bioreportr.list.notify(that, "The selection is still loading - try again in a moment");
        return;
    }
    const columns = bioreportr.list.downloadColumns.map(name => bioreportr.list.columnDefs[name]);
    const headers = ["Family", ...columns.map(column => column.label), "Taxon id"];
    const data = rows.map(row => [row.group, ...columns.map(column => column.text(row)), row.taxon.id]);
    hortis.downloadCSV(headers, data, bioreportr.list.fileName(that, window) + ".csv");
};

/**
 * Print the list, from a page of its own so that nothing of the story's page is printed with it: its title, the
 * people and sources it draws on, its link and date, and its table in the chosen columns, with any columns for the field.
 * @param {bioreportr.list} that - The list
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Window} window - The window
 */
bioreportr.list.print = function (that, storyPage, window) {
    const html = bioreportr.list.html;
    const rows = bioreportr.list.currentRows(that, storyPage);
    if (!rows) {
        bioreportr.list.notify(that, "The selection is still loading - try again in a moment");
        return;
    }
    const columns = fluid.makeArray(fluid.unwrapProxy(that.printColumns)).map(name => ({name, ...bioreportr.list.columnDefs[name]}));
    const title = bioreportr.list.title(that, storyPage), count = String(rows.length);
    // Each family's taxa, two to a row beneath its heading
    const families = [];
    rows.forEach(row => {
        const last = families[families.length - 1];
        if (last && last.group === row.group) {
            last.rows.push(row);
        } else {
            families.push({group: row.group, rows: [row]});
        }
    });
    const item = row => `<div class="taxon">${columns.map(column => column.name === "name" ?
        `<span class="name">${bioreportr.list.nameMarkup(row.taxon)}${row.taxon.commonName ? ` <span class="common">(${html(row.taxon.commonName)})</span>` : ""}</span>` :
        column.name === "tick" ? "<span class=\"box\"></span>" : `<span class="${column.name}">${column.markup(row)}</span>`).join("")}</div>`;
    const body = families.map(family => `<section class="family"><h2>${html(family.group)}<span class="n">${family.rows.length}</span></h2>` +
        `${family.rows.map(item).join("")}</section>`).join("");
    const sources = fluid.makeArray(fluid.unwrapProxy(storyPage.curationHistorySources)).map(source => source.source + (source.year ? " (" + source.year + ")" : ""));
    const siteTitle = bioreportr.list.read(that.siteTitle) || String(window.document.title || "").split("|")[0].trim();
    const query = bioreportr.list.query(that, storyPage);
    const date = new Date().toLocaleDateString("en-CA", {day: "numeric", month: "long", year: "numeric"});
    const credit = sources.length ? "Drawing on the work of " + sources.join(", ") + ", and every naturalist whose records are gathered here." :
        "Drawing on the records of every naturalist gathered here.";
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${html(bioreportr.list.fileName(that, window))}</title><style>
        @page { margin: 1.5cm 1.4cm; }
        body { font: 10px/1.45 "Open Sans", "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; }
        @media screen { body { max-width: 19cm; margin: 1.2cm auto; } }
        header { display: grid; grid-template-columns: 1fr auto; column-gap: 24px; align-items: end; margin-bottom: 14px;
            padding-bottom: 10px; border-bottom: 2px solid #184E62; }
        .site { grid-column: 1; margin: 0; font-size: 19px; font-weight: 700; line-height: 1.2; color: #184E62; }
        .kind { grid-column: 1; margin: 2px 0 0; font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #6b8794; }
        .query { grid-column: 2; grid-row: 1 / span 2; display: grid; grid-template-columns: max-content max-content; gap: 1px 10px;
            margin: 0; font-size: 9.5px; text-align: left; }
        .query dt { color: #6b8794; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 8.5px; padding-top: 1px; }
        .query dd { margin: 0; color: #1a1a1a; }
        .credit { grid-column: 1 / -1; margin: 8px 0 0; font-size: 9px; font-style: italic; color: #555; }
        .link { grid-column: 1 / -1; margin: 2px 0 0; font-size: 8px; color: #8a9aa2; word-break: break-all; }
        .family { display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; margin-bottom: 8px; }
        .family h2 { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline; margin: 8px 0 3px;
            padding-bottom: 2px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #184E62;
            border-bottom: 1px solid #184E62; break-after: avoid; }
        .family h2 .n { font-size: 8.5px; font-weight: 400; letter-spacing: 0; color: #6b8794; }
        .taxon { display: flex; gap: 7px; align-items: baseline; padding: 2px 0; border-bottom: 1px dotted #c9d3d8; break-inside: avoid; }
        .name em { font-style: italic; color: #111; } .common { color: #5b6b73; }
        .box { flex-shrink: 0; position: relative; top: 1px; display: inline-block; width: 8px; height: 8px; border: 1px solid #184E62; border-radius: 1.5px; }
    </style></head><body>
        <header>
            <p class="site">${html(siteTitle)}</p>
            <p class="kind">Plant checklist</p>
            <dl class="query">${query.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(value)}</dd>`).join("")}
                <dt>Taxa</dt><dd>${html(count)}</dd>
                <dt>Compiled</dt><dd>${html(date)}</dd></dl>
            <p class="credit">${html(credit)}</p>
            <p class="link">${html(window.location.href)}</p>
        </header>
        ${body}
    </body></html>`;
    bioreportr.list.printDocument(doc, window, bioreportr.list.fileName(that, window));
};

/**
 * Print a document of its own from a hidden frame within the page, rather than a new window, which some browsers block
 * or hand to the system - the browser's print dialog then offers to print it or save it as PDF.
 * @param {String} doc - The document's markup
 * @param {Window} window - The window of the page
 * @param {String} fileName - The name of the file, as which the page is titled while the print dialog is open
 */
bioreportr.list.printDocument = function (doc, window, fileName) {
    const dokkument = window.document;
    dokkument.getElementById("mxcw-list-print-frame")?.remove();
    const frame = dokkument.createElement("iframe");
    frame.id = "mxcw-list-print-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0; visibility: hidden;";
    dokkument.body.appendChild(frame);
    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(doc);
    frameDoc.close();
    // Printed once the frame has laid out its document
    // The page itself is titled as the file for as long as the print dialog is open, since a browser may name the PDF
    // saved from it after the page rather than the frame
    const pageTitle = dokkument.title;
    dokkument.title = fileName;
    window.setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        dokkument.title = pageTitle;
    }, 100);
};

/**
 * The name of a downloaded checklist, without its extension, e.g. "Flora-of-the-Saanich-Peninsula_checklist_2026-11-16" -
 * its stem, the project's fileStem or else the site's title in plain letters, then "_checklist_" and the date.
 * @param {bioreportr.list} that - The list
 * @param {Window} window - The window of the page
 * @return {String} The name
 */
bioreportr.list.fileName = function (that, window) {
    const stem = bioreportr.list.read(that.fileStem) || String(window.document.title || "Flora").split("|")[0]
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return stem + "_checklist_" + new Date().toISOString().substring(0, 10);
};
</script>

<style>
/* The Download list panel - a bar fixed to the foot of the right-hand column, level with the Records bar at the foot of
   the left, in its height, colour and type. The checklist above it takes the rest of the column. See bioreportr.list */
.imerss-container:has(> .mxcw-list-download-holder) > .imerss-filter-panel {
    flex: 1 1 0;
    min-height: 0;
}

.imerss-container > .mxcw-list-download-holder {
    flex: 0 0 var(--mxcw-records-header-height, 40px);
    margin-top: auto;
    /* The column stops short of the foot of the page by the gap beneath the container, which the Records bar spans */
    margin-bottom: -4px;
    background-color: #184E62;
}

.mxcw-list-download {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    padding: 0 8px 0 1rem;
    color: #eefaff;
}

.mxcw-list-download-title {
    flex-shrink: 0;
    font-size: var(--story-body);
    font-weight: 700;
}

.mxcw-list-download-label {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    font-size: var(--story-data);
    color: #b9d3df;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.mxcw-list-button {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    padding: 0;
    font: inherit;
    font-size: var(--story-data);
    color: #eefaff;
    background: none;
    border: none;
    cursor: pointer;
}

.mxcw-list-button svg {
    width: 18px;
    height: 18px;
    fill: #ddd;
    color: #eefaff;
}

.mxcw-list-button:hover {
    color: #FDF2CE;
}

.mxcw-list-notice {
    color: #FDF2CE;
}
</style>

<template>
    <div class="mxcw-list-download">
        <span class="mxcw-list-download-title">Download list</span>
        <span class="mxcw-list-download-label" title="@{label}">@{label}</span>
        <button type="button" class="mxcw-list-button" title="A formatted checklist of the taxa selected, to print or save as PDF" @onclick="{self}.print()">
            <svg aria-hidden="true"><use href="#imerss-i-download"/></svg>Checklist</button>
        <button type="button" class="mxcw-list-button" title="The taxa selected, with their records here, as CSV" @onclick="{self}.download()">
            <svg aria-hidden="true"><use href="#imerss-i-download"/></svg>CSV</button>
        <span class="mxcw-list-notice">@{notice}</span>
    </div>
</template>
