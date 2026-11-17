<script src="../js/story.js"></script>
<fluid-import src="bioreportr-atlasPanel.vue"></fluid-import>
<script>
"use strict";

// The Protected Areas pane of a story, assessing its native flora against its protected areas and Key Biodiversity
// Areas. Everything it shows follows the one selection of the story page,
// selectedRegion - all the protected areas when none is selected, a category, an individual area, all the KBAs or a
// KBA:
//   - the map, drawn by the pane's region handler from scripts/Protected_map_mapbox.R, holds each shape once, with a
//     layer for each category drawn from them by a filter - clicking an area or a KBA selects it, and a card
//     describes it as it is hovered or tapped
//   - the map's legend selects a category
//   - the pane's text opens with a card summarising the selection, and the area below the map holds a chart of the
//     categories, or of the areas within the selected one - both written as HTML by the script, as a card or chart
//     for each selection, of which the one for the selection is shown by bioreportr.protectedAreas.showSelection. Their
//     rows and links select what they name
//   - the records and the checklist are filtered to the selection, and a smaller panel of the plant chosen in the
//     checklist gives its records within it
// The behaviour is configured onto the story page, as its member protectedAreas, by the layer
// bioreportr.storyPageProtectedAreas, defined in bioreportr-storyPageProtectedAreas.vue, which a project names in the
// $layers of its <project>-story.vue, together with bioreportr.atlasPanel, whose helpers it uses. The project's story also names the fields of the records which
// may filter them, its regionFilterFieldNames, among which are "ProtectedArea" and "KBA" - see GroupField in
// scripts/intersectShapes.R

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
fluid.registerNamespace("bioreportr.protectedAreas");

fluid.def("bioreportr.protectedAreas", {
    $layers: "fluid.component",
    // Whether the pane keeps only the records which can be mapped, leaving out the species known only from records
    // without a position, e.g. those of lists, which would leave the map nothing to fit when chosen. Named once, as
    // protectedMappedOnly in the settings of the project's bioreportr.yaml, which scripts/Protected_map_mapbox.R reads
    // too, so that the pane's summaries agree
    mappedOnly: "{storyPage}.protectedMappedOnly",
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, Protected)",
    hover: {
        $bindable: {
            bind: "bioreportr.protectedAreas.bindCards({storyPage}, {storyPage}.map.readyMap, {storyPage}.mapData, {global})",
            unbind: "bioreportr.unbind({boundValue})"
        }
    },
    selects: {
        $bindable: {
            bind: "bioreportr.protectedAreas.bindSelects({storyPage}, {global})",
            unbind: "bioreportr.unbind({boundValue})"
        }
    },
    shown: "$effect:bioreportr.protectedAreas.showSelection({storyPage}.selectedRegion, {self}.baseRegion, {self}.active, {global})",
    // The plant chosen in the checklist, with its records within the selected region, shown in a smaller panel beside
    // the chart, in place of the atlas's
    regionRecords: "$compute:bioreportr.atlas.taxonRecords({storyPage}.pkg, {storyPage}.finalFilteredObs, {storyPage}.checklistTaxon, {storyPage}.sightingPredicates)",
    panelMarkup: "$compute:bioreportr.protectedAreas.panelMarkup({storyPage}.checklistTaxon, {self}.regionRecords, {storyPage}.selectedRegion, {storyPage}.statusLabels)",
    // The native species reported in no protected area, and the ids of the native species, those of conservation
    // concern and those reported within a KBA - see bioreportr.protectedAreas.regionFilter
    // They are derived only once the pane is first shown, or a selection needs them - see the story page's activatedPanes
    taxonSets: "$compute:bioreportr.protectedAreas.taxonSetsWhenNeeded({storyPage}, {storyPage}.activatedPanes, {storyPage}.selectedRegion)",
    // The area, group or other region of the selection, without any subset of its species - outlined on the map, marked
    // in the legend, and summarised by the card and chart shown
    baseRegion: "$compute:bioreportr.protectedAreas.baseRegion({storyPage}.selectedRegion)",
    // Whether the map's grid is shown - by the active pane, or while the unprotected diversity is selected here. Read
    // by the map, which is configured by the project's <project>-story.vue
    gridVisible: "$compute:bioreportr.protectedAreas.gridVisible({storyPage}.activePane.visibleGrid, {storyPage}.activePaneKey, {self}.baseRegion)"
});

// The selection of the native species reported in no protected area, as the script names it in its card, chart and
// tab, and of all the protected areas together, whose card is the overview - see scripts/Protected_map_mapbox.R
bioreportr.protectedAreas.unprotected = "Unprotected native plant diversity";
bioreportr.protectedAreas.allAreas = "Protected areas";

// The subsets of the species of a region which a figure of its card may select, in a selection such as
// "Regional park · species of conservation concern", by the set of taxa of bioreportr.protectedAreas.taxonSets they keep
bioreportr.protectedAreas.subsets = {
    "native species": "native",
    "species of conservation concern": "concern",
    "within Key Biodiversity Areas": "kba",
    "found in no other category": "unique"
};

/**
 * Parse a selection into its region and any subset of that region's species.
 * @param {String|null} selectedRegion - The selection, e.g. "Mount Work Regional Park · native species"
 * @return {{region: String|null, subset: String|undefined}} The region, and the key of the subset if any
 */
bioreportr.protectedAreas.parseSelection = function (selectedRegion) {
    const parts = (selectedRegion || "").split(" \u00b7 ");
    const subset = parts.length > 1 ? bioreportr.protectedAreas.subsets[fluid.peek(parts)] : undefined;
    return subset ? {region: parts.slice(0, -1).join(" \u00b7 "), subset} : {region: selectedRegion || null};
};

// The region of a selection, by whose card and chart it is shown - all the protected areas being shown by the overview
bioreportr.protectedAreas.baseRegion = function (selectedRegion) {
    const region = bioreportr.protectedAreas.parseSelection(selectedRegion).region;
    return region === bioreportr.protectedAreas.allAreas ? null : region;
};

/**
 * Compute the sets of taxa by which the pane selects some of the species of a region, once the pane is first shown or
 * the selection, e.g. held in the URL, needs them - until then they are empty. The story page's members are read
 * within, rather than as arguments, so that none of them is derived until then.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Object<String, Boolean>} activatedPanes - The panes which have been shown
 * @param {String|null} selectedRegion - The selection, as held in the URL, if any
 * @return {Object} The sets - see bioreportr.protectedAreas.taxonSets
 */
bioreportr.protectedAreas.taxonSetsWhenNeeded = function (storyPage, activatedPanes, selectedRegion) {
    const {region, subset} = bioreportr.protectedAreas.parseSelection(selectedRegion);
    const needed = activatedPanes.Protected || !!subset || region === bioreportr.protectedAreas.unprotected;
    const empty = new Set();
    return needed ? bioreportr.protectedAreas.taxonSets(storyPage.pkg, storyPage.taxa.rowById, storyPage.regionIndirectionRows) :
        {unprotected: empty, native: empty, concern: empty, kba: empty, unique: {}};
};

/**
 * Compute the sets of taxa by which the pane selects some of the species of a region.
 * @param {VizPackage} pkg - The data package
 * @param {Object<String, TaxonRow>} rowById - Map of taxon id to taxon row
 * @param {Object[]} indirectionRows - The rows of the region indirection table
 * @return {Object} Members `unprotected`, `native`, `concern` and `kba`, each a Set of taxon ids, and `unique`, a map
 * of each category of protected area to the Set of the native taxa reported in that category alone
 */
bioreportr.protectedAreas.taxonSets = function (pkg, rowById, indirectionRows) {
    const bareRowById = fluid.unwrapProxy(rowById);
    const isNative = id => {
        const taxon = bareRowById[id];
        return !!taxon && taxon.introduction_status === "native" && String(taxon.inSummary) === "1";
    };
    const idsWhere = predicates => new Set(hortis.distinctObs(pkg, hortis.selectObs(pkg, predicates), "iNaturalistTaxonId"));
    const protectedIds = idsWhere([{field: "ProtectedArea", op: "notNull"}]);
    const native = [...idsWhere([])].filter(isNative);
    return {
        unprotected: new Set(native.filter(id => !protectedIds.has(id))),
        native: new Set(native),
        concern: new Set(native.filter(id => bareRowById[id].provincial_concern === "concern")),
        // A story whose records lie in no KBA, e.g. Galiano Island's, has no KBA field, and a query of a field which the
        // package lacks fails
        kba: pkg.tables.obs.columns.KBA ? idsWhere([{field: "KBA", op: "notNull"}]) : new Set(),
        unique: bioreportr.protectedAreas.uniqueByCategory(pkg, native, indirectionRows)
    };
};

/**
 * Find the native taxa reported within the protected areas of only one category.
 * @param {VizPackage} pkg - The data package
 * @param {String[]} native - The ids of the native taxa
 * @param {Object[]} indirectionRows - The rows of the region indirection table
 * @return {Object<String, Set<String>>} Map of each category to the ids of the taxa reported in it alone
 */
bioreportr.protectedAreas.uniqueByCategory = function (pkg, native, indirectionRows) {
    const categories = new Set(indirectionRows.filter(row => row.regionField === "Protected").map(row => row.label));
    const categoryById = {};
    indirectionRows.forEach(row => {
        if (row.regionField === "ProtectedArea" && categories.has(row.label)) {
            categoryById[row.id] = row.label;
        }
    });
    const isNative = new Set(native);
    const categoriesOf = {};
    hortis.countObsByPair(pkg, hortis.selectAllObs(pkg), "iNaturalistTaxonId", "ProtectedArea").forEach(([id, area]) => {
        const category = categoryById[area];
        if (category && isNative.has(id)) {
            (categoriesOf[id] = categoriesOf[id] || new Set()).add(category);
        }
    });
    const togo = {};
    Object.entries(categoriesOf).forEach(([id, found]) => {
        if (found.size === 1) {
            const [category] = found;
            (togo[category] = togo[category] || new Set()).add(id);
        }
    });
    return togo;
};

/**
 * Compute the predicates of the selection of a region by the Protected Areas pane, which may also select all the
 * protected areas, or the native species reported in none, and a subset of the species of a region.
 * @param {String|null} selectedRegion - The selection, as held in the URL, if any
 * @param {Object[]} indirectionRows - The rows of the region indirection table
 * @param {String[]} fieldNames - The fields of regions which may be selected
 * @param {Object} taxonSets - The sets of taxa, as computed by bioreportr.protectedAreas.taxonSets
 * @param {String} activePaneKey - The key of the active pane
 * @param {Boolean} mappedOnly - Whether the pane keeps only the records which can be mapped
 * @return {Object[]} The predicates
 */
bioreportr.protectedAreas.regionPredicates = function (selectedRegion, indirectionRows, fieldNames, taxonSets, activePaneKey, mappedOnly) {
    const {region, subset} = bioreportr.protectedAreas.parseSelection(selectedRegion);
    const inSet = set => ({field: "iNaturalistTaxonId", op: "in", value: [...set]});
    const regionPredicates = region === bioreportr.protectedAreas.allAreas ? [{field: "ProtectedArea", op: "notNull"}] :
        region === bioreportr.protectedAreas.unprotected ? [inSet(taxonSets.unprotected)] :
            bioreportr.regionSelectionPredicates(region, indirectionRows, fieldNames);
    const set = subset === "unique" ? taxonSets.unique[region] || new Set() : taxonSets[subset];
    const subsetPredicates = subset ? [inSet(set)] : [];
    const isProtected = activePaneKey === "Protected";
    const nativePredicates = isProtected ? [inSet(taxonSets.native)] : [];
    const mappedPredicates = isProtected && mappedOnly ? hortis.mappedPredicates : [];
    return [...regionPredicates, ...subsetPredicates, ...nativePredicates, ...mappedPredicates];
};

// The map's grid of records, hidden on this pane, shows where the native species outside protected areas grow when
// they are selected
bioreportr.protectedAreas.gridVisible = (visibleGrid, activePaneKey, baseRegion) =>
    !!visibleGrid || activePaneKey === "Protected" && baseRegion === bioreportr.protectedAreas.unprotected;

// The pane's section, rendered from the template below
fluid.def("bioreportr.protectedPane", {
    $layers: "fluid.component"
});

/** The Protected Areas pane, whose chart and map select categories and individual areas **/

/**
 * Render the smaller panel of the plant chosen in the checklist which the pane shows beside its chart - its photo, names
 * and status, and its records within the selected region, or anywhere if none is selected - without the atlas's charts
 * of its history.
 * @param {TaxonRow|null} taxon - The chosen plant
 * @param {Object[]} records - Its dated records within the selected region, in date order
 * @param {String|null} region - The selected region, if any
 * @param {Object<String, String>} statusLabels - The label of each reporting status - see bioreportr.atlas.statusLabel
 * @return {String} The panel's markup, empty if no plant with records there is chosen
 */
bioreportr.protectedAreas.panelMarkup = function (taxon, records, region, statusLabels) {
    let togo = "";
    if (taxon && records.length > 0) {
        // The unprotected diversity is not a place, so it is named alone rather than as the place "In" which records lie
        const within = region && !region.startsWith(bioreportr.protectedAreas.unprotected) ? "In " : "";
        const where = region ? `<div class="mxcw-pa-taxon-region">${within}${hortis.dataTable.encode(region)}</div>` : "";
        togo = `<div class="mxcw-solow-taxon-pane mxcw-atlas-taxon-pane mxcw-pa-taxon-pane">
  <div class="mxcw-taxon-image">${hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)}</div>
  <div class="mxcw-taxon-info">
    <div class="mxcw-taxon-name">${hortis.dataTable.encode((taxon.scientificName || taxon.iNaturalistTaxonName) + (taxon.commonName ? ` (${taxon.commonName})` : ""))}</div>
    <div class="mxcw-atlas-facts">
      ${where}
      <dl class="mxcw-taxon-fields">
        ${bioreportr.atlas.field("Status", bioreportr.atlas.statusLabel(taxon.reportingStatus, statusLabels))}
        <dt>Records:</dt> <dd>${bioreportr.formatCount(records.length)}</dd>
        <dt>First seen:</dt> <dd>${bioreportr.eventDay(records[0].eventDate)}</dd>
        <dt>Last seen:</dt> <dd>${bioreportr.eventDay(fluid.peek(records).eventDate)}</dd>
        ${bioreportr.atlas.statusFields(taxon)}
      </dl>
    </div>
  </div>
</div>`;
    }
    return togo;
};

/**
 * Choose the panel of the plant chosen in the checklist for the pane shown - this pane's smaller one, or else the
 * atlas's.
 * @param {String} activePaneKey - The pane shown
 * @param {String} atlasMarkup - The atlas's panel
 * @param {String} protectedMarkup - This pane's panel
 * @return {String} The markup of the panel
 */
bioreportr.protectedAreas.choosePanel = (activePaneKey, atlasMarkup, protectedMarkup) =>
    activePaneKey === "Protected" ? protectedMarkup : atlasMarkup;

// The panel is shown on the atlas and on this pane, while a plant with records is chosen
bioreportr.protectedAreas.panelVisible = (markup, activePaneKey) => !!markup && (activePaneKey === "Status" || activePaneKey === "Protected");

/**
 * Whether the Protected Areas pane is the one shown - read from the page, since the cards are shown from map events.
 * @param {Document} dokkument - The page
 * @return {Boolean} Whether its section is shown
 */
bioreportr.protectedAreas.isShown = function (dokkument) {
    const section = dokkument.querySelector(".mxcw-paneKey-Protected");
    return !!(section && section.offsetParent);
};

/**
 * Show a card describing each individual area as the pointer passes over it, or as it is tapped on a touch screen,
 * while the pane is shown. The card's markup is the property `card` given to the area's shape by scripts/Protected_map_mapbox.R.
 * MapLibre takes the touches made on the map for its own gestures, so that a tap sends neither a mouse movement nor
 * a click - the tap is recognised from the pointer events, as bioreportr.solowMapLayer.bindHover does, and also selects
 * the area tapped, as a click does.
 * @param {bioreportr.storyPage} storyPage - The story page, whose selected region a tap sets
 * @param {maplibregl.Map} map - The story's map, once ready
 * @param {Object} mapData - The story's map data, whose style holds the areas' layers
 * @param {Window} window - The window holding the map
 * @return {Binding|null} The binding, removed should the map or its data change - see bioreportr.binding
 */
bioreportr.protectedAreas.bindCards = function (storyPage, map, mapData, window) {
    if (!map || !mapData) {
        return null;
    }
    const binding = bioreportr.binding();
    // The layers whose shapes carry cards, in sources named "... .cards" - see regions_to_mapbox_source
    const cardLayers = mapData.style.layers.filter(layer => layer.type === "fill" && layer.source?.endsWith(".cards"))
        .map(layer => layer.id);
    const card = binding.element(window.document.createElement("div"));
    card.className = "mxcw-pa-card";
    card.hidden = true;
    map.getContainer().appendChild(card);
    let shown = null;
    // The layers with cards, found once the map's style holds them
    let ids = [];
    // Returns the id of the area shown, if any
    const show = event => {
        if (ids.length === 0) {
            ids = cardLayers.filter(id => map.getLayer(id));
        }
        // The topmost shape under the pointer, so that a KBA is described rather than the area beneath it
        const feature = bioreportr.protectedAreas.isShown(window.document) && ids.length &&
            map.queryRenderedFeatures(event.point, {layers: ids})[0];
        const id = feature ? feature.properties.region : null;
        if (id !== shown) {
            card.innerHTML = id ? feature.properties.card : "";
            shown = id;
        }
        card.hidden = !id;
        if (id) {
            const {width, height} = map.getContainer().getBoundingClientRect();
            card.style.left = Math.max(8, Math.min(event.point.x + 16, width - card.offsetWidth - 8)) + "px";
            card.style.top = Math.max(8, Math.min(event.point.y + 16, height - card.offsetHeight - 8)) + "px";
        }
        return id;
    };
    // At most once a frame, since finding the area under the pointer is costly over so many layers
    let pending = null;
    binding.onMap(map, "mousemove", event => {
        if (pending === null) {
            window.requestAnimationFrame(() => {
                const latest = pending;
                pending = null;
                show(latest);
            });
        }
        pending = event;
    });
    const container = map.getContainer();
    let start = null;
    binding.listen(container, "pointerdown", event => {
        start = event.pointerType === "touch" && event.isPrimary ?
            {id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp} : null;
    }, true);
    binding.listen(container, "pointerup", event => {
        const tap = start;
        start = null;
        if (tap && event.pointerId === tap.id && event.timeStamp - tap.time <= bioreportr.solowMapLayer.tapDuration &&
            Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= bioreportr.solowMapLayer.tapSlop) {
            const rect = map.getCanvas().getBoundingClientRect();
            const id = show({point: {x: event.clientX - rect.left, y: event.clientY - rect.top}});
            // A proposed KBA has a card but no records, so is not selected
            if (id && !id.startsWith("Proposed KBA:")) {
                bioreportr.storyPage.selectRegion(storyPage, id);
            }
        }
    }, true);
    binding.listen(container, "pointercancel", () => {
        start = null;
    }, true);
    binding.listen(map.getCanvas(), "mouseleave", () => {
        card.hidden = true;
        shown = null;
    });
    return binding;
};

/**
 * Make the rows of the charts and the links of the summaries select what they name, as the map's legend and its
 * shapes do - by click, or by Enter or Space from the keyboard. A row of a chart which is already selected clears the
 * selection, as a row of the legend does; a link, e.g. back to all the protected areas, always selects what it names,
 * all of them if it names nothing.
 * @param {bioreportr.storyPage} storyPage - The story page, whose selected region they set
 * @param {Window} window - The window holding the page
 * @return {Binding} The binding - see bioreportr.binding
 */
bioreportr.protectedAreas.bindSelects = function (storyPage, window) {
    const dokkument = window.document;
    const binding = bioreportr.binding();
    const select = target => {
        const row = target.closest?.(".mxcw-pa-row[data-region]");
        const link = target.closest?.("[data-select]");
        if (link && link.matches(".mxcw-pa-stat") && link.getAttribute("aria-pressed") === "true") {
            // A selected figure returns to all the species of its region
            bioreportr.storyPage.selectRegion(storyPage, bioreportr.protectedAreas.baseRegion(link.dataset.select));
        } else if (row) {
            bioreportr.storyPage.selectRegion(storyPage, row.getAttribute("aria-pressed") === "true" ? null : row.dataset.region);
        } else if (link) {
            bioreportr.storyPage.selectRegion(storyPage, link.dataset.select || null);
        }
        return !!(row || link);
    };
    binding.listen(dokkument, "click", event => select(event.target));
    binding.listen(dokkument, "keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && select(event.target)) {
            event.preventDefault();
        }
    });
    return binding;
};

/**
 * Choose the view of a selection among those of a container - the one for the selection itself; failing that, the one
 * listing it among its members, e.g. the chart of an area's category; failing that, the view of no selection.
 * @param {Element[]} views - The views, each with a `data-key`, and any `data-members` as a JSON array
 * @param {String|null} selectedRegion - The selection, if any
 * @return {Element|undefined} The view to be shown
 */
bioreportr.protectedAreas.viewFor = function (views, selectedRegion) {
    const members = view => JSON.parse(view.dataset.members || "[]");
    return selectedRegion && (views.find(view => view.dataset.key === selectedRegion) ||
        views.find(view => members(view).includes(selectedRegion))) || views.find(view => view.dataset.key === "");
};

/**
 * Show, in the summaries of the pane's text and the charts beneath the map, the view of the selection - see
 * bioreportr.protectedAreas.viewFor - bringing a newly shown summary into view, and mark the selected row of a chart, tab
 * and figure.
 * @param {String|null} selectedRegion - The selection, if any
 * @param {String|null} baseRegion - Its region, without any subset of its species, whose views are shown
 * @param {Boolean} active - Whether the pane is shown, when its views are rendered
 * @param {Window} window - The window holding the page
 */
bioreportr.protectedAreas.showSelection = function (selectedRegion, baseRegion, active, window) {
    if (active) {
        window.setTimeout(() => {
            const dokkument = window.document;
            dokkument.querySelectorAll(".mxcw-pa-views").forEach(container => {
                const views = [...container.children].filter(view => view.dataset.key !== undefined);
                const shown = bioreportr.protectedAreas.viewFor(views, baseRegion);
                const changed = shown && shown.hidden;
                views.forEach(view => {
                    view.hidden = view !== shown;
                });
                if (changed && container.classList.contains("mxcw-pa-summaries")) {
                    shown.scrollIntoView({block: "nearest", behavior: "smooth"});
                }
            });
            dokkument.querySelectorAll(".mxcw-pa-row[data-region]").forEach(row => {
                row.setAttribute("aria-pressed", String(row.dataset.region === baseRegion));
            });
            // The tab of the unprotected diversity while any of it is selected, and otherwise that of all the protected
            // areas; and the selected figure of a card
            const unprotected = baseRegion === bioreportr.protectedAreas.unprotected;
            dokkument.querySelectorAll(".mxcw-pa-stat[data-select]").forEach(stat => {
                stat.setAttribute("aria-pressed", String(stat.dataset.select === selectedRegion));
            });
            dokkument.querySelectorAll(".mxcw-pa-tab").forEach(tab => {
                tab.setAttribute("aria-pressed", String(unprotected === (tab.dataset.select === bioreportr.protectedAreas.unprotected)));
            });
        }, 0);
    }
};
</script>

<style>
/* The data area below the map, while this pane is shown: the panel of the plant chosen in the checklist on the left,
   while one is chosen, and the chart on the right, or across the whole width, with the records' bar beneath both as on
   the other panes. As on the atlas while it shows a plant, the map and this area are given default heights, which the
   resize bar between them may change, since neither is !important - the shared rule which would shrink the area to
   the records' bar while they are collapsed leaves alone a pane showing widgets of its own there, see
   imerss-viz-story.css */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) {
    --pa-data-height: 300px;
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-map {
    /* Less the resize bar beneath it, as on the atlas */
    height: calc(100% - var(--pa-data-height) - 14px);
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data {
    height: var(--pa-data-height);
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    /* The records' bar, collapsed, has a strip of the same height as on the other panes - see
       --mxcw-records-header-height in imerss-viz-story.css */
    grid-template-rows: minmax(0, 1fr) 40px;
    grid-template-areas: "chart" "records";
    align-items: stretch;
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data:has(> .mxcw-atlas-has-taxon) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "taxon chart" "records records";
}

/* With the records open, they share the area with the panel and the chart */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data:has(> .mxcw-obs-table-holder:not(.mxcw-records-collapsed)) {
    grid-template-rows: minmax(0, 1fr) 220px;
    row-gap: 8px;
}

/* Open, the records fill their strip, whatever height the bar between a taxon panel and the records, hidden here, last
   gave them */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .mxcw-obs-table-holder:not(.mxcw-records-collapsed) {
    align-self: stretch;
    height: auto !important;
    display: flex;
    flex-direction: column;
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .mxcw-obs-table-holder:not(.mxcw-records-collapsed) > .mxcw-obs-table {
    flex: 1 1 0;
    min-height: 0;
}

/* The plant's panel and the chart's card are inset alike from the column's edges and the map, with an even gutter
   between them, and are of the same height */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .mxcw-atlas-has-taxon {
    grid-area: taxon;
    height: auto;
    min-height: 0;
    margin: 8px 4px 0 8px;
    overflow: hidden;
}

.mxcw-data:has(> .mxcw-atlas-has-taxon) .mxcw-dataPane-Protected .mxcw-pa-chart {
    margin-left: 4px;
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .resize-bar {
    display: none;
}

.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .mxcw-obs-table-holder {
    grid-area: records;
    min-height: 0;
}

/* Collapsed, the bar is centred in its strip, as on the other panes */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)) > .mxcw-data > .mxcw-obs-table-holder.mxcw-records-collapsed {
    align-self: center;
    height: 32px;
}

.mxcw-dataPane-Protected {
    grid-area: chart;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

/* The wrappers of the chart fill its cell, within which it scrolls */
.mxcw-dataPane-Protected > div,
.mxcw-dataPane-Protected .mxcw-dataPane-widgets {
    height: 100%;
}

/* With the records open, the area grows as the atlas's does, leaving the map the same height, and the records fill a
   strip of the same height as the atlas's at the foot of the column, beneath the panel and the chart - unless the
   resize bar has since given the map and the area heights of their own */
.imerss-main .mxcw-leftPane.mxcw-leftPane:has(.mxcw-dataPane-Protected:not(.fl-hidden)):has(.mxcw-obs-table-holder:not(.mxcw-records-collapsed)) {
    --pa-data-height: calc(100% - 222px);
}

/* The smaller panel of the plant, giving only its names, status and records within the selected region */
.mxcw-pa-taxon-pane .mxcw-taxon-fields {
    margin: 4px 0 0;
}

/* With no chart of the plant's history beside its facts, they take the panel's whole width, as a dl of two columns */
.mxcw-atlas-taxon-pane.mxcw-pa-taxon-pane .mxcw-taxon-info {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: start;
}

.mxcw-pa-taxon-pane .mxcw-atlas-facts dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 1px 8px;
}

.mxcw-pa-taxon-pane .mxcw-atlas-facts dd {
    margin: 0;
}

/* The plant's conservation status, the longest of its facts, runs beneath its label across the panel's width - see
   bioreportr.atlas.statusFields */
.mxcw-pa-taxon-pane .mxcw-atlas-facts dt:has(+ dd.mxcw-taxon-status),
.mxcw-pa-taxon-pane .mxcw-atlas-facts dd.mxcw-taxon-status {
    grid-column: 1 / -1;
}

.mxcw-pa-taxon-region {
    margin-top: 2px;
    font-size: var(--story-small);
    font-style: italic;
}

/* Beside the panel the chart is narrow, so its names give way and its counts of areas are left out */
.mxcw-pa-chart {
    container-type: inline-size;
}

@container (max-width: 440px) {
    /* Outweighing the chart's own columns below */
    .mxcw-pa-chart ul.mxcw-pa-rows {
        grid-template-columns: minmax(0, 1.3fr) minmax(40px, 1fr) max-content;
        column-gap: 8px;
    }

    .mxcw-pa-chart .mxcw-pa-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .mxcw-pa-chart .mxcw-pa-name small {
        display: none;
    }
}

/* The charts beneath the map, one shown at a time - see bioreportr.protectedAreas.showSelection */
.mxcw-pa-charts {
    height: 100%;
}

.mxcw-pa-chart[hidden] {
    display: none;
}

.mxcw-pa-chart .mxcw-pa-back {
    margin-right: 10px;
}

/* Shown in the data area below the map - see mxcw-data-pane-html in src/js/storyBuild.js */
/* A dark card, as the site's tiles and map cards are, set apart from the column's teal on which the records' bar sits,
   and inset as that bar is */
.mxcw-pa-chart {
    box-sizing: border-box;
    height: calc(100% - 8px);
    margin: 8px 8px 0;
    padding: 8px 14px;
    overflow: auto;
    color: #eefaff;
    background: #0d3040;
    border: 1px solid rgba(74, 154, 170, 0.45);
    border-radius: var(--data-table-radius, 8px);
}

.mxcw-pa-chart figcaption {
    margin-bottom: 4px;
    font-size: var(--story-data);
    font-weight: 700;
    color: #eefaff;
}

.mxcw-pa-chart .mxcw-pa-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: max-content minmax(80px, 1fr) max-content;
    column-gap: 10px;
    row-gap: 3px;
    align-items: center;
    font-size: var(--story-data);
}

.mxcw-pa-row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    margin: 0 -6px;
    padding: 2px 6px;
    border-radius: 6px;
    outline: 1px solid transparent;
}

.mxcw-pa-row[data-region] {
    cursor: pointer;
}

.mxcw-pa-row[data-region]:hover,
.mxcw-pa-row[data-region]:focus-visible {
    background: rgba(168, 200, 208, 0.1);
}

.mxcw-pa-row[aria-pressed="true"] {
    background: rgba(253, 242, 206, 0.12);
    outline-color: #FDF2CE;
}

/* The card summarising the selection at the head of the pane's text - see bioreportr.protectedAreas.showSelection. Its
   colour is that of the selected category, or the KBAs' */
.mxcw-pa-summaries {
    margin: 0.4em 0 1em;
}

.mxcw-pa-card-summary {
    padding: 10px 12px 12px;
    background: #0d3040;
    border-top: 3px solid var(--pa-colour);
    border-radius: var(--data-table-radius, 8px);
}

.mxcw-pa-card-summary[hidden] {
    display: none;
}

/* The tabs at the top right of the card, of all the protected areas and of the native plant diversity outside them,
   the selected one joined to the card beneath */
.mxcw-pa-tabs {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
}

.mxcw-pa-tab {
    padding: 4px 10px;
    font-size: var(--story-small);
    color: #a8c8d0;
    cursor: pointer;
    background: rgba(13, 48, 64, 0.55);
    border-radius: 6px 6px 0 0;
}

.mxcw-pa-tab:hover,
.mxcw-pa-tab:focus-visible {
    color: #eefaff;
}

.mxcw-pa-tab[aria-pressed="true"] {
    color: #eefaff;
    background: #0d3040;
}

.mxcw-pa-tabs ~ .mxcw-pa-card-summary {
    border-top-right-radius: 0;
}

.mxcw-pa-crumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.mxcw-sectionColumn .mxcw-pa-summary-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--story-body);
    color: #eefaff;
}

.mxcw-pa-summary-title::before {
    content: "";
    flex: none;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: var(--pa-colour);
}

.mxcw-sectionColumn .mxcw-pa-summary-subtitle {
    margin: 2px 0 8px 19px;
    font-size: var(--story-small);
    color: #a8c8d0;
}

.mxcw-sectionColumn .mxcw-pa-summary-text {
    margin: 0 0 10px;
    font-size: var(--story-data);
    line-height: 1.45;
    color: #c4dbe2;
}

/* The links of the summaries and charts, which select what they name - see bioreportr.protectedAreas.bindSelects */
.mxcw-pa-link {
    cursor: pointer;
    color: #eefaff;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
}

.mxcw-pa-link:hover,
.mxcw-pa-link:focus-visible {
    text-decoration-style: solid;
}

.mxcw-pa-crumbs .mxcw-pa-link,
.mxcw-pa-back {
    display: inline-block;
    padding: 1px 6px;
    font-size: var(--story-small);
    font-weight: 400;
    color: #a8c8d0;
    text-decoration: none;
    border: 1px solid rgba(168, 200, 208, 0.35);
    border-radius: 5px;
}

.mxcw-pa-crumbs .mxcw-pa-link:hover,
.mxcw-pa-crumbs .mxcw-pa-link:focus-visible,
.mxcw-pa-back:hover,
.mxcw-pa-back:focus-visible {
    color: #eefaff;
    background: rgba(168, 200, 208, 0.12);
}

/* The panel's figures, each a number over its meaning, in a grid as wide as the column allows */
.mxcw-pa-stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 8px 12px;
}

.mxcw-pa-stat {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
}

.mxcw-pa-stat b {
    font-size: 20px;
    color: #eefaff;
}

.mxcw-pa-stat span {
    font-size: var(--story-small);
    color: #a8c8d0;
}

/* The figures of the unprotected diversity, each selecting its species, as the rows of a legend do */
.mxcw-pa-stat[data-select] {
    padding: 4px 8px;
    margin: -4px -8px;
    cursor: pointer;
    border-radius: 6px;
    border: 1px solid transparent;
}

.mxcw-pa-stat[data-select]:hover,
.mxcw-pa-stat[data-select]:focus-visible {
    background: rgba(168, 200, 208, 0.1);
}

.mxcw-pa-stat[data-select][aria-pressed="true"] {
    background: rgba(224, 122, 95, 0.16);
    border-color: var(--pa-colour);
}

.mxcw-pa-richest-holder {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(168, 200, 208, 0.25);
    font-size: var(--story-small);
}

.mxcw-pa-richest-title {
    color: #a8c8d0;
}

.mxcw-sectionColumn .mxcw-pa-richest {
    margin: 4px 0 0;
    padding-left: 1.3em;
}

.mxcw-pa-richest li {
    margin: 0;
    color: #eefaff;
}

.mxcw-pa-richest li b {
    margin-left: 6px;
    color: #FDF2CE;
}

/* The card describing an individual area on the map, framed as the map's other cards - hidden by its attribute, which
   its display would otherwise override */
.mxcw-pa-card[hidden] {
    display: none;
}

.mxcw-pa-card {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 260px;
    padding: 8px 12px;
    color: #eefaff;
    font-size: var(--story-data);
    line-height: 1.35;
    background: #0d3040;
    border: 1px solid #4a9aaa;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.mxcw-pa-card-name {
    font-weight: 700;
}

.mxcw-pa-card-category {
    color: #a8c8d0;
}

.mxcw-pa-card-category::before {
    content: "";
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 6px;
    border-radius: 2px;
    background: var(--pa-colour);
}

.mxcw-pa-card-kba {
    --pa-colour: #FDF2CE;
}

.mxcw-pa-card-owner {
    font-size: var(--story-small);
    color: #a8c8d0;
}

.mxcw-pa-card-count b {
    color: #FDF2CE;
}

.mxcw-pa-name {
    color: #eefaff;
    line-height: 1.2;
}

.mxcw-pa-name small {
    font-size: var(--story-small);
    color: #a8c8d0;
    white-space: nowrap;
}

.mxcw-pa-track {
    height: 10px;
    border-radius: 5px;
    background: rgba(168, 200, 208, 0.12);
    overflow: hidden;
}

.mxcw-pa-bar {
    display: block;
    height: 100%;
    border-radius: 5px;
    background: var(--pa-colour);
}

.mxcw-pa-count {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #eefaff;
}

/* The KBAs overlap the protected areas, so their row is set apart below the categories */
.mxcw-pa-kba .mxcw-pa-name,
.mxcw-pa-kba .mxcw-pa-track,
.mxcw-pa-kba .mxcw-pa-count {
    margin-top: 6px;
    padding-top: 0;
}

.mxcw-pa-kba .mxcw-pa-name {
    color: #FDF2CE;
}

.mxcw-pa-kba .mxcw-pa-bar {
    background: repeating-linear-gradient(135deg, #FDF2CE 0 4px, rgba(253, 242, 206, 0.55) 4px 7px);
}

/* The native species outside every protected area, the remainder of the flora, set apart as the KBAs are */
.mxcw-pa-unprotected .mxcw-pa-name,
.mxcw-pa-unprotected .mxcw-pa-track,
.mxcw-pa-unprotected .mxcw-pa-count {
    margin-top: 6px;
}

.mxcw-pa-unprotected .mxcw-pa-name {
    color: #f2b8a6;
}

</style>

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from each project's content/story/Protected.Rmd, whose front matter names bioreportr.protectedPane as its
     paneComponent - so that it holds the section of whichever project was built last. Edit the R Markdown and knit it,
     then run "npm run story", which replaces everything between <template> and </template> and nothing else in this
     file. The markup is a template, which may bind members of bioreportr.protectedPane with @{...} - written in the R Markdown
     as raw HTML, e.g. `<span>@{count}</span>`{=html}, which pandoc leaves as it is -->
<template>
<div id="native-plant-diversity-within-protected-areas" class="section level2 mxcw-paneKey-Protected"><h2>Native plant diversity within protected areas</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">



<div class="mxcw-pa-summaries mxcw-pa-views">
<nav class="mxcw-pa-tabs">
<span class="mxcw-pa-tab" data-select="" role="button" tabindex="0">All protected areas</span>
<span class="mxcw-pa-tab" data-select="Unprotected native plant diversity" role="button" tabindex="0">Unprotected native plant diversity</span>
</nav>
<section class="mxcw-pa-card-summary" data-key="" style="--pa-colour: #eefaff">
<h3 class="mxcw-pa-summary-title">All protected and conserved areas</h3>
<p class="mxcw-pa-summary-text">Based on our current knowledge, 81 percent of the 670 native vascular plant species known to the peninsula have been reported within its protected and conserved areas, from national park reserve and ecological reserves to regional parks and lands held by conservancies. The other 128 have so far been recorded only outside them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat">
<b>43</b>
<span>areas in 6 categories</span>
</div>
<div class="mxcw-pa-stat">
<b>8,610</b>
<span>hectares</span>
</div>
<div class="mxcw-pa-stat" data-select="Protected areas · native species" role="button" tabindex="0">
<b>542</b>
<span>native species · 81% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Protected areas · species of conservation concern" role="button" tabindex="0">
<b>62</b>
<span>of the 80 species of conservation concern</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Unprotected native plant diversity" hidden style="--pa-colour: #e07a5f">
<h3 class="mxcw-pa-summary-title">Unprotected native plant diversity</h3>
<p class="mxcw-pa-summary-subtitle">128 species · 788 records</p>
<p class="mxcw-pa-summary-text">128 native species, 19 percent of the native plant diversity known to the peninsula, have so far been reported only outside its protected and conserved areas. The map's grid shows where their records lie - the places where protection does not yet reach this part of the flora, or where it has yet to be looked for within the protected areas.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Unprotected native plant diversity" role="button" tabindex="0">
<b>128</b>
<span>native species · 19% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Unprotected native plant diversity · species of conservation concern" role="button" tabindex="0">
<b>18</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Unprotected native plant diversity · within Key Biodiversity Areas" role="button" tabindex="0">
<b>17</b>
<span>reported within a Key Biodiversity Area</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="National park reserve" hidden style="--pa-colour: #5a96d2">
<h3 class="mxcw-pa-summary-title">National park reserve</h3>
<p class="mxcw-pa-summary-subtitle">1 area · 1,296 hectares</p>
<p class="mxcw-pa-summary-text">The national park reserve holds 29 percent of the native plant diversity known to the peninsula: 194 of its 670 native vascular plant species have been reported within it.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="National park reserve · native species" role="button" tabindex="0">
<b>194</b>
<span>native species · 29% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="National park reserve · species of conservation concern" role="button" tabindex="0">
<b>14</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="National park reserve · found in no other category" role="button" tabindex="0">
<b>5</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>1,687</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Ecological reserve" hidden style="--pa-colour: #decb90">
<h3 class="mxcw-pa-summary-title">Ecological reserves</h3>
<p class="mxcw-pa-summary-subtitle">4 areas · 445 hectares</p>
<p class="mxcw-pa-summary-text">Ecological reserves hold 26 percent of the native plant diversity known to the peninsula: 171 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Ecological reserve · native species" role="button" tabindex="0">
<b>171</b>
<span>native species · 26% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Ecological reserve · species of conservation concern" role="button" tabindex="0">
<b>22</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Ecological reserve · found in no other category" role="button" tabindex="0">
<b>7</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>1,731</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Trial Islands Ecological Reserve" role="button" tabindex="0">Trial Islands Ecological Reserve</span>
<b>123</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Oak Bay Islands Ecological Reserve" role="button" tabindex="0">Oak Bay Islands Ecological Reserve</span>
<b>106</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Ten Mile Point Ecological Reserve" role="button" tabindex="0">Ten Mile Point Ecological Reserve</span>
<b>36</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Provincial park" hidden style="--pa-colour: #8cc084">
<h3 class="mxcw-pa-summary-title">Provincial parks</h3>
<p class="mxcw-pa-summary-subtitle">4 areas · 1,810 hectares</p>
<p class="mxcw-pa-summary-text">Provincial parks hold 52 percent of the native plant diversity known to the peninsula: 347 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Provincial park · native species" role="button" tabindex="0">
<b>347</b>
<span>native species · 52% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Provincial park · species of conservation concern" role="button" tabindex="0">
<b>19</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Provincial park · found in no other category" role="button" tabindex="0">
<b>27</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>20,357</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Gowlland Tod Park" role="button" tabindex="0">Gowlland Tod Park</span>
<b>274</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Goldstream Park" role="button" tabindex="0">Goldstream Park</span>
<b>250</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="ȽÁU,WELṈEW̱/John Dean Park" role="button" tabindex="0">ȽÁU,WELṈEW̱/John Dean Park</span>
<b>147</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Migratory bird sanctuary" hidden style="--pa-colour: #9fd0e0">
<h3 class="mxcw-pa-summary-title">Migratory bird sanctuaries</h3>
<p class="mxcw-pa-summary-subtitle">3 areas · 2,119 hectares</p>
<p class="mxcw-pa-summary-text">Migratory bird sanctuaries hold 42 percent of the native plant diversity known to the peninsula: 284 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Migratory bird sanctuary · native species" role="button" tabindex="0">
<b>284</b>
<span>native species · 42% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Migratory bird sanctuary · species of conservation concern" role="button" tabindex="0">
<b>36</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Migratory bird sanctuary · found in no other category" role="button" tabindex="0">
<b>20</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>7,164</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Victoria Harbour Migratory Bird Sanctuary" role="button" tabindex="0">Victoria Harbour Migratory Bird Sanctuary</span>
<b>253</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Esquimalt Lagoon Migratory Bird Sanctuary" role="button" tabindex="0">Esquimalt Lagoon Migratory Bird Sanctuary</span>
<b>121</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Shoal Harbour Migratory Bird Sanctuary" role="button" tabindex="0">Shoal Harbour Migratory Bird Sanctuary</span>
<b>53</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Regional park" hidden style="--pa-colour: #4fae98">
<h3 class="mxcw-pa-summary-title">Regional parks</h3>
<p class="mxcw-pa-summary-subtitle">16 areas · 2,633 hectares</p>
<p class="mxcw-pa-summary-text">Regional parks hold 66 percent of the native plant diversity known to the peninsula: 440 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Regional park · native species" role="button" tabindex="0">
<b>440</b>
<span>native species · 66% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Regional park · species of conservation concern" role="button" tabindex="0">
<b>37</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Regional park · found in no other category" role="button" tabindex="0">
<b>72</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>26,243</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Thetis Lake Regional Park" role="button" tabindex="0">Thetis Lake Regional Park</span>
<b>290</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Mill Hill Regional Park" role="button" tabindex="0">Mill Hill Regional Park</span>
<b>197</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Mount Work Regional Park" role="button" tabindex="0">Mount Work Regional Park</span>
<b>195</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Private conservation land" hidden style="--pa-colour: #a593d8">
<h3 class="mxcw-pa-summary-title">Private conservation lands</h3>
<p class="mxcw-pa-summary-subtitle">15 areas · 309 hectares</p>
<p class="mxcw-pa-summary-text">Private conservation lands hold 30 percent of the native plant diversity known to the peninsula: 200 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Private conservation land · native species" role="button" tabindex="0">
<b>200</b>
<span>native species · 30% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Private conservation land · species of conservation concern" role="button" tabindex="0">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat" data-select="Private conservation land · found in no other category" role="button" tabindex="0">
<b>3</b>
<span>species reported in no other category</span>
</div>
<div class="mxcw-pa-stat">
<b>1,462</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Millstream Creek Watershed" role="button" tabindex="0">Millstream Creek Watershed</span>
<b>79</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Maltby Lake" role="button" tabindex="0">Maltby Lake</span>
<b>73</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Nature Conservancy of Canada protected area" role="button" tabindex="0">Nature Conservancy of Canada protected area</span>
<b>68</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Albert Head Lagoon Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Albert Head Lagoon Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 7 hectares</p>
<p class="mxcw-pa-summary-text">23 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within Albert Head Lagoon Regional Park, the 16th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Albert Head Lagoon Regional Park · native species" role="button" tabindex="0">
<b>23</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>54</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Alston-Stewart" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Alston-Stewart</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 3 hectares</p>
<p class="mxcw-pa-summary-text">4 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Alston-Stewart, the 15th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Alston-Stewart · native species" role="button" tabindex="0">
<b>4</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>4</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Bear Hill" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Bear Hill</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 2 hectares</p>
<p class="mxcw-pa-summary-text">8 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Bear Hill, the 13th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Bear Hill · native species" role="button" tabindex="0">
<b>8</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>10</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Bear Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Bear Hill Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 49 hectares</p>
<p class="mxcw-pa-summary-text">98 native species, 15 percent of the native plant diversity known to the peninsula, have been reported within Bear Hill Regional Park, the 9th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Bear Hill Regional Park · native species" role="button" tabindex="0">
<b>98</b>
<span>native species · 15% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Bear Hill Regional Park · species of conservation concern" role="button" tabindex="0">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>646</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Coles Bay Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Coles Bay Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 4 hectares</p>
<p class="mxcw-pa-summary-text">44 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Coles Bay Regional Park, the 13th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Coles Bay Regional Park · native species" role="button" tabindex="0">
<b>44</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>112</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Devonian Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Devonian Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 14 hectares</p>
<p class="mxcw-pa-summary-text">84 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Devonian Regional Park, the 11th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Devonian Regional Park · native species" role="button" tabindex="0">
<b>84</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>618</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Discovery Island Marine Park" hidden style="--pa-colour: #8cc084">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Discovery Island Marine Park</h3>
<p class="mxcw-pa-summary-subtitle">Provincial park · 68 hectares</p>
<p class="mxcw-pa-summary-text">87 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Discovery Island Marine Park, the 4th richest of its 4 provincial parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Discovery Island Marine Park · native species" role="button" tabindex="0">
<b>87</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Discovery Island Marine Park · species of conservation concern" role="button" tabindex="0">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>783</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Earthspring" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Earthspring</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 14 hectares</p>
<p class="mxcw-pa-summary-text">24 native species, 4 percent of the native plant diversity known to the peninsula, have been reported within Earthspring, the 8th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Earthspring · native species" role="button" tabindex="0">
<b>24</b>
<span>native species · 4% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>72</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Elk/Beaver Lake Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Elk/Beaver Lake Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 444 hectares</p>
<p class="mxcw-pa-summary-text">188 native species, 28 percent of the native plant diversity known to the peninsula, have been reported within Elk/Beaver Lake Regional Park, the 4th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Elk/Beaver Lake Regional Park · native species" role="button" tabindex="0">
<b>188</b>
<span>native species · 28% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Elk/Beaver Lake Regional Park · species of conservation concern" role="button" tabindex="0">
<b>7</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,306</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Esquimalt Lagoon Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="mxcw-pa-summary-title">Esquimalt Lagoon Migratory Bird Sanctuary</h3>
<p class="mxcw-pa-summary-subtitle">Migratory bird sanctuary · 134 hectares</p>
<p class="mxcw-pa-summary-text">121 native species, 18 percent of the native plant diversity known to the peninsula, have been reported within Esquimalt Lagoon Migratory Bird Sanctuary, the 2nd richest of its 3 migratory bird sanctuaries.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Esquimalt Lagoon Migratory Bird Sanctuary · native species" role="button" tabindex="0">
<b>121</b>
<span>native species · 18% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Esquimalt Lagoon Migratory Bird Sanctuary · species of conservation concern" role="button" tabindex="0">
<b>4</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,162</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Francis/King Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Francis/King Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 109 hectares</p>
<p class="mxcw-pa-summary-text">135 native species, 20 percent of the native plant diversity known to the peninsula, have been reported within Francis/King Regional Park, the 6th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Francis/King Regional Park · native species" role="button" tabindex="0">
<b>135</b>
<span>native species · 20% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Francis/King Regional Park · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,748</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Ginns" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Ginns</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 23 hectares</p>
<p class="mxcw-pa-summary-text">10 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Ginns, the 12th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Ginns · native species" role="button" tabindex="0">
<b>10</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>10</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Goldstream Park" hidden style="--pa-colour: #8cc084">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Goldstream Park</h3>
<p class="mxcw-pa-summary-subtitle">Provincial park · 293 hectares</p>
<p class="mxcw-pa-summary-text">250 native species, 37 percent of the native plant diversity known to the peninsula, have been reported within Goldstream Park, the 2nd richest of its 4 provincial parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Goldstream Park · native species" role="button" tabindex="0">
<b>250</b>
<span>native species · 37% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Goldstream Park · species of conservation concern" role="button" tabindex="0">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>5,978</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Gonzales Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Gonzales Hill Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 2 hectares</p>
<p class="mxcw-pa-summary-text">44 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Gonzales Hill Regional Park, the 13th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Gonzales Hill Regional Park · native species" role="button" tabindex="0">
<b>44</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Gonzales Hill Regional Park · species of conservation concern" role="button" tabindex="0">
<b>4</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>219</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Gowlland Tod Park" hidden style="--pa-colour: #8cc084">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Gowlland Tod Park</h3>
<p class="mxcw-pa-summary-subtitle">Provincial park · 1,276 hectares</p>
<p class="mxcw-pa-summary-text">274 native species, 41 percent of the native plant diversity known to the peninsula, have been reported within Gowlland Tod Park, the richest of its 4 provincial parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Gowlland Tod Park · native species" role="button" tabindex="0">
<b>274</b>
<span>native species · 41% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Gowlland Tod Park · species of conservation concern" role="button" tabindex="0">
<b>11</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>10,086</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Gulf Islands National Park Reserve of Canada" hidden style="--pa-colour: #5a96d2">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="National park reserve" role="button" tabindex="0">↑ National park reserve</span>
</nav>
<h3 class="mxcw-pa-summary-title">Gulf Islands National Park Reserve of Canada</h3>
<p class="mxcw-pa-summary-subtitle">National park reserve · 1,296 hectares</p>
<p class="mxcw-pa-summary-text">194 native species, 29 percent of the native plant diversity known to the peninsula, have been reported within Gulf Islands National Park Reserve of Canada.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Gulf Islands National Park Reserve of Canada · native species" role="button" tabindex="0">
<b>194</b>
<span>native species · 29% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Gulf Islands National Park Reserve of Canada · species of conservation concern" role="button" tabindex="0">
<b>14</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,687</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Horth Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Horth Hill Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 37 hectares</p>
<p class="mxcw-pa-summary-text">108 native species, 16 percent of the native plant diversity known to the peninsula, have been reported within Horth Hill Regional Park, the 7th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Horth Hill Regional Park · native species" role="button" tabindex="0">
<b>108</b>
<span>native species · 16% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>925</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Island View Beach Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Island View Beach Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 53 hectares</p>
<p class="mxcw-pa-summary-text">101 native species, 15 percent of the native plant diversity known to the peninsula, have been reported within Island View Beach Regional Park, the 8th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Island View Beach Regional Park · native species" role="button" tabindex="0">
<b>101</b>
<span>native species · 15% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Island View Beach Regional Park · species of conservation concern" role="button" tabindex="0">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,495</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Lone Tree Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Lone Tree Hill Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 31 hectares</p>
<p class="mxcw-pa-summary-text">93 native species, 14 percent of the native plant diversity known to the peninsula, have been reported within Lone Tree Hill Regional Park, the 10th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Lone Tree Hill Regional Park · native species" role="button" tabindex="0">
<b>93</b>
<span>native species · 14% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Lone Tree Hill Regional Park · species of conservation concern" role="button" tabindex="0">
<b>4</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>665</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Madrona Farm" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Madrona Farm</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 9 hectares</p>
<p class="mxcw-pa-summary-text">16 native species, 2 percent of the native plant diversity known to the peninsula, have been reported within Madrona Farm, the 11th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Madrona Farm · native species" role="button" tabindex="0">
<b>16</b>
<span>native species · 2% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Madrona Farm · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>21</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Maltby Lake" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Maltby Lake</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · Friends of Maltby Lake Watershed Society · 77 hectares</p>
<p class="mxcw-pa-summary-text">73 native species, 11 percent of the native plant diversity known to the peninsula, have been reported within Maltby Lake, the 2nd richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Maltby Lake · native species" role="button" tabindex="0">
<b>73</b>
<span>native species · 11% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>137</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Mary Hill Connector" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Mary Hill Connector</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 6 hectares</p>
<p class="mxcw-pa-summary-text">51 native species, 8 percent of the native plant diversity known to the peninsula, have been reported within Mary Hill Connector, the 4th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Mary Hill Connector · native species" role="button" tabindex="0">
<b>51</b>
<span>native species · 8% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Mary Hill Connector · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>101</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Matson Conservation Area" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Matson Conservation Area</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 1 hectares</p>
<p class="mxcw-pa-summary-text">51 native species, 8 percent of the native plant diversity known to the peninsula, have been reported within Matson Conservation Area, the 4th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Matson Conservation Area · native species" role="button" tabindex="0">
<b>51</b>
<span>native species · 8% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>118</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Mill Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Mill Hill Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 81 hectares</p>
<p class="mxcw-pa-summary-text">197 native species, 29 percent of the native plant diversity known to the peninsula, have been reported within Mill Hill Regional Park, the 2nd richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Mill Hill Regional Park · native species" role="button" tabindex="0">
<b>197</b>
<span>native species · 29% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Mill Hill Regional Park · species of conservation concern" role="button" tabindex="0">
<b>15</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,715</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Millstream Creek Watershed" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Millstream Creek Watershed</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 11 hectares</p>
<p class="mxcw-pa-summary-text">79 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within Millstream Creek Watershed, the richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Millstream Creek Watershed · native species" role="button" tabindex="0">
<b>79</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>302</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Mount Wells Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Mount Wells Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 44 hectares</p>
<p class="mxcw-pa-summary-text">28 native species, 4 percent of the native plant diversity known to the peninsula, have been reported within Mount Wells Regional Park, the 15th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Mount Wells Regional Park · native species" role="button" tabindex="0">
<b>28</b>
<span>native species · 4% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Mount Wells Regional Park · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>46</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Mount Work Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Mount Work Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 755 hectares</p>
<p class="mxcw-pa-summary-text">195 native species, 29 percent of the native plant diversity known to the peninsula, have been reported within Mount Work Regional Park, the 3rd richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Mount Work Regional Park · native species" role="button" tabindex="0">
<b>195</b>
<span>native species · 29% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Mount Work Regional Park · species of conservation concern" role="button" tabindex="0">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,050</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Mountain Road Forest Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Mountain Road Forest Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 20 hectares</p>
<p class="mxcw-pa-summary-text">66 native species, 10 percent of the native plant diversity known to the peninsula, have been reported within Mountain Road Forest Regional Park, the 12th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Mountain Road Forest Regional Park · native species" role="button" tabindex="0">
<b>66</b>
<span>native species · 10% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>212</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Nature Conservancy of Canada protected area" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Nature Conservancy of Canada protected area</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · Nature Conservancy of Canada · 60 hectares</p>
<p class="mxcw-pa-summary-text">68 native species, 10 percent of the native plant diversity known to the peninsula, have been reported within Nature Conservancy of Canada protected area, the 3rd richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Nature Conservancy of Canada protected area · native species" role="button" tabindex="0">
<b>68</b>
<span>native species · 10% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>164</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Oak Bay Islands Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="mxcw-pa-summary-title">Oak Bay Islands Ecological Reserve</h3>
<p class="mxcw-pa-summary-subtitle">Ecological reserve · 232 hectares</p>
<p class="mxcw-pa-summary-text">106 native species, 16 percent of the native plant diversity known to the peninsula, have been reported within Oak Bay Islands Ecological Reserve, the 2nd richest of its 4 ecological reserves.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Oak Bay Islands Ecological Reserve · native species" role="button" tabindex="0">
<b>106</b>
<span>native species · 16% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Oak Bay Islands Ecological Reserve · species of conservation concern" role="button" tabindex="0">
<b>10</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>438</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Rae-Leigh Place" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Rae-Leigh Place</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 6 hectares</p>
<p class="mxcw-pa-summary-text">37 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Rae-Leigh Place, the 6th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Rae-Leigh Place · native species" role="button" tabindex="0">
<b>37</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>97</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="SISȻENEM (Halibut Island)" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">SISȻENEM (Halibut Island)</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 3 hectares</p>
<p class="mxcw-pa-summary-text">7 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within SISȻENEM (Halibut Island), the 14th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="SISȻENEM (Halibut Island) · native species" role="button" tabindex="0">
<b>7</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>8</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Satellite Channel Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="mxcw-pa-summary-title">Satellite Channel Ecological Reserve</h3>
<p class="mxcw-pa-summary-subtitle">Ecological reserve · 190 hectares</p>
<p class="mxcw-pa-summary-text">4 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Satellite Channel Ecological Reserve, the 4th richest of its 4 ecological reserves.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Satellite Channel Ecological Reserve · native species" role="button" tabindex="0">
<b>4</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>4</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Second Lake" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Second Lake</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 72 hectares</p>
<p class="mxcw-pa-summary-text">23 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within Second Lake, the 9th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Second Lake · native species" role="button" tabindex="0">
<b>23</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>31</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Shoal Harbour Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="mxcw-pa-summary-title">Shoal Harbour Migratory Bird Sanctuary</h3>
<p class="mxcw-pa-summary-subtitle">Migratory bird sanctuary · 146 hectares</p>
<p class="mxcw-pa-summary-text">53 native species, 8 percent of the native plant diversity known to the peninsula, have been reported within Shoal Harbour Migratory Bird Sanctuary, the 3rd richest of its 3 migratory bird sanctuaries.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Shoal Harbour Migratory Bird Sanctuary · native species" role="button" tabindex="0">
<b>53</b>
<span>native species · 8% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Shoal Harbour Migratory Bird Sanctuary · species of conservation concern" role="button" tabindex="0">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>96</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Swan Lake - Christmas Hill" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">Swan Lake - Christmas Hill</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · The Nature Trust of British Columbia · 2 hectares</p>
<p class="mxcw-pa-summary-text">37 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Swan Lake - Christmas Hill, the 6th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Swan Lake - Christmas Hill · native species" role="button" tabindex="0">
<b>37</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="mxcw-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>333</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Ten Mile Point Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="mxcw-pa-summary-title">Ten Mile Point Ecological Reserve</h3>
<p class="mxcw-pa-summary-subtitle">Ecological reserve · 15 hectares</p>
<p class="mxcw-pa-summary-text">36 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Ten Mile Point Ecological Reserve, the 3rd richest of its 4 ecological reserves.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Ten Mile Point Ecological Reserve · native species" role="button" tabindex="0">
<b>36</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Ten Mile Point Ecological Reserve · species of conservation concern" role="button" tabindex="0">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>68</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Thetis Lake Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Thetis Lake Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 925 hectares</p>
<p class="mxcw-pa-summary-text">290 native species, 43 percent of the native plant diversity known to the peninsula, have been reported within Thetis Lake Regional Park, the richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Thetis Lake Regional Park · native species" role="button" tabindex="0">
<b>290</b>
<span>native species · 43% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Thetis Lake Regional Park · species of conservation concern" role="button" tabindex="0">
<b>17</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>7,585</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Trial Islands Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="mxcw-pa-summary-title">Trial Islands Ecological Reserve</h3>
<p class="mxcw-pa-summary-subtitle">Ecological reserve · 8 hectares</p>
<p class="mxcw-pa-summary-text">123 native species, 18 percent of the native plant diversity known to the peninsula, have been reported within Trial Islands Ecological Reserve, the richest of its 4 ecological reserves.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Trial Islands Ecological Reserve · native species" role="button" tabindex="0">
<b>123</b>
<span>native species · 18% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Trial Islands Ecological Reserve · species of conservation concern" role="button" tabindex="0">
<b>16</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,221</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Victoria Harbour Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="mxcw-pa-summary-title">Victoria Harbour Migratory Bird Sanctuary</h3>
<p class="mxcw-pa-summary-subtitle">Migratory bird sanctuary · 1,838 hectares</p>
<p class="mxcw-pa-summary-text">253 native species, 38 percent of the native plant diversity known to the peninsula, have been reported within Victoria Harbour Migratory Bird Sanctuary, the richest of its 3 migratory bird sanctuaries.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Victoria Harbour Migratory Bird Sanctuary · native species" role="button" tabindex="0">
<b>253</b>
<span>native species · 38% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Victoria Harbour Migratory Bird Sanctuary · species of conservation concern" role="button" tabindex="0">
<b>35</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>5,906</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Witty's Lagoon Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">Witty's Lagoon Regional Park</h3>
<p class="mxcw-pa-summary-subtitle">Regional park · 59 hectares</p>
<p class="mxcw-pa-summary-text">151 native species, 23 percent of the native plant diversity known to the peninsula, have been reported within Witty's Lagoon Regional Park, the 5th richest of its 16 regional parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Witty's Lagoon Regional Park · native species" role="button" tabindex="0">
<b>151</b>
<span>native species · 23% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Witty's Lagoon Regional Park · species of conservation concern" role="button" tabindex="0">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,847</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="ȽÁU,WELṈEW̱/John Dean Park" hidden style="--pa-colour: #8cc084">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="mxcw-pa-summary-title">ȽÁU,WELṈEW̱/John Dean Park</h3>
<p class="mxcw-pa-summary-subtitle">Provincial park · 174 hectares</p>
<p class="mxcw-pa-summary-text">147 native species, 22 percent of the native plant diversity known to the peninsula, have been reported within ȽÁU,WELṈEW̱/John Dean Park, the 3rd richest of its 4 provincial parks.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="ȽÁU,WELṈEW̱/John Dean Park · native species" role="button" tabindex="0">
<b>147</b>
<span>native species · 22% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="ȽÁU,WELṈEW̱/John Dean Park · species of conservation concern" role="button" tabindex="0">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,510</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="ȾIKEL" hidden style="--pa-colour: #a593d8">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="mxcw-pa-summary-title">ȾIKEL</h3>
<p class="mxcw-pa-summary-subtitle">Private conservation land · W̱SÁNEĆ Lands Trust Society · 19 hectares</p>
<p class="mxcw-pa-summary-text">18 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within ȾIKEL, the 10th richest of its 15 private conservation lands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="ȾIKEL · native species" role="button" tabindex="0">
<b>18</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="ȾIKEL · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>54</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Published Key Biodiversity Areas" hidden style="--pa-colour: #FDF2CE">
<h3 class="mxcw-pa-summary-title">Key Biodiversity Areas</h3>
<p class="mxcw-pa-summary-subtitle">14 published, 8 of them globally significant · 11 proposed · 781 hectares</p>
<p class="mxcw-pa-summary-text">Key Biodiversity Areas mark the places that matter most for the persistence of species and ecosystems. The peninsula's Garry oak meadows, rocky headlands and islets hold 14 published Key Biodiversity Areas, most of them identified for their threatened plants, and 11 more are proposed. Together the published KBAs hold 55 percent of the native plant diversity known to the peninsula: 371 of its 670 native vascular plant species have been reported within them.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Published Key Biodiversity Areas · native species" role="button" tabindex="0">
<b>371</b>
<span>native species · 55% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Published Key Biodiversity Areas · species of conservation concern" role="button" tabindex="0">
<b>47</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>26,575</b>
<span>records of native species</span>
</div>
</div>
<div class="mxcw-pa-richest-holder">
<span class="mxcw-pa-richest-title">Richest in native species</span>
<ol class="mxcw-pa-richest">
<li>
<span class="mxcw-pa-link" data-select="Uplands Park - Cattle Point" role="button" tabindex="0">Uplands Park - Cattle Point</span>
<b>223</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Fort Rodd Hill" role="button" tabindex="0">Fort Rodd Hill</span>
<b>177</b>
</li>
<li>
<span class="mxcw-pa-link" data-select="Trial Islands" role="button" tabindex="0">Trial Islands</span>
<b>149</b>
</li>
</ol>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Christmas Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Christmas Hill</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 14 hectares</p>
<p class="mxcw-pa-summary-text">85 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Christmas Hill.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Christmas Hill · native species" role="button" tabindex="0">
<b>85</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Christmas Hill · species of conservation concern" role="button" tabindex="0">
<b>4</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>1,534</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Durrance Lake - Cole Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Durrance Lake - Cole Hill</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for amphibians and reptiles, invertebrates · 199 hectares</p>
<p class="mxcw-pa-summary-text">125 native species, 19 percent of the native plant diversity known to the peninsula, have been reported within Durrance Lake - Cole Hill.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Durrance Lake - Cole Hill · native species" role="button" tabindex="0">
<b>125</b>
<span>native species · 19% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Durrance Lake - Cole Hill · species of conservation concern" role="button" tabindex="0">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>738</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Fort Rodd Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Fort Rodd Hill</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 28 hectares</p>
<p class="mxcw-pa-summary-text">177 native species, 26 percent of the native plant diversity known to the peninsula, have been reported within Fort Rodd Hill.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Fort Rodd Hill · native species" role="button" tabindex="0">
<b>177</b>
<span>native species · 26% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Fort Rodd Hill · species of conservation concern" role="button" tabindex="0">
<b>20</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>2,450</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Gonzales Point" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Gonzales Point</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="mxcw-pa-summary-text">37 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Gonzales Point.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Gonzales Point · native species" role="button" tabindex="0">
<b>37</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Gonzales Point · species of conservation concern" role="button" tabindex="0">
<b>5</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>114</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Harling Point" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Harling Point</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="mxcw-pa-summary-text">92 native species, 14 percent of the native plant diversity known to the peninsula, have been reported within Harling Point.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Harling Point · native species" role="button" tabindex="0">
<b>92</b>
<span>native species · 14% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Harling Point · species of conservation concern" role="button" tabindex="0">
<b>9</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,914</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Kohweechela - Mary Tod Island" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Kohweechela - Mary Tod Island</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 3 hectares</p>
<p class="mxcw-pa-summary-text">64 native species, 10 percent of the native plant diversity known to the peninsula, have been reported within Kohweechela - Mary Tod Island.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Kohweechela - Mary Tod Island · native species" role="button" tabindex="0">
<b>64</b>
<span>native species · 10% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Kohweechela - Mary Tod Island · species of conservation concern" role="button" tabindex="0">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>363</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Sidney Island - Wymond Point" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Sidney Island - Wymond Point</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for nonvascular plants · 27 hectares</p>
<p class="mxcw-pa-summary-text">35 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Sidney Island - Wymond Point.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Sidney Island - Wymond Point · native species" role="button" tabindex="0">
<b>35</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Sidney Island - Wymond Point · species of conservation concern" role="button" tabindex="0">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>67</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="SḰŦÁMEN - North Sidney Island" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">SḰŦÁMEN - North Sidney Island</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for invertebrates, vascular plants · 144 hectares</p>
<p class="mxcw-pa-summary-text">96 native species, 14 percent of the native plant diversity known to the peninsula, have been reported within SḰŦÁMEN - North Sidney Island.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="SḰŦÁMEN - North Sidney Island · native species" role="button" tabindex="0">
<b>96</b>
<span>native species · 14% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="SḰŦÁMEN - North Sidney Island · species of conservation concern" role="button" tabindex="0">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>952</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Trafalgar Park" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Trafalgar Park</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="mxcw-pa-summary-text">47 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Trafalgar Park.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Trafalgar Park · native species" role="button" tabindex="0">
<b>47</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Trafalgar Park · species of conservation concern" role="button" tabindex="0">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>191</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Trial Islands" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Trial Islands</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 19 hectares</p>
<p class="mxcw-pa-summary-text">149 native species, 22 percent of the native plant diversity known to the peninsula, have been reported within Trial Islands.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Trial Islands · native species" role="button" tabindex="0">
<b>149</b>
<span>native species · 22% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Trial Islands · species of conservation concern" role="button" tabindex="0">
<b>20</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>3,361</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="T̸IX̱EṈ - Cordova Shore" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">T̸IX̱EṈ - Cordova Shore</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for invertebrates, vascular plants · 140 hectares</p>
<p class="mxcw-pa-summary-text">134 native species, 20 percent of the native plant diversity known to the peninsula, have been reported within T̸IX̱EṈ - Cordova Shore.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="T̸IX̱EṈ - Cordova Shore · native species" role="button" tabindex="0">
<b>134</b>
<span>native species · 20% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="T̸IX̱EṈ - Cordova Shore · species of conservation concern" role="button" tabindex="0">
<b>7</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>2,152</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Uplands Park - Cattle Point" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Uplands Park - Cattle Point</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 39 hectares</p>
<p class="mxcw-pa-summary-text">223 native species, 33 percent of the native plant diversity known to the peninsula, have been reported within Uplands Park - Cattle Point.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Uplands Park - Cattle Point · native species" role="button" tabindex="0">
<b>223</b>
<span>native species · 33% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Uplands Park - Cattle Point · species of conservation concern" role="button" tabindex="0">
<b>26</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>10,446</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="Witty's Beach" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">Witty's Beach</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 3 hectares</p>
<p class="mxcw-pa-summary-text">39 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Witty's Beach.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="Witty's Beach · native species" role="button" tabindex="0">
<b>39</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="Witty's Beach · species of conservation concern" role="button" tabindex="0">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>205</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="mxcw-pa-card-summary" data-key="ȽEL,TOS - James Island" hidden style="--pa-colour: #FDF2CE">
<nav class="mxcw-pa-crumbs">
<span class="mxcw-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="mxcw-pa-summary-title">ȽEL,TOS - James Island</h3>
<p class="mxcw-pa-summary-subtitle">Key Biodiversity Area · Globally significant for invertebrates, vascular plants · 159 hectares</p>
<p class="mxcw-pa-summary-text">19 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within ȽEL,TOS - James Island.</p>
<div class="mxcw-pa-stats">
<div class="mxcw-pa-stat" data-select="ȽEL,TOS - James Island · native species" role="button" tabindex="0">
<b>19</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="mxcw-pa-stat" data-select="ȽEL,TOS - James Island · species of conservation concern" role="button" tabindex="0">
<b>5</b>
<span>species of conservation concern</span>
</div>
<div class="mxcw-pa-stat">
<b>88</b>
<span>records of native species</span>
</div>
</div>
</section>
</div>

<p>This preliminary evaluation is limited by biases in sampling effort
and other gaps in the data, but it is a starting point for a more
thorough assessment of progress toward conserving the region’s plant
diversity. Help improve it by reporting your observations to the <a href="https://www.inaturalist.org/projects/lost-plants-of-the-saanich-peninsula">“Lost”
plants of the Saanich Peninsula iNaturalist project</a>.</p>
<div class="mxcw-howto">
<p>The map shows protected and conserved areas by category, with Key
Biodiversity Areas outlined in cream. Proposed Key Biodiversity Areas,
whose boundaries are not yet public, are marked by rings. Click an area
on the map, or in the chart below it, to show only the plants recorded
there and its summary above, or a category in the map’s legend or the
chart to show those recorded in all its areas. Choose <em>Unprotected
native plant diversity</em> in the chart to show, as a grid on the map,
where the native plants not yet reported in any protected area have been
recorded. Protected areas are from the <a href="https://www.canada.ca/en/environment-climate-change/services/national-wildlife-areas/protected-conserved-areas-database.html">Canadian
Protected and Conserved Areas Database</a> (Environment and Climate
Change Canada), and Key Biodiversity Areas from <a href="https://kbacanada.org/">KBA Canada</a> (CC BY-NC-SA 4.0).</p>
</div>
</div></div></div>
</template>
