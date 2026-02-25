"use strict";

/* global Plotly */

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var reknitr = fluid.registerNamespace("reknitr");

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

/**
 * An integer
 *
 * @typedef {Number} Integer
 */

/**
 * A "call" structure instantiating an HTMLWidget
 *
 * @typedef {Object} HTMLWidgetCall
 * @property {String} method - The name of the method call
 * @property {Object[]} args - The arguments to the call
 */

/**
 * Information about a section element of a storymapping interface
 *
 * @typedef {Object} SectionHolder
 * @property {String} paneName - The name of the paneHandler for this section
 * @property {HTMLElement} section - The section node housing the widget
 * @property {HTMLElement} heading - The heading (currently h2 node) housing the widget
 * @property {String} headingText - The text of the heading node
 */

/**
 * Decoded information about a storymapping map widget
 *
 * @typedef {SectionHolder} MapWidgetInfo
 * @property {HTMLElement} [widget] - The DOM node holding the widget
 * @property {Object} data - The `data` entry associated with the map widget
 * @property {Array} subPanes - Any subpanes to which the widget's calls are allocated
 */

fluid.defaults("reknitr.widgetHandler", {
    gradeNames: "fluid.component",
    widgetKey: "{sourcePath}",
    events: {
        bindWidget: null
    },
    listeners: {
        "bindWidget.first": {
            priority: "first",
            func: "reknitr.widgetHandler.bindFirst"
        }
    }
});

reknitr.widgetHandler.bindFirst = function (element, that) {
    that.element = element;
};

fluid.defaults("reknitr.withResizableWidth", {
    // TODO: Was .mxcw-widgetPane
    resizableParent: ".mxcw-sectionColumn",
    listeners: {
        "bindWidget.makeResizable": {
            func: "reknitr.makeResizableWidth",
            args: ["{arguments}.0", "{paneHandler}", "{that}.options.resizableParent"]
        }
    }
});

reknitr.findPlotlyWidgetId = function (widget) {
    return widget.layout?.meta?.mx_widgetId;
};

reknitr.makeResizableWidth = function (element, paneHandler, selector) {
    // TODO: remove listener on destruction
    window.addEventListener("resize", function () {
        const parent = element.closest(selector);
        const newWidth = parent.clientWidth;
        if (newWidth > 0) {
            Plotly.relayout(element, {width: newWidth});
        }
    });
};

fluid.defaults("reknitr.choroplethSlider", {
    gradeNames: "reknitr.widgetHandler",
    listeners: {
        "bindWidget.impl": "reknitr.choroplethSlider.bind"
    }
});

reknitr.choroplethSlider.bind = function (element, that, paneHandler, storyPage) {
    const slider = element;
    const paneIndex = paneHandler.options.paneIndex;
    // TODO: apply this coordinate to index of queries via some kind of declarative reactive binding
    return;

    slider.on("plotly_sliderchange", function (e) {
        console.log("Slider change ", e);
        storyPage.applier.change(["activeSubPanes", paneIndex], e.slider.active);
        if (that.timer) {
            window.clearInterval(that.timer);
            delete that.timer;
        }
    });
    // Initialises with the assumption that the 0th subpane should be initially active - makes sense for choropleths
    // but what about others?
    storyPage.applier.change(["activeSubPanes", paneIndex], 0);
};

fluid.defaults("reknitr.withSliderAnimation", {
    delay: 1000,
    listeners: {
        "bindWidget.withSliderAnimation": {
            priority: "after:impl",
            funcName: "reknitr.withSliderAnimation.bind"
        }
    }
});

reknitr.withSliderAnimation.bind = function (element, that, paneHandler, storyPage) {
    const limit = element.data.length;
    const paneIndex = paneHandler.options.paneIndex;
    // TODO: We no longer maintain activeSubPanes, put this somewhere else
    return;
    that.timer = window.setInterval(function () {
        const current = storyPage.model.activeSubPanes[paneIndex];
        const next = (current + 1) % limit;
        // This updates the slider position and label, but not the plot
        Plotly.relayout(element, {"sliders.0.active": next});
        // This updates visibility of the plot - unknown why this doesn't happen from the former
        Plotly.restyle(element, {visible: element.layout.sliders[0].steps[next].args[1]});
        storyPage.applier.change(["activeSubPanes", paneIndex], next);
    }, that.options.delay);
};

reknitr.findPlotlyWidgets = function (storyPage, sectionHolders) {
    const widgets = [...document.querySelectorAll(".html-widget.plotly")];
    const sections = fluid.getMembers(sectionHolders, "section");

    console.log("Found " + widgets.length + " plotly widgets");
    widgets.forEach(function (widget) {
        const pane = widget.closest(".section");
        const widgetId = reknitr.findPlotlyWidgetId(widget);
        const index = sections.indexOf(pane);

        console.log("Plotly widget's pane index is " + index + " with id " + widgetId);
        const paneName = storyPage.sectionHolders[index].paneName;
        const paneHandler = paneName && reknitr.paneHandlerForName(storyPage, paneName);
        if (widgetId) {
            const handler = reknitr.widgetHandlerForName(paneHandler, widgetId);
            if (handler) {
                handler.events.bindWidget.fire(widget, handler, paneHandler, storyPage, paneHandler);
            } else {
                console.log("No widget handler configured for widget with id ", widgetId);
            }
        } else {
            console.log("Warning: no widget id found for plotly widget ", widget);
        }
    });
};

fluid.defaults("reknitr.withNativeLegend", {
    modelListeners: {
        legendVisible: {
            path: "{paneHandler}.model.isVisible",
            func: "reknitr.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{change}.value", true]
        }
    }
});

reknitr.decodePaneName = function (node) {
    const nameHolder = [...node.classList].find(clazz => clazz.startsWith("mxcw-paneName-"));
    return nameHolder.substring("mxcw-paneName-".length);
};

// Index the collection of sectionHolder structure by paneHandlerName
reknitr.sectionHoldersToIndex = function (sectionHolders) {
    const togo = {};
    sectionHolders.forEach(function (sectionHolder, index) {
        togo[sectionHolder.paneName] = index;
    });
    return togo;
};

/**
 * Decodes the document structure surrounding an array of DOM nodes representing map widgets
 * @param {reknitr.storyPage} storyPage - The overall storyPage component
 * @return {SectionHolder[]} An array of structures representing the section holders
 */
reknitr.mapSectionHolders = function (storyPage) {
    const sections = storyPage.locate("sections");
    console.log("Found " + sections.length + " sections");
    const togo = [...sections].map(function (section) {
        const heading = section.querySelector("h2");
        const paneNameHolder = section.querySelector(".mxcw-mapPane");
        const paneName = reknitr.decodePaneName(paneNameHolder);
        return {
            section, heading, paneName,
            subPanes: [],
            headingText: heading.innerText
        };
    });
    return togo;
};


// Search through an HTMLWidgets "calls" structure for a method with particular name
reknitr.findCall = function (calls, method) {
    return calls.find(call => call.method === method);
};

reknitr.toggleClass = function (container, clazz, value, inverse) {
    container.classList[value ^ inverse ? "add" : "remove"](clazz);
};

reknitr.toggleActiveClass = function (nodes, clazz, selectedIndex) {
    nodes.forEach(function (node, i) {
        reknitr.toggleClass(node, clazz, i === selectedIndex);
    });
};

reknitr.normaliseBounds = function (bounds) {
    return [+bounds[0], +bounds[1], +bounds[2], +bounds[3]];
};

reknitr.expandBounds = function (bounds, factor) {
    const [lat1, long1, lat2, long2] = reknitr.normaliseBounds(bounds);

    // Calculating the central point of the bounding box
    const centerLat = (lat1 + lat2) / 2;
    const centerLong = (long1 + long2) / 2;

    // Calculating the new dimensions of the bounding box
    const newLat1 = centerLat - (centerLat - lat1) * factor;
    const newLong1 = centerLong - (centerLong - long1) * factor;
    const newLat2 = centerLat + (lat2 - centerLat) * factor;
    const newLong2 = centerLong + (long2 - centerLong) * factor;

    // Creating and returning the expanded bounds array
    return [newLat1, newLong1, newLat2, newLong2];
};

reknitr.paneKeyToIndex = function (handler, storyPage) {
    const key = fluid.getForComponent(handler, "options.paneKey");
    const paneKeyToIndex = fluid.getForComponent(storyPage, "paneKeyToIndex");
    const index = paneKeyToIndex[key];
    if (index === undefined) {
        fluid.fail("Unable to look up section handler with name " + key + " to a data pane index");
    }
    return index;
};

/**
 * Given a paneHandler component, find its section holder
 * @param {reknitr.paneHandler} handler - The paneHandler to be looked up
 * @param {reknitr.storyPage} storyPage - The overall storyPage component
 * @return {jQuery} A jQuery-wrapped container node suitable for instantiating a component.
 */
reknitr.sectionForPaneHandler = function (handler, storyPage) {
    const index = reknitr.paneKeyToIndex(handler, storyPage);
    return fluid.container(storyPage.sectionHolders[index].section);
};

reknitr.paneHandlerForRegion = function (storyPage, region) {
    const paneHandlers = fluid.queryIoCSelector(storyPage, "reknitr.paneHandler", true);
    return paneHandlers.find(handler => fluid.getForComponent(handler, "options.selectRegion") === region);
};

reknitr.paneHandlerForName = function (storyPage, paneName) {
    const paneHandlers = fluid.queryIoCSelector(storyPage, "reknitr.paneHandler", true);
    return paneHandlers.find(handler => fluid.getForComponent(handler, "options.paneKey") === paneName);
};

reknitr.paneHandlerForIndex = function (storyPage, paneIndex) {
    const paneHandlers = fluid.queryIoCSelector(storyPage, "reknitr.paneHandler", true);
    return paneHandlers.find(handler => fluid.getForComponent(handler, "options.paneIndex") === paneIndex);
};

reknitr.widgetHandlerForName = function (paneHandler, widgetId) {
    const widgetHandlers = fluid.queryIoCSelector(paneHandler, "reknitr.widgetHandler", true);
    return widgetHandlers.find(handler => fluid.getForComponent(handler, "options.widgetKey") === widgetId);
};

reknitr.applyContentClass = function (hash, contentClass) {
    // TODO: split on space or iterate array etc.
    if (contentClass) {
        hash[contentClass] = true;
    }
};

reknitr.computeAllContentClassHash = function (storyPage) {
    const paneHandlers = fluid.queryIoCSelector(storyPage, "reknitr.paneHandler", true);
    const contentClassHash = {};
    paneHandlers.map(paneHandler => fluid.getForComponent(paneHandler, ["options", "contentClass"]))
        .forEach(contentClass => reknitr.applyContentClass(contentClassHash, contentClass));
    return contentClassHash;
};

reknitr.unflattenOptions = function (records) {
    return fluid.transform(records, record => ({
        type: record.type,
        options: fluid.censorKeys(record, ["type"])
    }));
};

reknitr.resolvePaneHandlers = function () {
    // Written into the markup by reknitr.reknitFile in reknit.js
    const rawPaneHandlers = reknitr.rawPaneHandlers;
    return reknitr.unflattenOptions(rawPaneHandlers);
};

hortis.libreMap.layerToLabel = function (layers) {
    return Object.fromEntries(layers.filter(layer => layer.label).map(layer => [layer.id, layer.label]));
};

fluid.defaults("hortis.libreMap.withRegions", {
    gradeNames: ["hortis.withTooltip"],
    members: {
        selectedRegion: "@expand:signal()",
        hoverRegion: "@expand:signal(null)",
        layerToLabel: "@expand:hortis.libreMap.layerToLabel({that}.options.mapOptions.style.layers)"

    },
    tooltipKey: "hoverRegion",
    invokers: {
        renderTooltip: {
            args: ["{that}.layerToLabel", "{arguments}.0"],
            func: (layerToLabel, id) => {
                const label = layerToLabel[id];
                return label ? `<div class="imerss-tooltip">${label}</div>` : null;
            }
        }
    },
    modelListeners: {
        paneToRegion: {
            path: "{storyPage}.model.activePane",
            args: ["{storyPage}", "{map}", "{change}.value"],
            funcName: "reknitr.paneToRegion"
        }
    },
    listeners: {
        "onCreate.bindRegionSelect": "hortis.libreMap.bindRegionSelect({that})"
    }
});

reknitr.paneToRegion = function (storyPage, map, activePane) {
    const paneHandler = reknitr.paneHandlerForIndex(storyPage, activePane);
    const selectRegion = paneHandler?.options.selectRegion;
    map.selectedRegion.value = selectRegion;
};

hortis.libreMap.layersToLabels = function (layers) {
    return Object.fromEntries(layers.filter(layer => layer.label).map(layer => [layer.id, layer.label]));
};

hortis.libreMap.bindRegionSelect = function (that) {
    const map = that.map;
    that.options.selectableRegions.forEach(selectableRegion => {
        map.on("click", selectableRegion, (e) => {
            console.log("Region ", selectableRegion, " clicked: ", e);
            that.selectedRegion.value = selectableRegion;
        });
        // https://stackoverflow.com/a/59203845
        map.on("mouseenter", selectableRegion, () => {
            map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", selectableRegion, () => {
            map.getCanvas().style.cursor = "";
        });
    });

    map.on("mousemove", (e) => {
        const features = map.queryRenderedFeatures(e.point);
        const visibleFeatures = features.filter(feature => feature.layer.paint["fill-opacity"] > 0);
        that.hoverEvent = e.originalEvent;
        that.hoverRegion.value = visibleFeatures[0]?.layer.id || null;
    });

    map.getCanvas().addEventListener("mouseleave", () => hortis.clearAllTooltips(that));
};

fluid.defaults("hortis.libreMap.regionLegend", {
    gradeNames: "fluid.component",
    members: {
        regionRows: "{vizLoader}.regionLoader.rows",
        control: "@expand:reknitr.legendKey.addLegendControl({map}, {that}.regionRows, {that}.isVisible)",
        isVisible: "@expand:signal(true)"
    }
});

fluid.defaults("hortis.libreMap.withRegionLegend", {
    components: {
        legend: {
            type: "hortis.libreMap.regionLegend"
        }
    }
});

reknitr.resolveMapboxData = function () {
    const data = reknitr.mapboxData;
    return fluid.copyImmutableResource(data);
};

fluid.defaults("hortis.libreMap.withMapboxData", {
    mapOptions: {
        style: "{that}.options.mapboxData.rootMap.x.layout.mapbox.style"
    }
});

fluid.defaults("reknitr.storyPage", {
    gradeNames: ["fluid.viewComponent", "fluid.resourceLoader"],
    container: "body",
    // zoomDuration: 100,
    // selectableRegions: [],
    // fillPatternPath
    // mapFlavourGrade
    resources: {
        plotlyReady: {
            promiseFunc: "reknitr.HTMLWidgetsPostRender"
        }
    },
    //mapFlavourGrade: [],
    selectors: {
        sections: ".section.level2",
        heading: "h2",
        map: ".mxcw-map",
        mapHolder: ".mxcw-map-holder",
        contentHolder: ".mxcw-content-holder",
        content: ".mxcw-content",
        sectionLeft: ".section-left",
        sectionLeftDesc: ".section-left-desc",
        sectionLeftText: ".section-left-text",
        sectionRight: ".section-right",
        sectionRightDesc: ".section-right-desc",
        sectionRightText: ".section-right-text"
    },
    components: {
        map: {
            type: "hortis.libreMap",
            options: {
                gradeNames: ["hortis.libreMap.inStoryPage", "{storyPage}.options.mapFlavourGrade"]

            }
        },
        hashManager: {
            type: "reknitr.hashManager"
        }
    },
    paneHandlers: "@expand:reknitr.resolvePaneHandlers()",
    dynamicComponents: {
        paneHandlers: {
            sources: "{that}.options.paneHandlers",
            type: "{source}.type",
            options: "{source}.options"
        }
    },
    members: {
        // Special flag used in reknitr.updateActiveMapPane due to lack of zoom callback API
        mapHasBounds: false,
        sectionHolders: "@expand:reknitr.mapSectionHolders({that})",
        paneKeyToIndex: "@expand:reknitr.sectionHoldersToIndex({that}.sectionHolders)",
        navRangeHolder: "@expand:reknitr.storyPage.navRangeHolder({that})",
        allContentClassHash: "@expand:reknitr.computeAllContentClassHash({that})",
        activePane: "@expand:signal()",
        // "model listeners"
        updateActiveMapPane: "@expand:fluid.effect(reknitr.updateActiveMapPane, {that}, {that}.map, {that}.activePane, {that}.map.mapLoaded)"
    },
    invokers: {
        navSection: "reknitr.navSection({that}.navRangeHolder, {arguments}.0, {arguments}.1)"
    },
    model: {
        // Currently this is at the head of updates - > activePane in model and then activePane signal
        activeSection: 0,
        activePane: 0,
        // Map of pane indices to active subpanes
        activeSubPanes: [],
        // Prevent the component trying to render until plotly's postRenderHandler has fired
        plotlyReady: "{that}.resources.plotlyReady.parsed"
    },
    modelListeners: {
        updateSectionClasses: {
            path: "activeSection",
            funcName: "reknitr.updateSectionClasses",
            args: ["{that}", "{change}.value"]
        },
        updateSectionNav: {
            path: "activeSection",
            funcName: "reknitr.updateSectionNav",
            args: ["{that}", "{change}.value"]
        },
        // Transmit the activePane model to the corresponding signal
        updateActivePaneSignal: {
            path: "activePane",
            args: ["{that}.activePane", "{change}.value"],
            func: (activePaneSignal, activePane) => {activePaneSignal.value = activePane;},
            priority: "last"
        },
        mapVisible: {
            path: "activePane",
            funcName: "reknitr.updateMapVisible",
            args: ["{that}", "{change}.value"],
            priority: "first" // ensure map becomes visible before we attempt to set its initial bounds
        },/*
        // TODO move to withLegend, hoist up
                legendVisible: {
            path: "activePane",
            funcName: "reknitr.updateLegendVisible",
            args: ["{that}", "{change}.value"],
            priority: "first"
        },*/
        contentClass: {
            path: "activePane",
            funcName: "reknitr.updateContentClass",
            args: ["{that}", "{change}.value"]
        },
        updatePaneHash: {
            // Close any open taxon panel - perhaps better to react to a change in activeSection instead,
            // but we will still have the standard difficulty of distinguishing an initial value
            path: "activePane",
            funcName: "reknitr.updatePaneHash",
            args: ["{storyPage}", "{hashManager}", "{change}.value"],
            excludeSource: "init"
        },
        listenPaneHash: {
            path: "{hashManager}.model.pane",
            funcName: "reknitr.listenPaneHash",
            args: ["{storyPage}", "{change}.value"]
        }
    },
    modelRelay: {
        // TODO: Abolish activePane since we can't trigger updates from it
        sectionToPane: {
            source: "activeSection",
            target: "activePane",
            funcName: "fluid.identity"
        }
    },
    listeners: {
        "onCreate.listenSectionButtons": "reknitr.listenSectionButtons({that})",
        // This will initialise subPaneIndices quite late
        "onCreate.findPlotlyWidgets": "reknitr.findPlotlyWidgets({that}, {that}.sectionHolders)"
    }
});

// Convert the HTMLWidgets postRenderHandler into a promise
reknitr.HTMLWidgetsPostRender = function () {
    const togo = fluid.promise();
    if (window.HTMLWidgets?.addPostRenderHandler) {
        window.HTMLWidgets.addPostRenderHandler(function () {
            togo.resolve(true);
        });
    } else {
        togo.resolve(true);
    }
    return togo;
};

reknitr.updateSectionClasses = function (that, activeSection) {
    reknitr.toggleActiveClass(that.sectionHolders.map(sectionHolder => sectionHolder.section), "mxcw-activeSection", activeSection);
};

reknitr.updatePaneHash = function (storyPage, hashManager, paneIndex) {
    const paneHandler = reknitr.paneHandlerForIndex(storyPage, paneIndex);
    const paneKey = paneHandler.options.paneKey;
    if (!fluid.globalInstantiator.hashSource) {
        // Blast the taxon in the hash since taxon selected for one panel will not be good for another
        fluid.replaceModelValue(hashManager.applier, [], {pane: paneKey, taxon: null});
    }
};

reknitr.listenPaneHash = function (storyPage, paneName) {
    const paneHandler = reknitr.paneHandlerForName(storyPage, paneName);
    const paneIndex = paneHandler ? paneHandler.options.paneIndex : 0;
    // TODO: Abolish distinction between pane indices and section indices
    storyPage.applier.change("activeSection", paneIndex);
};

reknitr.layerOpacityProperty = function (layer) {
    return layer.type === "line" ? "line-opacity" :
        layer.type === "fill" ? "fill-opacity" : null;
};

reknitr.updateActiveMapPane = function (that, map, activePane) {
    const activePaneName = that.sectionHolders[activePane]?.paneName;

    const mapboxData = map.options.mapboxData;

    const layers = map.options.mapOptions.style.layers;
    const layerVisibility = mapboxData.layersByPaneId[activePaneName] || {};
    layers.forEach((layer) => {
        const opacityProp = reknitr.layerOpacityProperty(layer);
        if (opacityProp) {
            // TODO: possible optimisation here from maplibre-gl-dev.js
            //         this.style.setPaintProperty(layerId, name, value, options);
            //         return this._update(true);
            const origOpacity = layer.paint[opacityProp];
            map.map.setPaintProperty(layer.id, opacityProp, layerVisibility[layer.id] ? origOpacity : 0);
        }
    });

    // TODO: Perhaps assign these into paneHandlers if frequently used?
    const widgetData = mapboxData.mapWidgets[activePaneName]?.x.layout.mapbox;
    const currentZoom = map.map.getZoom();

    // Pretty terrible, there is no longer an ability to specify a callback: https://github.com/mapbox/mapbox-gl-js/issues/1794
    // API docs claim "maxDuration" but there is not
    const zoom = fluid.promise();
    if (widgetData) {
        if (map.hasBounds) {
            const zoomRatio = Math.abs(Math.log(currentZoom / widgetData.zoom));
            // For zooms greater than a certain magnitude, do a much slower zoom
            const zoomDuration = zoomRatio > 0.3 ? that.options.slowZoomDuration : that.options.zoomDuration;
            map.map.flyTo({
                center: widgetData.center,
                zoom: widgetData.zoom,
                duration: zoomDuration,
                // Awkward to override the prefersReducedMotion setting but taking OS setting by default seems too severe
                essential: true
            });
            map.map.once("moveend", () => {
                zoom.resolve();
            });
        } else {
            map.map.jumpTo({
                center: widgetData.center,
                zoom: widgetData.zoom
            });
            map.hasBounds = true;
            zoom.resolve();
        }
    } else {
        zoom.resolve();
    }

    zoom.then(function () {
        // TODO: We probably just want this to happen immediately
        // This is a hack to cause SVG plotly widgets to resize themselves e.g. the Species Reported bar -
        // find a better solution
        window.dispatchEvent(new Event("resize"));
    });
};

reknitr.updateMapVisible = function (that, activePane) {
    const paneHandler = reknitr.paneHandlerForIndex(that, activePane);
    if (!paneHandler) {
        fluid.fail("No pane handler found for section with index ", activePane);
    }
    const isVisible = !fluid.componentHasGrade(paneHandler, "reknitr.mapHidingPaneHandler");
    reknitr.toggleClass(that.dom.locate("mapHolder")[0], "mxcw-hideMap", isVisible, true);
};

reknitr.updateLegendVisible = function (that, activePane) {
    const paneHandler = reknitr.paneHandlerForIndex(that, activePane);
    if (!paneHandler) {
        fluid.fail("No pane handler found for section with index ", activePane);
    }
    const hideLegend = paneHandler.options.hideLegend;
    that.map.legend.isVisible.value = !hideLegend;
};

reknitr.updateContentClass = function (that, activePane) {
    const paneHandler = reknitr.paneHandlerForIndex(that, activePane);
    const hash = fluid.transform(that.allContentClassHash, () => false);
    reknitr.applyContentClass(hash, paneHandler.options.contentClass);
    Object.entries(hash).forEach(([clazz, state]) => {
        reknitr.toggleClass(that.locate("contentHolder")[0], clazz, state);
    });
};

// Compute the destination section for a navigation operation, given a "Range" record, the current active section and the desired offset
reknitr.navSection = function (navRangeHolder, activeSection, offset) {
    const navRangeIndex = navRangeHolder.indexToRange[activeSection];
    const navRange = navRangeHolder.navRanges[navRangeIndex];
    const navIndex = navRange.indexOf(activeSection);
    return navRange[navIndex + offset];
};

reknitr.storyPage.navRangeHolder = function (storyPage) {
    // Just support a single "navRange" - this was a complexity generated for Xetthecum
    const navRanges = [Object.values(storyPage.paneKeyToIndex)];
    const indexToRange = fluid.generate(navRanges[0].length, 0);

    return {navRanges, indexToRange};
};


reknitr.listenSectionButtons = function (that) {
    const sectionLeft = that.locate("sectionLeft")[0];
    sectionLeft.addEventListener("click", () => {
        const activeSection = that.model.activeSection;
        const navLeft = that.navSection(activeSection, -1);
        if (navLeft !== undefined) {
            that.applier.change("activeSection", navLeft);
        }
    });
    const sectionRight = that.locate("sectionRight")[0];
    sectionRight.addEventListener("click", () => {
        const activeSection = that.model.activeSection;
        const navRight = that.navSection(activeSection, 1);
        if (navRight !== undefined) {
            that.applier.change("activeSection", navRight);
        }
    });
};

reknitr.updateSectionNav = function (that, activeSection) {
    const l = (selector) => that.locate(selector)[0];
    const navLeft = that.navSection(activeSection, -1);
    const first = navLeft === undefined;
    const navRight = that.navSection(activeSection, 1);
    const last = navRight === undefined;

    reknitr.toggleClass(l("sectionLeft"), "disabled", first);
    l("sectionLeftText").innerText = first ? "" : that.sectionHolders[navLeft].headingText;
    reknitr.toggleClass(l("sectionLeftDesc"), "mxcw-hidden", first);
    const paneHandlerLeft = reknitr.paneHandlerForIndex(that, navLeft);
    l("sectionLeft").style.setProperty("--section-circle-fill", paneHandlerLeft?.options.sectionButtonFill || "#eee");

    reknitr.toggleClass(l("sectionRight"), "disabled", last);
    l("sectionRightText").innerText = last ? "" : that.sectionHolders[navRight].headingText;
    reknitr.toggleClass(l("sectionRightDesc"), "mxcw-hidden", last);
    const paneHandlerRight = reknitr.paneHandlerForIndex(that, navRight);
    l("sectionRight").style.setProperty("--section-circle-fill", paneHandlerRight?.options.sectionButtonFill || "#eee");
};

// Base definitions

fluid.defaults("reknitr.paneHandler", {
    gradeNames: "fluid.viewComponent",
    // TODO: normalise paneKey -> paneName
    paneKey: "{sourcePath}",
    paneIndex: "@expand:reknitr.paneKeyToIndex({that}, {reknitr.storyPage})",
    members: {
        container: "@expand:reknitr.sectionForPaneHandler({that}, {reknitr.storyPage})",
        isVisible: "@expand:signal()"
    },
    modelListeners: {
        isVisibleToSignal: {
            path: "isVisible",
            args: ["{that}.isVisible", "{change}.value"],
            func: (isVisibleSignal, isVisible) => isVisibleSignal.value = isVisible
        },
        stopMedia: {
            path: "isVisible",
            args: ["{that}.options.parentContainer.0", "{change}.value"],
            func: "reknitr.stopMedia"
        }
    },

    modelRelay: {
        isVisible: {
            args: ["{reknitr.storyPage}.model.activePane", "{that}.options.paneIndex"],
            func: (activePane, paneIndex) => activePane === paneIndex,
            target: "isVisible"
        }
    },
    listeners: {
        "onCreate.addPaneClass": "reknitr.paneHandler.addPaneClass({that}, {that}.options.parentContainer)"
    },
    resolvedWidgets: "@expand:reknitr.unflattenOptions({that}.options.widgets)",
    dynamicComponents: {
        widgets: {
            sources: "{that}.options.resolvedWidgets",
            type: "{source}.type",
            options: "{source}.options"
        }
    },
    // For consistency when binding from withPaneInfo
    parentContainer: "{that}.container"
});

reknitr.stopMedia = function (container, isVisible) {
    if (!isVisible) {
        const audios = [...container.querySelectorAll("audio")];
        audios.forEach(audio => audio.pause());
    }
};

reknitr.paneHandler.addPaneClass = function (that, parentContainer) {
    parentContainer[0].classList.add("mxcw-widgetPane-" + that.options.paneKey);
};

fluid.defaults("reknitr.librePaneHandler", {
    gradeNames: "reknitr.paneHandler"
});

// Tag interpreted by reknitr.updateMapVisible
fluid.defaults("reknitr.mapHidingPaneHandler", {
});

fluid.defaults("reknitr.templatePaneHandler", {
    gradeNames: ["reknitr.paneHandler", "fluid.templateRenderingView"],
    parentContainer: "@expand:reknitr.sectionForPaneHandler({that}, {reknitr.storyPage})"
});

fluid.defaults("hortis.vizLoader.withRegions", {
    gradeNames: "hortis.vizLoader",
    components: {
        regionLoader: {
            type: "hortis.csvReader",
            options: {
                url: "{vizLoader}.options.regionFile"
            }
        }
    }
});

fluid.defaults("reknitr.hashManager", {
    gradeNames: "fluid.modelComponent",
    listeners: {
        "onCreate.listenHash": "reknitr.hashManager.listenHash"
    },
    invokers: {
        applyHash: "reknitr.hashManager.applyHash({that}, {arguments}.0)"
    },
    members: {
        // We don't get a notification on startup, ingest any hash present in the initial URL, but delay to avoid
        // confusing initial model resolution and map loading TODO improve with initial model merging if we can
        applyHashOnResources: "@expand:fluid.effect({that}.applyHash, load, {vizLoader}.resourcesLoaded)"
    },
    modelListeners: {
        "pushState": {
            path: "",
            funcName: "reknitr.hashManager.listenModel",
            args: ["{that}", "{change}.value"],
            excludeSource: "init"
        }
    }
});

reknitr.parseHashSegment = function (segment) {
    const [key, value] = decodeURIComponent(segment).split(":");
    const parsedValue = value.startsWith("{") || value.startsWith("[") ? JSON.parse(value) : value;
    return [key, parsedValue];
};

reknitr.renderHashSegment = function (key, value) {
    return key + ":" + (fluid.isPrimitive(value) ? "" + value : JSON.stringify(value));
};

reknitr.hashManager.applyHash = function (that) {
    const hash = location.hash.substring(1); // Remove initial # if any
    const sections = hash.split("&");
    const parsedSections = sections.filter(section => section.includes(":"))
        .map(section => reknitr.parseHashSegment(section));
    const model = Object.fromEntries(parsedSections);
    // We tried applying a transaction source here but there is a nested listener in reknitr.listenPaneHash and we
    // never implemented transaction globbing for https://fluidproject.atlassian.net/browse/FLUID-5498
    fluid.globalInstantiator.hashSource = true;
    fluid.replaceModelValue(that.applier, [], model);
    delete fluid.globalInstantiator.hashSource;
};

reknitr.hashManager.listenHash = function (that) {
    window.addEventListener("hashchange", () => {
        console.log("hashchange");
        that.applyHash();
    });
    window.addEventListener("popstate", () => {
        console.log("popstate");
        that.applyHash();
    });
};

reknitr.hashManager.listenModel = function (that, model) {
    const nonEmpty = Object.entries(model).filter(([, value]) => fluid.isValue(value));
    const segments = nonEmpty.map(([key, value]) => reknitr.renderHashSegment(key, value));
    const hash = "#" + segments.join("&");
    window.history.pushState(null, null, hash);
};
