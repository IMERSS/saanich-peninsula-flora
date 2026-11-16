<fluid-import src="bioreportr-atlasPanel.vue"></fluid-import>
<script src="../js/story.js"></script>
<script>
"use strict";

// The Lost Plants pane of a story - its section, knitted from content/story/LostPlants.Rmd, and the gallery of "lost"
// plants shown in its data pane in place of the map. The plants are selected from the site's data whenever
// it loads, so that the gallery follows the data, and their photos are looked up live from iNaturalist. The gallery is
// configured onto the story page, as its member lostPlants, by the layer bioreportr.storyPageLostPlants, defined in
// bioreportr-storyPageLostPlants.vue, which a project names in the $layers of its <project>-story.vue, together with
// bioreportr.atlasPanel

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
fluid.registerNamespace("bioreportr.lostPlants");

// The gallery of lost plants, with tabs showing in its place the plants of the other reporting statuses
fluid.def("bioreportr.lostPlants", {
    $layers: "fluid.component",
    // A native species which is historically reported but unconfirmed is shown if it has at least this Solow EP ...
    minEP: 0.3,
    // ... or no more than this number of records
    maxRecords: 2,
    // The galleries chosen by the tabs, in their order. Each of the first is of the native species of a reporting
    // status - see hortis.reportingStatusById - the "lost" gallery further selected by minEP and maxRecords. Each of the
    // last is of groups of the taxa which the curation workflow kept off the list, read from excludedTaxaFile - see
    // scripts/prepare_excluded_taxa.R. A gallery with no plants, e.g. in a story without that file, has no tab
    galleries: {
        lost: {label: "Lost", status: "unconfirmed", title: "Native species historically reported, not seen in recent decades"},
        confirmed: {label: "Confirmed", status: "confirmed", title: "Native species recorded both historically and recently"},
        new: {label: "New", status: "new", title: "Native species first reported in recent decades"},
        // Taxa the curators have excluded from the list - flagged doubtful, persisting or planted
        excluded: {label: "Excluded", group: "excluded", title: "Taxa the curators have excluded from the checklist"},
        // Taxa still awaiting review, followed by those never reviewed, most recorded first in each
        underReview: {label: "Under review", group: ["underReview", "unlisted"], title: "Taxa not yet on the checklist, awaiting review"}
    },
    // The taxa kept off the list
    excluded: "$compute:bioreportr.lostPlants.loadExcluded({storyPage}.excludedTaxaFile)",
    // The gallery shown
    gallery: "lost",
    // The maximum number of ids accepted by a single request to the iNaturalist taxa endpoint
    batchSize: 30,
    // Observes iNaturalist's requested limit of about one request per second
    batchDelay: 1100,
    // The cards of each gallery, by its key - each {cards: String[], complete: Boolean}
    cards: {},
    // Derived only once the pane is first shown - see the story page's activatedPanes
    plants: "$compute:bioreportr.lostPlants.plantsOnceShown({storyPage}, {self}, {storyPage}.activatedPanes)",
    // The photos of a gallery are fetched only once its tab is first chosen
    load: "$effect:bioreportr.lostPlants.load({self}, {self}.plants, {self}.gallery, {storyPage}.loaded)",
    // The cards are shown in a fresh random order each time the pane is opened, so that a different assemblage leads
    reshuffle: "$effect:bioreportr.lostPlants.reshuffle({self}, {storyPage}.activePaneKey)",
    markup: "$compute:bioreportr.lostPlants.markup({self}.cards, {self}.gallery, {self}.galleries, {self}.plants, {self})",
    // Once the gallery is drawn afresh, its search box is given back its focus, and any plant searched for is shown - see
    // bioreportr.lostPlants.afterRender
    afterRender: "$effect:bioreportr.lostPlants.afterRender({storyPage}, {self}.markup, {global})",
    // The gallery handles its own clicks, and a card turned over to show its notes turns back once the pointer leaves
    // it - see bioreportr.lostPlants.bindEvents
    events: "$effect:bioreportr.lostPlants.bindEvents({storyPage}, {global})",
    count: "$compute:bioreportr.lostPlants.count({self}.cards)"
});

// The pane's section, rendered from the template below - its text gives the number of plants in the gallery, and holds
// a block of text for each of the gallery's tabs, of which only that of the tab chosen is shown
fluid.def("bioreportr.lostPlantsPane", {
    $layers: "fluid.component",
    count: "{storyPage}.lostPlants.count",
    showText: "$effect:bioreportr.lostPlants.showText({storyPage}.lostPlants.gallery, {storyPage}.activePaneKey, {global})"
});

/** The gallery of lost plants **/

/**
 * Load the taxa kept off the list by the curation workflow - see scripts/prepare_excluded_taxa.R.
 * @param {String|null} file - The file of excluded taxa, if the story has one
 * @return {Promise<Object[]>|Object[]} Its rows
 */
bioreportr.lostPlants.loadExcluded = function (file) {
    return file ? hortis.csvReader.load(file, {header: true, skipEmptyLines: true}).then(parsed => parsed?.data || []) : [];
};

/**
 * Select the plants of each gallery once the pane is first shown - until then there are none. The members of the story
 * page and the pane are read within, rather than as arguments, so that none of them is derived until the pane is shown.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {bioreportr.lostPlants} that - The pane's component
 * @param {Object<String, Boolean>} activatedPanes - The panes which have been shown
 * @return {Object<String, Object[]>} The plants of each gallery - see bioreportr.lostPlants.select
 */
bioreportr.lostPlants.plantsOnceShown = (storyPage, that, activatedPanes) => activatedPanes.LostPlants ?
    bioreportr.lostPlants.select(storyPage.taxa.allRows, storyPage.pkg, that, storyPage.recordAnnotations, storyPage.statusById,
        storyPage.sightingPredicates, that.galleries, that.excluded) : {};

/**
 * Select the plants of each gallery from the site's data. The galleries of reporting statuses hold the native species
 * of their status - and the "lost" gallery, highest extirpation probability first, only those whose Solow EP is at
 * least `minEP` or which have no more than `maxRecords` records. A gallery with a `group` holds the excluded taxa of
 * that group, most recorded first.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {VizPackage} pkg - The data package
 * @param {Object} options - Members `minEP` and `maxRecords`
 * @param {Object<String, Object>} [annotations] - The annotations of records, by occurrenceID - those suspended from the
 * calculation of extirpation probability, e.g. of a planted population, are not counted as sightings
 * @param {Object<String, String>} statusById - The reporting status of each taxon, by id - see hortis.reportingStatusById,
 * which reads a summary's "reported" as unconfirmed
 * @param {Object[]} sightingPredicates - The predicates of a sighting - see the story page's member sightingPredicates
 * @param {Object<String, Object>} galleries - The galleries, by key - see bioreportr.lostPlants
 * @param {Object[]} excluded - The taxa kept off the list - see bioreportr.lostPlants.loadExcluded
 * @return {Object<String, Object[]>} The plants of each gallery, by its key, each with members `taxon`, `nRecords`,
 * `nUnmapped` and `lastRecorded`, and for an excluded taxon `excluded`, its row
 */
bioreportr.lostPlants.select = function (taxaRows, pkg, options, annotations, statusById, sightingPredicates, galleries, excluded) {
    // The sightings of each taxon counted towards EP, how many of them can't be mapped, and the year of the last - by one
    // query grouping them by taxon
    const year = {year: "eventDate"};
    const unmapped = {not: {all: bioreportr.coordinatePredicates}};
    const result = hortis.query(pkg, {
        from: "obs",
        where: [...bioreportr.notExcludedFromEPPredicates(fluid.unwrapProxy(annotations)), ...fluid.makeArray(fluid.unwrapProxy(sightingPredicates))],
        groupBy: ["iNaturalistTaxonId"],
        measures: {nRecords: {count: true}, nUnmapped: {count: true, filter: [unmapped]}, lastRecorded: {max: year}}
    });
    const sightings = new Map();
    for (let g = 0; g < result.groups; ++g) {
        sightings.set(String(result.keys.iNaturalistTaxonId[g]), {
            nRecords: result.measures.nRecords[g], nUnmapped: result.measures.nUnmapped[g], lastRecorded: result.measures.lastRecorded[g]
        });
    }
    const ofStatus = status => taxaRows
        .filter(taxon => taxon.inSummary && taxon.introduction_status === "native" && statusById[taxon.id] === status)
        .map(taxon => ({taxon, ...(sightings.get(taxon.id) || {nRecords: 0, nUnmapped: 0, lastRecorded: NaN})}));
    const ofGroup = group => (excluded || []).filter(row => fluid.makeArray(group).includes(row.group)).map(row => ({
        taxon: {id: row.id, scientificName: row.scientificName, commonName: row.commonName},
        nRecords: +row.n_records || 0, nUnmapped: 0, lastRecorded: parseInt(row.last_record_date, 10), excluded: row
    }));
    return fluid.transform(galleries, ({status, group}, key) => {
        const plants = group ? ofGroup(group) : ofStatus(status);
        return key === "lost" ? plants
            .filter(({taxon, nRecords}) => +taxon.solow_EP >= options.minEP || nRecords > 0 && nRecords <= options.maxRecords)
            .sort((a, b) => +b.taxon.solow_EP - +a.taxon.solow_EP || a.taxon.scientificName.localeCompare(b.taxon.scientificName)) : plants;
    });
};

/**
 * Render a scientific name for display in italics, with the words marking its rank - "ssp.", "var." and the like -
 * set upright, as is the convention, e.g. Quercus garryana <span>var.</span> garryana.
 * @param {String} name - The scientific name
 * @return {String} The markup of the name, encoded
 */
bioreportr.lostPlants.nameMarkup = function (name) {
    return hortis.dataTable.encode(name || "").replace(/(^|\s)(ssp\.|subsp\.|var\.|f\.|nothosubsp\.|nothovar\.)(?=\s)/g,
        "$1<span class=\"mxcw-lost-rank\">$2</span>");
};

/**
 * Render one plant of the gallery, as a card which turns over to show its curatorial notes.
 * @param {Object} plant - A plant as selected by `bioreportr.lostPlants.select`
 * @param {Object} [photo] - Its photo record from the iNaturalist API - a taxon set aside by the curators is shown
 * without one if it has none, since its notes matter more than its picture
 * @return {String} The markup for the plant
 */
bioreportr.lostPlants.renderCard = function (plant, photo) {
    const encode = hortis.dataTable.encode;
    const name = encode(plant.taxon.scientificName);
    const details = [plant.taxon.commonName, plant.lastRecorded && "last recorded " + plant.lastRecorded].filter(Boolean).join(" · ");
    const unmapped = !plant.excluded && plant.nRecords > 0 && plant.nUnmapped === plant.nRecords ? "<span class=\"mxcw-lost-unmapped\">⚠ no mapped records</span>" : "";
    const reason = plant.excluded ? `<span class="mxcw-lost-reason">${encode(plant.excluded.reason)}</span>` : "";
    const credit = photo ? photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "") : "";
    const image = photo ? `<img src="${encode(photo.medium_url)}" alt="${name}" loading="lazy">` : "<span class=\"mxcw-lost-noimage\" aria-hidden=\"true\"></span>";
    // The card turns over to show the plant's notes on its back, filled as it turns - see bioreportr.lostPlants.click
    return `<div class="mxcw-lost-card" data-taxon-id="${encode(plant.taxon.id)}"><div class="mxcw-lost-flip">
        <button type="button" class="mxcw-lost-front" aria-expanded="false">
            ${image}
            <span class="mxcw-lost-name">${bioreportr.lostPlants.nameMarkup(plant.taxon.scientificName)}</span>
            <span class="mxcw-lost-details">${encode(details)}</span>
            ${reason}${unmapped}
            <span class="mxcw-lost-credit">${encode(credit)}</span>
        </button>
        <div class="mxcw-lost-back" aria-hidden="true"></div>
    </div></div>`;
};

/**
 * Fill a gallery with its plants once its tab is first chosen - see `bioreportr.lostPlants.fetchCards`. Nothing is
 * fetched until the real data has loaded, and plants selected afresh start every gallery again.
 * @param {fluid.component} that - The component holding the gallery
 * @param {Object<String, Object[]>} plants - The plants of each gallery, as selected by `bioreportr.lostPlants.select`
 * @param {String} gallery - The key of the gallery shown
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 */
bioreportr.lostPlants.load = function (that, plants, gallery, loaded) {
    if (loaded) {
        const state = bioreportr.lostPlants.runs.get(that);
        if (!state || state.plants !== plants) {
            bioreportr.lostPlants.runs.set(that, {plants, started: new Set()});
            // Deferred, since an effect may not write signals
            fluid.invokeLater(() => that.cards = {});
        }
        const {started} = bioreportr.lostPlants.runs.get(that);
        // The lost plants are always fetched, since the pane's text gives their number
        ["lost", gallery].filter(key => plants[key] && !started.has(key)).forEach(key => {
            started.add(key);
            bioreportr.lostPlants.fetchCards(that, plants, key);
        });
    }
};

/**
 * Return a copy of a list in random order, by the Fisher-Yates shuffle.
 * @param {Array} list - The list
 * @return {Array} The shuffled copy
 */
bioreportr.lostPlants.shuffle = function (list) {
    const togo = list.slice();
    for (let i = togo.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        [togo[i], togo[j]] = [togo[j], togo[i]];
    }
    return togo;
};

/**
 * Shuffle the cards of the galleries of reporting statuses each time the pane is opened. Deferred, since an effect may
 * not write signals, and reading the cards there keeps them from becoming a dependency of the effect, which would then
 * shuffle them forever. The galleries of excluded taxa keep their order, most recorded first.
 * @param {fluid.component} that - The component holding the gallery
 * @param {String} activePaneKey - The key of the pane shown
 */
bioreportr.lostPlants.reshuffle = function (that, activePaneKey) {
    if (activePaneKey === "LostPlants") {
        fluid.invokeLater(() => {
            that.cards = fluid.transform(that.cards, (entry, key) => entry.complete && !that.galleries[key]?.group ?
                {...entry, cards: bioreportr.lostPlants.shuffle(entry.cards)} : entry);
        });
    }
};

/**
 * Fetch the photos of the plants of a gallery from iNaturalist and render their cards, a batch at a time, observing
 * iNaturalist's requested limit of about one request per second. The cards are written to the component's `cards` as
 * each batch arrives, so that a large gallery fills progressively - see `bioreportr.lostPlants.load`.
 * @param {fluid.component} that - The component holding the gallery
 * @param {Object<String, Object[]>} allPlants - The plants of every gallery, as selected by `bioreportr.lostPlants.select`
 * @param {String} key - The key of the gallery to fill
 * @return {Promise} A promise which resolves once every batch has been fetched
 */
bioreportr.lostPlants.fetchCards = async function (that, allPlants, key) {
    const current = () => bioreportr.lostPlants.runs.get(that)?.plants === allPlants;
    const plants = allPlants[key];
    const {batchSize, batchDelay} = that;
    const keepWithout = !!that.galleries[key]?.group;
    // Any card fetched ahead of its batch, for a plant searched for, is kept at the front until its batch brings it -
    // see bioreportr.lostPlants.fetchOne
    const write = (cards, complete) => {
        const ids = new Set(cards.map(bioreportr.lostPlants.cardId));
        const ahead = (that.cards[key]?.cards || []).filter(card => !ids.has(bioreportr.lostPlants.cardId(card)));
        that.cards = {...that.cards, [key]: {cards: ahead.concat(cards), complete}};
    };
    let cards = [];
    // Only taxa with an iNaturalist id can have a photo looked up
    const hasId = plant => /^\d+$/.test(plant.taxon.id);
    for (let start = 0; start < plants.length && current(); start += batchSize) {
        const batch = plants.slice(start, start + batchSize);
        const ids = batch.filter(hasId).map(plant => plant.taxon.id).join(",");
        try {
            const taxa = ids ? (await (await fetch(`https://api.inaturalist.org/v1/taxa/${ids}?per_page=${batchSize}`)).json()).results : [];
            const photos = Object.fromEntries(taxa.map(taxon => [String(taxon.id), bioreportr.atlas.licensedPhoto(taxon)]));
            cards = cards.concat(batch.filter(plant => keepWithout || photos[plant.taxon.id])
                .map(plant => bioreportr.lostPlants.renderCard(plant, photos[plant.taxon.id])));
            if (current()) {
                write(cards, false);
            }
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        } catch (error) {
            console.error("Could not fetch photos from iNaturalist", error);
            start = plants.length;
        }
    }
    if (current()) {
        write(keepWithout ? cards : bioreportr.lostPlants.shuffle(cards), true);
    }
};

// The latest run of loading each gallery, so that a later run supersedes an earlier, and the galleries it has started
bioreportr.lostPlants.runs = new WeakMap();

// The id of the plant of a card's markup
bioreportr.lostPlants.cardId = card => /data-taxon-id="([^"]*)"/.exec(card)?.[1];

/**
 * Fetch the photo of one plant of a gallery still loading and place its card at the gallery's front, so that a plant
 * searched for is shown at once rather than once its batch arrives - see bioreportr.lostPlants.reveal. A plant of a
 * gallery of the site's own taxa without an openly licensed photo has no card, as in its batch.
 * @param {fluid.component} that - The component holding the gallery
 * @param {String} key - The key of the gallery
 * @param {Object} plant - The plant, as selected by `bioreportr.lostPlants.select`
 * @return {Promise<Boolean>} Resolves to whether the plant has a card
 */
bioreportr.lostPlants.fetchOne = async function (that, key, plant) {
    const keepWithout = !!that.galleries[key]?.group;
    let photo;
    if (/^\d+$/.test(plant.taxon.id)) {
        try {
            const taxon = (await (await fetch(`https://api.inaturalist.org/v1/taxa/${plant.taxon.id}`)).json()).results?.[0];
            photo = taxon && bioreportr.atlas.licensedPhoto(taxon);
        } catch (error) {
            console.error("Could not fetch the photo from iNaturalist", error);
        }
    }
    const entry = that.cards[key] || {cards: [], complete: false};
    const id = String(plant.taxon.id);
    const has = photo || keepWithout;
    if (has && !entry.cards.some(card => bioreportr.lostPlants.cardId(card) === id)) {
        that.cards = {...that.cards, [key]: {...entry, cards: [bioreportr.lostPlants.renderCard(plant, photo)].concat(entry.cards)}};
    }
    return !!has;
};

/**
 * Render the gallery shown, with its tabs above it.
 * @param {Object<String, Object>} cards - The cards of each gallery, by its key - see bioreportr.lostPlants.fetchCards
 * @param {String} gallery - The key of the gallery shown
 * @param {Object<String, Object>} galleries - The galleries, by key - see bioreportr.lostPlants
 * @param {Object<String, Object[]>} plants - The plants of each gallery
 * @param {fluid.component} that - The component holding the gallery, whose search's state is kept apart from its
 * signals, so that typing doesn't draw the gallery afresh - see bioreportr.lostPlants.search
 * @return {String} The markup of the gallery
 */
bioreportr.lostPlants.markup = function (cards, gallery, galleries, plants, that) {
    const encode = hortis.dataTable.encode;
    // A gallery with no plants, e.g. of excluded taxa in a story which has none, has no tab
    const tabs = Object.entries(galleries).filter(([key]) => plants[key]?.length).map(([key, {label, title}]) =>
        `<button type="button" class="mxcw-lost-tab" data-gallery="${key}" aria-pressed="${key === gallery}" title="${encode(title)}">` +
        `${encode(label)} <span class="mxcw-lost-tab-count">${bioreportr.formatCount(plants[key].length)}</span></button>`).join("");
    const entry = cards[gallery] || {cards: [], complete: false};
    const intro = galleries[gallery]?.intro ? `<p class="mxcw-lost-intro">${encode(galleries[gallery].intro)}</p>` : "";
    const loading = entry.complete ? "" : "<p class=\"mxcw-lost-loading\">Loading photos from iNaturalist …</p>";
    // The search box at the right of the tabs - the same autocomplete as the atlas checklist's, in the same frame, which
    // is moved into this slot each time the gallery is drawn afresh - see bioreportr.lostPlants.placeSearch
    const search = bioreportr.lostPlants.search(that);
    const searchBox = `<div class="mxcw-lost-search" role="search">
        <span class="imerss-search-checklist">
            <span class="imerss-filter-autocomplete"><span class="mxcw-lost-search-slot"></span></span>
            <svg width="32" height="32" aria-hidden="true"><use href="#imerss-i-search-wide"/></svg>
        </span>
        <span class="mxcw-lost-search-status" role="status">${encode(search.message)}</span>
    </div>`;
    return `<div class="mxcw-lost-gallery-pane"><div class="mxcw-lost-tabs"><div class="mxcw-lost-tablist" role="toolbar" aria-label="Galleries">${tabs}</div>${searchBox}</div>
        ${intro}<p class="mxcw-lost-hint">Select a plant to review its curatorial notes.</p>
        <div class="mxcw-lost-gallery">${entry.cards.join("")}</div>${loading}</div>`;
};

/**
 * Render the back of a plant's card - its curatorial history, from the curation history, the same source as the atlas's
 * Notes tab and the curation pane's History tab - see bioreportr.curationForm.historyMarkup. A taxon kept off the list
 * is also given the curators' decision on it, or, if it was never reviewed, an account of its records. A plant of the
 * site's own data may be followed to its records in the atlas, or to the Living Data pane to comment on it.
 * @param {Object} plant - A plant as selected by `bioreportr.lostPlants.select`
 * @param {Object} context - Members `historyById`, `sources`, `byTaxon`, `statusLabels`, `rowById` and `canCurate`
 * @return {String} The markup of the back of the card
 */
bioreportr.lostPlants.backMarkup = function (plant, {historyById, sources, byTaxon, statusLabels, rowById, canCurate}) {
    const encode = hortis.dataTable.encode;
    const {taxon, excluded} = plant;
    const year = date => parseInt(date, 10) || "";
    const plural = (n, noun) => bioreportr.formatCount(n) + " " + noun + (n === 1 ? "" : "s");
    const span = (first, last) => first && last && first !== last ? `${first}–${last}` : first || last;
    // The plant's facts, run together on one line - for a taxon kept off the list, the curators' decision on it first
    const facts = (excluded ? [
        excluded.reason && excluded.reason[0].toUpperCase() + excluded.reason.slice(1),
        excluded.introduction_status,
        plant.nRecords && plural(plant.nRecords, "record") + (+excluded.n_research_grade ? `, ${bioreportr.formatCount(+excluded.n_research_grade)} research grade` : ""),
        span(year(excluded.first_record_date), year(excluded.last_record_date))
    ] : [
        bioreportr.atlas.statusLabel(taxon.reportingStatus, statusLabels),
        plant.nRecords && plural(plant.nRecords, "record"),
        !Number.isNaN(plant.lastRecorded) && "last seen " + plant.lastRecorded
    ]).filter(Boolean).map(fact => encode(String(fact))).join(" · ");
    const history = excluded?.group === "unlisted" ?
        "<p class=\"mxcw-curation-none\">Not yet reviewed: this name is in the records, but scored too low in confidence to be prioritized for review.</p>" :
        bioreportr.lostPlants.notesMarkup(taxon, historyById || {}, sources || [], byTaxon || {});
    // Only a plant of the site's own data has records in the atlas, and may be curated
    const known = !!rowById?.[taxon.id];
    const action = (kind, label) => `<button type="button" class="mxcw-lost-action" data-action="${kind}" data-taxon-id="${encode(taxon.id)}">${label}</button>`;
    const actions = known ? [action("atlas", "See in the Atlas"), canCurate ? action("curate", "Comment in Living Data") : ""].join("") : "";
    return `<div class="mxcw-lost-back-head">
            <span class="mxcw-lost-name">${bioreportr.lostPlants.nameMarkup(taxon.scientificName)}</span>
            <button type="button" class="mxcw-lost-close" aria-label="Turn the card back">×</button>
        </div>
        <p class="mxcw-lost-facts">${facts}</p>
        <div class="mxcw-lost-history">${history}</div>
        <div class="mxcw-lost-actions">${actions}</div>`;
};

/**
 * Render a plant's curatorial notes simply, as the back of its card has room for - each note a paragraph, oldest first,
 * followed by its source in parentheses, and then the notes added through the site, by their authors. A note repeated
 * word for word by a later source is shown once, citing both. A source's citation is its `cite`, if it gives one -
 * empty for a source whose notes are signed already, e.g. the reviewers' - or else its name. The curation pane's History
 * tab shows the same notes in full, with their sources as headings - see bioreportr.curationForm.historyMarkup.
 * @param {TaxonRow} taxon - The plant
 * @param {Object<String, Object>} historyById - The history of the curatorial notes on each taxon, by id
 * @param {Object[]} sources - The sources of that history, oldest first, each with `field`, `source` and any `cite`
 * @param {Object<String, CurationNote[]>} byTaxon - The notes added through the site on each taxon, by id
 * @return {String} The markup of the notes
 */
bioreportr.lostPlants.notesMarkup = function (taxon, historyById, sources, byTaxon) {
    const encode = hortis.dataTable.encode;
    const linkify = bioreportr.curationForm?.linkify || encode;
    const history = historyById[taxon.id] || {};
    const notes = [];
    sources.filter(({field}) => history[field]).forEach(({field, source, cite}) => {
        const text = String(history[field]).trim();
        const citation = cite ?? source;
        const same = notes.find(note => note.text === text);
        if (same) {
            same.cites.push(citation);
        } else {
            notes.push({text, cites: [citation]});
        }
    });
    // The notes added through the site, oldest first, follow - so that the history grows with each
    (byTaxon[taxon.id] || []).slice().reverse().filter(note => note.comment).forEach(note =>
        notes.push({text: note.comment, cites: [note.author + (note.pending ? ", being processed" : "")]}));
    const paragraphs = notes.map(({text, cites}) => {
        const cited = cites.filter(Boolean).join("; ");
        return `<p>${linkify(text)}${cited ? ` <span class="mxcw-lost-cite">(${encode(cited)})</span>` : ""}</p>`;
    });
    return paragraphs.length ? paragraphs.join("") : "<p class=\"mxcw-curation-none\">No curatorial notes yet.</p>";
};

/**
 * Turn a card over to show its notes, or back again - only one card is turned over at a time.
 * @param {Element} card - The card
 * @param {Boolean} flip - `true` to show its notes
 */
bioreportr.lostPlants.flip = function (card, flip) {
    card.classList.toggle("mxcw-lost-flipped", flip);
    card.querySelector(".mxcw-lost-front")?.setAttribute("aria-expanded", String(flip));
    card.querySelector(".mxcw-lost-back")?.setAttribute("aria-hidden", String(!flip));
};

/**
 * Respond to a click in the gallery - on a tab, choosing its gallery, on the front of a plant's card, turning it over to
 * show its curatorial notes, on the back's close button turning it back, and on its actions opening the plant in the
 * atlas or in the Living Data pane.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Event} event - The click
 */
bioreportr.lostPlants.click = function (storyPage, event) {
    const lostPlants = storyPage.lostPlants;
    const target = event.target;
    const tab = target.closest(".mxcw-lost-tab");
    const front = target.closest(".mxcw-lost-front");
    const action = target.closest(".mxcw-lost-action");
    const card = target.closest(".mxcw-lost-card");
    // Any choice in the gallery ends a search still waiting to show its plant
    if (tab || front) {
        bioreportr.lostPlants.search(lostPlants).target = null;
    }
    if (tab) {
        lostPlants.gallery = tab.dataset.gallery;
    } else if (action) {
        const taxonId = action.dataset.taxonId;
        if (action.dataset.action === "curate") {
            bioreportr.curation.open(storyPage, taxonId);
        } else {
            // Kept as the pane changes, as a species of the Community Science pane is - see bioreportr.storyPage.keepTaxon
            bioreportr.storyPage.keepTaxon.add(storyPage);
            storyPage.checklist.search.select(taxonId);
            storyPage.selectPane("Status");
        }
    } else if (target.closest(".mxcw-lost-close")) {
        bioreportr.lostPlants.flip(card, false);
        card.querySelector(".mxcw-lost-front")?.focus();
    } else if (front) {
        bioreportr.lostPlants.open(storyPage, card);
    }
};

/**
 * Turn a plant's card over to show its notes, filling its back as it turns, and turn back any other.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Element} card - The card
 */
bioreportr.lostPlants.open = function (storyPage, card) {
    const lostPlants = storyPage.lostPlants;
    const plant = (lostPlants.plants[lostPlants.gallery] || []).find(candidate => String(candidate.taxon.id) === card.dataset.taxonId);
    if (plant) {
        card.ownerDocument.querySelectorAll(".mxcw-lost-flipped").forEach(other => bioreportr.lostPlants.flip(other, false));
        card.querySelector(".mxcw-lost-back").innerHTML = bioreportr.lostPlants.backMarkup(plant, {
            historyById: storyPage.curation?.historyById,
            sources: storyPage.curationHistorySources,
            byTaxon: storyPage.curation?.byTaxon,
            statusLabels: storyPage.statusLabels,
            rowById: storyPage.taxa.rowById,
            canCurate: !!(bioreportr.curation?.paneKey && bioreportr.curation.paneKey(storyPage.panes))
        });
        bioreportr.lostPlants.flip(card, true);
    }
};

/** Searching the gallery **/

// The state of each gallery's search - whether its box had the focus and where its caret stood, its message, and the
// plant sought - kept apart from its signals, so that typing doesn't draw the gallery afresh
bioreportr.lostPlants.searches = new WeakMap();

/**
 * The state of a gallery's search.
 * @param {fluid.component} that - The component holding the gallery
 * @return {Object} Its state - members `focused`, `caret`, `message` and `target`
 */
bioreportr.lostPlants.search = function (that) {
    let search = bioreportr.lostPlants.searches.get(that);
    if (!search) {
        search = {focused: false, caret: 0, message: "", target: null};
        bioreportr.lostPlants.searches.set(that, search);
    }
    return search;
};

/**
 * Find the plant of any gallery best matching a query - one whose scientific or common name is the query, else one
 * whose name begins with it, else one whose name contains it - and the gallery holding it, in the order of the tabs.
 * @param {Object<String, Object[]>} plants - The plants of each gallery
 * @param {Object<String, Object>} galleries - The galleries, by key
 * @param {String} query - The text sought
 * @return {Object|null} Members `plant` and `gallery`, or null if no plant matches
 */
bioreportr.lostPlants.find = function (plants, galleries, query) {
    const sought = query.trim().toLowerCase();
    const entries = Object.keys(galleries).flatMap(gallery => (plants[gallery] || []).map(plant => ({plant, gallery})));
    const names = ({plant}) => [plant.taxon.scientificName, plant.taxon.commonName].filter(Boolean).map(name => name.toLowerCase());
    return !sought ? null : entries.find(entry => names(entry).includes(sought)) ||
        entries.find(entry => names(entry).some(name => name.startsWith(sought))) ||
        entries.find(entry => names(entry).some(name => name.includes(sought))) || null;
};

/**
 * Bring the gallery to the plant best matching a query - to the tab holding it, where its card is turned over, once it
 * has loaded, to show its notes - see bioreportr.lostPlants.afterRender.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} query - The text sought
 * @param {Document} dokkument - The document holding the gallery
 */
bioreportr.lostPlants.seek = function (storyPage, query, dokkument) {
    const lostPlants = storyPage.lostPlants;
    const search = bioreportr.lostPlants.search(lostPlants);
    const found = bioreportr.lostPlants.find(lostPlants.plants, lostPlants.galleries, query);
    search.target = found && {id: String(found.plant.taxon.id), gallery: found.gallery, name: found.plant.taxon.scientificName};
    search.message = found ? "" : "No plant of that name in the gallery";
    if (found && found.gallery !== lostPlants.gallery) {
        lostPlants.gallery = found.gallery;
    } else {
        bioreportr.lostPlants.reveal(storyPage, dokkument);
    }
    bioreportr.lostPlants.showStatus(dokkument, search.message);
};

/**
 * Show a message beside the search box, without drawing the gallery afresh.
 * @param {Document} dokkument - The document holding the gallery
 * @param {String} message - The message
 */
bioreportr.lostPlants.showStatus = function (dokkument, message) {
    const status = dokkument.querySelector(".mxcw-dataPane-LostPlants .mxcw-lost-search-status");
    if (status) {
        status.textContent = message;
    }
};

/**
 * Show the plant sought, if its card is in the gallery shown - scrolled into view and turned over. A plant whose card
 * hasn't yet arrived, its gallery still loading, has its card fetched at once - see bioreportr.lostPlants.fetchOne - and
 * it is shown again each time the gallery is drawn afresh until it has loaded, since that turns the card back. One
 * which has no card, since it has no openly licensed photo, is said to have none.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Document} dokkument - The document holding the gallery
 */
bioreportr.lostPlants.reveal = function (storyPage, dokkument) {
    const lostPlants = storyPage.lostPlants;
    const search = bioreportr.lostPlants.search(lostPlants);
    const target = search.target;
    if (target && target.gallery === lostPlants.gallery) {
        const card = dokkument.querySelector(`.mxcw-dataPane-LostPlants .mxcw-lost-card[data-taxon-id="${CSS.escape(target.id)}"]`);
        const complete = !!lostPlants.cards[target.gallery]?.complete;
        if (card) {
            search.target = complete ? null : target;
            search.message = "";
            // Scrolled to as it is first shown, and once more as its gallery completes, which may move it
            if (!target.shown || complete) {
                card.scrollIntoView({block: "center", behavior: "smooth"});
                target.shown = true;
            }
            bioreportr.lostPlants.open(storyPage, card);
        } else if (complete || target.missing) {
            search.target = null;
            search.message = `${target.name} has no photo, so no card`;
        } else if (!target.fetching) {
            // Not yet arrived in its batch - fetched at once, and shown once its card is drawn
            target.fetching = true;
            const plant = (lostPlants.plants[target.gallery] || []).find(candidate => String(candidate.taxon.id) === target.id);
            if (plant) {
                bioreportr.lostPlants.fetchOne(lostPlants, target.gallery, plant).then(has => {
                    if (!has && search.target === target) {
                        target.missing = true;
                        bioreportr.lostPlants.reveal(storyPage, dokkument);
                    }
                });
            }
        }
        bioreportr.lostPlants.showStatus(dokkument, search.message);
    }
};

// The id of the gallery's search box
bioreportr.lostPlants.searchId = "mxcw-lost-search";

// The search widget of each document, made once and moved into the gallery each time it is drawn afresh
bioreportr.lostPlants.searchWidgets = new WeakMap();

/**
 * Suggest the plants of any gallery matching a query, best first - see bioreportr.lostPlants.find - each by its
 * scientific name, followed by its common name.
 * @param {fluid.component} lostPlants - The component holding the gallery
 * @param {String} query - The text typed
 * @return {String[]} The suggestions
 */
bioreportr.lostPlants.suggest = function (lostPlants, query) {
    const sought = query.trim().toLowerCase();
    const seen = new Set();
    const ranked = [[], [], []];
    Object.keys(lostPlants.galleries).forEach(gallery => (lostPlants.plants[gallery] || []).forEach(({taxon}) => {
        const names = [taxon.scientificName, taxon.commonName].filter(Boolean).map(name => name.toLowerCase());
        const rank = names.includes(sought) ? 0 : names.some(name => name.startsWith(sought)) ? 1 : names.some(name => name.includes(sought)) ? 2 : -1;
        if (rank >= 0 && !seen.has(taxon.scientificName)) {
            seen.add(taxon.scientificName);
            ranked[rank].push(taxon.scientificName + (taxon.commonName ? ` (${taxon.commonName})` : ""));
        }
    }));
    return ranked.flat().slice(0, 30);
};

/**
 * Place the gallery's search box in its slot, making it once - the same accessible-autocomplete as the atlas
 * checklist's, which seeks the plant chosen. It is made outside the gallery's markup, which is drawn afresh as its cards
 * arrive, and moved into each drawing, keeping what was typed in it.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Window} window - The window holding the page
 */
bioreportr.lostPlants.placeSearch = function (storyPage, window) {
    const dokkument = window.document;
    const slot = dokkument.querySelector(".mxcw-dataPane-LostPlants .mxcw-lost-search-slot");
    let widget = bioreportr.lostPlants.searchWidgets.get(dokkument);
    if (!widget && window.accessibleAutocomplete) {
        widget = dokkument.createElement("div");
        window.accessibleAutocomplete({
            element: widget,
            id: bioreportr.lostPlants.searchId,
            placeholder: "Find a plant ...",
            minLength: 2,
            displayMenu: "overlay",
            confirmOnBlur: false,
            source: (query, callback) => callback(bioreportr.lostPlants.suggest(storyPage.lostPlants, query)),
            // A suggestion names the plant first, before any common name in brackets
            onConfirm: choice => choice && bioreportr.lostPlants.seek(storyPage, choice.replace(/ \(.*\)$/, ""), dokkument)
        });
        widget.querySelector("input")?.setAttribute("spellcheck", "false");
        bioreportr.lostPlants.searchWidgets.set(dokkument, widget);
    }
    if (slot && widget && widget.parentElement !== slot) {
        slot.appendChild(widget);
    }
};

/**
 * Once the gallery is drawn afresh, move its search box into it, give the box back the focus and caret it had, and show
 * any plant sought. Deferred until the markup is in the page.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} markup - The gallery's markup, on whose drawing this follows
 * @param {Window} window - The window holding the page
 */
bioreportr.lostPlants.afterRender = function (storyPage, markup, window) {
    if (window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
            const search = bioreportr.lostPlants.search(storyPage.lostPlants);
            bioreportr.lostPlants.placeSearch(storyPage, window);
            const input = window.document.getElementById(bioreportr.lostPlants.searchId);
            if (input && search.focused && window.document.activeElement !== input) {
                input.focus();
                input.setSelectionRange(search.caret, search.caret);
            }
            bioreportr.lostPlants.reveal(storyPage, window.document);
        });
    }
};

// The documents whose galleries already handle their events
bioreportr.lostPlants.boundDocuments = new WeakSet();

/**
 * Handle the gallery's clicks - see bioreportr.lostPlants.click - and turn a card back once a mouse leaves it, so that
 * browsing may resume across the gallery. On a touch screen, which has no pointer to leave, a card turns back when
 * another is turned over, or by its close button. Bound once to the document, since the gallery's markup is rendered
 * afresh as its cards arrive.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Window} window - The window holding the page
 */
bioreportr.lostPlants.bindEvents = function (storyPage, window) {
    const dokkument = window.document;
    if (!dokkument || bioreportr.lostPlants.boundDocuments.has(dokkument)) {
        return;
    }
    bioreportr.lostPlants.boundDocuments.add(dokkument);
    dokkument.addEventListener("click", event => {
        if (event.target.closest?.(".mxcw-lost-gallery-pane")) {
            bioreportr.lostPlants.click(storyPage, event);
        }
    });
    // The search box keeps its own state, since the gallery is drawn afresh as its cards arrive - see
    // bioreportr.lostPlants.search. A suggestion chosen is sought by the widget; text entered with no suggestion
    // highlighted is sought on Enter
    const inSearch = event => event.target.id === bioreportr.lostPlants.searchId ? event.target : null;
    const search = () => bioreportr.lostPlants.search(storyPage.lostPlants);
    dokkument.addEventListener("input", event => {
        const input = inSearch(event);
        if (input) {
            search().caret = input.selectionStart ?? input.value.length;
        }
    });
    dokkument.addEventListener("keydown", event => {
        const input = inSearch(event);
        if (input && event.key === "Enter" && !dokkument.querySelector(".mxcw-lost-search .autocomplete__option--focused")) {
            event.preventDefault();
            bioreportr.lostPlants.seek(storyPage, input.value, dokkument);
        }
    });
    dokkument.addEventListener("focusin", event => {
        if (inSearch(event)) {
            search().focused = true;
        }
    });
    dokkument.addEventListener("focusout", event => {
        // Not when the box loses its focus by being drawn afresh, which it is to be given back
        if (inSearch(event) && event.target.isConnected) {
            search().focused = false;
        }
    });
    dokkument.addEventListener("pointerout", event => {
        const card = event.target.closest?.(".mxcw-lost-flipped");
        if (card && event.pointerType === "mouse" && !card.contains(event.relatedTarget)) {
            bioreportr.lostPlants.flip(card, false);
        }
    });
};

/**
 * Show the block of the pane's text written for the tab chosen - each a div of class mxcw-lost-text in the pane's
 * R Markdown, naming its gallery by data-gallery - and hide the others. A gallery with no block of its own keeps that of
 * the lost plants, which is shown as the page loads, the others being hidden in the markup.
 * @param {String} gallery - The key of the gallery shown
 * @param {String} activePaneKey - The key of the pane shown, so that the text is set once the pane's section is shown
 * @param {Window} window - The window holding the page
 */
bioreportr.lostPlants.showText = function (gallery, activePaneKey, window) {
    const blocks = [...(window.document?.querySelectorAll(".mxcw-lost-text[data-gallery]") || [])];
    const shown = blocks.some(block => block.dataset.gallery === gallery) ? gallery : "lost";
    blocks.forEach(block => block.hidden = block.dataset.gallery !== shown);
};

// Blank until the gallery of lost plants has loaded, so that the text reads "The gallery shows native species" rather
// than a count of none
bioreportr.lostPlants.count = cards => cards.lost?.complete && cards.lost.cards.length > 0 ? String(cards.lost.cards.length) : "";

// The gallery is shown in the Lost Plants pane's data pane, in place of the map
bioreportr.lostPlants.paneMarkup = galleryMarkup => ({LostPlants: galleryMarkup});
</script>

<style>
/* ── Gallery of lost plants ──────────────────────────────── */

.mxcw-dataPane-LostPlants {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    background-color: #184E62;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
}

.mxcw-lost-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--story-gap);
    padding: 12px 0 12px 12px;
}

/* A card turns over to show the plant's notes on its back - see bioreportr.lostPlants.flip */
.mxcw-lost-card {
    perspective: 1200px;
}

.mxcw-lost-flip {
    position: relative;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 450ms ease;
}

.mxcw-lost-flipped .mxcw-lost-flip {
    transform: rotateY(180deg);
}

.mxcw-lost-front,
.mxcw-lost-back {
    color: #eefaff;
    background: #0d3040;
    border-radius: var(--data-table-radius);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    outline: 2px solid transparent;
    outline-offset: -2px;
    transition: outline-color 150ms;
}

/* Drawn inside the card, since the scrollbar's gutter would clip it at the right hand edge of the gallery */
.mxcw-lost-front {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    height: 100%;
    padding: 0 0 var(--story-gap);
    text-align: left;
    font: inherit;
    border: none;
    overflow: hidden;
    cursor: pointer;
}

.mxcw-lost-front:hover,
.mxcw-lost-front:focus-visible,
.mxcw-lost-flipped .mxcw-lost-back {
    outline-color: #FDF2CE;
}

.mxcw-lost-back {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px var(--story-gap) var(--story-gap);
    transform: rotateY(180deg);
    overflow: hidden;
}

.mxcw-lost-flipped .mxcw-lost-front {
    pointer-events: none;
}

.mxcw-lost-card:not(.mxcw-lost-flipped) .mxcw-lost-back {
    visibility: hidden;
    transition: visibility 0s 450ms;
}

.mxcw-lost-front img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    margin-bottom: 4px;
}

.mxcw-lost-front > span {
    padding: 0 var(--story-gap);
}

/* The words marking a name's rank, e.g. "ssp." or "var.", are set upright within the italic name */
.mxcw-lost-rank {
    font-style: normal;
}

.mxcw-lost-name {
    font-size: var(--story-data);
    font-style: italic;
    font-weight: 700;
    line-height: 1.3;
}

.mxcw-lost-details {
    font-size: var(--story-data);
    line-height: 1.3;
}

.mxcw-lost-credit {
    font-size: var(--story-small);
    line-height: 1.3;
    color: #a8c8d0;
}

@media (max-width: 767.98px) {
    .mxcw-lost-gallery {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
}

.mxcw-dataPane-LostPlants::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 12px;
}

.mxcw-dataPane-LostPlants::-webkit-scrollbar-thumb {
    border: 3px solid transparent;
    border-radius: 6px;
    background-clip: padding-box;
    background-color: #C1C1C1;
}

/* ── The tabs choosing the gallery ───────────────────────── */

.mxcw-lost-tabs {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 12px 12px 10px;
    background-color: #184E62;
}

.mxcw-lost-tablist {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

/* The search box at the right of the tabs */
.mxcw-lost-search {
    position: relative;
    margin-left: auto;
}

/* The search looks as the atlas checklist's does - a pale rounded box with the magnifier at its left, and its
   suggestions in a white menu beneath. Those styles are scoped to the atlas's .imerss-container, outside which the
   gallery lies, so they are given again here */
.mxcw-lost-search .imerss-search-checklist {
    position: relative;
    display: block;
    width: 250px;
    max-width: 100%;
    height: 26px;
    color: #4b778f;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
}

.mxcw-lost-search .imerss-filter-autocomplete,
.mxcw-lost-search .mxcw-lost-search-slot,
.mxcw-lost-search .autocomplete__wrapper {
    position: relative;
    display: block;
    width: 100%;
}

.mxcw-lost-search .imerss-search-checklist > svg {
    position: absolute;
    top: -2px;
    left: 0;
    width: 32px;
    height: 32px;
    padding-left: 11px;
    color: #636c76;
    pointer-events: none;
}

.mxcw-lost-search .autocomplete__input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 26px;
    margin: 0;
    padding: 3px 5px 3px 40px;
    color: #4b778f;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    line-height: 20px;
    background-color: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 100px;
}

.mxcw-lost-search .autocomplete__input--focused,
.mxcw-lost-search .autocomplete__input:focus {
    outline: 2px solid #4b778f;
    outline-offset: 0;
    box-shadow: none;
}

.mxcw-lost-search .autocomplete__menu {
    position: absolute;
    top: 26px;
    left: 0;
    right: 4px;
    z-index: 100;
    margin: 0;
    padding: 0;
    list-style: none;
    color: #0b0c0c;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.26);
}

.mxcw-lost-search .autocomplete__option {
    padding: 4px 10px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.35;
}

.mxcw-lost-search-status {
    position: absolute;
    top: 100%;
    right: 4px;
    margin-top: 3px;
    color: #FDF2CE;
    font-size: var(--story-small);
    white-space: nowrap;
}

.mxcw-lost-tab {
    padding: 5px 12px;
    font-size: var(--story-data);
    color: #d6e8ee;
    background: transparent;
    border: 1px solid #4f7f8f;
    border-radius: 999px;
    cursor: pointer;
}

.mxcw-lost-tab:hover,
.mxcw-lost-tab:focus-visible {
    border-color: #FDF2CE;
}

.mxcw-lost-tab[aria-pressed="true"] {
    color: #0d3040;
    background: #FDF2CE;
    border-color: #FDF2CE;
}

.mxcw-lost-tab-count {
    opacity: 0.75;
}

.mxcw-lost-intro,
.mxcw-lost-loading {
    margin: 0 12px 4px;
    color: #d6e8ee;
    font-size: var(--story-data);
    line-height: 1.45;
    max-width: 52em;
}

.mxcw-lost-loading {
    color: #a8c8d0;
    padding-bottom: 12px;
}

.mxcw-lost-gallery-pane .mxcw-lost-gallery {
    padding-top: 4px;
}

/* ── The back of a card: the plant's curatorial notes ───── */

.mxcw-lost-hint {
    margin: 0 12px 4px;
    color: #a8c8d0;
    font-size: var(--story-small);
}

.mxcw-lost-back-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
}

.mxcw-lost-close {
    flex: none;
    padding: 0 2px;
    font-size: 1.3em;
    line-height: 1;
    color: #a8c8d0;
    background: none;
    border: none;
    cursor: pointer;
}

.mxcw-lost-facts {
    margin: 0;
    color: #a8c8d0;
    font-size: var(--story-small);
    line-height: 1.35;
}

/* The notes scroll within the card, whose size stays that of its front */
.mxcw-lost-history {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    font-size: var(--story-small);
    line-height: 1.35;
}

.mxcw-lost-history p {
    margin: 0 0 0.6em;
}

.mxcw-lost-cite {
    color: #a8c8d0;
    font-style: italic;
}

.mxcw-lost-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.mxcw-lost-actions:empty {
    display: none;
}

.mxcw-lost-action {
    padding: 3px 9px;
    font-size: var(--story-small);
    color: #0d3040;
    background: #FDF2CE;
    border: none;
    border-radius: 999px;
    cursor: pointer;
}

.mxcw-lost-action:hover,
.mxcw-lost-action:focus-visible {
    background: #fff;
}

@media (prefers-reduced-motion: reduce) {
    .mxcw-lost-flip {
        transition: none;
    }
}

/* A taxon set aside by the curators, and one without a photo */
.mxcw-lost-reason {
    font-size: var(--story-small);
    line-height: 1.3;
    color: #f2b8a6;
}

.mxcw-lost-noimage {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    margin-bottom: 4px;
    background: repeating-linear-gradient(45deg, #123c4d 0 8px, #0f3445 8px 16px);
}

/* ── Plants of the gallery without coordinates ───────────── */

.mxcw-lost-unmapped {
    font-size: var(--story-small);
    line-height: 1.3;
    color: #FDF2CE;
}

@media (min-width: 768px) {
    .mxcw-paneKey-LostPlants .mxcw-sectionInner {
        flex: none;
    }
}

.mxcw-paneKey-LostPlants h2 {
    color: #a8c8d0;
    font-size: var(--story-small);
    font-weight: 400;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin: 1.25rem 0 clamp(12px, 2.4vh, 26px);
}

.mxcw-paneKey-LostPlants :is(.mxcw-sectionColumn, .mxcw-lost-text) > p {
    max-width: 31em;
    margin: 0 auto clamp(10px, 2.2vh, 22px);
    padding: 0;
    color: #d6e8ee;
    font-size: var(--story-reading-text);
    line-height: 1.5;
    text-align: center;
    text-wrap: pretty;
}

.mxcw-paneKey-LostPlants :is(.mxcw-sectionColumn, .mxcw-lost-text) > p :is(strong, .mxcw-callout),
.mxcw-paneKey-LostPlants :is(.mxcw-sectionColumn, .mxcw-lost-text) > p a {
    color: #FDF2CE;
    font-weight: 400;
}

/* Phones: the gallery runs on down the page beneath the story, rather than scrolling within a box of its own */
@media (max-width: 767.98px) {
    .mxcw-leftPane:has(.mxcw-dataPane-LostPlants:not(.fl-hidden)),
    .mxcw-leftPane:has(.mxcw-dataPane-LostPlants:not(.fl-hidden)) > .mxcw-data {
        height: auto;
    }

    .mxcw-dataPane-LostPlants {
        height: auto;
        overflow: visible;
    }
}
</style>

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from each project's content/story/LostPlants.Rmd, whose front matter names bioreportr.lostPlantsPane as its
     paneComponent - so that it holds the section of whichever project was built last. Edit the R Markdown and knit it,
     then run "npm run story", which replaces everything between <template> and </template> and nothing else in this
     file. The markup is a template, which may bind members of bioreportr.lostPlantsPane with @{...} - written in the R Markdown
     as raw HTML, e.g. `<span>@{count}</span>`{=html}, which pandoc leaves as it is -->
<template>
<div id="the-lost-plants-of-the-wsánećsaanich-peninsula" class="section level2 mxcw-paneKey-LostPlants"><h2>The lost plants of the W̱SÁNEĆ/Saanich Peninsula</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">

<div class="mxcw-lost-text" data-gallery="lost">
<p>This gallery shows <span class="mxcw-lost-count">@{count}</span>
native species once reported for the Saanich Peninsula, which have not
been seen in recent decades. Some may be lost <em>to us</em>—overlooked,
forgotten, or waiting to be rediscovered. Others may be lost <em>because
of us</em>, through impacts like habitat change or the introduction of
invasive species.</p>
<p><span class="mxcw-callout">Pick a plant from the gallery</span> to
turn it over and read its curatorial notes, from the earliest accounts
to the latest reviews. From there you can follow it to its records in
the Atlas, or add your own notes in Living Data. Then join local
naturalists and community members on a search for the <a href="https://www.inaturalist.org/projects/lost-plants-of-the-saanich-peninsula">“Lost”
Plants of the Saanich Peninsula</a> project on iNaturalist.</p>
</div>
<div class="mxcw-lost-text" data-gallery="confirmed" hidden="hidden">
<p>These native species were known to the peninsula’s earlier botanists,
and have been <strong>seen again</strong> since 2000. They are the
enduring core of its native flora—though being found again is no promise
of security, and some now survive in only one or two places.</p>
<p><span class="mxcw-callout">Pick a plant from the gallery</span> to
turn it over and read its curatorial notes, then follow it to its
records in the Atlas to see where it persists, or add your own notes in
Living Data.</p>
</div>
<div class="mxcw-lost-text" data-gallery="new" hidden="hidden">
<p>These native species were <strong>first reported</strong> for the
Saanich Peninsula since 2000. Some were surely here all along,
overlooked by earlier botanists or confused with their relatives; others
may be newly arrived, or newly told apart by taxonomists.</p>
<p><span class="mxcw-callout">Pick a plant from the gallery</span> to
turn it over and read its curatorial notes, then follow it to its
records in the Atlas, or add your own notes in Living Data.</p>
</div>
<div class="mxcw-lost-text" data-gallery="excluded" hidden="hidden">
<p>Not every plant reported for the peninsula belongs on its checklist.
These taxa are <strong>excluded</strong> from it: curators have judged
some to be doubtful records, others to be garden escapes that persist
without establishing, or to have been planted.</p>
<p><span class="mxcw-callout">Pick a plant from the gallery</span> to
turn it over and read the curators’ reasoning. These notes show how the
checklist was made, and where it remains open to question.</p>
</div>
<div class="mxcw-lost-text" data-gallery="underReview" hidden="hidden">
<p>These taxa are <strong>under review</strong>, and are not yet on the
checklist. Curators are still weighing some of them; many more have
never been reviewed at all, mostly names known from a single record, or
unknown elsewhere in BC.</p>
<p><span class="mxcw-callout">Pick a plant from the gallery</span> to
turn it over and read any notes the curators have made so far. If you
know one of these plants here, your observations can help to settle its
place.</p>
</div>
<p>Szczawinski and Harrison’s (1972) <em>Flora of the Saanich
Peninsula</em> provides the historical baseline for this atlas. Harvey
Janszen devoted much of his life to revising this flora, but passed away
in 2021, before completing this work. A community of naturalists has
since carried those efforts forward; this atlas is a testament to that
continuing legacy.</p>
</div></div></div>
</template>
