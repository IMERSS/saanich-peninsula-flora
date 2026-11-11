<script src="../../bioreportr/js/story.js"></script>
<script src="../js/saanich.js"></script>
<script>
"use strict";

// The Lost Plants pane of the Saanich story - its section, knitted from content/story/LostPlants.Rmd, and the gallery
// of "lost" plants shown in its data pane in place of the map. The plants are selected from the site's data whenever
// it loads, so that the gallery follows the data, and their photos are looked up live from iNaturalist. The gallery is
// configured onto the story page by saanich-story.vue as its member lostPlants

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
fluid.registerNamespace("saanich.lostPlants");

// The gallery of lost plants
fluid.def("saanich.lostPlants", {
    $layers: "fluid.component",
    // A native species which is historically reported but unconfirmed is shown if it has at least this Solow EP ...
    minEP: 0.3,
    // ... or no more than this number of records
    maxRecords: 2,
    // The maximum number of ids accepted by a single request to the iNaturalist taxa endpoint
    batchSize: 30,
    // Observes iNaturalist's requested limit of about one request per second
    batchDelay: 1100,
    cards: [],
    plants: "$compute:saanich.lostPlants.select({storyPage}.taxa.allRows, {storyPage}.obsRows, {self})",
    load: "$effect:saanich.lostPlants.load({self}, {self}.plants, {storyPage}.loaded)",
    markup: "$compute:saanich.lostPlants.markup({self}.cards)",
    count: "$compute:saanich.lostPlants.count({self}.cards)"
});

// The pane's section, rendered from the template below - its text gives the number of plants in the gallery
fluid.def("saanich.lostPlantsPane", {
    $layers: "fluid.component",
    count: "{storyPage}.lostPlants.count"
});

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
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        } catch (error) {
            console.error("Could not fetch photos from iNaturalist", error);
            start = plants.length;
        }
    }
    // Shown only once complete, so that the text never gives a partial count. Until then it reads "These native species"
    if (current()) {
        that.cards = cards;
    }
};

// The latest run of loading each gallery, so that a later run supersedes an earlier
saanich.lostPlants.runs = new WeakMap();

saanich.lostPlants.markup = cards => "<div class=\"saanich-lost-gallery\">" + cards.join("") + "</div>";

// Blank until the gallery has loaded, so that the text reads "The gallery shows native species" rather than a count of none
saanich.lostPlants.count = cards => cards.length > 0 ? String(cards.length) : "";

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


// The gallery is shown in the Lost Plants pane's data pane, in place of the map
saanich.paneMarkup = galleryMarkup => ({LostPlants: galleryMarkup});
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

.saanich-lost-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--story-gap);
    padding: 12px 0 12px 12px;
}

.saanich-lost-card {

/* Drawn inside the card, since the scrollbar's gutter would clip it at the right hand edge of the gallery */
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 0 var(--story-gap);
    text-align: left;
    color: #eefaff;
    background: #0d3040;
    border-radius: var(--data-table-radius);
    overflow: hidden;
    cursor: pointer;
    transition: outline-color 150ms;
    outline: 2px solid transparent;
    outline-offset: -2px;
}

.saanich-lost-card:hover,
.saanich-lost-card:focus-visible {
    outline-color: #FDF2CE;
}

.saanich-lost-card img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    margin-bottom: 4px;
}

.saanich-lost-card span {
    padding: 0 var(--story-gap);
}

.saanich-lost-name {
    font-size: var(--story-data);
    font-style: italic;
    font-weight: 700;
    line-height: 1.3;
}

.saanich-lost-details {
    font-size: var(--story-data);
    line-height: 1.3;
}

.saanich-lost-credit {
    font-size: var(--story-small);
    line-height: 1.3;
    color: #a8c8d0;
}

@media (max-width: 767.98px) {
    .saanich-lost-gallery {
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

/* ── Plants of the gallery without coordinates ───────────── */

.saanich-lost-unmapped {
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

.mxcw-paneKey-LostPlants .mxcw-sectionColumn > p {
    max-width: 31em;
    margin: 0 auto clamp(10px, 2.2vh, 22px);
    padding: 0;
    color: #d6e8ee;
    font-size: var(--story-reading-text);
    line-height: 1.5;
    text-align: center;
    text-wrap: pretty;
}

.mxcw-paneKey-LostPlants .mxcw-sectionColumn > p :is(strong, .saanich-callout),
.mxcw-paneKey-LostPlants .mxcw-sectionColumn > p a {
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
     knitted from content/story/LostPlants.Rmd, whose front matter names saanich.lostPlantsPane as its paneComponent. Edit the
     R Markdown and knit it, then run "npm run story", which replaces everything between <template> and </template>
     and nothing else in this file. The markup is a template, which may bind members of saanich.lostPlantsPane with
     @{...} - written in the R Markdown as raw HTML, e.g. `<span>@{count}</span>`{=html}, which pandoc leaves as it is -->
<template>
<div id="the-lost-plants-of-the-wsánećsaanich-peninsula" class="section level2 mxcw-paneKey-LostPlants"><h2>The lost plants of the W̱SÁNEĆ/Saanich Peninsula</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">

<p>The gallery shows <span class="saanich-lost-count">@{count}</span>
native species once reported for the Saanich Peninsula, which have not
been seen in recent decades. Some may be lost <em>to us</em>—overlooked,
forgotten, or waiting to be rediscovered. Others may be lost <em>because
of us</em>, through impacts like habitat change or the introduction of
invasive species.</p>
<p><span class="saanich-callout">Pick a plant from the gallery</span> to
see where and when it was last found, then join local naturalists and
community members on a search for the <a href="https://www.inaturalist.org/projects/lost-plants-of-the-saanich-peninsula">“Lost”
Plants of the Saanich Peninsula</a> project on iNaturalist!</p>
<p>Szczawinski and Harrison’s (1972) <em>Flora of the Saanich
Peninsula</em> provides the historical baseline for this atlas. Harvey
Janszen devoted much of his life to revising this flora, but passed away
in 2021, before completing this work. A community of naturalists has
since carried those efforts forward; this atlas is a testament to that
continuing legacy.</p>
</div></div></div>
</template>
