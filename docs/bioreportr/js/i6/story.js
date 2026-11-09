/*
Copyright 2025-2026 Antranig Basman
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

/* global Papa */

// The story map of a bioReportR project, ported to Infusion 6 from reknit-client.js and imerss-viz-reknit.js of
// howe-sound-mapping-2026. Its panes are written by the project's src/js/storyBuild.js from the HTML knitted from its
// R Markdown. The pane shown is held in the URL's hash, from which the story page computes it before anything is
// rendered - see bioreportr-storyPage.vue - so that everything which depends on the pane - its tab, its section, the
// map's layers and camera, the filters - is first rendered for the pane the URL names.

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

// Namespaces of components defined in Single File Components, whose functions are defined here
fluid.registerNamespace("bioreportr.storyPage");
fluid.registerNamespace("bioreportr.storyPane");
fluid.registerNamespace("bioreportr.storyMap");
fluid.registerNamespace("bioreportr.pageFragment");

/**
 * The settings of a pane, which govern what the story page shows alongside it.
 * @typedef {Object} PaneSettings
 * @property {String} paneKey - The pane's key, the name of the R Markdown file it was knitted from
 * @property {String} title - The pane's title
 * @property {String} shortTitle - The pane's title as shown in its tab
 * @property {String} file - The file holding the pane's section, relative to the story's material
 * @property {String[]} layers - The names of the pane handler layers its front matter names, e.g. "reknitr.obsMapPaneHandler"
 * @property {Boolean} [visibleMap] - Whether the map is shown
 * @property {Boolean} [visibleGrid] - Whether the map's grid of observations is shown
 * @property {Boolean} [visibleFilters] - Whether the filters of observations are applied and shown
 * @property {Boolean} [visibleObsFilters] - Whether the panel of filters is shown
 * @property {Boolean} [visibleObsTable] - Whether the table of observations is shown
 * @property {Boolean} [visibleVizControls] - Whether the filters and checklist are shown
 * @property {Boolean} [visibleSolow] - Whether the controls of the extirpation risk analysis are shown
 * @property {String} [regionField] - The field of the region indirection table whose regions the pane's map shows
 * @property {String[]} [selectableRegions] - The ids of the layers of the pane's map which may be selected
 */

// The settings implied by each pane handler layer a pane's front matter may name, ported from the Infusion 4 grades
// of the same names
bioreportr.paneLayerDefaults = {
    "reknitr.obsMapPaneHandler": {
        visibleMap: true,
        visibleGrid: true,
        visibleFilters: true,
        visibleObsFilters: true,
        visibleObsTable: true,
        visibleVizControls: true
    },
    "reknitr.solowPaneHandler": {
        visibleMap: true,
        visibleVizControls: true,
        visibleSolow: true
    }
};

// The settings of a pane which names no layer - every setting has a value, so that one a pane lacks is not unavailable
bioreportr.paneBaseSettings = {
    visibleMap: false,
    visibleGrid: false,
    visibleFilters: false,
    visibleObsFilters: false,
    visibleObsTable: false,
    visibleVizControls: false,
    visibleSolow: false,
    regionField: null,
    selectableRegions: [],
    maxObsCountOverride: null,
    dataFile: null,
    // Sliders of the pane's data widgets which filter observations by year, each with members `widgetId`, and
    // optionally `animate` and `delay`
    sliders: [],
    // Whether the pane's data widgets are resized to the height of the data area as well as its width
    resizeHeight: false,
    // iNaturalist panels shown in the pane's data pane, each the options of bioreportr.iNatPanel.options
    iNatPanels: []
};

bioreportr.paneLayerDefaults["bioreportr.statusPaneHandler"] = bioreportr.paneLayerDefaults["reknitr.obsMapPaneHandler"];

/**
 * Compute the settings of each pane of a story, from the defaults of the layers named by its front matter, the front
 * matter itself, and any overrides supplied for it by the project.
 * @param {Object[]} paneRecords - The records of panes.json, as written by storyBuild.js
 * @param {Object<String, Object>} paneOverrides - Map of pane key to settings overriding those of the pane's record,
 * which may also name further layers
 * @return {PaneSettings[]} The settings of each pane, in order
 */
bioreportr.storyPage.paneSettings = function (paneRecords, paneOverrides) {
    return paneRecords.map(record => {
        const override = paneOverrides[record.paneKey] || {};
        const layers = [...record.layers, ...(override.layers || [])];
        const defaults = Object.assign({}, bioreportr.paneBaseSettings, ...layers.map(layer => bioreportr.paneLayerDefaults[layer] || {}));
        return {...defaults, ...record, ...override, layers};
    });
};

/**
 * Determine the pane to be shown - the one chosen, or else the first.
 * @param {String} [selectedPaneKey] - The key of the pane chosen, e.g. as held in the URL, if any is
 * @param {PaneSettings[]} panes - The settings of each pane
 * @return {String} The key of the pane to be shown
 */
bioreportr.storyPage.activePaneKey = function (selectedPaneKey, panes) {
    return panes.some(pane => pane.paneKey === selectedPaneKey) ? selectedPaneKey : panes[0].paneKey;
};

bioreportr.storyPage.activePane = (panes, activePaneKey) => panes.find(pane => pane.paneKey === activePaneKey);

/**
 * Show a pane. Since the story page's `selectedPaneKey` refers to the URL's hash, the write is applied to the hash.
 * @param {bioreportr.storyPage} that - The story page
 * @param {String} paneKey - The key of the pane to be shown
 */
bioreportr.storyPage.selectPane = function (that, paneKey) {
    that.selectedPaneKey = paneKey;
};

bioreportr.storyPane.url = (storyBase, file) => storyBase + file;

// Loaded once the observations are filtered, from genuine data rather than placeholders
bioreportr.storyPage.loaded = (finalFilteredObs, ...isPlaceholders) => !fluid.withPlaceholder.any(...isPlaceholders);

bioreportr.storyPage.isActive = (activePaneKey, paneKey) => activePaneKey === paneKey;

/**
 * Read the markup of a `<template>` element of the document holding a component, e.g. site navigation rendered into
 * the page by Hugo, which is to be rendered within the component's own template.
 * @param {Element} container - An element of the document
 * @param {String} templateId - The id of the `<template>` element
 * @return {String} The markup of its content, or the empty string if there is no such element
 */
bioreportr.pageFragment.markup = function (container, templateId) {
    const template = container.ownerDocument.getElementById(templateId);
    return template ? template.innerHTML : "";
};

/**
 * Fetch the text of a file.
 * @param {String} url - The URL of the file
 * @return {Promise<String>} A promise for the file's text
 */
bioreportr.fetchText = function (url) {
    return fetch(url).then(response => response.ok ? response.text() : Promise.reject(response.status + " " + response.statusText + " fetching " + url));
};

/**
 * Render any HTML widgets, e.g. plotly charts, within a pane which has been rendered, using the htmlwidgets library
 * which R's knitted output relies on. Each widget is rendered once - rendering every widget of the document, which
 * htmlwidgets does, skips those already rendered.
 * @param {Element} container - The pane's rendered container
 * @param {Object} [HTMLWidgets] - The htmlwidgets library
 * @return {Element[]|Unavailable} The widgets rendered, or an unavailable value if the library is not loaded
 */
bioreportr.storyPane.renderWidgets = function (container, HTMLWidgets) {
    let togo;
    if (HTMLWidgets) {
        HTMLWidgets.staticRender();
        togo = [...container.querySelectorAll(".html-widget")];
    } else {
        togo = fluid.unavailable({message: "The htmlwidgets library is not loaded", variety: "config"});
    }
    return togo;
};

/**
 * Show the layers of a story's map which belong to its active pane, by setting their opacity, and move the map's camera
 * to the pane's - jumping on the first occasion, and flying thereafter, slowly for a large change of zoom.
 * @param {bioreportr.storyMap} that - The map
 * @param {maplibregl.Map} map - The map, once its style has applied
 * @param {Object} mapData - The story's map data, as written by storyBuild.js
 * @param {String} activePaneKey - The key of the active pane
 */
bioreportr.storyMap.showPane = function (that, map, mapData, activePaneKey) {
    const paneMap = mapData.panes[activePaneKey];
    const visible = paneMap?.layers || {};
    mapData.style.layers.forEach(layer => {
        const opacityProp = bioreportr.storyMap.opacityProperty(layer);
        if (opacityProp && map.getLayer(layer.id)) {
            map.setPaintProperty(layer.id, opacityProp, visible[layer.id] ? layer.paint?.[opacityProp] ?? 1 : 0);
        }
    });
    if (paneMap?.center) {
        if (bioreportr.storyMap.placed.has(map)) {
            const zoomRatio = Math.abs(Math.log(map.getZoom() / paneMap.zoom));
            map.flyTo({center: paneMap.center, zoom: paneMap.zoom, essential: true,
                duration: zoomRatio > 0.3 ? that.slowZoomDuration : that.zoomDuration});
        } else {
            map.jumpTo({center: paneMap.center, zoom: paneMap.zoom});
            bioreportr.storyMap.placed.add(map);
        }
    }
};

// The maps whose camera has been placed, which subsequently fly rather than jump to each pane
bioreportr.storyMap.placed = new WeakSet();

bioreportr.storyMap.opacityProperty = function (layer) {
    return {line: "line-opacity", fill: "fill-opacity", raster: "raster-opacity"}[layer.type] || null;
};

/**
 * Download the observations surviving the filters as CSV.
 * @param {Object[]} rows - The observations
 */
bioreportr.storyPage.downloadObs = function (rows) {
    hortis.triggerDownload(Papa.unparse(rows), "text/csv;charset=utf-8;", "observations.csv");
};

/** Regions **/

/**
 * Select a region. Since the story page's `selectedRegion` refers to the URL's hash, the write is applied to the hash.
 * @param {bioreportr.storyPage} that - The story page
 * @param {String|null} region - The id of the region's layer, or null to clear the selection
 */
bioreportr.storyPage.selectRegion = function (that, region) {
    that.selectedRegion = region;
};

/**
 * Filter observations to those lying in the region selected on the map. The region is the label of rows of the region
 * indirection table, whose `regionField` names the column of the observations holding the region and whose `id` is
 * the value found there.
 * @param {Object[]} obsRows - The observations
 * @param {String|null} selectedRegion - The label of the selected region, or null if none is selected
 * @param {Object[]} indirectionRows - The rows of the region indirection table
 * @param {String[]} fieldNames - The columns of the table whose regions may be selected
 * @return {Object[]} The observations surviving the filter
 */
bioreportr.regionSelectionFilter = function (obsRows, selectedRegion, indirectionRows, fieldNames) {
    const rows = selectedRegion ? indirectionRows.filter(row => row.label === selectedRegion && fieldNames.includes(row.regionField)) : [];
    return selectedRegion ? obsRows.filter(obsRow => rows.some(row => obsRow[row.regionField] === row.id)) : obsRows;
};

/**
 * Find the selectable region under a map event, if any.
 * @param {maplibregl.Map} map - The map
 * @param {Object} event - A MapLibre mouse event
 * @param {String[]} selectableRegions - The ids of the layers of the active pane which may be selected
 * @return {String|null} The id of the region's layer, or null if there is none
 */
bioreportr.storyMap.eventToRegion = function (map, event, selectableRegions) {
    const features = map.queryRenderedFeatures(event.point);
    const match = features.find(feature => feature.layer.paint?.["fill-opacity"] > 0 && selectableRegions.includes(feature.layer.id));
    return match?.layer.id || null;
};

bioreportr.storyMap.handleRegionClick = function (storyPage, map, event, selectableRegions) {
    const region = bioreportr.storyMap.eventToRegion(map, event, selectableRegions);
    if (region) {
        storyPage.selectRegion(region);
    }
    return !!region;
};

/**
 * Outline the selected region on the map.
 * @param {maplibregl.Map} map - The map, once its style has applied
 * @param {String|null} selectedRegion - The id of the selected region's layer, whose source is of the same name
 */
bioreportr.storyMap.highlightRegion = function (map, selectedRegion) {
    if (map.getLayer("region-highlight")) {
        map.removeLayer("region-highlight");
    }
    if (selectedRegion && map.getSource(selectedRegion)) {
        map.addLayer({id: "region-highlight", type: "line", source: selectedRegion, paint: {"line-color": "yellow", "line-width": 3}});
    }
};

/** Legend of regions or statuses **/

/**
 * Compute the rows of the legend of the active pane's map - one per status, for a pane whose map is coloured by
 * reporting status, or else one per region of the pane's region field.
 * @param {PaneSettings} pane - The active pane
 * @param {Object[]} indirectionRows - The rows of the region indirection table
 * @param {Object[]} styleLayers - The layers of the map's style
 * @return {Object[]} The rows, each with members `key`, `label`, `colour` and `selects`, the selection it makes -
 * "status" or "region"
 */
bioreportr.storyMap.legendRows = function (pane, indirectionRows, styleLayers) {
    let togo = [];
    if (pane.regionField === "!statusAsRegion") {
        togo = Object.entries(pane.statusColors || {}).map(([label, colour]) => ({
            key: label === "historical" ? "unconfirmed" : label, label, colour, selects: "status"
        }));
    } else if (pane.regionField) {
        const layerById = Object.fromEntries(styleLayers.map(layer => [layer.id, layer]));
        togo = indirectionRows.filter(row => row.regionField === pane.regionField).map(row => ({
            key: row.label, label: row.label, colour: layerById[row.label]?.paint?.["fill-color"] || "transparent", selects: "region"
        }));
    }
    return togo;
};

/**
 * Render the markup of a legend.
 * @param {Object[]} rows - The legend's rows, as computed by `bioreportr.storyMap.legendRows`
 * @param {String|null} selectedStatus - The selected reporting status, if any
 * @param {String|null} selectedRegion - The selected region, if any
 * @return {String} The legend's markup
 */
bioreportr.storyMap.legendMarkup = function (rows, selectedStatus, selectedRegion) {
    return rows.map(row => {
        const selected = row.key === (row.selects === "status" ? selectedStatus : selectedRegion);
        return `<div class="imerss-legend-row${selected ? " imerss-selected" : ""}" data-key="${row.key}" data-selects="${row.selects}">` +
            "<span class=\"imerss-legend-icon\"></span>" +
            `<span class="imerss-legend-preview" style="background-color: ${row.colour}"></span>` +
            `<span class="imerss-legend-label">${row.label}</span></div>`;
    }).join("\n");
};

/**
 * Add an empty legend to a map as a control, whose rows select a status or region when clicked.
 * @param {maplibregl.Map} map - The map
 * @param {bioreportr.storyPage} storyPage - The story page, whose selection the rows make
 * @param {Document} dokkument - The document holding the map
 * @return {Object} The control, whose `container` is the legend's element
 */
bioreportr.storyMap.addRegionLegend = function (map, storyPage, dokkument) {
    const container = dokkument.createElement("div");
    container.classList.add("mxcw-legend", "mxcw-region-legend", "maplibregl-ctrl");
    container.addEventListener("click", event => {
        const row = event.target.closest("[data-key]");
        if (row && row.dataset.selects === "status") {
            storyPage.selectedStatus = row.dataset.key === storyPage.selectedStatus ? null : row.dataset.key;
        } else if (row) {
            storyPage.selectRegion(row.dataset.key);
        }
    });
    const control = {container, onAdd: () => container, onRemove: () => container.remove()};
    map.addControl(control, "bottom-right");
    return control;
};

bioreportr.storyMap.renderRegionLegend = function (control, markup) {
    control.container.innerHTML = markup;
    hortis.toggleClass(control.container, "mxcw-hidden", !markup);
};

/** Carto keys **/

/**
 * Substitute the Carto API key, written ${CARTO_API_KEY}, into the tile URLs of any source of a style whose key includes "carto-" - the key for
 * localhost when the page is served from there, and otherwise the project's.
 * @param {Object} style - The map's style
 * @param {Object<String, String>} cartoKeys - Map of "localhost" and "imerss" to Carto API keys
 * @param {Location} location - The location of the page
 * @return {Object} The style, with the keys substituted
 */
bioreportr.storyMap.styleWithCartoKeys = function (style, cartoKeys, location) {
    const key = cartoKeys[String(location?.href).includes("//localhost") ? "localhost" : "imerss"];
    const sources = fluid.transform(style.sources, (source, sourceKey) => sourceKey.includes("carto-") && source.tiles ?
        {...source, tiles: source.tiles.map(tile => tile.split("${CARTO_API_KEY}").join(key))} : source);
    return {...style, sources};
};

/** Data panes and their widgets **/

fluid.registerNamespace("bioreportr.dataPane");
fluid.registerNamespace("bioreportr.choroplethSlider");

/**
 * Fetch the markup of a pane's data widgets, if it has any.
 * @param {String} storyBase - The directory of the story's material
 * @param {String|null} dataFile - The file holding the widgets, or null if the pane has none
 * @return {String|Promise<String>} The markup, or the empty string if the pane has no widgets
 */
bioreportr.dataPane.fetch = function (storyBase, dataFile) {
    return dataFile ? bioreportr.fetchText(storyBase + dataFile) : "";
};

/**
 * Resize the plotly widgets of a data pane to the width of the data area whenever the pane is shown - a widget
 * rendered whilst hidden has no width.
 * @param {Element[]} widgets - The rendered widgets
 * @param {Boolean} active - Whether the pane is shown
 * @param {Boolean} resizeHeight - Whether the widgets are also resized to the height of the data area
 * @param {Object} [Plotly] - The plotly library
 */
bioreportr.dataPane.resize = function (widgets, active, resizeHeight, Plotly) {
    if (active && Plotly) {
        setTimeout(() => widgets.forEach(widget => {
            const holder = widget.closest(".mxcw-data");
            if (holder && holder.clientWidth > 0 && widget.layout) {
                Plotly.relayout(widget, resizeHeight ? {width: holder.clientWidth, height: holder.clientHeight} : {width: holder.clientWidth});
            }
        }), 0);
    }
};

/**
 * Find the widget driving a slider among a data pane's rendered widgets.
 * @param {Element[]} widgets - The rendered widgets
 * @param {String} widgetId - The `mx_widgetId` of the widget
 * @return {Element|Unavailable} The widget, or an unavailable value if it has not been rendered
 */
bioreportr.choroplethSlider.element = function (widgets, widgetId) {
    const widget = widgets.find(element => element.dataset.widgetId === widgetId);
    return widget && widget.layout ? widget : fluid.unavailable({message: "Widget " + widgetId + " has not been rendered", variety: "I/O"});
};

/**
 * Bind to the slider of a plotly widget, writing the index of its step into the slider component. If `animate` is
 * set, the slider steps on a timer whilst its pane is shown, until the user moves it.
 * @param {bioreportr.choroplethSlider} that - The slider component
 * @param {Element} element - The widget
 * @param {Object} Plotly - The plotly library
 * @return {Object} A record of the binding, to be supplied to `bioreportr.choroplethSlider.unbind`
 */
bioreportr.choroplethSlider.bind = function (that, element, Plotly) {
    const record = {element, timer: null};
    that.labels = element.layout.sliders[0].steps.map(step => step.label);
    that.sliderIndex = element.layout.sliders[0].active || 0;
    record.listener = e => {
        that.sliderIndex = e.slider.active;
        bioreportr.choroplethSlider.stop(record);
    };
    element.on("plotly_sliderchange", record.listener);
    if (that.slider.animate) {
        record.timer = setInterval(() => {
            if (that.isActive) {
                const sliders = element.layout.sliders[0];
                const next = (sliders.active + 1) % sliders.steps.length;
                Plotly.relayout(element, {"sliders.0.active": next});
                Plotly.restyle(element, {visible: sliders.steps[next].args[1]});
                that.sliderIndex = next;
            }
        }, that.slider.delay || 1000);
    }
    return record;
};

bioreportr.choroplethSlider.stop = function (record) {
    if (record.timer) {
        clearInterval(record.timer);
        record.timer = null;
    }
};

bioreportr.choroplethSlider.unbind = function (record) {
    record.element.removeListener?.("plotly_sliderchange", record.listener);
    bioreportr.choroplethSlider.stop(record);
};

bioreportr.choroplethSlider.filterState = function (labels, sliderIndex) {
    return labels.length > 0 ? +labels[sliderIndex] : null;
};

bioreportr.choroplethSlider.yearCache = function (obsRows) {
    return new Map(obsRows.map(row => [row, +String(row.eventDate).substring(0, 4)]));
};

/**
 * Filter observations to those made up to the year of the slider's step.
 * @param {Object[]} obsRows - The observations
 * @param {Number|null} filterState - The year, or null if the slider is not bound
 * @param {Map<Object, Number>} yearCache - The year of each observation
 * @return {Object[]} The observations surviving the filter
 */
bioreportr.choroplethSlider.doFilter = function (obsRows, filterState, yearCache) {
    return filterState === null ? obsRows : obsRows.filter(row => yearCache.get(row) <= filterState);
};

/** iNaturalist panels **/

fluid.registerNamespace("bioreportr.iNatPanel");

// The options of an iNaturalist panel, as rendered by @imerss/inat-components, which a pane's settings refine - ported
// from bioreportr.iNatComponentsPaneHandler in paneHandlers.js
bioreportr.iNatPanel.defaults = {
    dataSource: "autoLoad",
    itemWidth: 180,
    features: [
        {feature: "recentObservations", numResults: 40},
        {feature: "commonTaxa", numResults: 40, numYears: 10},
        {feature: "favourites", numResults: 40, numYears: 10},
        {feature: "stats", numTopObservers: 10, observersListClass: "inat-observers-list", statsCountSummaryClass: "inat-stats-count-summary"}
    ],
    generalClasses: {
        tabsElement: "inat-tabs",
        yearsDropdown: "inat-years-dropdown",
        pageHeadings: "inat-page-headings",
        observationLabelTitle: "inat-observation-label-title",
        observationLabelDate: "inat-observation-label-data",
        observationLabelName: "inat-observation-label-name",
        tabDesc: "inat-tab-desc"
    }
};

/**
 * Compute the options of an iNaturalist panel, merging those of a pane onto the defaults - each of its features onto
 * the default feature at the same position.
 * @param {Object} options - The pane's options, e.g. with members `taxon`, `place` and `features`
 * @return {Object} The options of the panel
 */
bioreportr.iNatPanel.options = function (options) {
    const defaults = bioreportr.iNatPanel.defaults;
    const features = defaults.features.map((feature, i) => ({...feature, ...(options.features || [])[i]}));
    return {...defaults, ...options, features};
};

/**
 * Render an iNaturalist panel into its container, which the library thereafter owns.
 * @param {fluid.component} that - The panel's component
 * @param {Element} container - The panel's rendered container
 * @param {String} containerId - The id of the container, by which the library finds it
 * @param {Object} options - The panel's options
 * @param {Object} [inatComponents] - The @imerss/inat-components library
 * @return {Boolean|Unavailable} `true` once rendered, or an unavailable value if the library is not loaded
 */
bioreportr.iNatPanel.bind = function (that, container, containerId, options, inatComponents) {
    let togo;
    if (inatComponents) {
        fluid.disableRendering(that);
        container.id = containerId;
        inatComponents.initTaxonPanel(containerId, fluid.copy(options));
        togo = true;
    } else {
        togo = fluid.unavailable({message: "The inat-components library is not loaded", variety: "config"});
    }
    return togo;
};
