const recorder = plant => (plant.earliest.recordedBy || "").split(";")[0].trim();"use strict";

// noinspection ES6ConvertVarToLetConst
var reknitr = fluid.registerNamespace("reknitr");

// Mixin grade to apply Weibull distribution scaling for gridded obs counts as per https://claude.ai/chat/3c2ca1c6-452f-47e8-b19e-5ce1045ef26f
fluid.defaults("reknitr.storyPage.withSaanichWeibull", {
    countTransform: (x, maxCount) =>        maxCount < 200 ? x : 1 - Math.exp(-Math.pow(x / 0.012, 0.5)),
    inverseCountTransform: (x, maxCount) => maxCount < 200 ? x : 0.012 * Math.pow(-Math.log(1 - x), 1 / 0.5),
    distributeOptions: {
        countTransform: {
            source: "{that}.options.countTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.countTransform"
        },
        inverseCountTransform: {
            source: "{that}.options.inverseCountTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.inverseCountTransform"
        }
    }
});

fluid.registerNamespace("reknitr.saanichTaxaFiltersHolder");

reknitr.saanichTaxaFiltersHolder.markup = `
<div class="mxcw-taxa-filters-holder imerss-filters-collapsed">
    <div class="imerss-panel-label imerss-filters-header">
        <button type="button" class="imerss-filters-toggle" aria-expanded="false" aria-controls="imerss-taxa-filters">Filters:</button>
        <div class="imerss-filter-controls imerss-basic-tooltip" title="Reset filters">
            <svg width="24" height="24" class="imerss-reset-filter">
                <use href="#filter-reset" />
            </svg>
        </div>
    </div>
    <div id="imerss-taxa-filters" class="imerss-filters imerss-taxa-filters">
    </div>
</div>`;


// Contains bits of "hortis.standardVizLoader" from imerss-viz.js in core
fluid.defaults("reknitr.saanichTaxaFiltersHolder", {
    gradeNames: ["fluid.viewComponent", "fluid.containerRenderingView"],

    markup: {
        container: reknitr.saanichTaxaFiltersHolder.markup
    },
    selectors: {
        filterControls: ".imerss-filter-controls",
        filtersToggle: ".imerss-filters-toggle",
        filters: ".imerss-taxa-filters"
    },
    listeners: {
        "onCreate.bindFiltersToggle": "reknitr.bindFiltersToggle({that}.container.0, {that}.dom.filtersToggle.0)"
    },
    components: {
        filterControls: {
            type: "hortis.filterControls",
            container: "{that}.dom.filterControls"
        },
        filters: {
            type: "reknitr.saanichFilters",
            container: "{that}.dom.filters",
            options: {
                members: {
                    allInput: "@expand:fluid.computed(reknitr.summaryTaxaRows, {vizLoader}.taxa.rows)"
                }
            }
        }
    }
});


reknitr.saanichFiltersTemplate = `
    <div class="imerss-filters">
        <div class="imerss-filter"></div>
        <div class="imerss-ep-filter imerss-filter"></div>
        <div class="imerss-rank-filter imerss-filter"></div>
        <div class="imerss-introduction-filter imerss-filter"></div>
        <div class="imerss-provenance-filter imerss-filter"></div>
        <div class="imerss-conservation-filter imerss-filter"></div>
        <div class="imerss-graminoid-filter imerss-filter"></div>
    </div>
`;


fluid.defaults("reknitr.saanichFilters", {
    gradeNames: ["hortis.taxaFilters", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.saanichFiltersTemplate,
        fallbackContainer: reknitr.saanichFiltersTemplate
    },
    selectors: {
        epFilter: ".imerss-ep-filter",
        rankFilter: ".imerss-rank-filter",
        introductionFilter: ".imerss-introduction-filter",
        provenanceFilter: ".imerss-provenance-filter",
        conservationFilter: ".imerss-conservation-filter",
        graminoidFilter: ".imerss-graminoid-filter"
    },
    components: {
        filterRoot: "{vizLoader}",
        epFilter: {
            type: "reknitr.epFilter",
            container: "{that}.dom.epFilter"
        },
        rankFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.rankFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Infrataxon",
                fieldName: "infrataxon_status",
                fieldValues: ["infrataxon", "non-infrataxon"]
            }
        },
        introductionFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.introductionFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Introduction",
                fieldName: "introduction_status",
                fieldValues: ["native", "exotic", "unknown"]
            }
        },
        provenanceFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.provenanceFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Provenance",
                fieldName: "provenance_status",
                fieldValues: ["voucher", "no_voucher", "unknown"],
            }
        },
        conservationFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.conservationFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Conservation",
                fieldName: "provincial_concern",
                fieldValues: ["concern", "secure"]
            }
        },
        graminoidFilter: {
            type: "hortis.graminoidFilter",
            container: "{that}.dom.graminoidFilter",
            options: {
                // As hortis.graminoidFilter's markup, with its title shortened to match our other filters
                markup: {
                    container: `
                    <div class="imerss-graminoid-filter">
                        <div class="imerss-filter-title">Graminoid:</div>
                        <div class="imerss-filter-body imerss-graminoid-filter-checks">
                        <div class="imerss-filter-row"><div class="imerss-graminoid-check"></div> graminoid</div>
                        <div class="imerss-filter-row"><div class="imerss-nongraminoid-check"></div> non-graminoid</div>
                        </div>
                    </div>
                    `
                }
            }
        }
    }
});


// Filters species by their range of extirpation probability
fluid.registerNamespace("reknitr.epFilter");

reknitr.epFilter.markup = `
<div class="imerss-ep-filter">
    <div class="imerss-filter-title">Extirpation probability (EP):</div>
    <div class="imerss-filter-body saanich-ep-range">
        <label><span>Min</span><input type="range" class="saanich-ep-min" min="0" max="100" step="5" value="0" aria-label="Minimum extirpation probability"><output class="saanich-ep-min-value">0.00</output></label>
        <label><span>Max</span><input type="range" class="saanich-ep-max" min="0" max="100" step="5" value="100" aria-label="Maximum extirpation probability"><output class="saanich-ep-max-value">1.00</output></label>
    </div>
</div>
`;

reknitr.epFilter.initialState = () => signal({min: 0, max: 1});

fluid.defaults("reknitr.epFilter", {
    gradeNames: ["hortis.taxaFilter", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.epFilter.markup
    },
    members: {
        filterState: "@expand:reknitr.epFilter.initialState()"
    },
    invokers: {
        doFilter: "reknitr.epFilter.doFilter",
        reset: "reknitr.epFilter.reset({that})"
    },
    listeners: {
        "onCreate.bindInput": "reknitr.epFilter.bindInput({that})"
    }
});

reknitr.epFilter.doFilter = function (rows, state) {
    return state.min <= 0 && state.max >= 1 ? rows : rows.filter(row => +row.solow_EP >= state.min && +row.solow_EP <= state.max);
};

/**
 * Show a pair of slider positions, given as percentages, and make them the state of the filter.
 * @param {reknitr.epFilter} that - The filter
 * @param {Number} min - The position of the minimum slider
 * @param {Number} max - The position of the maximum slider
 */
reknitr.epFilter.apply = function (that, min, max) {
    const root = that.container[0];
    root.querySelector(".saanich-ep-min").value = min;
    root.querySelector(".saanich-ep-max").value = max;
    root.querySelector(".saanich-ep-min-value").textContent = (min / 100).toFixed(2);
    root.querySelector(".saanich-ep-max-value").textContent = (max / 100).toFixed(2);
    that.filterState.value = {min: min / 100, max: max / 100};
};

reknitr.epFilter.reset = that => reknitr.epFilter.apply(that, 0, 100);

reknitr.epFilter.bindInput = function (that) {
    that.container[0].addEventListener("input", event => {
        const root = that.container[0];
        let min = +root.querySelector(".saanich-ep-min").value, max = +root.querySelector(".saanich-ep-max").value;
        // The handle being moved pushes the other along rather than crossing it
        if (min > max) {
            if (event.target.classList.contains("saanich-ep-min")) {
                max = min;
            } else {
                min = max;
            }
        }
        reknitr.epFilter.apply(that, min, max);
    });
};

fluid.registerNamespace("reknitr.lostPlants");

// The first page of the story, with a gallery of "lost" plants in place of the map. The plants are selected from the
// site's data whenever it loads, so that the gallery follows the data, and photos are looked up live from iNaturalist.
fluid.defaults("reknitr.lostPlantsPaneHandler", {
    gradeNames: ["reknitr.paneHandler", "reknitr.templatePaneHandler"],
    // The pane listing a species' records, which clicking on a plant opens
    targetPane: "Solow",
    // A native species which is historically reported but unconfirmed is shown if it has at least this Solow EP ...
    minEP: 0.3,
    // ... or no more than this number of records
    maxRecords: 2,
    // The maximum number of ids accepted by a single request to the iNaturalist taxa endpoint
    batchSize: 30,
    // Observes iNaturalist's requested limit of about one request per second
    batchDelay: 1100,
    resources: {
        template: {
            resourceText: "<div class=\"saanich-lost-gallery\"></div>"
        }
    },
    members: {
        pendingTaxonId: "@expand:signal(null)",
        showPendingTaxon: "@expand:fluid.effect(reknitr.lostPlants.showTaxon, {that}, {reknitr.storyPage}, {vizLoader}.taxa.rowById, {that}.pendingTaxonId)",
        loadGallery: "@expand:fluid.effect(reknitr.lostPlants.loadGallery, {that}, {vizLoader}.taxaRows, {vizLoader}.obsRows)",
        annotateGeoref: "@expand:fluid.effect(reknitr.lostPlants.annotateGeoref, {vizLoader}, {vizLoader}.taxaRows, {vizLoader}.obsRows)"
    },
    listeners: {
        "onCreate.bindGallery": "reknitr.lostPlants.bindGallery({reknitr.storyPage}, {that})"
    }
});

/**
 * Select the plants of the gallery from the site's data, highest extirpation probability first.
 * @param {Object[]} taxaRows - All taxon rows
 * @param {Object[]} obsRows - All observation rows
 * @param {Object} options - The options of the pane handler, holding `minEP` and `maxRecords`
 * @return {Object[]} - Selected taxon rows, each paired as {taxon, nRecords, lastRecorded}
 */
reknitr.lostPlants.selectPlants = function (taxaRows, obsRows, options) {
    const sightings = new Map();
    obsRows.forEach(obs => {
        const entry = sightings.get(obs.iNaturalistTaxonId) || {nRecords: 0, lastRecorded: NaN};
        const year = parseInt(obs.eventDate, 10);
        entry.nRecords++;
        entry.lastRecorded = Number.isNaN(entry.lastRecorded) ? year : Math.max(entry.lastRecorded, year || entry.lastRecorded);
        sightings.set(obs.iNaturalistTaxonId, entry);
    });
    return taxaRows
        .filter(taxon => taxon.inSummary && taxon.introduction_status === "native" && taxon.reportingStatus === "unconfirmed")
        .map(taxon => ({taxon, ...(sightings.get(taxon.id) || {nRecords: 0, lastRecorded: NaN})}))
        .filter(({taxon, nRecords}) => +taxon.solow_EP >= options.minEP || nRecords > 0 && nRecords <= options.maxRecords)
        .sort((a, b) => +b.taxon.solow_EP - +a.taxon.solow_EP || a.taxon.scientificName.localeCompare(b.taxon.scientificName));
};

/**
 * Note on each taxon row its number of records and how many of them lack coordinates, for the table of taxa. These are
 * display values held in the browser alone.
 * @param {Object} vizLoader - The viz loader
 * @param {Object[]} taxaRows - All taxon rows
 * @param {Object[]} obsRows - All observation rows
 */
reknitr.lostPlants.annotateGeoref = function (vizLoader, taxaRows, obsRows) {
    const counts = new Map();
    obsRows.forEach(record => {
        const entry = counts.get(record.iNaturalistTaxonId) || {total: 0, unmapped: 0};
        entry.total++;
        entry.unmapped += reknitr.hasCoordinates(record) ? 0 : 1;
        counts.set(record.iNaturalistTaxonId, entry);
    });
    taxaRows.forEach(taxon => {
        const entry = counts.get(taxon.id) || {total: 0, unmapped: 0};
        taxon.n_obs = entry.total;
        taxon.n_unmapped = entry.unmapped;
    });
    // Deferred since this runs within an effect, which may not both read and write a signal
    fluid.invokeLater(() => vizLoader.taxaTable.resizeCount.value = vizLoader.taxaTable.resizeCount.peek() + 1);
};

/**
 * Find a photo of a taxon which may be republished. iNaturalist records no licence code for a photo with all rights
 * reserved, and photos licensed against derivatives are passed over since the gallery crops them to squares. The taxon's default photo is preferred, followed by the others curated for it.
 * @param {Object} taxon - A taxon record from the iNaturalist API
 * @return {Object|undefined} - The photo record, if there is an openly licensed one
 */
reknitr.lostPlants.licensedPhoto = function (taxon) {
    const photos = [taxon.default_photo, ...(taxon.taxon_photos || []).map(entry => entry.photo)];
    return photos.find(photo => photo?.license_code && !photo.license_code.includes("-nd"));
};

/**
 * Render one plant of the gallery.
 * @param {Object} plant - An entry from `reknitr.lostPlants.selectPlants`
 * @param {Object} photo - Its photo record from the iNaturalist API
 * @return {String} - The markup for the plant
 */
reknitr.lostPlants.renderCard = function (plant, photo) {
    const name = fluid.XMLEncode(plant.taxon.scientificName);
    const details = [plant.taxon.commonName, plant.lastRecorded && "last recorded " + plant.lastRecorded].filter(Boolean).join(" · ");
    const unmapped = plant.taxon.n_obs > 0 && plant.taxon.n_unmapped === plant.taxon.n_obs ? `<span class="saanich-lost-unmapped">\u26A0 no mapped records</span>` : "";
    const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
    return `<button type="button" class="saanich-lost-card" data-taxon-id="${fluid.XMLEncode(plant.taxon.id)}">
        <img src="${fluid.XMLEncode(photo.medium_url)}" alt="${name}" loading="lazy">
        <span class="saanich-lost-name">${name}</span>
        <span class="saanich-lost-details">${fluid.XMLEncode(details)}</span>
        ${unmapped}
        <span class="saanich-lost-credit">${fluid.XMLEncode(credit)}</span>
    </button>`;
};

/**
 * Fill the gallery with those selected plants which have an openly licensed photo, a batch at a time.
 * @param {reknitr.lostPlantsPaneHandler} that - This pane handler
 * @param {Object[]} taxaRows - All taxon rows
 * @param {Object[]} obsRows - All observation rows
 */
reknitr.lostPlants.loadGallery = async function (that, taxaRows, obsRows) {
    const container = that.container[0];
    const {batchSize, batchDelay} = that.options;
    const plants = reknitr.lostPlants.selectPlants(taxaRows, obsRows, that.options);
    const count = document.querySelector(".saanich-lost-count");
    container.innerHTML = "";
    let shown = 0;
    for (let start = 0; start < plants.length; start += batchSize) {
        const batch = plants.slice(start, start + batchSize);
        const ids = batch.map(plant => plant.taxon.id).join(",");
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/taxa/${ids}?per_page=${batchSize}`);
            const taxa = (await response.json()).results;
            const photos = Object.fromEntries(taxa.map(taxon => [taxon.id, reknitr.lostPlants.licensedPhoto(taxon)]));
            const cards = batch.filter(plant => photos[plant.taxon.id])
                .map(plant => reknitr.lostPlants.renderCard(plant, photos[plant.taxon.id]));
            container.insertAdjacentHTML("beforeend", cards.join(""));
            shown += cards.length;
            count.textContent = shown;
        } catch (error) {
            console.error("Could not fetch photos from iNaturalist", error);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
};

/**
 * Place the gallery in this pane's section of the left hand column and listen for clicks on its plants.
 * @param {reknitr.storyPage} storyPage - The story page
 * @param {reknitr.lostPlantsPaneHandler} that - This pane handler
 */
reknitr.lostPlants.bindGallery = function (storyPage, that) {
    const container = that.container[0];
    storyPage.dataPanes[that.options.paneIndex].appendChild(container);
    container.addEventListener("click", event => {
        const card = event.target.closest(".saanich-lost-card");
        if (card) {
            that.pendingTaxonId.value = card.dataset.taxonId;
        }
    });
};

/**
 * Open the pane listing a species' records with the clicked plant selected, as soon as the taxa have loaded.
 * @param {reknitr.lostPlantsPaneHandler} that - This pane handler
 * @param {reknitr.storyPage} storyPage - The story page
 * @param {Object} rowById - Taxon rows indexed by id
 * @param {String|null} taxonId - The id of the clicked plant, if there is one still to be shown
 */
reknitr.lostPlants.showTaxon = function (that, storyPage, rowById, taxonId) {
    const row = rowById[taxonId];
    if (row) {
        const table = storyPage.vizLoader.taxaTable;
        storyPage.applier.change("activeSection", storyPage.paneKeyToIndex[that.options.targetPane]);
        table.selectedRow.value = row;
        requestAnimationFrame(() => reknitr.lostPlants.revealRow(table, row));
        fluid.invokeLater(() => that.pendingTaxonId.value = null);
    }
};

/**
 * Bring a row of a table into view, which must wait until the table has its size in a newly visible pane.
 * @param {Object} table - The table
 * @param {Object} row - The row to show
 */
reknitr.lostPlants.revealRow = function (table, row) {
    const index = table.displayRows.indexOf(row);
    if (index >= 0) {
        table.dom.locate("scrollEl")[0].scrollTop = index * hortis.dataTable.rowHeight(table);
        hortis.dataTable.renderRows(table);
    }
};

// Show checklist entries under the project's accepted names, including annotations such as ssp. and var.
const inatRowToScientific = hortis.rowToScientific;
hortis.rowToScientific = row => row.scientificName || inatRowToScientific(row);

fluid.registerNamespace("reknitr.saanichAtlas");

// The atlas pane, whose confirmed, historical and new links in the text select those species in the map and lists
fluid.defaults("reknitr.saanichAtlasPaneHandler", {
    gradeNames: "reknitr.statusPaneHandler",
    members: {
        updateStatusTiles: "@expand:fluid.effect(reknitr.saanichAtlas.updateTiles, {that}.container, {vizLoader}.taxaRows, {vizLoader}.obsRows, {reknitr.storyPage}.map.selectedStatus)"
    },
    components: {
        atlasTaxonInfo: {
            type: "reknitr.atlasTaxonInfo",
            options: {
                parentContainer: ".mxcw-atlas-taxon-holder"
            }
        }
    },
    listeners: {
        "onCreate.bindStatusLinks": "reknitr.saanichAtlas.bindLinks({that}.container, {reknitr.storyPage}.map.selectedStatus)",
        "onCreate.bindStatusTooltips": "reknitr.statusTooltip.bind({vizLoader})"
    }
});

reknitr.saanichAtlas.bindLinks = function (container, selectedStatus) {
    container.on("click", ".saanich-status-link", function () {
        const status = this.dataset.status;
        selectedStatus.value = selectedStatus.peek() === status ? null : status;
    });
};

reknitr.saanichAtlas.updateLinks = function (container, selectedStatus) {
    container.find(".saanich-status-link").each(function () {
        this.setAttribute("aria-pressed", String(this.dataset.status === selectedStatus));
    });
};

fluid.registerNamespace("reknitr.remembering");

reknitr.remembering.imagePath = "../local/images/remembering/";

reknitr.remembering.journals = [
    {file: "1973-1981.png", caption: "Flora of Saturna, ca. 1973–1981"},
    {file: "1981-1996.png", caption: "Journal, ca. 1981–1996"},
    {file: "1996-2000.png", caption: "Journal, ca. 1996–2000"},
    {file: "1999-2003.png", caption: "Unbound field notes, ca. 1999–2003"},
    {file: "2003-2017.png", caption: "Field notes, ca. 2003–2017"}
];

reknitr.remembering.renderFigure = function (file, caption, className) {
    return `<figure class="${className}"><img src="${reknitr.remembering.imagePath}${file}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
};

reknitr.remembering.markup = `<div class="saanich-remembering">
    <div class="saanich-remembering-photos">
        ${reknitr.remembering.renderFigure("harvey-and-hannah.jpg", "Harvey Janszen and Hannah Carpendale searching for <i>Platanthera unalascensis</i> on Stockade Hill, Galiano Island, July 2020", "saanich-remembering-lead").replace(/alt="[^"]*"/, "alt=\"Harvey Janszen and Hannah Carpendale searching for an orchid on Stockade Hill, Galiano Island\"")}
        ${reknitr.remembering.renderFigure("HJ.png", "Harvey Janszen, Galiano Island, May 3, 2019", "saanich-remembering-portrait")}
    </div>
    <h3>Harvey’s field journals</h3>
    <div class="saanich-remembering-journals">
        ${reknitr.remembering.journals.map(journal => reknitr.remembering.renderFigure(journal.file, journal.caption, "saanich-remembering-journal")).join("")}
    </div>
</div>`;

// The final page of the story, with photographs and field journals in place of the map
fluid.defaults("reknitr.rememberingPaneHandler", {
    gradeNames: ["reknitr.paneHandler", "reknitr.templatePaneHandler"],
    resources: {
        template: {
            resourceText: reknitr.remembering.markup
        }
    },
    listeners: {
        "onCreate.placePhotos": "reknitr.remembering.placePhotos({reknitr.storyPage}, {that})"
    }
});

reknitr.remembering.placePhotos = function (storyPage, that) {
    storyPage.dataPanes[that.options.paneIndex].appendChild(that.container[0]);
};

// The taxon panel of the atlas, following the plant or group chosen in the checklist
fluid.registerNamespace("reknitr.atlasTaxonInfo");

reknitr.atlasTaxonInfo.markup = `
<div class="mxcw-solow-taxon-pane">
  <div class="mxcw-taxon-image">
      %taxonImage
  </div>
  <div class="mxcw-taxon-info">
  <div class="mxcw-taxon-name">%taxonName</div>
      <dl class="mxcw-taxon-fields">
        %commonName
        <dt>Date first seen:</dt> <dd>%dateFirstSeen</dd>
        <dt>Date last seen:</dt>  <dd>%dateLastSeen</dd>
        <dt>Total records:</dt> <dd>%numObs</dd>
        %status
      </dl>
      %georefNote
  </div>
</div>
`;

reknitr.atlasTaxonInfo.statusLabels = {confirmed: "Confirmed", unconfirmed: "Historical", new: "New"};

reknitr.atlasTaxonInfo.field = (label, value) => value ? `<dt>${label}:</dt> <dd>${fluid.XMLEncode(value)}</dd>` : "";

/**
 * Find the dated records of a taxon and of any taxa beneath it, in date order.
 * @param {Object[]} obsRows - All observation rows
 * @param {Object} rowById - Taxon rows indexed by id
 * @param {Object|null} taxon - The selected taxon
 * @return {Object[]} - The records found
 */
reknitr.atlasTaxonInfo.taxonRecords = function (obsRows, rowById, taxon) {
    const isWithin = id => {
        for (let row = rowById[id]; row; row = row.parent) {
            if (row === taxon) {
                return true;
            }
        }
        return false;
    };
    return taxon ? obsRows.filter(obs => obs.eventDate && isWithin(obs.iNaturalistTaxonId)).sort(reknitr.obsDateComparator) : [];
};

reknitr.atlasTaxonInfo.renderModel = function (taxon, records) {
    return taxon && records.length > 0 ? {
        taxonName: taxon.scientificName || taxon.iNaturalistTaxonName,
        commonName: reknitr.atlasTaxonInfo.field("Common name", taxon.commonName),
        dateFirstSeen: records[0].eventDate.substring(0, 10),
        dateLastSeen: fluid.peek(records).eventDate.substring(0, 10),
        numObs: records.length.toLocaleString("en-CA"),
        status: reknitr.atlasTaxonInfo.field("Status", reknitr.atlasTaxonInfo.statusLabels[taxon.reportingStatus]),
        georefNote: reknitr.georefNote(records),
        taxonImage: hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)
    } : undefined;
};

fluid.defaults("reknitr.atlasTaxonInfo", {
    gradeNames: ["fluid.viewComponent", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.atlasTaxonInfo.markup
    },
    members: {
        selectedTaxon: "{vizLoader}.checklist.search.filterState",
        records: "@expand:fluid.computed(reknitr.atlasTaxonInfo.taxonRecords, {vizLoader}.obsRows, {vizLoader}.taxa.rowById, {that}.selectedTaxon)",
        renderModel: "@expand:fluid.computed(reknitr.atlasTaxonInfo.renderModel, {that}.selectedTaxon, {that}.records)",
        updateHolder: "@expand:fluid.effect(reknitr.atlasTaxonInfo.updateHolder, {that}.selectedTaxon, {that}.records, {reknitr.saanichAtlasPaneHandler}.isVisible)"
    }
});

/**
 * Show the panel only on the atlas pane and only while a plant with records is selected. Its model is unavailable
 * rather than empty when there is no plant, so this needs to be driven by the selection itself.
 * @param {Object|null} taxon - The selected taxon
 * @param {Object[]} records - Its records
 * @param {Boolean} isVisible - Whether the atlas pane is showing
 */
reknitr.atlasTaxonInfo.updateHolder = function (taxon, records, isVisible) {
    hortis.toggleClass(document.querySelector(".mxcw-atlas-taxon-holder"), "mxcw-atlas-has-taxon", !!taxon && records.length > 0 && !!isVisible);
};

// Summaries of each group of species, shown when hovering over its name in the atlas text or the map's key
fluid.registerNamespace("reknitr.statusTooltip");

reknitr.statusTooltip.colours = {confirmed: "#5a96d2", unconfirmed: "#decb90", new: "#7562b4"};

/**
 * Render a set of horizontal bars.
 * @param {Array} entries - The bars to render, as [label, value] pairs
 * @return {String} - The markup for the bars
 */
reknitr.statusTooltip.bars = function (entries) {
    const max = Math.max(...entries.map(([, value]) => value), 1);
    return `<div class="saanich-tip-bars">${entries.map(([label, value, text]) => `
        <span class="saanich-tip-label" title="${fluid.XMLEncode(label)}">${fluid.XMLEncode(label)}</span>
        <span class="saanich-tip-track"><span class="saanich-tip-bar" style="width:${value / max * 100}%"></span></span>
        <span class="saanich-tip-value">${text || value.toLocaleString("en-CA")}</span>`).join("")}</div>`;
};

/**
 * Render a row of twelve columns, one for each month of the year.
 * @param {Number[]} counts - The value for each month
 * @return {String} - The markup for the columns
 */
reknitr.statusTooltip.months = function (counts) {
    const max = Math.max(...counts, 1);
    return `<div class="saanich-tip-months">${counts.map((count, month) => `
        <span class="saanich-tip-month" title="${count}"><span class="saanich-tip-column" style="height:${count / max * 100}%"></span><span>${"JFMAMJJASOND"[month]}</span></span>`).join("")}</div>`;
};

reknitr.statusTooltip.frame = (name, count, body) =>
    `<div class="saanich-tip-title">${name} <span>${count.toLocaleString("en-CA")} species</span></div>${body}`;

reknitr.statusTooltip.heading = text => `<div class="saanich-tip-heading">${text}</div>`;

reknitr.statusTooltip.groupRecords = function (obsRows) {
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

reknitr.statusTooltip.renderers = {
    confirmed: function (taxa, byTaxon) {
        const bins = [["1–9", 1, 9], ["10–99", 10, 99], ["100–999", 100, 999], ["1,000+", 1000, Infinity]];
        const sizes = taxa.map(taxon => (byTaxon.get(taxon.id) || []).length);
        return reknitr.statusTooltip.frame("Confirmed", taxa.length,
            reknitr.statusTooltip.heading("Species by number of records") +
            reknitr.statusTooltip.bars(bins.map(([label, min, max]) => [label, sizes.filter(size => size >= min && size <= max).length])));
    },
    new: function (taxa, byTaxon) {
        const firstRecorder = record => (record.recordedBy || "Unknown").split(";")[0].trim() || "Unknown";
        const reports = taxa.map(taxon => ({taxon, first: (byTaxon.get(taxon.id) || []).sort(reknitr.obsDateComparator)[0]})).filter(report => report.first);
        const counts = {};
        reports.forEach(report => counts[firstRecorder(report.first)] = (counts[firstRecorder(report.first)] || 0) + 1);
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const latest = reports.sort((a, b) => b.first.eventDate.localeCompare(a.first.eventDate)).slice(0, 3);
        return reknitr.statusTooltip.frame("Newly reported", taxa.length,
            reknitr.statusTooltip.heading("Observers with the earliest atlas record of the most species") + reknitr.statusTooltip.bars(top) +
            reknitr.statusTooltip.heading("Most recent additions, by earliest record in this atlas") +
            `<ul class="saanich-tip-list">${latest.map(report => `<li><i>${fluid.XMLEncode(report.taxon.scientificName)}</i> ${report.first.eventDate.substring(0, 4)}, ${fluid.XMLEncode(firstRecorder(report.first))}</li>`).join("")}</ul>`);
    },
    unconfirmed: function (taxa, byTaxon) {
        const eras = [["Before 1900", 0, 1899], ["1900–1949", 1900, 1949], ["1950–1979", 1950, 1979], ["1980–1999", 1980, 1999]];
        const records = taxa.map(taxon => (byTaxon.get(taxon.id) || []).sort(reknitr.obsDateComparator)).filter(list => list.length > 0);
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
        return reknitr.statusTooltip.frame("Historical", taxa.length,
            reknitr.statusTooltip.heading("Species by when last recorded") +
            reknitr.statusTooltip.bars(eras.map(([label, min, max]) => [label, records.filter(list => lastYear(list) >= min && lastYear(list) <= max).length])) +
            reknitr.statusTooltip.heading("Past records by month, a guide to when to look") + reknitr.statusTooltip.months(months) +
            `<div class="saanich-tip-note">${withLocality} species have a recorded locality to search, and ${withSpecimen} have a specimen to consult.</div>`);
    }
};

/**
 * Find which group of species an element in the page refers to, if any.
 * @param {Element} element - The element being hovered over or focused
 * @return {Array|undefined} - The status, and the element to anchor the tooltip to
 */
reknitr.statusTooltip.statusFor = function (element) {
    const link = element.closest?.(".saanich-status-link");
    const row = element.closest?.(".mxcw-map .imerss-legend-row");
    const rowStatus = row && ["confirmed", "unconfirmed", "new"].find(status => row.classList.contains("imerss-legend-row-" + status) ||
        status === "unconfirmed" && row.classList.contains("imerss-legend-row-historical"));
    return link ? [link.dataset.status, link] : rowStatus ? [rowStatus, row] : undefined;
};

reknitr.statusTooltip.bind = function (vizLoader) {
    reknitr.statusTooltip.vizLoader = vizLoader;
    const tip = document.createElement("div");
    tip.className = "saanich-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    const cache = {};
    const render = status => {
        const taxaRows = vizLoader.taxaRows.value, obsRows = vizLoader.obsRows.value;
        if (taxaRows && obsRows && !cache[status]) {
            cache.byTaxon = cache.byTaxon || reknitr.statusTooltip.groupRecords(obsRows);
            const taxa = taxaRows.filter(taxon => taxon.inSummary && taxon.reportingStatus === status);
            cache[status] = reknitr.statusTooltip.renderers[status](taxa, cache.byTaxon);
        }
        return cache[status];
    };
    const show = event => {
        const found = reknitr.statusTooltip.statusFor(event.target);
        const markup = found && render(found[0]);
        if (markup) {
            tip.innerHTML = markup;
            tip.style.setProperty("--tip-colour", reknitr.statusTooltip.colours[found[0]]);
            tip.classList.add("saanich-tip-visible");
            const anchor = found[1].getBoundingClientRect(), box = tip.getBoundingClientRect();
            const left = anchor.left - box.width - 12 >= 8 ? anchor.left - box.width - 12 : Math.min(anchor.right + 12, innerWidth - box.width - 8);
            tip.style.left = Math.max(8, left) + "px";
            tip.style.top = Math.min(Math.max(8, anchor.top - 24), innerHeight - box.height - 8) + "px";
        }
    };
    const hide = event => {
        if (reknitr.statusTooltip.statusFor(event.target)) {
            tip.classList.remove("saanich-tip-visible");
        }
    };
    document.addEventListener("mouseover", show);
    document.addEventListener("mouseout", hide);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", hide);
};

// iNaturalist's records carry a full timestamp - show only the date in the tables of records
const dataTableRenderCell = hortis.dataTable.renderCell;
hortis.dataTable.renderCell = (col, row) => col.key === "eventDate" ? fluid.XMLEncode(String(row.eventDate ?? "").substring(0, 10)) :
    col.key === "n_unmapped" ? (row.n_unmapped > 0 ? `<span class="mxcw-georef-flag" title="${row.n_unmapped} of ${row.n_obs} records have no coordinates">\u26A0 ${row.n_unmapped}</span>` : "") : dataTableRenderCell(col, row);

// A summary of a map cell, leading with what matters most to the search for lost plants: the historical species
// recorded there, followed by what has newly been found there and what is well documented
fluid.registerNamespace("reknitr.cellTooltip");

reknitr.cellTooltip.statuses = [["unconfirmed", "Historical"], ["new", "Newly reported"], ["confirmed", "Confirmed"]];

reknitr.cellTooltip.plural = (count, noun) => `${count.toLocaleString("en-CA")} ${noun}${count === 1 ? "" : "s"}`;

reknitr.cellTooltip.section = (heading, status, body) =>
    `<div class="saanich-cell-section" style="--tip-colour:${reknitr.statusTooltip.colours[status]}">${reknitr.statusTooltip.heading(heading)}${body}</div>`;

/**
 * Find the earliest record of each taxon across the whole atlas, whatever filters are applied.
 * @return {Map} - The earliest record for each taxon id
 */
reknitr.cellTooltip.earliestRecords = function () {
    if (!reknitr.cellTooltip.earliest) {
        const earliest = reknitr.cellTooltip.earliest = new Map();
        reknitr.statusTooltip.vizLoader.obsRows.value.forEach(record => {
            const current = earliest.get(record.iNaturalistTaxonId);
            if (record.eventDate && (!current || record.eventDate < current.eventDate)) {
                earliest.set(record.iNaturalistTaxonId, record);
            }
        });
    }
    return reknitr.cellTooltip.earliest;
};

/**
 * Render the summary of a grid cell - this replaces hortis.renderVizGridTooltip, which listed taxa alone.
 * @param {Object} that - The tooltip component
 * @param {Object} grid - The grid of records
 * @param {Object} rowById - Taxon rows indexed by id
 * @param {String} cellId - The id of the cell
 * @return {String} - The markup for the summary
 */
hortis.renderVizGridTooltip = function (that, grid, rowById, cellId) {
    const bucket = grid.buckets[cellId];
    const obsRows = reknitr.statusTooltip.vizLoader.finalFilteredObs.value;
    const plants = Object.entries(bucket.byTaxonId).map(([taxonId, obsIndices]) => {
        const records = obsIndices.map(index => obsRows[index]).filter(record => record?.eventDate).sort(reknitr.obsDateComparator);
        return {taxon: rowById[taxonId], count: obsIndices.length, first: records[0], last: fluid.peek(records)};
    });
    const inStatus = status => plants.filter(plant => plant.taxon.reportingStatus === status);
    const name = plant => plant.taxon.scientificName || plant.taxon.iNaturalistTaxonName;
    const more = (list, shown) => list.length > shown ? `<div class="saanich-tip-note">and ${list.length - shown} more</div>` : "";

    const segments = reknitr.cellTooltip.statuses.map(([status, label]) => ({status, label, count: inStatus(status).length})).filter(segment => segment.count > 0);
    const stack = `<div class="saanich-cell-stack">${segments.map(segment =>
        `<span style="flex:${segment.count};background:${reknitr.statusTooltip.colours[segment.status]}"></span>`).join("")}</div>
        <div class="saanich-cell-key">${segments.map(segment =>
        `<span><i style="background:${reknitr.statusTooltip.colours[segment.status]}"></i>${segment.label} ${segment.count}</span>`).join("")}</div>`;

    const historical = inStatus("unconfirmed").sort((a, b) => +b.taxon.solow_EP - +a.taxon.solow_EP);
    // A newly reported species is identified by its earliest record anywhere, not by whatever was last seen in this cell
    const earliest = reknitr.cellTooltip.earliestRecords();
    const fresh = inStatus("new").map(plant => ({...plant, earliest: earliest.get(plant.taxon.id)})).filter(plant => plant.earliest)
        .sort((a, b) => b.earliest.eventDate.localeCompare(a.earliest.eventDate));
    const confirmed = inStatus("confirmed").sort((a, b) => b.count - a.count);
    const recorder = plant => (plant.last.recordedBy || "").split(";")[0].trim();

    const sections = [
        historical.length && reknitr.cellTooltip.section("Lost plants recorded here: records, and year last seen", "unconfirmed",
            reknitr.statusTooltip.bars(historical.slice(0, 4).map(plant => [name(plant), plant.count,
                `${plant.count} · ${plant.last ? plant.last.eventDate.substring(0, 4) : "?"}`])) + more(historical, 4)),
        fresh.length && reknitr.cellTooltip.section("Newly reported species here: earliest record in this atlas", "new",
            `<ul class="saanich-tip-list">${fresh.slice(0, 3).map(plant => `<li><i>${fluid.XMLEncode(name(plant))}</i> ${plant.earliest.eventDate.substring(0, 4)}${recorder(plant) ? ", " + fluid.XMLEncode(recorder(plant)) : ""}${plant.first?.eventDate === plant.earliest.eventDate ? " (here)" : ""}</li>`).join("")}</ul>` + more(fresh, 3)),
        confirmed.length && reknitr.cellTooltip.section("Most recorded confirmed species", "confirmed",
            reknitr.statusTooltip.bars(confirmed.slice(0, 3).map(plant => [name(plant), plant.count])) + more(confirmed, 3))
    ].filter(Boolean).join("");

    return `<div class="saanich-cell-tip">
        <div class="saanich-tip-title">${plants.length.toLocaleString("en-CA")} species <span>${reknitr.cellTooltip.plural(bucket.obsCount, "record")}</span></div>
        ${stack}${sections}
    </div>`;
};

// Tiles summarizing the three groups of species in the atlas text, computed from the site's data. Each is a link which
// selects its group, and carries a small chart of the question that matters for that group
/**
 * Find the period covered by the dated records.
 * @param {Object[]} obsRows - All observation rows
 * @return {Object} - The earliest and latest years, as `first` and `last`
 */
reknitr.recordPeriod = function (obsRows) {
    return obsRows.reduce((period, obs) => {
        const year = parseInt(obs.eventDate, 10);
        return Number.isFinite(year) ? {first: Math.min(period.first, year), last: Math.max(period.last, year)} : period;
    }, {first: Infinity, last: -Infinity});
};

reknitr.saanichAtlas.yearBins = (start, end, width) =>
    fluid.iota(Math.ceil((end - start + 1) / width)).map(index => start + index * width);

reknitr.saanichAtlas.tiles = [{
    status: "confirmed",
    name: "Confirmed",
    meaning: "Reported historically and found again since 2000.",
    caption: "First found again",
    bins: lastYear => reknitr.saanichAtlas.yearBins(2000, lastYear, 5),
    year: records => parseInt(records.find(record => parseInt(record.eventDate, 10) >= 2000)?.eventDate, 10)
}, {
    status: "unconfirmed",
    name: "Historical",
    meaning: "Reported in the past but not recorded since 2000.",
    caption: "Last recorded",
    bins: () => reknitr.saanichAtlas.yearBins(1860, 1999, 20),
    year: records => parseInt(fluid.peek(records).eventDate, 10)
}, {
    status: "new",
    name: "Newly reported",
    meaning: "Additions to the flora from recent reports.",
    caption: "Earliest record in this atlas",
    bins: lastYear => reknitr.saanichAtlas.yearBins(2000, lastYear, 5),
    year: records => parseInt(records[0].eventDate, 10)
}];

/**
 * Render the tile for one group of species.
 * @param {Object} tile - One entry of `reknitr.saanichAtlas.tiles`
 * @param {Object[]} taxa - The species of this group
 * @param {Map} byTaxon - Dated records indexed by taxon id
 * @param {Number} lastYear - The latest year of the records
 * @return {String} - The markup for the tile
 */
reknitr.saanichAtlas.renderTile = function (tile, taxa, byTaxon, lastYear) {
    const bins = tile.bins(lastYear);
    const counts = bins.map(() => 0);
    const width = bins[1] - bins[0];
    taxa.forEach(taxon => {
        const records = byTaxon.get(taxon.id);
        const year = records ? tile.year(records.slice().sort(reknitr.obsDateComparator)) : NaN;
        const index = Math.floor((year - bins[0]) / width);
        if (index >= 0 && index < counts.length) {
            counts[index]++;
        }
    });
    const max = Math.max(...counts, 1);
    const columns = counts.map(count => `<span style="height:${count / max * 100}%"></span>`).join("");
    // Each label starts beneath the bar for the period beginning in that year, and every other bar is labelled to leave room
    const axis = bins.filter((bin, index) => index % 2 === 0).map(bin => `<span>${bin}</span>`).join("");
    return `<button type="button" class="saanich-status-link saanich-status-tile" data-status="${tile.status}" aria-pressed="false" style="--tip-colour:${reknitr.statusTooltip.colours[tile.status]}">
        <span class="saanich-tile-name">${tile.name}</span>
        <span class="saanich-tile-count">${taxa.length.toLocaleString("en-CA")} <small>species</small></span>
        <span class="saanich-tile-meaning">${tile.meaning}</span>
        <span class="saanich-tile-caption">${tile.caption}, species per ${width} years</span>
        <span class="saanich-tile-chart" style="--tile-bins:${counts.length}">${columns}</span>
        <span class="saanich-tile-axis" style="--tile-bins:${counts.length}">${axis}</span>
    </button>`;
};

reknitr.saanichAtlas.updateTiles = function (container, taxaRows, obsRows, selectedStatus) {
    const holder = container.find(".saanich-status-tiles")[0];
    if (holder && !holder.firstElementChild) {
        const byTaxon = reknitr.statusTooltip.groupRecords(obsRows);
        const lastYear = reknitr.recordPeriod(obsRows).last;
        holder.innerHTML = reknitr.saanichAtlas.tiles.map(tile => reknitr.saanichAtlas.renderTile(tile,
            taxaRows.filter(taxon => taxon.inSummary && taxon.reportingStatus === tile.status), byTaxon, lastYear)).join("");
    }
    reknitr.saanichAtlas.updateLinks(container, selectedStatus);
};

// The map's grid counts records of every type of evidence, not only observations. The legend is redrawn whenever the
// grid changes, so its title is corrected each time
const drawObsGridLegend = hortis.libreMap.withObsGrid.drawLegend;
hortis.libreMap.withObsGrid.drawLegend = function (...args) {
    const legend = drawObsGridLegend(...args);
    const retitle = () => {
        const title = legend.container.querySelector(".imerss-legend-title");
        if (title) {
            title.textContent = "Record count";
        }
    };
    new MutationObserver(retitle).observe(legend.container, {childList: true});
    retitle();
    return legend;
};

fluid.registerNamespace("reknitr.saanichSolow");

// Opens on whichever species is at the top of the list, as it stands in the data, with the map fitted to its records
fluid.defaults("reknitr.saanichSolowPaneHandler", {
    gradeNames: "reknitr.solowPaneHandler",
    members: {
        selectTopSpecies: "@expand:fluid.effect(reknitr.saanichSolow.selectTopSpecies, {that}, {vizLoader}, {vizLoader}.taxaTable.rows, {that}.isVisible)",
        setAnalysisPeriod: "@expand:fluid.effect(reknitr.saanichSolow.setAnalysisPeriod, {vizLoader}.obsRows)"
    }
});

/**
 * Note the period which the records cover, before any plant can be selected, as the period of the Solow analysis.
 * @param {Object[]} obsRows - All observation rows
 */
reknitr.saanichSolow.setAnalysisPeriod = function (obsRows) {
    reknitr.saanichSolow.analysisPeriod = reknitr.recordPeriod(obsRows);
};

// The analysis always runs over the period of the records, in place of the fixed years of the shared framework
const frameworkSolowBayesFactor = reknitr.solowBayesFactor;
reknitr.solowBayesFactor = function (sortedCluster) {
    const {first, last} = reknitr.saanichSolow.analysisPeriod;
    return frameworkSolowBayesFactor(sortedCluster, {baselineYear: first, analysisYear: last});
};

/**
 * The first time the pane is shown, select the species at the top of the list unless one has already been chosen.
 * @param {Object} that - This pane handler
 * @param {Object} vizLoader - The viz loader
 * @param {Object[]} rows - The rows of the species list
 * @param {Boolean} isVisible - Whether this pane is showing
 */
reknitr.saanichSolow.selectTopSpecies = function (that, vizLoader, rows, isVisible) {
    if (isVisible && !that.topSpeciesSelected && rows.length > 0) {
        that.topSpeciesSelected = true;
        // Deferred since an effect may not write signals, and so that the pane's own positioning of the map comes first
        fluid.invokeLater(() => {
            const table = vizLoader.taxaTable;
            if (!table.selectedRow.peek()) {
                const top = hortis.dataTable.sortRows(rows, table.sortColumn.peek(), table.sortDirection.peek())[0];
                table.selectedRow.value = top;
                reknitr.saanichSolow.fitToTaxon(vizLoader, top);
            }
        });
    }
};

/**
 * Fit the map to the mapped records of a species.
 * @param {Object} vizLoader - The viz loader
 * @param {Object} taxon - The row of the species
 */
reknitr.saanichSolow.fitToTaxon = function (vizLoader, taxon) {
    const points = reknitr.solowObsForTaxon(vizLoader.obsRows.value, taxon).filter(reknitr.hasCoordinates)
        .map(record => [parseFloat(record.decimalLongitude), parseFloat(record.decimalLatitude)]);
    if (points.length > 0) {
        const bounds = points.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(points[0], points[0]));
        vizLoader.map.map.fitBounds(bounds, {padding: 80, maxZoom: 11, duration: 0});
    }
};

/**
 * Open the Find the Plants pane on a species, with its row in view and the map fitted to its records.
 * @param {reknitr.storyPage} storyPage - The story page
 * @param {Object} taxon - The row of the species
 */
reknitr.saanichSolow.openTaxon = function (storyPage, taxon) {
    const {vizLoader} = storyPage, table = vizLoader.taxaTable;
    storyPage.applier.change("activeSection", storyPage.paneKeyToIndex.Solow);
    table.selectedRow.value = taxon;
    // Once the map and table have taken up their sizes in the newly visible pane
    requestAnimationFrame(() => {
        vizLoader.map.map.resize();
        reknitr.saanichSolow.fitToTaxon(vizLoader, taxon);
        reknitr.lostPlants.revealRow(table, taxon);
    });
};

// The opening page of the story: plants' key moments appear across the landscape as a timeline plays, starting from a
// random year on each visit. Everything is derived from the site's data whenever it loads
fluid.registerNamespace("reknitr.traces");

reknitr.traces.kinds = {
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

reknitr.traces.icon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true">${reknitr.traces.kinds[kind].icon}</svg>`;

// How many seconds a marker takes to fade away: the last record of a plant lingers
reknitr.traces.life = kind => kind === "last" ? 18 : 12;

reknitr.traces.playIcons = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>`
};

/**
 * Derive the events of the timeline: each marks a key moment in the record of a species, and is shown only if the record
 * concerned can be mapped. A record which is both the first and last of a lost plant appears once, as its last.
 * @param {Object[]} taxaRows - All taxon rows
 * @param {Object[]} obsRows - All observation rows
 * @return {Object[]} - The events, in date order
 */
reknitr.traces.buildEvents = function (taxaRows, obsRows) {
    const byTaxon = reknitr.statusTooltip.groupRecords(obsRows);
    const events = [];
    const add = (taxon, kind, record) => {
        if (record && reknitr.hasCoordinates(record)) {
            events.push({taxon, kind, record, year: parseInt(record.eventDate, 10)});
        }
    };
    taxaRows.filter(taxon => taxon.inSummary).forEach(taxon => {
        const records = (byTaxon.get(taxon.id) || []).slice().sort(reknitr.obsDateComparator);
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
    return events.filter(event => Number.isFinite(event.year)).sort((a, b) => reknitr.obsDateComparator(a.record, b.record));
};

reknitr.traces.formatDate = function (eventDate) {
    const [year, month, day] = eventDate.substring(0, 10).split("-").map(Number);
    return day ? new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-CA", {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"}) :
        String(year);
};

reknitr.traces.renderCard = function (event) {
    const {taxon, kind, record} = event;
    const recorder = (record.recordedBy || "").split(";")[0].trim();
    const common = taxon.commonName ? `<div class="saanich-trace-common">${fluid.XMLEncode(taxon.commonName)}</div>` : "";
    const place = record.locality ? `<div>${fluid.XMLEncode(record.locality)}</div>` : "";
    return `<div class="saanich-trace-photo"></div><div class="saanich-trace-kind" data-kind="${kind}">${reknitr.traces.icon(kind)}${reknitr.traces.kinds[kind].label}</div>
        <div class="saanich-trace-name">${fluid.XMLEncode(taxon.scientificName)}</div>${common}
        <div>${reknitr.traces.formatDate(record.eventDate)}${recorder ? ", " + fluid.XMLEncode(recorder) : ""}</div>${place}
        <div class="saanich-trace-significance">${reknitr.traces.kinds[kind].significance}</div>
        <div class="saanich-trace-action">Click to find this plant &rarr;</div>`;
};

fluid.defaults("reknitr.tracesPaneHandler", {
    gradeNames: "reknitr.paneHandler",
    visibleMap: true,
    members: {
        controlPlayback: "@expand:fluid.effect(reknitr.traces.controlPlayback, {that}, {reknitr.storyPage}, {vizLoader}.taxaRows, {vizLoader}.obsRows, {that}.isVisible)"
    },
    listeners: {
        "onCreate.bindNext": "reknitr.traces.bindNext({that}.container, {reknitr.storyPage})"
    }
});

reknitr.traces.bindNext = function (container, storyPage) {
    container.on("click", ".saanich-traces-next", event => {
        event.preventDefault();
        storyPage.applier.change("activeSection", storyPage.paneKeyToIndex.LostPlants);
    });
};

/**
 * Create the elements laid over the map: the year, the controls of the timeline, the key and the card shown on hover.
 * @param {HTMLElement} mapElement - The element holding the map
 * @param {Number} firstYear - The year of the earliest event
 * @param {Number} lastYear - The year of the latest event
 * @return {Object} - The elements which change during playback
 */
reknitr.traces.createOverlay = function (mapElement, firstYear, lastYear) {
    const overlay = document.createElement("div");
    overlay.className = "saanich-traces-overlay";
    overlay.innerHTML = `<div class="saanich-traces-year"></div>
        <div class="saanich-traces-controls">
            <button type="button" class="saanich-traces-play"></button>
            <input type="range" class="saanich-traces-slider" min="${firstYear}" max="${lastYear}" step="1" aria-label="Year">
        </div>
        <div class="saanich-traces-key">${["last", "first", "found", "fresh"].map(kind =>
        `<span data-kind="${kind}">${reknitr.traces.icon(kind)}${reknitr.traces.kinds[kind].label}</span>`).join("")}</div>`;
    mapElement.appendChild(overlay);
    const card = document.createElement("div");
    card.className = "saanich-trace-card";
    card.setAttribute("role", "tooltip");
    document.body.appendChild(card);
    return {year: overlay.querySelector(".saanich-traces-year"), play: overlay.querySelector(".saanich-traces-play"),
        slider: overlay.querySelector(".saanich-traces-slider"), card};
};

/**
 * Update whether the timeline is paused or being dragged, freezing the markers on the map while it is either.
 * @param {Object} state - The state of the playback
 * @param {Object} changes - New values for `paused` and/or `scrubbing`
 */
reknitr.traces.setPlayback = function (state, changes) {
    Object.assign(state, changes);
    const {play} = state.overlay, action = state.paused ? "Play" : "Pause";
    play.innerHTML = reknitr.traces.playIcons[action.toLowerCase()];
    play.setAttribute("aria-label", action);
    play.title = action;
    document.querySelector(".mxcw-leftPane").classList.toggle("saanich-traces-still", state.paused || state.scrubbing);
};

/**
 * Bind the play button and the slider. Playback holds while the slider is dragged, and carries on from the new position
 * when it is let go.
 * @param {Object} state - The state of the playback
 * @param {Object} map - The maplibre map
 */
reknitr.traces.bindControls = function (state, map) {
    const {play, slider} = state.overlay;
    const release = () => reknitr.traces.setPlayback(state, {scrubbing: false});
    play.addEventListener("click", () => reknitr.traces.setPlayback(state, {paused: !state.paused}));
    slider.addEventListener("pointerdown", () => reknitr.traces.setPlayback(state, {scrubbing: true}));
    slider.addEventListener("input", () => {
        reknitr.traces.setPlayback(state, {scrubbing: true});
        reknitr.traces.seek(state, map, Number(slider.value));
    });
    slider.addEventListener("change", release);
    // Not on the slider, since the pointer may be let go anywhere and a click which moves nothing fires no change
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
};

reknitr.traces.showYear = function (state, year) {
    const {year: label, slider} = state.overlay;
    label.textContent = year;
    slider.value = year;
    slider.style.setProperty("--saanich-progress", ((year - state.firstYear) / Math.max(1, state.lastYear - state.firstYear) * 100) + "%");
};

reknitr.traces.showCard = function (state, event, element) {
    const {card} = state.overlay;
    card.innerHTML = reknitr.traces.renderCard(event);
    card.classList.add("saanich-trace-card-visible");
    const anchor = element.getBoundingClientRect(), box = card.getBoundingClientRect();
    const fitsRight = anchor.right + 12 + box.width <= innerWidth - 8;
    card.style.left = (fitsRight ? anchor.right + 12 : Math.max(8, anchor.left - box.width - 12)) + "px";
    card.style.top = Math.min(Math.max(8, anchor.top - 16), innerHeight - box.height - 8) + "px";
    reknitr.traces.loadPhoto(state, event);
};

reknitr.traces.photos = new Map();

/**
 * Look up an openly licensed photo of a taxon on iNaturalist, once only for each taxon.
 * @param {String} taxonId - The id of the taxon
 * @return {Promise} - Resolves to the photo record, or undefined if there is none or it cannot be fetched
 */
reknitr.traces.photoFor = function (taxonId) {
    if (!reknitr.traces.photos.has(taxonId)) {
        reknitr.traces.photos.set(taxonId, fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`)
            .then(response => response.json())
            .then(body => reknitr.lostPlants.licensedPhoto(body.results[0]))
            .catch(() => undefined));
    }
    return reknitr.traces.photos.get(taxonId);
};

/**
 * Fill in the photo of the card being shown, unless another card has replaced it in the meantime.
 * @param {Object} state - The state of the playback
 * @param {Object} event - The event shown on the card
 */
reknitr.traces.loadPhoto = function (state, event) {
    state.cardEvent = event;
    reknitr.traces.photoFor(event.taxon.id).then(photo => {
        const holder = state.overlay.card.querySelector(".saanich-trace-photo");
        if (state.cardEvent === event && holder) {
            if (photo) {
                const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
                holder.innerHTML = `<img src="${fluid.XMLEncode(photo.medium_url)}" alt=""><span>${fluid.XMLEncode(credit)}</span>`;
            } else {
                holder.remove();
            }
        }
    });
};

reknitr.traces.hideCard = state => state.overlay.card.classList.remove("saanich-trace-card-visible");

/**
 * Place the marker for one event on the map. It fades away by itself, unless held open by the pointer resting on it.
 * @param {Object} state - The state of the playback
 * @param {Object} map - The maplibre map
 * @param {Object} event - The event to show
 * @param {Number} [age] - How many seconds into its fade the marker should begin
 */
reknitr.traces.addMarker = function (state, map, event, age = 0) {
    const element = document.createElement("div");
    element.className = "saanich-trace";
    element.dataset.kind = event.kind;
    element.innerHTML = `<div class="saanich-trace-mark" style="animation-duration: ${reknitr.traces.life(event.kind)}s; animation-delay: ${-age}s">${reknitr.traces.icon(event.kind)}</div>`;
    const marker = new maplibregl.Marker({element}).setLngLat([parseFloat(event.record.decimalLongitude), parseFloat(event.record.decimalLatitude)]).addTo(map);
    state.markers.add(marker);
    element.addEventListener("mouseenter", () => {
        state.holding++;
        reknitr.traces.showCard(state, event, element);
    });
    element.addEventListener("mouseleave", () => {
        state.holding = Math.max(0, state.holding - 1);
        reknitr.traces.hideCard(state);
    });
    element.addEventListener("click", () => reknitr.saanichSolow.openTaxon(state.storyPage, event.taxon));
    element.firstElementChild.addEventListener("animationend", () => {
        marker.remove();
        state.markers.delete(marker);
    });
};

reknitr.traces.clearMarkers = function (state) {
    state.markers.forEach(marker => marker.remove());
    state.markers.clear();
    state.holding = 0;
    reknitr.traces.hideCard(state);
};

// The time in milliseconds before the next event: the quiet stretches of the record pass more slowly than the busy ones,
// though never for long
reknitr.traces.delayAfter = (event, next) => Math.min(1600, 600 + Math.max(0, next.year - event.year) * 200);

reknitr.traces.step = function (state, map) {
    state.timer = setTimeout(() => reknitr.traces.step(state, map), reknitr.traces.nextDelay);
    if (!state.paused && !state.scrubbing && state.holding === 0 && !document.hidden) {
        const event = state.events[state.index];
        reknitr.traces.addMarker(state, map, event);
        reknitr.traces.showYear(state, event.year);
        state.index = (state.index + 1) % state.events.length;
        clearTimeout(state.timer);
        state.timer = setTimeout(() => reknitr.traces.step(state, map), reknitr.traces.delayAfter(event, state.events[state.index]));
    }
};

reknitr.traces.nextDelay = 300;

// As many markers as playback could have left on the map, at its quickest and with the longest fade
reknitr.traces.trailLength = 30;
// Far enough into its fade that a marker has finished appearing, so that it shows even while the timeline is frozen
reknitr.traces.trailStartAge = 1.2;

/**
 * Lay out the markers playback would have left on the map by the time it reached a given event, each as far through its
 * fade as it would then be.
 * @param {Object} state - The state of the playback
 * @param {Object} map - The maplibre map
 * @param {Number} end - The index following the most recent event to show
 */
reknitr.traces.placeTrail = function (state, map, end) {
    const {events} = state;
    let age = reknitr.traces.trailStartAge;
    for (let i = end - 1; i >= Math.max(0, end - reknitr.traces.trailLength); --i) {
        if (age < reknitr.traces.life(events[i].kind)) {
            reknitr.traces.addMarker(state, map, events[i], age);
        }
        if (i > 0) {
            age += reknitr.traces.delayAfter(events[i - 1], events[i]) / 1000;
        }
    }
};

/**
 * Move the timeline to the end of a given year, in either direction.
 * @param {Object} state - The state of the playback
 * @param {Object} map - The maplibre map
 * @param {Number} year - The year to move to
 */
reknitr.traces.seek = function (state, map, year) {
    const next = state.events.findIndex(event => event.year > year);
    const end = next === -1 ? state.events.length : next;
    state.index = end % state.events.length;
    reknitr.traces.clearMarkers(state);
    reknitr.traces.placeTrail(state, map, end);
    reknitr.traces.showYear(state, year);
};

/**
 * Start or stop the timeline as this pane is shown or left, beginning at a random year when it first starts.
 * @param {Object} that - This pane handler
 * @param {reknitr.storyPage} storyPage - The story page
 * @param {Object[]} taxaRows - All taxon rows
 * @param {Object[]} obsRows - All observation rows
 * @param {Boolean} isVisible - Whether this pane is showing
 */
reknitr.traces.controlPlayback = function (that, storyPage, taxaRows, obsRows, isVisible) {
    document.querySelector(".mxcw-leftPane").classList.toggle("saanich-traces-active", !!isVisible);
    const map = storyPage.map.map;
    if (!that.traces) {
        const events = reknitr.traces.buildEvents(taxaRows, obsRows);
        if (events.length === 0) {
            return;
        }
        const firstYear = events[0].year, lastYear = fluid.peek(events).year;
        const startYear = firstYear + Math.floor(Math.random() * (lastYear - firstYear + 1));
        that.traces = {storyPage, events, firstYear, lastYear, markers: new Set(), holding: 0, timer: null, paused: false, scrubbing: false,
            index: Math.max(0, events.findIndex(event => event.year >= startYear)),
            overlay: reknitr.traces.createOverlay(document.querySelector(".mxcw-map"), firstYear, lastYear)};
        reknitr.traces.setPlayback(that.traces, {});
        reknitr.traces.bindControls(that.traces, map);
    }
    const state = that.traces;
    clearTimeout(state.timer);
    reknitr.traces.clearMarkers(state);
    if (isVisible) {
        reknitr.startAtProjectArea(storyPage.map);
        if (state.paused) {
            // Someone returning to a timeline they paused finds it as they left it
            reknitr.traces.placeTrail(state, map, state.index || state.events.length);
        }
        reknitr.traces.step(state, map);
    }
};
