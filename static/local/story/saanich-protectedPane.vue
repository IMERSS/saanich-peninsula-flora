<script src="../../bioreportr/js/story.js"></script>
<script>
"use strict";

// The Protected Areas pane of the Saanich story. Everything it shows follows the one selection of the story page,
// selectedRegion - all the protected areas when none is selected, a category, an individual area, all the KBAs or a
// KBA:
//   - the map, drawn by the pane's region handler from scripts/Protected_map_mapbox.R, holds each shape once, with a
//     layer for each category drawn from them by a filter - clicking an area or a KBA selects it, and a card
//     describes it as it is hovered or tapped
//   - the map's legend selects a category
//   - the pane's text opens with a card summarising the selection, and the area below the map holds a chart of the
//     categories, or of the areas within the selected one - both written as HTML by the script, as a card or chart
//     for each selection, of which the one for the selection is shown by saanich.protectedAreas.showSelection. Their
//     rows and links select what they name
//   - the records and the checklist are filtered to the selection, and a smaller panel of the plant chosen in the
//     checklist gives its records within it
// The behaviour is configured onto the story page by saanich-story.vue as its member protectedAreas

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
fluid.registerNamespace("saanich.protectedAreas");

fluid.def("saanich.protectedAreas", {
    $layers: "fluid.component",
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, Protected)",
    hover: "$effect:saanich.protectedAreas.bindCards({storyPage}, {storyPage}.map.readyMap, {storyPage}.mapData, {global})",
    selects: "$effect:saanich.protectedAreas.bindSelects({storyPage}, {global})",
    shown: "$effect:saanich.protectedAreas.showSelection({storyPage}.selectedRegion, {self}.active, {global})",
    // The plant chosen in the checklist, with its records within the selected region, shown in a smaller panel beside
    // the chart, in place of the atlas's
    regionRecords: "$compute:saanich.atlas.taxonRecords({storyPage}.finalFilteredObs, {storyPage}.taxa.rowById, {storyPage}.checklistTaxon)",
    panelMarkup: "$compute:saanich.protectedAreas.panelMarkup({storyPage}.checklistTaxon, {self}.regionRecords, {storyPage}.selectedRegion)"
});

// The pane's section, rendered from the template below
fluid.def("saanich.protectedPane", {
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
 * @return {String} The panel's markup, empty if no plant with records there is chosen
 */
saanich.protectedAreas.panelMarkup = function (taxon, records, region) {
    let togo = "";
    if (taxon && records.length > 0) {
        const where = region ? `<div class="saanich-pa-taxon-region">In ${hortis.dataTable.encode(region)}</div>` : "";
        togo = `<div class="mxcw-solow-taxon-pane saanich-atlas-taxon-pane saanich-pa-taxon-pane">
  <div class="mxcw-taxon-image">${hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)}</div>
  <div class="mxcw-taxon-info">
    <div class="mxcw-taxon-name">${hortis.dataTable.encode((taxon.scientificName || taxon.iNaturalistTaxonName) + (taxon.commonName ? ` (${taxon.commonName})` : ""))}</div>
    <div class="saanich-atlas-facts">
      ${where}
      <dl class="mxcw-taxon-fields">
        ${saanich.atlas.field("Status", saanich.atlas.statusLabels[taxon.reportingStatus])}
        <dt>Records:</dt> <dd>${saanich.formatCount(records.length)}</dd>
        <dt>First seen:</dt> <dd>${bioreportr.eventDay(records[0].eventDate)}</dd>
        <dt>Last seen:</dt> <dd>${bioreportr.eventDay(fluid.peek(records).eventDate)}</dd>
      </dl>
    </div>
  </div>
</div>`;
    }
    return togo;
};

/**
 * Choose the panel of the plant chosen in the checklist for the pane shown - the smaller panel of this pane, or the
 * atlas's.
 * @param {String} activePaneKey - The pane shown
 * @param {String} atlasMarkup - The atlas's panel
 * @param {String} protectedMarkup - This pane's panel
 * @return {String} The markup of the panel
 */
saanich.protectedAreas.choosePanel = (activePaneKey, atlasMarkup, protectedMarkup) =>
    activePaneKey === "Protected" ? protectedMarkup : atlasMarkup;

// The panel is shown on the atlas and on this pane, while a plant with records is chosen
saanich.protectedAreas.panelVisible = (markup, activePaneKey) => !!markup && (activePaneKey === "Status" || activePaneKey === "Protected");

/**
 * Whether the Protected Areas pane is the one shown - read from the page, since the cards are shown from map events.
 * @param {Document} dokkument - The page
 * @return {Boolean} Whether its section is shown
 */
saanich.protectedAreas.isShown = function (dokkument) {
    const section = dokkument.querySelector(".mxcw-paneKey-Protected");
    return !!(section && section.offsetParent);
};

// The maps whose individual areas already show their cards
saanich.protectedAreas.boundMaps = new WeakSet();

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
 */
saanich.protectedAreas.bindCards = function (storyPage, map, mapData, window) {
    if (!map || !mapData || saanich.protectedAreas.boundMaps.has(map)) {
        return;
    }
    saanich.protectedAreas.boundMaps.add(map);
    // The layers whose shapes carry cards, in sources named "... .cards" - see regions_to_mapbox_source
    const cardLayers = mapData.style.layers.filter(layer => layer.type === "fill" && layer.source?.endsWith(".cards"))
        .map(layer => layer.id);
    const card = window.document.createElement("div");
    card.className = "saanich-pa-card";
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
        const feature = saanich.protectedAreas.isShown(window.document) && ids.length &&
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
    map.on("mousemove", event => {
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
    container.addEventListener("pointerdown", event => {
        start = event.pointerType === "touch" && event.isPrimary ?
            {id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp} : null;
    }, true);
    container.addEventListener("pointerup", event => {
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
    container.addEventListener("pointercancel", () => {
        start = null;
    }, true);
    map.getCanvas().addEventListener("mouseleave", () => {
        card.hidden = true;
        shown = null;
    });
};

// The pages whose rows and links already select what they name
saanich.protectedAreas.boundPages = new WeakSet();

/**
 * Make the rows of the charts and the links of the summaries select what they name, as the map's legend and its
 * shapes do - by click, or by Enter or Space from the keyboard. A row of a chart which is already selected clears the
 * selection, as a row of the legend does; a link, e.g. back to all the protected areas, always selects what it names,
 * all of them if it names nothing.
 * @param {bioreportr.storyPage} storyPage - The story page, whose selected region they set
 * @param {Window} window - The window holding the page
 */
saanich.protectedAreas.bindSelects = function (storyPage, window) {
    const dokkument = window.document;
    if (saanich.protectedAreas.boundPages.has(dokkument)) {
        return;
    }
    saanich.protectedAreas.boundPages.add(dokkument);
    const select = target => {
        const row = target.closest?.(".saanich-pa-row[data-region]");
        const link = target.closest?.("[data-select]");
        if (row) {
            bioreportr.storyPage.selectRegion(storyPage, row.getAttribute("aria-pressed") === "true" ? null : row.dataset.region);
        } else if (link) {
            bioreportr.storyPage.selectRegion(storyPage, link.dataset.select || null);
        }
        return !!(row || link);
    };
    dokkument.addEventListener("click", event => select(event.target));
    dokkument.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && select(event.target)) {
            event.preventDefault();
        }
    });
};

/**
 * Choose the view of a selection among those of a container - the one for the selection itself; failing that, the one
 * listing it among its members, e.g. the chart of an area's category; failing that, the view of no selection.
 * @param {Element[]} views - The views, each with a `data-key`, and any `data-members` as a JSON array
 * @param {String|null} selectedRegion - The selection, if any
 * @return {Element|undefined} The view to be shown
 */
saanich.protectedAreas.viewFor = function (views, selectedRegion) {
    const members = view => JSON.parse(view.dataset.members || "[]");
    return selectedRegion && (views.find(view => view.dataset.key === selectedRegion) ||
        views.find(view => members(view).includes(selectedRegion))) || views.find(view => view.dataset.key === "");
};

/**
 * Show, in the summaries of the pane's text and the charts beneath the map, the view of the selection - see
 * saanich.protectedAreas.viewFor - bringing a newly shown summary into view, and mark the selected row of a chart.
 * @param {String|null} selectedRegion - The selection, if any
 * @param {Boolean} active - Whether the pane is shown, when its views are rendered
 * @param {Window} window - The window holding the page
 */
saanich.protectedAreas.showSelection = function (selectedRegion, active, window) {
    if (active) {
        window.setTimeout(() => {
            const dokkument = window.document;
            dokkument.querySelectorAll(".saanich-pa-views").forEach(container => {
                const views = [...container.children].filter(view => view.dataset.key !== undefined);
                const shown = saanich.protectedAreas.viewFor(views, selectedRegion);
                const changed = shown && shown.hidden;
                views.forEach(view => {
                    view.hidden = view !== shown;
                });
                if (changed && container.classList.contains("saanich-pa-summaries")) {
                    shown.scrollIntoView({block: "nearest", behavior: "smooth"});
                }
            });
            dokkument.querySelectorAll(".saanich-pa-row[data-region]").forEach(row => {
                row.setAttribute("aria-pressed", String(row.dataset.region === selectedRegion));
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

.mxcw-data:has(> .mxcw-atlas-has-taxon) .mxcw-dataPane-Protected .saanich-pa-chart {
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
.saanich-pa-taxon-pane .mxcw-taxon-fields {
    margin: 4px 0 0;
}

/* With no chart of the plant's history beside its facts, they take the panel's whole width, as a dl of two columns */
.saanich-atlas-taxon-pane.saanich-pa-taxon-pane .mxcw-taxon-info {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: start;
}

.saanich-pa-taxon-pane .saanich-atlas-facts dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 1px 8px;
}

.saanich-pa-taxon-pane .saanich-atlas-facts dd {
    margin: 0;
}

.saanich-pa-taxon-region {
    margin-top: 2px;
    font-size: var(--story-small);
    font-style: italic;
}

/* Beside the panel the chart is narrow, so its names give way and its counts of areas are left out */
.saanich-pa-chart {
    container-type: inline-size;
}

@container (max-width: 440px) {
    /* Outweighing the chart's own columns below */
    .saanich-pa-chart ul.saanich-pa-rows {
        grid-template-columns: minmax(0, 1.3fr) minmax(40px, 1fr) max-content;
        column-gap: 8px;
    }

    .saanich-pa-chart .saanich-pa-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .saanich-pa-chart .saanich-pa-name small {
        display: none;
    }
}

/* The charts beneath the map, one shown at a time - see saanich.protectedAreas.showSelection */
.saanich-pa-charts {
    height: 100%;
}

.saanich-pa-chart[hidden] {
    display: none;
}

.saanich-pa-chart .saanich-pa-back {
    margin-right: 10px;
}

/* Shown in the data area below the map - see mxcw-data-pane-html in src/js/storyBuild.js */
/* A dark card, as the site's tiles and map cards are, set apart from the column's teal on which the records' bar sits,
   and inset as that bar is */
.saanich-pa-chart {
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

.saanich-pa-chart figcaption {
    margin-bottom: 4px;
    font-size: var(--story-data);
    font-weight: 700;
    color: #eefaff;
}

.saanich-pa-chart .saanich-pa-rows {
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

.saanich-pa-row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    margin: 0 -6px;
    padding: 2px 6px;
    border-radius: 6px;
    outline: 1px solid transparent;
}

.saanich-pa-row[data-region] {
    cursor: pointer;
}

.saanich-pa-row[data-region]:hover,
.saanich-pa-row[data-region]:focus-visible {
    background: rgba(168, 200, 208, 0.1);
}

.saanich-pa-row[aria-pressed="true"] {
    background: rgba(253, 242, 206, 0.12);
    outline-color: #FDF2CE;
}

/* The card summarising the selection at the head of the pane's text - see saanich.protectedAreas.showSelection. Its
   colour is that of the selected category, or the KBAs' */
.saanich-pa-summaries {
    margin: 0.4em 0 1em;
}

.saanich-pa-card-summary {
    padding: 10px 12px 12px;
    background: #0d3040;
    border-top: 3px solid var(--pa-colour);
    border-radius: var(--data-table-radius, 8px);
}

.saanich-pa-card-summary[hidden] {
    display: none;
}

.saanich-pa-crumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.mxcw-sectionColumn .saanich-pa-summary-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--story-body);
    color: #eefaff;
}

.saanich-pa-summary-title::before {
    content: "";
    flex: none;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: var(--pa-colour);
}

.mxcw-sectionColumn .saanich-pa-summary-subtitle {
    margin: 2px 0 8px 19px;
    font-size: var(--story-small);
    color: #a8c8d0;
}

.mxcw-sectionColumn .saanich-pa-summary-text {
    margin: 0 0 10px;
    font-size: var(--story-data);
    line-height: 1.45;
    color: #c4dbe2;
}

/* The links of the summaries and charts, which select what they name - see saanich.protectedAreas.bindSelects */
.saanich-pa-link {
    cursor: pointer;
    color: #eefaff;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
}

.saanich-pa-link:hover,
.saanich-pa-link:focus-visible {
    text-decoration-style: solid;
}

.saanich-pa-crumbs .saanich-pa-link,
.saanich-pa-back {
    display: inline-block;
    padding: 1px 6px;
    font-size: var(--story-small);
    font-weight: 400;
    color: #a8c8d0;
    text-decoration: none;
    border: 1px solid rgba(168, 200, 208, 0.35);
    border-radius: 5px;
}

.saanich-pa-crumbs .saanich-pa-link:hover,
.saanich-pa-crumbs .saanich-pa-link:focus-visible,
.saanich-pa-back:hover,
.saanich-pa-back:focus-visible {
    color: #eefaff;
    background: rgba(168, 200, 208, 0.12);
}

/* The panel's figures, each a number over its meaning, in a grid as wide as the column allows */
.saanich-pa-stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 8px 12px;
}

.saanich-pa-stat {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
}

.saanich-pa-stat b {
    font-size: 20px;
    color: #eefaff;
}

.saanich-pa-stat span {
    font-size: var(--story-small);
    color: #a8c8d0;
}

.saanich-pa-richest-holder {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(168, 200, 208, 0.25);
    font-size: var(--story-small);
}

.saanich-pa-richest-title {
    color: #a8c8d0;
}

.mxcw-sectionColumn .saanich-pa-richest {
    margin: 4px 0 0;
    padding-left: 1.3em;
}

.saanich-pa-richest li {
    margin: 0;
    color: #eefaff;
}

.saanich-pa-richest li b {
    margin-left: 6px;
    color: #FDF2CE;
}

/* The card describing an individual area on the map, framed as the map's other cards - hidden by its attribute, which
   its display would otherwise override */
.saanich-pa-card[hidden] {
    display: none;
}

.saanich-pa-card {
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

.saanich-pa-card-name {
    font-weight: 700;
}

.saanich-pa-card-category {
    color: #a8c8d0;
}

.saanich-pa-card-category::before {
    content: "";
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 6px;
    border-radius: 2px;
    background: var(--pa-colour);
}

.saanich-pa-card-kba {
    --pa-colour: #FDF2CE;
}

.saanich-pa-card-owner {
    font-size: var(--story-small);
    color: #a8c8d0;
}

.saanich-pa-card-count b {
    color: #FDF2CE;
}

.saanich-pa-name {
    color: #eefaff;
    line-height: 1.2;
}

.saanich-pa-name small {
    font-size: var(--story-small);
    color: #a8c8d0;
    white-space: nowrap;
}

.saanich-pa-track {
    height: 10px;
    border-radius: 5px;
    background: rgba(168, 200, 208, 0.12);
    overflow: hidden;
}

.saanich-pa-bar {
    display: block;
    height: 100%;
    border-radius: 5px;
    background: var(--pa-colour);
}

.saanich-pa-count {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #eefaff;
}

/* The KBAs overlap the protected areas, so their row is set apart below the categories */
.saanich-pa-kba .saanich-pa-name,
.saanich-pa-kba .saanich-pa-track,
.saanich-pa-kba .saanich-pa-count {
    margin-top: 6px;
    padding-top: 0;
}

.saanich-pa-kba .saanich-pa-name {
    color: #FDF2CE;
}

.saanich-pa-kba .saanich-pa-bar {
    background: repeating-linear-gradient(135deg, #FDF2CE 0 4px, rgba(253, 242, 206, 0.55) 4px 7px);
}
</style>

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from content/story/Protected.Rmd, whose front matter names saanich.protectedPane as its paneComponent. Edit the
     R Markdown and knit it, then run "npm run story", which replaces everything between <template> and </template>
     and nothing else in this file. The markup is a template, which may bind members of saanich.protectedPane with
     @{...} - written in the R Markdown as raw HTML, e.g. `<span>@{count}</span>`{=html}, which pandoc leaves as it is -->
<template>
<div id="vascular-plant-diversity-within-the-protected-areas-of-the-wsánećsaanich-peninsula" class="section level2 mxcw-paneKey-Protected"><h2>Vascular plant diversity within the protected areas of the
W̱SÁNEĆ/Saanich Peninsula</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">



<div class="saanich-pa-summaries saanich-pa-views">
<section class="saanich-pa-card-summary" data-key="" style="--pa-colour: #eefaff">
<h3 class="saanich-pa-summary-title">All protected and conserved areas</h3>
<p class="saanich-pa-summary-text">Based on our current knowledge, 79 percent of the 674 native vascular plant species known to the peninsula have been reported within its protected and conserved areas, from national park reserve and ecological reserves to regional parks and lands held by conservancies. The other 144 have so far been recorded only outside them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>43</b>
<span>areas in 6 categories</span>
</div>
<div class="saanich-pa-stat">
<b>8,610</b>
<span>hectares</span>
</div>
<div class="saanich-pa-stat">
<b>530</b>
<span>native species · 79% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>61</b>
<span>of the 79 species of conservation concern</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="National park reserve" hidden style="--pa-colour: #5a96d2">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">National park reserve</h3>
<p class="saanich-pa-summary-subtitle">1 area · 1,296 hectares</p>
<p class="saanich-pa-summary-text">The national park reserve holds 27 percent of the native plant diversity known to the peninsula: 183 of its 674 native vascular plant species have been reported within it.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>183</b>
<span>native species · 27% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>12</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>1,363</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Ecological reserve" hidden style="--pa-colour: #decb90">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Ecological reserves</h3>
<p class="saanich-pa-summary-subtitle">4 areas · 445 hectares</p>
<p class="saanich-pa-summary-text">Ecological reserves hold 24 percent of the native plant diversity known to the peninsula: 159 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>159</b>
<span>native species · 24% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>22</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>1,358</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Trial Islands Ecological Reserve" role="button" tabindex="0">Trial Islands Ecological Reserve</span>
<b>108</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Oak Bay Islands Ecological Reserve" role="button" tabindex="0">Oak Bay Islands Ecological Reserve</span>
<b>104</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Ten Mile Point Ecological Reserve" role="button" tabindex="0">Ten Mile Point Ecological Reserve</span>
<b>34</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Provincial park" hidden style="--pa-colour: #8cc084">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Provincial parks</h3>
<p class="saanich-pa-summary-subtitle">4 areas · 1,810 hectares</p>
<p class="saanich-pa-summary-text">Provincial parks hold 51 percent of the native plant diversity known to the peninsula: 346 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>346</b>
<span>native species · 51% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>21</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>37</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>14,972</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Gowlland Tod Park" role="button" tabindex="0">Gowlland Tod Park</span>
<b>270</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Goldstream Park" role="button" tabindex="0">Goldstream Park</span>
<b>238</b>
</li>
<li>
<span class="saanich-pa-link" data-select="ȽÁU,WELṈEW̱/John Dean Park" role="button" tabindex="0">ȽÁU,WELṈEW̱/John Dean Park</span>
<b>134</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Migratory bird sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Migratory bird sanctuaries</h3>
<p class="saanich-pa-summary-subtitle">3 areas · 2,119 hectares</p>
<p class="saanich-pa-summary-text">Migratory bird sanctuaries hold 40 percent of the native plant diversity known to the peninsula: 270 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>270</b>
<span>native species · 40% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>33</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>22</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>5,272</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Victoria Harbour Migratory Bird Sanctuary" role="button" tabindex="0">Victoria Harbour Migratory Bird Sanctuary</span>
<b>239</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Esquimalt Lagoon Migratory Bird Sanctuary" role="button" tabindex="0">Esquimalt Lagoon Migratory Bird Sanctuary</span>
<b>113</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Shoal Harbour Migratory Bird Sanctuary" role="button" tabindex="0">Shoal Harbour Migratory Bird Sanctuary</span>
<b>40</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Regional park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Regional parks</h3>
<p class="saanich-pa-summary-subtitle">16 areas · 2,633 hectares</p>
<p class="saanich-pa-summary-text">Regional parks hold 62 percent of the native plant diversity known to the peninsula: 419 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>419</b>
<span>native species · 62% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>33</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>78</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>18,691</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Thetis Lake Regional Park" role="button" tabindex="0">Thetis Lake Regional Park</span>
<b>274</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Mill Hill Regional Park" role="button" tabindex="0">Mill Hill Regional Park</span>
<b>191</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Mount Work Regional Park" role="button" tabindex="0">Mount Work Regional Park</span>
<b>178</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Private conservation land" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Private conservation lands</h3>
<p class="saanich-pa-summary-subtitle">15 areas · 309 hectares</p>
<p class="saanich-pa-summary-text">Private conservation lands hold 23 percent of the native plant diversity known to the peninsula: 153 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>153</b>
<span>native species · 23% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species reported in no other category</span>
</div>
<div class="saanich-pa-stat">
<b>898</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Millstream Creek Watershed" role="button" tabindex="0">Millstream Creek Watershed</span>
<b>78</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Nature Conservancy of Canada protected area" role="button" tabindex="0">Nature Conservancy of Canada protected area</span>
<b>55</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Maltby Lake" role="button" tabindex="0">Maltby Lake</span>
<b>50</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Albert Head Lagoon Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Albert Head Lagoon Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 7 hectares</p>
<p class="saanich-pa-summary-text">14 native species, 2 percent of the native plant diversity known to the peninsula, have been reported within Albert Head Lagoon Regional Park, the 16th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>14</b>
<span>native species · 2% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>36</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Alston-Stewart" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Alston-Stewart</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 3 hectares</p>
<p class="saanich-pa-summary-text">3 native species, 0 percent of the native plant diversity known to the peninsula, have been reported within Alston-Stewart, the 15th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>3</b>
<span>native species · 0% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Bear Hill" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Bear Hill</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 2 hectares</p>
<p class="saanich-pa-summary-text">4 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Bear Hill, the 13th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>4</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Bear Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Bear Hill Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 49 hectares</p>
<p class="saanich-pa-summary-text">86 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Bear Hill Regional Park, the 9th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>86</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>492</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Coles Bay Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Coles Bay Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 4 hectares</p>
<p class="saanich-pa-summary-text">29 native species, 4 percent of the native plant diversity known to the peninsula, have been reported within Coles Bay Regional Park, the 14th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>29</b>
<span>native species · 4% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>62</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Devonian Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Devonian Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 14 hectares</p>
<p class="saanich-pa-summary-text">81 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within Devonian Regional Park, the 11th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>81</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>505</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Discovery Island Marine Park" hidden style="--pa-colour: #8cc084">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Discovery Island Marine Park</h3>
<p class="saanich-pa-summary-subtitle">Provincial park · 68 hectares</p>
<p class="saanich-pa-summary-text">87 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Discovery Island Marine Park, the 4th richest of its 4 provincial parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>87</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>712</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Earthspring" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Earthspring</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 14 hectares</p>
<p class="saanich-pa-summary-text">8 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Earthspring, the 10th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>8</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>12</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Elk/Beaver Lake Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Elk/Beaver Lake Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 444 hectares</p>
<p class="saanich-pa-summary-text">176 native species, 26 percent of the native plant diversity known to the peninsula, have been reported within Elk/Beaver Lake Regional Park, the 4th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>176</b>
<span>native species · 26% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,146</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Esquimalt Lagoon Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="saanich-pa-summary-title">Esquimalt Lagoon Migratory Bird Sanctuary</h3>
<p class="saanich-pa-summary-subtitle">Migratory bird sanctuary · 134 hectares</p>
<p class="saanich-pa-summary-text">113 native species, 17 percent of the native plant diversity known to the peninsula, have been reported within Esquimalt Lagoon Migratory Bird Sanctuary, the 2nd richest of its 3 migratory bird sanctuaries.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>113</b>
<span>native species · 17% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>845</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Francis/King Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Francis/King Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 109 hectares</p>
<p class="saanich-pa-summary-text">128 native species, 19 percent of the native plant diversity known to the peninsula, have been reported within Francis/King Regional Park, the 6th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>128</b>
<span>native species · 19% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>1,188</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Ginns" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Ginns</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 23 hectares</p>
<p class="saanich-pa-summary-text">7 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Ginns, the 11th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>7</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>7</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Goldstream Park" hidden style="--pa-colour: #8cc084">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Goldstream Park</h3>
<p class="saanich-pa-summary-subtitle">Provincial park · 293 hectares</p>
<p class="saanich-pa-summary-text">238 native species, 35 percent of the native plant diversity known to the peninsula, have been reported within Goldstream Park, the 2nd richest of its 4 provincial parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>238</b>
<span>native species · 35% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>4,130</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Gonzales Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Gonzales Hill Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 2 hectares</p>
<p class="saanich-pa-summary-text">40 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Gonzales Hill Regional Park, the 13th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>40</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>171</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Gowlland Tod Park" hidden style="--pa-colour: #8cc084">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Gowlland Tod Park</h3>
<p class="saanich-pa-summary-subtitle">Provincial park · 1,276 hectares</p>
<p class="saanich-pa-summary-text">270 native species, 40 percent of the native plant diversity known to the peninsula, have been reported within Gowlland Tod Park, the richest of its 4 provincial parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>270</b>
<span>native species · 40% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>12</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>7,393</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Gulf Islands National Park Reserve of Canada" hidden style="--pa-colour: #5a96d2">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="National park reserve" role="button" tabindex="0">↑ National park reserve</span>
</nav>
<h3 class="saanich-pa-summary-title">Gulf Islands National Park Reserve of Canada</h3>
<p class="saanich-pa-summary-subtitle">National park reserve · 1,296 hectares</p>
<p class="saanich-pa-summary-text">183 native species, 27 percent of the native plant diversity known to the peninsula, have been reported within Gulf Islands National Park Reserve of Canada.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>183</b>
<span>native species · 27% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>12</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>1,363</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Horth Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Horth Hill Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 37 hectares</p>
<p class="saanich-pa-summary-text">87 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Horth Hill Regional Park, the 8th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>87</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>530</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Island View Beach Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Island View Beach Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 53 hectares</p>
<p class="saanich-pa-summary-text">97 native species, 14 percent of the native plant diversity known to the peninsula, have been reported within Island View Beach Regional Park, the 7th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>97</b>
<span>native species · 14% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>993</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Lone Tree Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Lone Tree Hill Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 31 hectares</p>
<p class="saanich-pa-summary-text">83 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within Lone Tree Hill Regional Park, the 10th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>83</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>550</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Madrona Farm" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Madrona Farm</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 9 hectares</p>
<p class="saanich-pa-summary-text">11 native species, 2 percent of the native plant diversity known to the peninsula, have been reported within Madrona Farm, the 8th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>11</b>
<span>native species · 2% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>11</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Maltby Lake" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Maltby Lake</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · Friends of Maltby Lake Watershed Society · 77 hectares</p>
<p class="saanich-pa-summary-text">50 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Maltby Lake, the 3rd richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>50</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>101</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Mary Hill Connector" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Mary Hill Connector</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 6 hectares</p>
<p class="saanich-pa-summary-text">4 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within Mary Hill Connector, the 13th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>4</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>4</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Matson Conservation Area" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Matson Conservation Area</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · Habitat Acquisition Trust · 1 hectares</p>
<p class="saanich-pa-summary-text">48 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Matson Conservation Area, the 4th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>48</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>97</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Mill Hill Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Mill Hill Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 81 hectares</p>
<p class="saanich-pa-summary-text">191 native species, 28 percent of the native plant diversity known to the peninsula, have been reported within Mill Hill Regional Park, the 2nd richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>191</b>
<span>native species · 28% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>13</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,929</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Millstream Creek Watershed" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Millstream Creek Watershed</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 11 hectares</p>
<p class="saanich-pa-summary-text">78 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within Millstream Creek Watershed, the richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>78</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>275</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Mount Wells Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Mount Wells Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 44 hectares</p>
<p class="saanich-pa-summary-text">23 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within Mount Wells Regional Park, the 15th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>23</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>35</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Mount Work Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Mount Work Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 755 hectares</p>
<p class="saanich-pa-summary-text">178 native species, 26 percent of the native plant diversity known to the peninsula, have been reported within Mount Work Regional Park, the 3rd richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>178</b>
<span>native species · 26% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,108</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Mountain Road Forest Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Mountain Road Forest Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 20 hectares</p>
<p class="saanich-pa-summary-text">56 native species, 8 percent of the native plant diversity known to the peninsula, have been reported within Mountain Road Forest Regional Park, the 12th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>56</b>
<span>native species · 8% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>161</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Nature Conservancy of Canada protected area" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Nature Conservancy of Canada protected area</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · Nature Conservancy of Canada · 60 hectares</p>
<p class="saanich-pa-summary-text">55 native species, 8 percent of the native plant diversity known to the peninsula, have been reported within Nature Conservancy of Canada protected area, the 2nd richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>55</b>
<span>native species · 8% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>91</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Oak Bay Islands Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="saanich-pa-summary-title">Oak Bay Islands Ecological Reserve</h3>
<p class="saanich-pa-summary-subtitle">Ecological reserve · 232 hectares</p>
<p class="saanich-pa-summary-text">104 native species, 15 percent of the native plant diversity known to the peninsula, have been reported within Oak Bay Islands Ecological Reserve, the 2nd richest of its 4 ecological reserves.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>104</b>
<span>native species · 15% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>11</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>418</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Rae-Leigh Place" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Rae-Leigh Place</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · BC Parks Foundation · 6 hectares</p>
<p class="saanich-pa-summary-text">13 native species, 2 percent of the native plant diversity known to the peninsula, have been reported within Rae-Leigh Place, the 7th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>13</b>
<span>native species · 2% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>20</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="SISȻENEM (Halibut Island)" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">SISȻENEM (Halibut Island)</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 3 hectares</p>
<p class="saanich-pa-summary-text">5 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within SISȻENEM (Halibut Island), the 12th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>5</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>5</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Satellite Channel Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="saanich-pa-summary-title">Satellite Channel Ecological Reserve</h3>
<p class="saanich-pa-summary-subtitle">Ecological reserve · 190 hectares</p>
<p class="saanich-pa-summary-text">3 native species, 0 percent of the native plant diversity known to the peninsula, have been reported within Satellite Channel Ecological Reserve, the 4th richest of its 4 ecological reserves.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>3</b>
<span>native species · 0% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Second Lake" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Second Lake</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Land Conservancy of BC · 72 hectares</p>
<p class="saanich-pa-summary-text">23 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within Second Lake, the 6th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>23</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>31</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Shoal Harbour Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="saanich-pa-summary-title">Shoal Harbour Migratory Bird Sanctuary</h3>
<p class="saanich-pa-summary-subtitle">Migratory bird sanctuary · 146 hectares</p>
<p class="saanich-pa-summary-text">40 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Shoal Harbour Migratory Bird Sanctuary, the 3rd richest of its 3 migratory bird sanctuaries.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>40</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>58</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Swan Lake - Christmas Hill" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">Swan Lake - Christmas Hill</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · The Nature Trust of British Columbia · 2 hectares</p>
<p class="saanich-pa-summary-text">29 native species, 4 percent of the native plant diversity known to the peninsula, have been reported within Swan Lake - Christmas Hill, the 5th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>29</b>
<span>native species · 4% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>0</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>223</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Ten Mile Point Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="saanich-pa-summary-title">Ten Mile Point Ecological Reserve</h3>
<p class="saanich-pa-summary-subtitle">Ecological reserve · 15 hectares</p>
<p class="saanich-pa-summary-text">34 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Ten Mile Point Ecological Reserve, the 3rd richest of its 4 ecological reserves.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>34</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>58</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Thetis Lake Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Thetis Lake Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 925 hectares</p>
<p class="saanich-pa-summary-text">274 native species, 41 percent of the native plant diversity known to the peninsula, have been reported within Thetis Lake Regional Park, the richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>274</b>
<span>native species · 41% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>16</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>5,465</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Trial Islands Ecological Reserve" hidden style="--pa-colour: #decb90">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Ecological reserve" role="button" tabindex="0">↑ Ecological reserves</span>
</nav>
<h3 class="saanich-pa-summary-title">Trial Islands Ecological Reserve</h3>
<p class="saanich-pa-summary-subtitle">Ecological reserve · 8 hectares</p>
<p class="saanich-pa-summary-text">108 native species, 16 percent of the native plant diversity known to the peninsula, have been reported within Trial Islands Ecological Reserve, the richest of its 4 ecological reserves.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>108</b>
<span>native species · 16% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>15</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>879</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Victoria Harbour Migratory Bird Sanctuary" hidden style="--pa-colour: #9fd0e0">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Migratory bird sanctuary" role="button" tabindex="0">↑ Migratory bird sanctuaries</span>
</nav>
<h3 class="saanich-pa-summary-title">Victoria Harbour Migratory Bird Sanctuary</h3>
<p class="saanich-pa-summary-subtitle">Migratory bird sanctuary · 1,838 hectares</p>
<p class="saanich-pa-summary-text">239 native species, 35 percent of the native plant diversity known to the peninsula, have been reported within Victoria Harbour Migratory Bird Sanctuary, the richest of its 3 migratory bird sanctuaries.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>239</b>
<span>native species · 35% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>32</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>4,369</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Witty's Lagoon Regional Park" hidden style="--pa-colour: #4fae98">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Regional park" role="button" tabindex="0">↑ Regional parks</span>
</nav>
<h3 class="saanich-pa-summary-title">Witty's Lagoon Regional Park</h3>
<p class="saanich-pa-summary-subtitle">Regional park · 59 hectares</p>
<p class="saanich-pa-summary-text">136 native species, 20 percent of the native plant diversity known to the peninsula, have been reported within Witty's Lagoon Regional Park, the 5th richest of its 16 regional parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>136</b>
<span>native species · 20% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>1,320</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="ȽÁU,WELṈEW̱/John Dean Park" hidden style="--pa-colour: #8cc084">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Provincial park" role="button" tabindex="0">↑ Provincial parks</span>
</nav>
<h3 class="saanich-pa-summary-title">ȽÁU,WELṈEW̱/John Dean Park</h3>
<p class="saanich-pa-summary-subtitle">Provincial park · 174 hectares</p>
<p class="saanich-pa-summary-text">134 native species, 20 percent of the native plant diversity known to the peninsula, have been reported within ȽÁU,WELṈEW̱/John Dean Park, the 3rd richest of its 4 provincial parks.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>134</b>
<span>native species · 20% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,737</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="ȾIKEL" hidden style="--pa-colour: #a593d8">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Private conservation land" role="button" tabindex="0">↑ Private conservation lands</span>
</nav>
<h3 class="saanich-pa-summary-title">ȾIKEL</h3>
<p class="saanich-pa-summary-subtitle">Private conservation land · W̱SÁNEĆ Lands Trust Society · 19 hectares</p>
<p class="saanich-pa-summary-text">9 native species, 1 percent of the native plant diversity known to the peninsula, have been reported within ȾIKEL, the 9th richest of its 15 private conservation lands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>9</b>
<span>native species · 1% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>12</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Published Key Biodiversity Areas" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Key Biodiversity Areas</h3>
<p class="saanich-pa-summary-subtitle">14 published, 8 of them globally significant · 11 proposed · 781 hectares</p>
<p class="saanich-pa-summary-text">Key Biodiversity Areas mark the places that matter most for the persistence of species and ecosystems. The peninsula's Garry oak meadows, rocky headlands and islets hold 14 published Key Biodiversity Areas, most of them identified for their threatened plants, and 11 more are proposed. Together the published KBAs hold 52 percent of the native plant diversity known to the peninsula: 352 of its 674 native vascular plant species have been reported within them.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>352</b>
<span>native species · 52% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>43</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>19,657</b>
<span>records of native species</span>
</div>
</div>
<div class="saanich-pa-richest-holder">
<span class="saanich-pa-richest-title">Richest in native species</span>
<ol class="saanich-pa-richest">
<li>
<span class="saanich-pa-link" data-select="Uplands Park - Cattle Point" role="button" tabindex="0">Uplands Park - Cattle Point</span>
<b>213</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Fort Rodd Hill" role="button" tabindex="0">Fort Rodd Hill</span>
<b>175</b>
</li>
<li>
<span class="saanich-pa-link" data-select="Trial Islands" role="button" tabindex="0">Trial Islands</span>
<b>132</b>
</li>
</ol>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Christmas Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Christmas Hill</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 14 hectares</p>
<p class="saanich-pa-summary-text">78 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within Christmas Hill.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>78</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>4</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>1,114</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Durrance Lake - Cole Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Durrance Lake - Cole Hill</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for amphibians and reptiles, invertebrates · 199 hectares</p>
<p class="saanich-pa-summary-text">104 native species, 15 percent of the native plant diversity known to the peninsula, have been reported within Durrance Lake - Cole Hill.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>104</b>
<span>native species · 15% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>506</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Fort Rodd Hill" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Fort Rodd Hill</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 28 hectares</p>
<p class="saanich-pa-summary-text">175 native species, 26 percent of the native plant diversity known to the peninsula, have been reported within Fort Rodd Hill.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>175</b>
<span>native species · 26% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>22</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,180</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Gonzales Point" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Gonzales Point</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="saanich-pa-summary-text">34 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Gonzales Point.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>34</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>5</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>107</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Harling Point" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Harling Point</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="saanich-pa-summary-text">87 native species, 13 percent of the native plant diversity known to the peninsula, have been reported within Harling Point.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>87</b>
<span>native species · 13% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,696</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Kohweechela - Mary Tod Island" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Kohweechela - Mary Tod Island</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 3 hectares</p>
<p class="saanich-pa-summary-text">50 native species, 7 percent of the native plant diversity known to the peninsula, have been reported within Kohweechela - Mary Tod Island.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>50</b>
<span>native species · 7% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>8</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>223</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Sidney Island - Wymond Point" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Sidney Island - Wymond Point</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for nonvascular plants · 27 hectares</p>
<p class="saanich-pa-summary-text">34 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Sidney Island - Wymond Point.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>34</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>1</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>63</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="SḰŦÁMEN - North Sidney Island" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">SḰŦÁMEN - North Sidney Island</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for invertebrates, vascular plants · 144 hectares</p>
<p class="saanich-pa-summary-text">81 native species, 12 percent of the native plant diversity known to the peninsula, have been reported within SḰŦÁMEN - North Sidney Island.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>81</b>
<span>native species · 12% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>6</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>770</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Trafalgar Park" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Trafalgar Park</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 2 hectares</p>
<p class="saanich-pa-summary-text">43 native species, 6 percent of the native plant diversity known to the peninsula, have been reported within Trafalgar Park.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>43</b>
<span>native species · 6% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>3</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>121</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Trial Islands" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Trial Islands</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 19 hectares</p>
<p class="saanich-pa-summary-text">132 native species, 20 percent of the native plant diversity known to the peninsula, have been reported within Trial Islands.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>132</b>
<span>native species · 20% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>17</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>2,572</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="T̸IX̱EṈ - Cordova Shore" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">T̸IX̱EṈ - Cordova Shore</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for invertebrates, vascular plants · 140 hectares</p>
<p class="saanich-pa-summary-text">122 native species, 18 percent of the native plant diversity known to the peninsula, have been reported within T̸IX̱EṈ - Cordova Shore.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>122</b>
<span>native species · 18% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>7</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>1,382</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Uplands Park - Cattle Point" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Uplands Park - Cattle Point</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for vascular plants · 39 hectares</p>
<p class="saanich-pa-summary-text">213 native species, 32 percent of the native plant diversity known to the peninsula, have been reported within Uplands Park - Cattle Point.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>213</b>
<span>native species · 32% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>24</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>7,717</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="Witty's Beach" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">Witty's Beach</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Nationally significant for vascular plants · 3 hectares</p>
<p class="saanich-pa-summary-text">35 native species, 5 percent of the native plant diversity known to the peninsula, have been reported within Witty's Beach.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>35</b>
<span>native species · 5% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>2</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>121</b>
<span>records of native species</span>
</div>
</div>
</section>
<section class="saanich-pa-card-summary" data-key="ȽEL,TOS - James Island" hidden style="--pa-colour: #FDF2CE">
<nav class="saanich-pa-crumbs">
<span class="saanich-pa-link" data-select="" role="button" tabindex="0">← All protected areas</span>
<span class="saanich-pa-link" data-select="Published Key Biodiversity Areas" role="button" tabindex="0">↑ Key Biodiversity Areas</span>
</nav>
<h3 class="saanich-pa-summary-title">ȽEL,TOS - James Island</h3>
<p class="saanich-pa-summary-subtitle">Key Biodiversity Area · Globally significant for invertebrates, vascular plants · 159 hectares</p>
<p class="saanich-pa-summary-text">19 native species, 3 percent of the native plant diversity known to the peninsula, have been reported within ȽEL,TOS - James Island.</p>
<div class="saanich-pa-stats">
<div class="saanich-pa-stat">
<b>19</b>
<span>native species · 3% of the native flora</span>
</div>
<div class="saanich-pa-stat">
<b>5</b>
<span>species of conservation concern</span>
</div>
<div class="saanich-pa-stat">
<b>85</b>
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
<div class="saanich-howto">
<p>The map shows protected and conserved areas by category, with Key
Biodiversity Areas outlined in cream. Proposed Key Biodiversity Areas,
whose boundaries are not yet public, are marked by rings. Click an area
on the map, or in the chart below it, to show only the plants recorded
there and its summary above, or a category in the map’s legend or the
chart to show those recorded in all its areas. Protected areas are from
the <a href="https://www.canada.ca/en/environment-climate-change/services/national-wildlife-areas/protected-conserved-areas-database.html">Canadian
Protected and Conserved Areas Database</a> (Environment and Climate
Change Canada), and Key Biodiversity Areas from <a href="https://kbacanada.org/">KBA Canada</a> (CC BY-NC-SA 4.0).</p>
</div>
</div></div></div>
</template>
