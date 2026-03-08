"use strict";
/* global Plotly */

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var reknitr = fluid.registerNamespace("reknitr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

// Main integration point for imerss-bioinfo "vizLoader" coexisting with storyPage infrastructure
fluid.defaults("reknitr.storyPage.withVizLoader", {
    components: {
        // Inject this outwards so that we can forward selectedRegion onto it
        regionFilter: "{vizLoader}.filters.datasetFilter",
        statusFilter: "{storyPage}.paneHandlers-Status.statusFilter",
        vizLoader: {
            type: "hortis.blitzVizLoader",
            container: ".imerss-container",
            options: {
                selectors: {
                    // Inject the outer literal node to stop it looking inside its container
                    map: "{storyPage}.dom.map"
                },
                gridResolution: "{storyPage}.options.gridResolution",
                components: {
                    // Assume that it must be a vizLoaderWithMap
                    map: {
                        // Forward these options which used to be assigned to our nested map
                        options: {
                            gradeNames: ["hortis.libreMap.inStoryPage", "{storyPage}.options.mapFlavourGrade"]
                        }
                    },
                    // TODO configure these away for Howe Sound, needs to be viz-dependent
                    tabs: {
                        type: "fluid.emptySubcomponent"
                    },
                    blitzRecords: {
                        type: "fluid.emptySubcomponent"
                    },
                    recordReporter: {
                        type: "hortis.recordAndTaxaReporter",
                        options: {
                            members: {
                                taxa: "{vizLoader}.taxaFromObs",
                                taxaById: "{vizLoader}.taxa.rowById"
                            }
                        }
                    },
                    filters: {
                        options: {
                            components: {
                                datasetFilter: {
                                    options: {
                                        fieldNames: "{storyPage}.options.regionFilterFieldNames"
                                    }
                                },
                                // Allow for filters in panes
                                filterRoot: "{storyPage}"
                            }
                        }
                    }
                }
            }
        },
        // Inject out the inner map so that modelListeners etc. can bind to it
        // Note that this completely overwites the story's map
        map: "{storyPage}.vizLoader.map"
    },
    modelListeners: {
        listenRegionHash: {
            path: "{hashManager}.model.region",
            func: (map, selectedRegion) => map.selectedRegion.value = selectedRegion || null,
            args: ["{map}", "{change}.value"]
        }
    },
    members: {
        relayStatusToFilter: "@expand:fluid.effect(reknitr.relayStatusToFilter, {map}.selectedStatus, {storyPage}.statusFilter)",
        relayRegionsToLegend: "@expand:fluid.effect(reknitr.relayRegionsToLegend, {map}, {vizLoader}.regionIndirection.rows, {storyPage}.activePaneHandler, {map}.mapLoaded)",
        relayRegionToHash: "@expand:fluid.effect(reknitr.relayRegionToHash, {hashManager}, {map}.selectedRegion)"
    }
});

// legend/widget names: confirmed/historical/new
// filter names: confirmed/unconfirmed/new
reknitr.relayStatusToFilter = function (selectedStatus, statusFilter) {
    const newFilterState = {
        confirmed: false,
        new: false,
        unconfirmed: false
    };
    const applyStatus = selectedStatus === "historical" ? "unconfirmed" : selectedStatus;
    if (applyStatus) {
        newFilterState[applyStatus] = true;
    }
    fluid.each(newFilterState, (value, key) => statusFilter[key].value = value);
};

reknitr.relayRegionToHash = function (hashManager, selectedRegion) {
    hashManager.applier.change("region", selectedRegion);
};

reknitr.mapboxColorToCSS = function ({ r, g, b, a }) {
    const to255 = (v) => Math.round(v * 255);
    return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${a})`;
};

// Map is assumed to be a hortis.libreMap.regionLegend
reknitr.relayRegionsToLegend = function (map, regionIndirection, activePaneHandler) {
    let regionLegendRows = [];
    const regionField = activePaneHandler.options.regionField;
    if (regionField) {
        if (regionField === "!statusAsRegion") {
            const colours = activePaneHandler.options.statusColors;
            regionLegendRows = Object.entries(colours).map(([regionKey, fillColor]) => ({
                regionKey,
                fillColor,
                bindState: "selectedStatus"
            }));
        } else {
            const rows = regionIndirection;
            regionLegendRows = rows.filter(row => row.regionField === regionField).map(row => {
                const regionKey = row.label;
                const layer = map.map.getLayer(regionKey);
                const rawColor = layer.paint._values["fill-color"].value.value;
                return {
                    regionKey,
                    fillColor: reknitr.mapboxColorToCSS(rawColor),
                    bindState: "selectedRegion"
                };
            });
        }
    }
    map.legend.regionLegendRows.value = regionLegendRows;
};

/** Forward all configuration from storyMap's map onto viz's map */
fluid.defaults("hortis.libreMap.inStoryPage", {
    gradeNames: "hortis.libreMap",
    container: "{storyPage}.dom.map",
    zoomDuration: "{storyPage}.options.zoomDuration",
    selectableRegions: "{storyPage}.options.selectableRegions",
    fillPatternPath: "{storyPage}.options.fillPatternPath",
    mapboxData: "@expand:reknitr.resolveMapboxData()",
    fillPatterns: "{that}.options.mapboxData.fillPatterns",
    style: {
        transition: {
            duration: "{that}.options.zoomDuration"
        }
    },
    // TODO: Infusion bug - the member declaration for zoomToObsBounds below should work but it doesn't since we don't use C3 properly
    // and options supplied by a subcomponent override as seen above should take priority over any internal grade names
    distributeOptions: {
        target: "{that}.options.members.zoomToObsBounds",
        record: "@expand:signal()"
    },

    members: {
        selectedStatus: "@expand:signal()",
        regionSelectionEffect: "@expand:fluid.effect(reknitr.forwardRegionSelection, {storyPage}.regionFilter, {that}.selectedRegion)",
        // Prevent the map zooming to selected obs
        zoomToObsBounds: "@expand:signal()"
    }
});

fluid.defaults("reknitr.statusPaneHandler", {
    gradeNames: "reknitr.paneHandler",
    components: {
        statusFilter: {
            type: "hortis.statusFilter",
            options: {
                members: {
                    isActive: "{paneHandler}.isVisible",
                    obsRows: "{vizLoader}.obsRows", // ineffective
                    taxaById: "{vizLoader}.taxa.rowById"
                }
            }
        }
    }
});

reknitr.forwardRegionSelection = function (regionFilter, selectedRegion) {
    let filterState = {};
    if (selectedRegion) {
        const regionIndex = regionFilter.filterRows.value.findIndex(row => row.label === selectedRegion);
        if (regionIndex !== -1) {
            filterState = {[regionIndex]: true};
        }
    }
    regionFilter.filterState.value = filterState;
};

// A pane holding some kind of viz from imerss-viz - now just a simple template loader
fluid.defaults("reknitr.storyVizPane", {
    gradeNames: ["reknitr.templatePaneHandler"],
    resourceBase: ".",
    //
    resourceOptions: {
        terms: {
            resourceBase: "{that}.options.resourceBase"
        }
    },
    styles: {
        paneClass: "mxcw-viz-pane"
    },
    resources: {
        template: {
            url: "{that}.options.markupTemplate",
            dataType: "text"
        }
    },
    model: {
    },
    listeners: {
        "onCreate.paneClass": {
            func: (parentContainer, clazz) => parentContainer[0].classList.add(clazz),
            args: ["{that}.options.parentContainer", "{that}.options.styles.paneClass"]
        }
    }
});

// Grade applied to the base storyPage routing a taxon selection to selectedTaxonId signal in a pane
fluid.defaults("reknitr.storyPage.withPaneTaxon", {
    members: {
        taxaByName: "@expand:fluid.computed(hortis.taxaByName, {vizLoader}.taxaRows)"
    },
    modelListeners: {
        listenTaxonHash: {
            priority: "first",
            path: "{hashManager}.model",
            funcName: "reknitr.listenTaxonHash",
            args: ["{storyPage}", "{change}.value", "{storyPage}.taxaByName.value"]
        }
    }
});

hortis.taxaByName = function (taxaRows) {
    const taxaByName = {};
    taxaRows.forEach(row => taxaByName[row.iNaturalistTaxonName] = row);
    return taxaByName;
};

// Listen to this first so that taxon pane is ready before we make it visible
reknitr.listenTaxonHash = function (storyPage, hashModel, taxaByName) {
    const paneHandler = reknitr.paneHandlerForName(storyPage, hashModel.pane);
    if (paneHandler?.selectedTaxonId) {
        const row = taxaByName[hashModel?.taxon];
        const taxonId = row?.id;
        // Put in null explicitly to avoid censoring by fluid.effect
        paneHandler.selectedTaxonId.value = taxonId || null;
    }
};

reknitr.updateTaxonHash = function (hashManager, taxaById, selectedTaxonId, isVisible) {
    if (isVisible) {
        const taxonName = taxaById[selectedTaxonId]?.iNaturalistTaxonName;
        hashManager.applier.change("taxon", taxonName);
    }
};


// AS has requested the region selection bar to appear in a special area above the taxonomy
fluid.defaults("reknitr.regionSelectionBar.withHoist", {
    gradeNames: "reknitr.htmlWidget",
    listeners: {
        "bindWidget.hoist": {
            funcName: "reknitr.regionSelectionBar.hoist",
            priority: "before:impl"
        }
    },
    resizableParent: ".imerss-checklist-outer"
});

reknitr.regionSelectionBar.hoist = function (element, that, paneHandler) {
    const target = paneHandler.container[0].querySelector(".imerss-checklist-widgets");
    target.appendChild(element);
};

fluid.defaults("reknitr.regionSelectionBar", {
    gradeNames: ["reknitr.htmlWidget", "reknitr.withResizableWidth"],
    listeners: {
        "bindWidget.impl": "reknitr.regionSelectionBar.bind"
    }
    //,
    // members: {
    //    selectedStatus: .... - currently configured in config.json5
    // }
});

reknitr.regionSelectionBar.bind = function (element, that) {
    const names = fluid.getMembers(element.data, "name");
    that.showStatusEffects = names.map((oneStatus, index) =>
        fluid.effect(selectedStatus => {
            const selected = selectedStatus === oneStatus;
            Plotly.restyle(element, {
                // Should agree with .imerss-selected but seems that plotly cannot be reached via CSS
                "marker.line": selected ? {
                    color: "#FCFF63",
                    width: 2
                } : {
                    color: "#000000",
                    width: 0
                }
            }, index);
        }
        , that.selectedStatus));

    element.on("plotly_click", function (e) {
        const statusName = e.points[0].data.name;
        that.selectedStatus.value = statusName;
    });
};

fluid.defaults("reknitr.bareRegionsExtra.withLegend", {
    selectors: {
        // key is from Xetthecum, selector is ours - we don't have "keys", normalise this
        legendKeys: ".mxcw-legend"
    },
    modelListeners: {
        legend: {
            path: "selectedRegions.*",
            func: "hortis.legendKey.selectRegion",
            args: ["{that}", "{change}.value", "{change}.path"]
        },
        legendVisible: {
            path: "{paneHandler}.model.isVisible",
            func: "reknitr.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{change}.value", true]
        }
    },
    members: {
        legendContainer: "@expand:reknitr.legendKey.drawLegend({that}, {paneHandler})"
    },
    listeners: {
        // BUG only one of the legendVisible modelListeners fires onCreate! Perhaps because of the namespace?
        "onCreate.legendVisible": {
            path: "{paneHandler}.model.isVisible",
            func: "reknitr.toggleClass",
            args: ["{that}.legendContainer", "mxcw-hidden", "{paneHandler}.model.isVisible", true]
        }
    }
});


reknitr.addToVizColumn = function (parentContainer, jNode) {
    const target = parentContainer.find(".mxcw-vizColumn");
    target.append(jNode);
};

fluid.defaults("hortis.taxonDisplay.withClose", {
    selectors: {
        close: ".imerss-taxonDisplay-close"
    },
    markup: { /** TODO: This should probably be in a snippet/resource */
        taxonDisplayHeader:
            `<div class="imerss-taxonDisplay-close">
                <div>close</div>
                <div class="imerss-taxonDisplay-x">
                    <svg width="20" height="20">
                        <use href="#close-x" />
                    </svg>
                </div>
            </div>`
    },
    listeners: {
        "onCreate.bindClose": {
            args: ["{that}.container", "{that}.options.selectors.close", "{that}.selectedTaxonId"],
            /* TODO: Materialise all delegates! */
            func: (container, close, selectedTaxonId) => container.on("click", close, () => selectedTaxonId.value = null)
        }
    }
});

// Abstractish base grade common between those which can display info on a taxon in toggleable panel
fluid.defaults("reknitr.paneWithTaxonDisplay", {
    selectors: {
        taxonDisplay: ".imerss-taxonDisplay",
        panels: ".imerss-panel",
        sectionInner: ".mxcw-sectionInner",
        legends: ".imerss-map-legend"
    },
    // defaultPanel
    members: {
        selectedTaxonId: "@expand:signal(null)",
        panelHash: "@expand:reknitr.panelsToHash({that}.dom.panels)",
        paneSelect: "@expand:fluid.effect(reknitr.taxonToPanel, {that}.options.defaultPanel, {that}.panelHash, {that}.selectedTaxonId)",
        updateTaxonHash: "@expand:fluid.effect(reknitr.updateTaxonHash, {hashManager}, {vizLoader}.taxa.rowById, {that}.selectedTaxonId, {that}.isVisible)",
        rewriteTaxonLinks: `@expand:fluid.effect(reknitr.rewriteTaxonLinks, {that}.options.parentContainer,
             {that}.options.paneKey, {storyPage}.taxaByName, {that}.regionTaxa, {vizLoader}.resourcesLoaded)`,
        instantiateLegends: `@expand:fluid.effect(reknitr.paneHandler.instantiateLegends, {that}, {map}, {vizLoader}.regionLoader,
             {vizLoader}.resourcesLoaded)`
    },
    invokers: {
        // override from fluid.containerRenderingView
        addToParent: "reknitr.addToVizColumn({that}.options.parentContainer, {arguments}.0)"
    },
    components: {
        taxonDisplay: {
            type: "hortis.taxonDisplay",
            container: "{that}.dom.taxonDisplay",
            options: {
                gradeNames: "hortis.taxonDisplay.withClose",
                culturalValues: true,
                members: {
                    obsRows: "{vizLoader}.obsRows",
                    taxaById: "{vizLoader}.taxa.rowById",
                    selectedTaxonId: "{paneHandler}.selectedTaxonId"
                }
            }
        }
    }
});
