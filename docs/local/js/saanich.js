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
        rankFilter: ".imerss-rank-filter",
        introductionFilter: ".imerss-introduction-filter",
        provenanceFilter: ".imerss-provenance-filter",
        conservationFilter: ".imerss-conservation-filter",
        graminoidFilter: ".imerss-graminoid-filter"
    },
    components: {
        filterRoot: "{vizLoader}",
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
        loadGallery: "@expand:fluid.effect(reknitr.lostPlants.loadGallery, {that}, {vizLoader}.taxaRows, {vizLoader}.obsRows)"
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
    const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
    return `<button type="button" class="saanich-lost-card" data-taxon-id="${fluid.XMLEncode(plant.taxon.id)}">
        <img src="${fluid.XMLEncode(photo.medium_url)}" alt="${name}" loading="lazy">
        <span class="saanich-lost-name">${name}</span>
        <span class="saanich-lost-details">${fluid.XMLEncode(details)}</span>
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
        // Bring the selected row into view once the table has its size in the newly visible pane
        requestAnimationFrame(() => {
            const index = table.displayRows.indexOf(row);
            if (index >= 0) {
                table.dom.locate("scrollEl")[0].scrollTop = index * hortis.dataTable.rowHeight(table);
                hortis.dataTable.renderRows(table);
            }
        });
        fluid.invokeLater(() => that.pendingTaxonId.value = null);
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
        updateStatusLinks: "@expand:fluid.effect(reknitr.saanichAtlas.updateLinks, {that}.container, {reknitr.storyPage}.map.selectedStatus)"
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
hortis.dataTable.renderCell = (col, row) => col.key === "eventDate" ? fluid.XMLEncode(String(row.eventDate ?? "").substring(0, 10)) : dataTableRenderCell(col, row);

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
