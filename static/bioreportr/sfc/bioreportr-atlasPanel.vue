<script src="../js/story.js"></script>
<script src="../js/solow.js"></script>
<script>
"use strict";

/* global maplibregl */

// The atlas's panel of the plant or group chosen in the checklist: its photo, names, status and dates, and a chart of the
// history of its records by decade or by month, with the notes on it - together with the atlas's tiles of the groups
// of species and their summaries, the icons of the checklist, and the species of the Community Science pane, which
// open on the atlas. The Protected Areas pane shows a smaller panel built from the same helpers - see
// bioreportr-protectedPane.vue. A project lays bioreportr.atlasPanel over its story page in <project>-story.vue, and
// gives its own settings there - see the members documented below

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
fluid.registerNamespace("bioreportr.atlas");

// The atlas's panel, a layer of the story page - it is shown on the atlas, and the Protected Areas pane shows its own
// smaller one in its place, as chosen by bioreportr.protectedAreas.choosePanel
fluid.def("bioreportr.atlasPanel", {
    $layers: "fluid.component",
    // Settings which a project may override:
    // The year from which a record counts as recent - the baseline of sightings, from which a plant counts as confirmed
    recentYear: 2000,
    // The label of each reporting status of the summary. A status may be followed by a year, e.g. "new 2021", shown
    // after its label
    statusLabels: {confirmed: "Confirmed", reported: "Historical", unconfirmed: "Historical", new: "New"},
    // The predicates of the query description language by which a record is a sighting of its plant, giving a date at
    // which it was seen - by default every record. A project whose catalogue holds records which are not, such as a
    // species list entered as pseudo-records, overrides this - see notes/query-description-language.md in imerss-bioinfo
    sightingPredicates: [],
    // The query by which the Community Science pane's panels choose their species, as parameters of iNaturalist's
    // species_counts API, e.g. {project_id: 303782} or {place_id: 121270, taxon_id: 211194} - see paneOverrides in the
    // project's story. Its species open on the atlas - see bioreportr.inatSpecies
    inatSpeciesQuery: null,
    // The plant or group chosen in the checklist, and its dated records
    checklistTaxon: "$compute:bioreportr.atlas.resolveTaxon({self}.taxa.rowById, {self}.checklist.search.filterState)",
    atlasRecords: "$compute:bioreportr.atlas.taxonRecords({self}.pkg, {self}.allObs, {self}.checklistTaxon, {self}.sightingPredicates)",
    atlasPanelMarkup: `$compute:bioreportr.atlas.panelMarkup({self}.checklistTaxon, {self}.atlasRecords,
        {self}.curation.historyById, {self}.curationHistorySources, {self}.curation.byTaxon, {self}.recordAnnotations, atlas, {self}.statusLabels)`,
    // The panel is shown on the atlas, while a plant with records is chosen - and on the Protected Areas pane, if the
    // story has one, see bioreportr.storyPageProtectedAreas
    taxonPanelVisible: "$compute:bioreportr.atlas.panelVisible({self}.taxonPanel.markup, {self}.activePaneKey)",
    // The extirpation risk pane shows the same panel of its chosen plant, with its regional EP
    solowDatedObs: "$compute:bioreportr.atlas.datedObsOfTaxon({self}.pkg, {self}.solowTaxa.selectedTaxon, {self}.sightingPredicates)",
    // The populations mapped by the extirpation risk pane are drawn from dated sightings alone, since an undated record
    // gives no time of sighting for its population's EP - the records table still lists every record
    solowEPObs: "$compute:bioreportr.atlas.datedObsOfTaxon({self}.pkg, {self}.solowTaxa.selectedTaxon, {self}.sightingPredicates, {self}.recordAnnotations)",
    // The map pans and zooms to the records of the plant chosen in the extirpation risk pane's table
    fitToSolowTaxon: "$effect:bioreportr.atlas.fitToTaxon({self}.map.readyMap, {self}.solowTaxa.selectedTaxon, {self}.solowTaxonObs, {self}.map.zoomDuration, {self}.activePaneKey)",
    solowTaxonPanel: {
        $component: {
            markup: `$compute:bioreportr.atlas.panelMarkup({storyPage}.solowTaxa.selectedTaxon, {storyPage}.solowDatedObs,
                {storyPage}.curation.historyById, {storyPage}.curationHistorySources, {storyPage}.curation.byTaxon, {storyPage}.recordAnnotations,
                solow, {storyPage}.statusLabels)`
        }
    },
    // The tiles of the atlas's three groups of species, placed in its section, each selecting its group
    statusById: "$compute:hortis.reportingStatusById({self}.taxa.rowById)",
    atlasTiles: "$compute:bioreportr.atlas.tilesMarkup({self}.taxa.allRows, {self}.statusById, {self}.selectedStatus, {self}.recentYear)",
    sectionInserts: "$compute:bioreportr.atlas.sectionInserts({self}.atlasTiles)",
    paneClick: "$method:bioreportr.atlas.paneClick({self}, {0}:event)",
    // A click anywhere on a row of the checklist chooses its taxon, as a click on one of its names does
    checklistRowClick: "$effect:bioreportr.atlas.bindRowClick({self}, {global})",
    // The checklist shows each species' reporting status by an icon - see bioreportr.atlas.checklistDecoration
    checklist: {
        $component: {
            decorate: "bioreportr.atlas.checklistDecoration"
        }
    },
    // The species of the Community Science pane open on the atlas - see bioreportr.inatSpecies
    inatSpeciesClick: "$effect:bioreportr.inatSpecies.bind({self}, {self}.inatSpeciesQuery, {global})",
    // The dated sightings of each taxon, from which the groups' summaries are drawn
    byTaxon: "$compute:bioreportr.atlas.groupRecords({self}.pkg, {self}.sightingPredicates)",
    // Summaries of each group of species, shown when hovering over its tile or its row of the map's legend
    statusTooltip: {
        $component: {
            $layers: "hortis.withTooltip",
            cache: "$compute:bioreportr.statusTooltip.makeCache({storyPage}.taxa.allRows)",
            renderTooltip: `$method:bioreportr.statusTooltip.render({storyPage}.taxa.allRows, {storyPage}.statusById, {storyPage}.byTaxon,
                {self}.cache, {storyPage}.recentYear, {0}:status)`,
            hover: {
                $bindable: {
                    bind: "bioreportr.statusTooltip.bind({self}, {global}.document)",
                    unbind: "bioreportr.statusTooltip.unbind({boundValue})"
                }
            }
        }
    }
});

// The panel is shown only on the atlas, while a plant with records is chosen
bioreportr.atlas.panelVisible = (markup, activePaneKey) => !!markup && activePaneKey === "Status";

/**
 * Fit the map to the records with coordinates of the plant chosen in the extirpation risk pane.
 * @param {maplibregl.Map} map - The story's map, once its style has applied
 * @param {TaxonRow|null} taxon - The plant chosen, if any
 * @param {Object[]} obsRows - All records
 * @param {Number} duration - The duration in milliseconds of the map's smooth move to the records
 * @param {String} activePaneKey - The key of the pane shown - the map is fitted only on the extirpation risk pane
 */
bioreportr.atlas.fitToTaxon = function (map, taxon, taxonObs, duration, activePaneKey) {
    if (taxon && activePaneKey === "Solow") {
        const points = taxonObs.map(bioreportr.obsPoint).filter(point => point);
        if (points.length > 0) {
            hortis.libreMap.afterLayout(map, () => {
                // The map may only just have been shown, in a pane which hid it
                map.resize();
                const bounds = points.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(points[0], points[0]));
                map.fitBounds(bounds, {padding: 80, maxZoom: 11, duration, essential: true});
            });
        }
    }
};

/**
 * Decorate a checklist row with an icon of its taxon's reporting status, as hortis.blitzChecklistDecoration does, but
 * referring to the icons by the ids the story page gives them, which carry the prefix `imerss-i-`. Without it the
 * icons refer to symbols which don't exist, and show nothing.
 * @param {TaxonRow} row - The checklist's taxon row
 * @return {VNode|null} The icon, or null if the taxon has no reporting status
 */
bioreportr.atlas.checklistDecoration = function (row) {
    const node = hortis.blitzChecklistDecoration(row);
    const use = node?.children.find(child => child.tag === "use");
    if (use && !use.attrs.href.startsWith("#imerss-i-")) {
        use.attrs.href = "#imerss-i-" + use.attrs.href.substring(1);
    }
    return node;
};

// The story pages whose checklist rows already choose their taxa
bioreportr.atlas.rowClickBound = new WeakSet();

/**
 * Let a click anywhere on a row of the checklist - on the separator between its names, or the space beside them -
 * choose its taxon, as hortis.checklist.click does only for a click on one of its names, by passing it on to the
 * row's first name.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Window} window - The window holding the story page
 */
bioreportr.atlas.bindRowClick = function (storyPage, window) {
    if (!bioreportr.atlas.rowClickBound.has(storyPage)) {
        bioreportr.atlas.rowClickBound.add(storyPage);
        window.document.addEventListener("click", event => {
            const row = event.target.matches?.("li.checklist-row") ? event.target : null;
            const name = row && [...row.children].find(child => child.matches("p[data-row-id]"));
            if (name) {
                name.click();
            }
        });
    }
};

/** The atlas's tiles of the three groups of species **/

// Each tile is a link which selects its group - its meaning is written for the story's recent year
bioreportr.atlas.tiles = [{
    status: "confirmed",
    name: "Confirmed",
    meaning: "Reported historically and found again since %recentYear."
}, {
    status: "unconfirmed",
    name: "Historical",
    meaning: "Reported in the past but not recorded since %recentYear."
}, {
    status: "new",
    name: "Newly reported",
    meaning: "Added new to the flora from recent reports."
}];

/**
 * Find the taxa of the summary holding a reporting status.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Object<String, String>} statusById - The reporting status of each taxon, by id - see hortis.reportingStatusById
 * @param {String} status - The reporting status
 * @return {TaxonRow[]} The taxa
 */
bioreportr.atlas.taxaOfStatus = function (taxaRows, statusById, status) {
    return taxaRows.filter(taxon => taxon.inSummary && statusById[taxon.id] === status);
};

/**
 * Render the tile for one group of species.
 * @param {Object} tile - One entry of `bioreportr.atlas.tiles`
 * @param {TaxonRow[]} taxa - The species of this group
 * @param {Boolean} pressed - Whether the group is selected
 * @param {Number} recentYear - The year from which a record counts as recent
 * @return {String} The markup for the tile
 */
bioreportr.atlas.renderTile = function (tile, taxa, pressed, recentYear) {
    return `<button type="button" class="mxcw-status-link mxcw-status-tile" data-status="${tile.status}" aria-pressed="${pressed}" style="--tip-colour:${bioreportr.statusColours[tile.status]}">
        <span class="mxcw-tile-name">${tile.name}</span>
        <span class="mxcw-tile-count">${bioreportr.formatCount(taxa.length)} <small>species</small></span>
        <span class="mxcw-tile-meaning">${tile.meaning.replace("%recentYear", recentYear)}</span>
    </button>`;
};

/**
 * Render the tiles of the three groups of species, computed from the site's data.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Object<String, String>} statusById - The reporting status of each taxon, by id
 * @param {String|null} selectedStatus - The selected group, if any
 * @param {Number} recentYear - The year from which a record counts as recent
 * @return {String} The markup of the tiles
 */
bioreportr.atlas.tilesMarkup = function (taxaRows, statusById, selectedStatus, recentYear) {
    return bioreportr.atlas.tiles.map(tile => bioreportr.atlas.renderTile(tile, bioreportr.atlas.taxaOfStatus(taxaRows, statusById, tile.status),
        tile.status === selectedStatus, recentYear)).join("");
};

bioreportr.atlas.sectionInserts = tiles => ({"mxcw-status-tiles": tiles});

/**
 * Select the group of a tile clicked in the atlas's section, or clear it if it is already selected.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Event} event - The click
 */
bioreportr.atlas.paneClick = function (storyPage, event) {
    const tile = event.target.closest(".mxcw-status-link");
    // A click in the Lost Plants gallery, if the story has one, is its own - see bioreportr.lostPlants.click
    const gallery = event.target.closest(".mxcw-lost-gallery-pane");
    if (tile) {
        const status = tile.dataset.status;
        storyPage.selectedStatus = storyPage.selectedStatus === status ? null : status;
    } else if (gallery) {
        bioreportr.lostPlants.click(storyPage, event);
    }
};

/**
 * Index the dated sightings of each taxon - by one query grouping their ids by taxon, each taxon's records being read
 * as row objects only when they are first asked for, e.g. by a summary of its group of species.
 * @param {VizPackage} pkg - The data package
 * @param {Object[]} sightingPredicates - The project's predicates of a sighting
 * @return {Object} The index, with a method `get` accepting a taxon id and returning its records, in no order, or
 * `undefined` if it has none - as a Map of taxon id to records would - and for a view which needs only a few of each
 * taxon's records, `idsOf`, returning the ids of its records in order of date, `rowOf`, reading a record by its id,
 * `yearOf`, the year of a record by its id, and `idsWhere`, returning a Set of the ids of the records passing a list
 * of predicates
 */
bioreportr.atlas.groupRecords = function (pkg, sightingPredicates) {
    const result = hortis.query(pkg, {from: "obs", where: bioreportr.datedPredicates(sightingPredicates),
        groupBy: ["iNaturalistTaxonId"], measures: {rows: {rows: true}}});
    const bare = fluid.unwrapProxy(pkg), obs = bare.tables.obs;
    const groupOf = new Map();
    for (let g = 0; g < result.groups; ++g) {
        groupOf.set(String(result.keys.iNaturalistTaxonId[g]), g);
    }
    const cache = new Map();
    const {offsets, values} = result.measures.rows;
    const days = obs.columns.eventDate.days;
    return {
        has: taxonId => groupOf.has(String(taxonId)),
        idsOf: function (taxonId) {
            const g = groupOf.get(String(taxonId));
            // Ordered by day, and within a day as the records were catalogued
            return g === undefined ? new Int32Array(0) : values.slice(offsets[g], offsets[g + 1]).sort((a, b) => days[a] - days[b] || a - b);
        },
        rowOf: id => hortis.qdl.rowObject(obs, id),
        yearOf: id => hortis.qdl.dateParts.year(days[id]),
        idsWhere: predicates => new Set(hortis.query(pkg, {from: "obs", where: predicates, select: {rows: true}}).rows),
        get: function (taxonId) {
            const id = String(taxonId);
            let togo = cache.get(id);
            if (!togo && groupOf.has(id)) {
                const g = groupOf.get(id);
                togo = hortis.qdl.rowObjects(obs, values.subarray(offsets[g], offsets[g + 1]));
                cache.set(id, togo);
            }
            return togo;
        }
    };
};

/** Plants opened from other panes, and their photos **/

/**
 * Find a photo of a taxon which may be republished. iNaturalist records no licence code for a photo with all rights
 * reserved, and photos licensed against derivatives are passed over since the gallery crops them to squares. The
 * taxon's default photo is preferred, followed by the others curated for it.
 * @param {Object} taxon - A taxon record from the iNaturalist API
 * @return {Object|undefined} The photo record, if there is an openly licensed one
 */
bioreportr.atlas.licensedPhoto = function (taxon) {
    const photos = [taxon.default_photo, ...(taxon.taxon_photos || []).map(entry => entry.photo)];
    return photos.find(photo => photo?.license_code && !photo.license_code.includes("-nd"));
};

/**
 * Open the extirpation risk pane with a plant selected - one chosen in the Lost Plants gallery or the In Memoriam timeline, bringing its row into view.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} taxonId - The id of the plant's taxon
 * @param {String} targetPane - The key of the pane listing a species' records
 * @param {Document} dokkument - The document holding the story page
 * @param {Window} window - The window holding the story page
 */
bioreportr.atlas.showSolowTaxon = function (storyPage, taxonId, targetPane, dokkument, window) {
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

/** The species of the Community Science pane, which open on the atlas **/

fluid.registerNamespace("bioreportr.inatSpecies");

// The lookup of the species of the Community Science pane, made once, on the first click
bioreportr.inatSpecies.lookup = null;

/**
 * Look up the iNaturalist taxa of the species shown by the Community Science pane's panels, which name each by its
 * common name alone, by the same query the panels make. Made once, on the first click.
 * @param {Object} query - The panels' query, as parameters of iNaturalist's species_counts API
 * @param {Window} window - The window holding the story page
 * @return {Promise<Map<String, Object>>} Map of lower-cased common name to the taxon's `id` and scientific `name`
 */
bioreportr.inatSpecies.byName = function (query, window) {
    if (!bioreportr.inatSpecies.lookup) {
        const params = new URLSearchParams({verifiable: "true", ...query, per_page: "500"});
        bioreportr.inatSpecies.lookup = window.fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`)
            .then(response => response.json())
            .then(data => new Map(data.results.filter(result => result.taxon.preferred_common_name)
                .map(result => [result.taxon.preferred_common_name.toLowerCase(), {id: String(result.taxon.id), name: result.taxon.name}])));
    }
    return bioreportr.inatSpecies.lookup;
};

/**
 * Find the atlas's taxon for a species of iNaturalist - the same taxon, or else the atlas's taxon of that scientific name
 * or one beneath it.
 * @param {Object<String, TaxonRow>} rowById - The atlas's taxa
 * @param {Object} taxon - The iNaturalist taxon, with its `id` and scientific `name`
 * @return {TaxonRow|undefined} The atlas's taxon, preferring one of its summary
 */
bioreportr.inatSpecies.atlasRow = function (rowById, taxon) {
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
 * Open the atlas on the species of a card of the Community Science pane, if it is one of the atlas's taxa. The plant is
 * kept as the pane changes, which a story may otherwise clear it on - see bioreportr.storyPage.keepTaxon.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {HTMLElement} card - The card clicked
 * @param {Object} query - The panels' query - see bioreportr.inatSpecies.byName
 * @param {Window} window - The window holding the story page
 */
bioreportr.inatSpecies.open = function (storyPage, card, query, window) {
    const name = card.querySelector(".inat-observation-label-title")?.textContent.trim().toLowerCase();
    if (name) {
        bioreportr.inatSpecies.byName(query, window).then(byName => {
            const taxon = byName.get(name);
            const row = taxon && bioreportr.inatSpecies.atlasRow(storyPage.taxa.rowById, taxon);
            if (row) {
                bioreportr.storyPage.keepTaxon.add(storyPage);
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
bioreportr.inatSpecies.isSpeciesCard = function (card) {
    const tab = [...card.closest(".mxcw-inat-components").querySelectorAll("li")].find(item => /selected/.test(item.className));
    return !!tab && tab.textContent.trim() === "Most common";
};

// The story pages whose Community Science cards already open their species
bioreportr.inatSpecies.bound = new WeakSet();

/**
 * Listen for clicks on the cards of the Community Science pane, which the iNaturalist panels render outside the story
 * page's own handling of clicks in its panes. Only the cards of "Most common" are species, which open the atlas - those
 * of "Recent" and "Most favourited" are observations, whose own handler opens them on iNaturalist.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Object|null} query - The panels' query - see bioreportr.inatSpecies.byName - or null if the story has none
 * @param {Window} window - The window holding the story page
 */
bioreportr.inatSpecies.bind = function (storyPage, query, window) {
    if (query && !bioreportr.inatSpecies.bound.has(storyPage)) {
        bioreportr.inatSpecies.bound.add(storyPage);
        // Caught as it descends, before the card's own handler
        window.document.addEventListener("click", event => {
            const card = event.target.closest?.(".mxcw-inat-components article");
            if (card && bioreportr.inatSpecies.isSpeciesCard(card)) {
                event.preventDefault();
                event.stopPropagation();
                bioreportr.inatSpecies.open(storyPage, card, query, window);
            }
        }, true);
    }
};

/** Summaries of the groups of species, shown on hovering over a tile or a row of the map's legend **/

fluid.registerNamespace("bioreportr.statusTooltip");

bioreportr.statusTooltip.frame = (name, count, body) =>
    `<div class="mxcw-tip-title">${name} <span>${bioreportr.formatCount(count)} species</span></div>${body}`;

bioreportr.firstRecorder = record => (record.recordedBy || "Unknown").split(";")[0].trim() || "Unknown";

// The five recorders to whom the most of a list of records are owed
bioreportr.statusTooltip.topRecorders = function (records) {
    const counts = {};
    records.forEach(record => {
        const recorder = bioreportr.firstRecorder(record);
        counts[recorder] = (counts[recorder] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
};

bioreportr.statusTooltip.isRecent = (record, recentYear) => parseInt(record.eventDate, 10) >= recentYear;

bioreportr.statusTooltip.renderers = {
    // When each historically reported species was first found again since the recent year, and who found the most of them again
    confirmed: function (taxa, byTaxon, recentYear) {
        const refound = taxa.map(taxon => (byTaxon.get(taxon.id) || []).slice().sort(bioreportr.obsDateComparator)
            .find(record => bioreportr.statusTooltip.isRecent(record, recentYear))).filter(record => record);
        return bioreportr.statusTooltip.frame("Confirmed", taxa.length,
            bioreportr.tip.heading("Observers who found the most species again") + bioreportr.tip.bars(bioreportr.statusTooltip.topRecorders(refound)));
    },
    // Each species' first record, among those made in recent years
    new: function (taxa, byTaxon, recentYear) {
        const firsts = taxa.map(taxon => (byTaxon.get(taxon.id) || []).slice().sort(bioreportr.obsDateComparator)[0])
            .filter(record => record && bioreportr.statusTooltip.isRecent(record, recentYear));
        return bioreportr.statusTooltip.frame("Newly reported", taxa.length,
            bioreportr.tip.heading(`Observers with most added records since ${recentYear}`) + bioreportr.tip.bars(bioreportr.statusTooltip.topRecorders(firsts)));
    },
    unconfirmed: function (taxa, byTaxon) {
        const records = taxa.map(taxon => (byTaxon.get(taxon.id) || []).slice().sort(bioreportr.obsDateComparator)).filter(list => list.length > 0);
        const withLocality = records.filter(list => list.some(record => record.locality)).length;
        const withSpecimen = records.filter(list => list.some(record => /specimen/i.test(record.basisOfRecord))).length;
        return bioreportr.statusTooltip.frame("Historical", taxa.length,
            bioreportr.tip.heading("Last recorded by") + bioreportr.tip.bars(bioreportr.statusTooltip.topRecorders(records.map(list => fluid.peek(list)))) +
            `<div class="mxcw-tip-note">${withLocality} species have a recorded locality to search, and ${withSpecimen} have a specimen to consult.</div>`);
    }
};

/**
 * Render the summary of a group of species. Each summary is rendered once, since it depends only on the site's data.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Object<String, String>} statusById - The reporting status of each taxon, by id
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @param {Object<String, String>} cache - The summaries already rendered, by status
 * @param {Number} recentYear - The year from which a record counts as recent
 * @param {String} status - The group's reporting status
 * @return {String|null} The summary's markup, or null if there is no such group
 */
bioreportr.statusTooltip.render = function (taxaRows, statusById, byTaxon, cache, recentYear, status) {
    const renderer = bioreportr.statusTooltip.renderers[status];
    if (renderer && !cache[status]) {
        cache[status] = `<div class="mxcw-tip mxcw-tip-visible" style="--tip-colour:${bioreportr.statusColours[status]}">` +
            renderer(bioreportr.atlas.taxaOfStatus(taxaRows, statusById, status), byTaxon, recentYear) + "</div>";
    }
    return cache[status] || null;
};

bioreportr.statusTooltip.makeCache = () => ({});

/**
 * Find which group of species an element in the page refers to, if any - a tile of the atlas or a row of the legend
 * of a map coloured by status.
 * @param {Element} element - The element under the pointer
 * @return {String|null} The group's reporting status, or null if there is none
 */
bioreportr.statusTooltip.statusFor = function (element) {
    const link = element.closest?.(".mxcw-status-link");
    const row = element.closest?.(".mxcw-map .mxcw-region-legend [data-selects=\"status\"]");
    return link ? link.dataset.status : row ? row.dataset.key : null;
};

/**
 * Report the group of species under the pointer to the tooltip. The listeners are bound to the document, since the
 * tiles and the legend are rerendered beneath them.
 * @param {fluid.component} that - The tooltip, a hortis.withTooltip
 * @param {Document} dokkument - The document
 * @return {Object} A record of the listeners, to be supplied to `bioreportr.statusTooltip.unbind`
 */
bioreportr.statusTooltip.bind = function (that, dokkument) {
    const move = event => that.hoverAt(bioreportr.statusTooltip.statusFor(event.target), event);
    const leave = event => {
        if (!event.relatedTarget || !bioreportr.statusTooltip.statusFor(event.relatedTarget)) {
            that.hoverAt(null);
        }
    };
    dokkument.addEventListener("mousemove", move);
    dokkument.addEventListener("mouseout", leave);
    return {dokkument, move, leave};
};

bioreportr.statusTooltip.unbind = function (record) {
    record.dokkument.removeEventListener("mousemove", record.move);
    record.dokkument.removeEventListener("mouseout", record.leave);
};

/**
 * Resolve the taxon chosen in the checklist's search, whose state held in the URL records only its id.
 * @param {Object<String, TaxonRow>} rowById - Taxon rows indexed by id
 * @param {Object|null} search - The search's state, a taxon row or a record holding its `id`
 * @return {TaxonRow|null} The taxon's row, or null if none is chosen
 */
bioreportr.atlas.resolveTaxon = function (rowById, search) {
    return search && rowById[search.id] || null;
};

/**
 * Label a reporting status of the summary - e.g. "confirmed", "reported" (historically, not yet found again), or
 * "new 2021", with the year of its first report, which is shown after its label.
 * @param {String} status - The status
 * @param {Object<String, String>} labels - The label of each status, by its first word - see the story page's statusLabels
 * @return {String|undefined} The label, if the status has one
 */
bioreportr.atlas.statusLabel = (status, labels) => {
    const [kind, year] = String(status || "").split(" ");
    const label = labels[kind];
    return label && year ? `${label} (${year})` : label;
};

bioreportr.atlas.field = (label, value) => value ? `<dt>${label}:</dt> <dd>${hortis.dataTable.encode(value)}</dd>` : "";

/**
 * Find the dated sightings of a taxon, or of any taxon beneath it, in order of date.
 * @param {VizPackage} pkg - The data package
 * @param {Selection} selection - The observations from which they are drawn
 * @param {TaxonRow|null} taxon - The taxon, if any is chosen
 * @param {Object[]} sightingPredicates - The project's predicates of a sighting
 * @return {Object[]} The records
 */
bioreportr.atlas.taxonRecords = function (pkg, selection, taxon, sightingPredicates) {
    return taxon ? bioreportr.queryRows(pkg, [{field: "iNaturalistTaxonId", op: "within", taxa: [taxon.id]},
        ...bioreportr.datedPredicates(sightingPredicates)], selection) : [];
};

/**
 * Find the dated sightings of a taxon alone, in order of date, optionally leaving out the records suspended from the
 * calculation of extirpation probability - from which the populations mapped by the extirpation risk pane are drawn.
 * @param {VizPackage} pkg - The data package
 * @param {TaxonRow|null} taxon - The taxon, if any is chosen
 * @param {Object[]} sightingPredicates - The project's predicates of a sighting
 * @param {Object<String, Object>} [annotations] - The annotations of records, by occurrenceID, if those suspended
 * from the calculation are to be left out
 * @return {Object[]} The records
 */
bioreportr.atlas.datedObsOfTaxon = function (pkg, taxon, sightingPredicates, annotations) {
    return taxon ? bioreportr.queryRows(pkg, [{field: "iNaturalistTaxonId", op: "=", value: taxon.id},
        ...bioreportr.datedPredicates(sightingPredicates), ...bioreportr.notExcludedFromEPPredicates(fluid.unwrapProxy(annotations))]) : [];
};

/**
 * Render the panel of the plant or group chosen in the checklist - or, in the extirpation risk pane, of the plant chosen
 * for its analysis, which also gives its regional EP.
 * @param {TaxonRow|null} taxon - The chosen taxon
 * @param {Object[]} records - Its dated records
 * @param {Object<String, Object>} [historyById] - The history of the curatorial notes on each taxon, by id
 * @param {Object[]} [sources] - The sources of that history, oldest first - see bioreportr.curationForm.historyMarkup
 * @param {Object<String, CurationNote[]>} [byTaxon] - The notes added through the site on each taxon, by id
 * @param {Object<String, Object>} [annotations] - The annotations of records, by occurrenceID
 * @param {String} [context] - "atlas", or "solow" for the extirpation risk pane - which also names the panel's tabs,
 * so that those of the two panes are chosen apart
 * @param {Object<String, String>} [statusLabels] - The label of each reporting status - see bioreportr.atlas.statusLabel
 * @return {String} The panel's markup, empty if no taxon with records is chosen
 */
bioreportr.atlas.panelMarkup = function (taxon, records, historyById, sources, byTaxon, annotations, context = "atlas", statusLabels = {}) {
    let togo = "";
    if (taxon && records.length > 0) {
        togo = `<div class="mxcw-solow-taxon-pane mxcw-atlas-taxon-pane">
  <div class="mxcw-taxon-image">${hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)}</div>
  <div class="mxcw-taxon-info">
    <div class="mxcw-taxon-name">${hortis.dataTable.encode((taxon.scientificName || taxon.iNaturalistTaxonName) + (taxon.commonName ? ` (${taxon.commonName})` : ""))}</div>
    <div class="mxcw-atlas-facts">
      <dl class="mxcw-taxon-fields">
        <dt>Date first seen:</dt> <dd>${bioreportr.eventDay(records[0].eventDate)}</dd>
        <dt>Date last seen:</dt> <dd>${bioreportr.eventDay(fluid.peek(records).eventDate)}</dd>
        <dt>Total records:</dt> <dd>${bioreportr.formatCount(records.length)}</dd>
        ${bioreportr.atlas.field("Status", bioreportr.atlas.statusLabel(taxon.reportingStatus, statusLabels))}
      ${context === "solow" ? bioreportr.atlas.field("Regional EP", taxon.solow_EP) : ""}
      </dl>
      ${bioreportr.georefNote(records)}
    </div>
    ${bioreportr.atlas.historyMarkup(records, context + "-" + taxon.id, bioreportr.atlas.notesMarkup(taxon, records, historyById, sources, byTaxon, annotations))}
  </div>
</div>`;
    }
    return togo;
};

/** The history of a plant's records, charted in the atlas's panel - only there, since the extirpation risk pane's panel
    has no room for it beside its slider **/

// The first decade charted, that of the earliest records of the flora, so that every plant is charted on the same span
bioreportr.atlas.firstDecade = 1850;

bioreportr.atlas.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

/**
 * Count the records of a plant in each decade from `bioreportr.atlas.firstDecade` to the present, and in each month.
 * @param {Object[]} records - The plant's dated records
 * @param {Number} [thisYear] - The present year
 * @return {Object} Members `decades`, {decade, count}[], and `months`, Number[12]
 */
bioreportr.atlas.history = function (records, thisYear = new Date().getFullYear()) {
    const first = bioreportr.atlas.firstDecade;
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
bioreportr.atlas.columns = function (columns, kind) {
    // On a square root scale, so that the few records of earlier decades still show beside the many of recent ones
    const max = Math.sqrt(Math.max(...columns.map(column => column.value), 1));
    const slots = columns.map(column => `<span class="mxcw-history-slot" title="${column.title}">` +
        `<span class="mxcw-history-bar${column.value ? "" : " mxcw-history-empty"}" style="height:${Math.sqrt(column.value) / max * 100}%"></span>` +
        `<span class="mxcw-history-label">${column.label}</span></span>`).join("");
    return `<div class="mxcw-history-chart mxcw-history-${kind}">${slots}</div>`;
};

/**
 * Render the history of a plant's observations - how many were made in each decade, and in each month of the year - as
 * one chart at a time, chosen by its tabs. The tabs are radio buttons, so that they work without script, the chart shown
 * being picked by CSS - see the styles in this file.
 * @param {Object[]} records - The plant's dated records
 * @param {String} taxonId - The plant's id, naming its tabs apart from any other panel's
 * @return {String} The markup of the charts and their tabs
 */
bioreportr.atlas.historyMarkup = function (records, taxonId, notes = "") {
    const {decades, months} = bioreportr.atlas.history(records);
    const count = n => bioreportr.formatCount(n) + (n === 1 ? " report" : " reports");
    const decadeColumns = decades.map(({decade, count: n}) => ({value: n, title: `${decade}s: ${count(n)}`,
        label: decade % 50 === 0 ? String(decade) : ""}));
    const monthColumns = months.map((n, month) => ({value: n, title: `${bioreportr.atlas.monthNames[month]}: ${count(n)}`,
        label: bioreportr.atlas.monthNames[month][0]}));
    const name = "mxcw-history-" + taxonId;
    const tab = (kind, label, title, checked) => `<input type="radio" class="mxcw-history-${kind}-tab" id="${name}-${kind}" name="${name}"${checked ? " checked" : ""}>` +
        `<label for="${name}-${kind}" title="${title}">${label}</label>`;
    return `<div class="mxcw-history">
      <div class="mxcw-history-tabs" role="tablist">${tab("decade", "Decades", "Reports by decade", true)}${tab("month", "Months", "Reports by month", false)}${tab("notes", "Notes", "Annotation history", false)}</div>
      ${bioreportr.atlas.columns(decadeColumns, "decades")}
      ${bioreportr.atlas.columns(monthColumns, "months")}
      <div class="mxcw-history-notes">${notes}</div>
    </div>`;
};

/**
 * Render the history of the annotations of a plant, shown by the Notes tab of the atlas's panel - any records set aside,
 * e.g. as planted, then its curatorial notes from the earliest account to those added through the site, as the History
 * tab of the curation pane shows them - see bioreportr.curationForm.historyMarkup.
 * @param {TaxonRow} taxon - The plant
 * @param {Object[]} records - Its records
 * @param {Object<String, Object>} historyById - The history of the curatorial notes on each taxon, by id
 * @param {Object[]} sources - The sources of that history, oldest first - see bioreportr.curationForm.historyMarkup
 * @param {Object<String, CurationNote[]>} byTaxon - The notes added through the site on each taxon, by id
 * @param {Object<String, Object>} annotations - The annotations of records, by occurrenceID
 * @return {String} The markup of the history
 */
bioreportr.atlas.notesMarkup = function (taxon, records, historyById, sources, byTaxon, annotations) {
    const setAside = bioreportr.solowAnnotationNote(records, annotations);
    const history = bioreportr.curationForm?.historyMarkup ? bioreportr.curationForm.historyMarkup(taxon, historyById || {}, sources, byTaxon || {}) : "";
    return setAside + history;
};
</script>

<style>
/* The atlas's panel of the chosen plant: its facts, and beside them a chart of the history of its observations, by
   decade or by month as chosen by the chart's tabs - see bioreportr.atlas.historyMarkup. The extirpation risk pane's panel,
   which shares its other styles, has no chart. On a narrow panel the chart falls beneath the facts */
/* The plant's name runs across the top of the panel's column, and beneath it its facts and the chart sit side by side,
   the chart filling the height left to it. Where the column is too narrow for both, the chart falls beneath the facts */
.mxcw-atlas-taxon-pane .mxcw-taxon-info {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 4px 20px;
    padding-right: var(--story-gap);
}

.mxcw-atlas-taxon-pane .mxcw-taxon-name {
    grid-column: 1 / -1;
    padding-bottom: 4px;
}

@container (max-width: 380px) {
    .mxcw-atlas-taxon-pane .mxcw-taxon-info {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto;
    }
}

/* On a phone the chart always falls beneath the facts, the panel's column scrolling to it */
@media (max-width: 767.98px) {
    .mxcw-atlas-taxon-pane .mxcw-taxon-info {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto;
    }

    .mxcw-atlas-taxon-pane .mxcw-history-chart,
    .mxcw-atlas-taxon-pane .mxcw-history-notes {
        min-height: 90px;
    }
}

/* The photo yields room to the chart, which it does not share in the extirpation risk pane's panel */
.mxcw-atlas-taxon-pane .mxcw-taxon-image {
    max-width: 34%;
}

.mxcw-atlas-facts {
    min-width: 0;
}

/* The column is as wide as the facts - a note beneath them wraps within it rather than widening it */
.mxcw-atlas-facts > :not(dl) {
    contain: inline-size;
}

/* Dates and counts are kept whole */
.mxcw-atlas-facts dd {
    white-space: nowrap;
}

.mxcw-history {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}

.mxcw-history-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;
}

.mxcw-history-heading {
    flex: 0 0 100%;
    margin-bottom: 2px;
    color: #5a7680;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

/* The tabs are radio buttons, hidden behind their labels */
.mxcw-history-tabs input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.mxcw-history-tabs label {
    padding: 1px 9px;
    border: 1px solid #c9d6dc;
    border-radius: 999px;
    color: #4b778f;
    font-size: 12px;
    cursor: pointer;
}

.mxcw-history-tabs input:checked + label {
    border-color: #2f7f8f;
    background: #2f7f8f;
    color: #fff;
}

.mxcw-history-tabs input:focus-visible + label {
    outline: 2px solid #4b778f;
    outline-offset: 1px;
}

.mxcw-history:has(.mxcw-history-decade-tab:checked) .mxcw-history-months,
.mxcw-history:has(.mxcw-history-month-tab:checked) .mxcw-history-decades,
.mxcw-history:has(.mxcw-history-notes-tab:checked) .mxcw-history-chart,
.mxcw-history:not(:has(.mxcw-history-notes-tab:checked)) .mxcw-history-notes {
    display: none;
}

/* The Notes tab's history of the plant's annotations, scrolling within the room the charts take */
.mxcw-history-notes {
    flex: 1 1 auto;
    min-height: 70px;
    max-height: 150px;
    overflow-y: auto;
    padding-right: 4px;
    color: #1f2a30;
    font-size: 12px;
    line-height: 1.35;
}

.mxcw-history-notes .mxcw-curation-history {
    margin: 0 0 0 6px;
    padding: 0 0 0 14px;
    border-left: 2px solid rgba(90, 118, 128, 0.35);
    list-style: none;
}

.mxcw-history-notes .mxcw-curation-history-entry {
    position: relative;
    margin: 0 0 8px;
    list-style: none;
}

.mxcw-history-notes .mxcw-curation-history-entry::marker {
    content: none;
}

.mxcw-history-notes .mxcw-curation-history-entry::before {
    content: "";
    position: absolute;
    top: 0.45em;
    left: -19px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5a7680;
}

.mxcw-history-notes .mxcw-curation-history-site::before {
    background: #e8711a;
}

.mxcw-history-notes .mxcw-curation-history-head span,
.mxcw-history-notes .mxcw-curation-history-reviewed,
.mxcw-history-notes .mxcw-curation-none {
    color: #5a7680;
}

.mxcw-history-notes .mxcw-curation-history-reviewed {
    margin: 2px 0 0;
}

.mxcw-history-notes .mxcw-curation-history-text a {
    color: #184e62;
}

.mxcw-history-notes .mxcw-solow-annotation-note {
    margin: 0 0 6px;
}

.mxcw-history-chart {
    display: flex;
    gap: 2px;
    flex: 1 1 auto;
    height: auto;
    min-height: 70px;
    max-height: 150px;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(90, 118, 128, 0.35);
}

.mxcw-history-slot {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
}

.mxcw-history-bar {
    display: block;
    width: 100%;
    min-height: 2px;
    border-radius: 3px 3px 0 0;
    background: #2f7f8f;
}

.mxcw-history-bar.mxcw-history-empty {
    min-height: 0;
}

.mxcw-history-slot:hover .mxcw-history-bar {
    background: #184e62;
}

/* The labels hang beneath the axis, outside the chart's height */
.mxcw-history-label {
    position: absolute;
    top: calc(100% + 2px);
    left: 50%;
    transform: translateX(-50%);
    color: #5a7680;
    font-size: 10px;
    line-height: 1;
    white-space: nowrap;
}

/* The first label is aligned with the chart's edge, which would otherwise cut it off */
.mxcw-history-slot:first-child .mxcw-history-label {
    left: 0;
    transform: none;
}

/* The atlas's tiles of its three groups of species and their summaries */
/* ── Atlas links to status groups ────────────────────────── */

.mxcw-status-link {
    font-weight: 700;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
    cursor: pointer;
    border-radius: 4px;
    padding: 0 4px;
    margin-left: -4px;
}

.mxcw-status-link:hover,
.mxcw-status-link:focus-visible {
    text-decoration-style: solid;
}

.mxcw-status-link[aria-pressed="true"] {
    color: #0d3040;
    background: #FDF2CE;
    text-decoration: none;
}

/* ── Group summaries in the atlas ────────────────────────── */

.mxcw-tip {
    position: fixed;
    z-index: 1000;
    width: 300px;
    padding: 12px;
    display: none;
    pointer-events: none;
    color: #eefaff;
    background: #0d3040;
    border: 1px solid #4a9aaa;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.35;
}

.mxcw-tip-visible {
    display: block;
}

/* The group summaries are framed as the summaries of map cells are - see imerss-story.css */
.imerss-tooltip-holder:has(.mxcw-tip) {
    max-width: none;
    padding: 0;
    border: 1px solid #4a9aaa;
    border-radius: 8px;
    background: #0d3040;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

/* The group summaries are placed by the IMERSS framework's tooltip holder, which supplies the frame */
.imerss-tooltip-holder .mxcw-tip {
    position: static;
    border: 0;
    box-shadow: none;
}

/* ── Atlas tiles for the three groups of species ─────────── */

.mxcw-status-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--story-gap);
    margin: 0 0 0.6em;
}

.mxcw-status-tile {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    padding: var(--story-gap);
    text-align: left;
    font-weight: 400;
    color: #eefaff;
    text-decoration: none;
    background: #0d3040;
    border-top: 3px solid var(--tip-colour);
    border-radius: var(--data-table-radius);
    outline: 2px solid transparent;
    outline-offset: -2px;
}

.mxcw-status-tile:hover,
.mxcw-status-tile:focus-visible,
.mxcw-status-tile[aria-pressed="true"] {
    color: #eefaff;
    background: #0d3040;
    outline-color: #FDF2CE;
}

.mxcw-tile-name {
    font-size: var(--story-data);
    font-weight: 700;
}

.mxcw-tile-count {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.15;
}

.mxcw-tile-count small {
    font-size: var(--story-small);
    font-weight: 400;
    color: #a8c8d0;
}

.mxcw-tile-meaning {
    flex: 1;
    font-size: var(--story-small);
    line-height: 1.3;
    color: #a8c8d0;
    margin-top: 2px;
}
</style>
