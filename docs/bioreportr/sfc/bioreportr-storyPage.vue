<fluid-import src="bioreportr-pageFragment.vue"></fluid-import>
<fluid-import src="bioreportr-sectionTab.vue"></fluid-import>
<fluid-import src="bioreportr-storyPane.vue"></fluid-import>
<fluid-import src="bioreportr-dataPane.vue"></fluid-import>
<fluid-import src="bioreportr-storyMap.vue"></fluid-import>
<fluid-import src="bioreportr-statusFilter.vue"></fluid-import>
<fluid-import src="bioreportr-recordAndTaxaReporter.vue"></fluid-import>
<fluid-import src="bioreportr-storyPageCuration.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/filters/hortis-standardFilterControls.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/filters/hortis-collectorFilter.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/core/hortis-standardChecklist.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/components/hortis-dataTable.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/components/hortis-resizeBar.vue"></fluid-import>
<fluid-import src="bioreportr-solowRadius.vue"></fluid-import>
<fluid-import src="bioreportr-solowTaxonInfo.vue"></fluid-import>
<fluid-import src="bioreportr-solowTaxa.vue"></fluid-import>
<fluid-import src="bioreportr-curationPane.vue"></fluid-import>
<script src="%papaparse/papaparse.min.js" data-fl-scope="global"></script>
<script src="%pako/dist/pako_inflate.min.js" data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-plants.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/blitz.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/hashManager.js"></script>
<script src="../js/story.js"></script>
<script src="../js/solow.js"></script>
<style src="https://cdn.materialdesignicons.com/2.0.46/css/materialdesignicons.min.css"></style>
<style src="%imerss-bioinfo/src/client/css/imerss-core.css"></style>
<style src="%imerss-bioinfo/src/client/css/imerss-i6.css"></style>
<script>
"use strict";

// The story page of a bioReportR project - its panes, knitted from R Markdown, each shown beside a map of the
// observations and the filters and checklist of the visualisation. A project hosts it on an element bearing
// fluid-layers, together with a layer of its own configuring its data and panes. The pane shown and the region selected
// are held in the URL's hash, by referring to the global {hashManager} - see hashManager.js in imerss-bioinfo. The hash
// is decoded before anything is rendered, so that the pane the URL names is the first and only one shown. When the page
// is rendered statically there is no URL, and nothing depending on the pane is rendered until the page boots
fluid.def("bioreportr.storyPage", {
    // Community curation of the taxa and records - see bioreportr.storyPageCuration
    $layers: ["hortis.vizLoader", "bioreportr.storyPageCuration"],
    // obsFile: String
    // taxaFile: String
    // regionIndirectionFile: String
    // The directory holding the material written by storyBuild.js, relative to the page and ending in /
    storyBase: "",
    // Map of pane key to settings overriding those of its front matter - see bioreportr.storyPage.paneSettings
    paneOverrides: {},
    gridResolution: 1000,
    // The id of a <template> element of the page holding the site's navigation, rendered above the story
    siteNavTemplateId: "site-subnav",
    paneRecords: "$compute:fluid.fetchJSON({self}.panesUrl)",
    panesFile: "panes.json",
    panesUrl: "$compute:bioreportr.storyPane.url({self}.storyBase, {self}.panesFile)",
    mapData: "$compute:fluid.fetchJSON({self}.mapDataUrl)",
    mapDataFile: "mapData.json",
    mapDataUrl: "$compute:bioreportr.storyPane.url({self}.storyBase, {self}.mapDataFile)",
    panes: "$compute:bioreportr.storyPage.paneSettings({self}.paneRecords, {self}.paneOverrides)",
    // The key of the pane chosen, held in the URL - undefined if none is chosen, when the first is shown
    selectedPaneKey: "{hashManager}.hash.pane",
    activePaneKey: "$compute:bioreportr.storyPage.activePaneKey({self}.selectedPaneKey, {self}.panes)",
    activePane: "$compute:bioreportr.storyPage.activePane({self}.panes, {self}.activePaneKey)",
    // A record selected in one pane is cleared on moving to another
    clearRecordOnPaneChange: "$effect:bioreportr.storyPage.clearRecordOnPaneChange({self}, {self}.activePaneKey)",
    classes: "$compute:bioreportr.storyPage.classes({self}.activePane, {self}.checklist.search.filterState, {self}.map.recordSelector.filterState)",
    selectPane: "$method:bioreportr.storyPage.selectPane({self}, {0}:paneKey)",
    // The reporting status chosen in the status filter, or in the legend of a map coloured by status
    selectedStatus: null,
    // The region selected on the map or its legend, held in the URL - undefined if none is selected
    selectedRegion: "{hashManager}.hash.region",
    selectRegion: "$method:bioreportr.storyPage.selectRegion({self}, {0}:region)",
    // The columns of the region indirection table whose regions may be selected on the map
    regionFilterFieldNames: [],
    regionFilter: {
        $component: {
            $layers: "hortis.obsFilter",
            filterState: "{storyPage}.selectedRegion",
            filterSummary: "$compute:hortis.collectorFilter.summarise({self}.filterState, {self}.filterName)",
            filterName: "Region",
            doFilter: `$method:bioreportr.regionSelectionFilter({0}:obsRows, {1}:filterState, {storyPage}.regionIndirection.rows,
                {storyPage}.regionFilterFieldNames)`,
            reset: "$method:bioreportr.storyPage.selectRegion({storyPage}, {self}.noRegion)",
            noRegion: null
        }
    },
    siteNav: {
        $component: {
            $layers: "bioreportr.pageFragment",
            templateId: "{storyPage}.siteNavTemplateId"
        }
    },
    sectionTabs: {
        $component: {
            $layers: "bioreportr.sectionTab",
            $for: {
                source: "{storyPage}.panes",
                valueAs: "pane"
            }
        }
    },
    storyPanes: {
        $component: {
            $layers: "bioreportr.storyPane",
            $for: {
                source: "{storyPage}.panes",
                valueAs: "pane"
            }
        }
    },
    dataPanes: {
        $component: {
            $layers: "bioreportr.dataPane",
            $for: {
                source: "{storyPage}.panes",
                valueAs: "pane"
            }
        }
    },
    regionIndirection: {
        $component: {
            $layers: ["hortis.csvReader", "fluid.withPlaceholder"],
            url: "{vizLoader}.regionIndirectionFile",
            placeholderUrl: "{vizLoader}.regionIndirectionPlaceholderFile"
        }
    },
    obsFilters: {
        $component: {
            $layers: "hortis.obsFilters"
        }
    },
    filteredObs: "{self}.obsFilters.allOutput",
    taxaFromObs: "$compute:hortis.taxaFromObs({self}.filteredObs, {self}.taxa.rowById)",
    statusFilter: {
        $component: {
            $layers: "bioreportr.statusFilter",
            isActive: "{storyPage}.activePane.visibleFilters"
        }
    },
    collectorFilter: {
        $component: {
            $layers: "hortis.collectorFilter",
            filterName: "Recorder",
            isActive: "{storyPage}.activePane.visibleFilters"
        }
    },
    map: {
        $component: {
            $layers: "bioreportr.storyMap"
        }
    },
    checklist: {
        $component: {
            $layers: "hortis.standardChecklist",
            label: "Plants",
            rootId: "47126", // Plantae
            decorate: "hortis.blitzChecklistDecoration"
        }
    },
    recordReporter: {
        $component: {
            $layers: "bioreportr.recordAndTaxaReporter",
            filteredRows: "{vizLoader}.finalFilteredObs",
            allRows: "{vizLoader}.obsRows",
            taxa: "{vizLoader}.taxaFromObs",
            rowById: "{vizLoader}.taxa.rowById"
        }
    },
    filterControls: {
        $component: {
            $layers: "hortis.standardFilterControls",
            label: ""
        }
    },
    // The columns of the tables of records, as for hortis.dataTable - by default, one for each field of a record
    recordColumns: [],
    obsTable: {
        $component: {
            $layers: "hortis.dataTable",
            rows: "{vizLoader}.finalFilteredObs",
            columns: "{storyPage}.recordColumns",
            // Clicking a record shows its marker alone on the map - see hortis.libreMap.recordSelector
            rowSelectable: true,
            selectedRow: "{storyPage}.map.recordSelector.selectedRow",
            selectRow: "$method:hortis.libreMap.recordSelector.select({storyPage}.map.recordSelector, {0}:row)"
        }
    },
    // The buttons beside the tables of records clearing the record selected in them, disabled whilst there is none
    noRecordSelected: "$compute:bioreportr.storyPage.noRecordSelected({self}.map.recordSelector.filterState)",
    resetRecord: "$method:hortis.libreMap.recordSelector.reset({self}.map.recordSelector)",
    // Shows the title of any element of the page in a styled tooltip of its own, in place of the browser's
    titleTooltips: {
        $component: {
            $layers: "hortis.titleTooltips"
        }
    },
    // The panel of records beneath the map opens and closes as an accordion, its header naming the filters narrowing it
    recordsCollapsed: true,
    toggleRecords: "$method:bioreportr.storyPage.toggle({self}, recordsCollapsed)",
    // Each filter which may narrow the records, with a function describing its state - see bioreportr.recordsFilterDescribers
    recordsLabel: `$compute:bioreportr.storyPage.recordsLabel({self}.taxa.rowById, {self}.checklist.search.filterState, {self}.selectedStatus,
        {self}.selectedRegion, {self}.collectorFilter.filterState, {self}.map.gridSelector.filterState, {self}.map.polygonDraw.filterState)`,
    // A panel showing the taxon chosen in a pane, above the records - empty unless a project supplies its markup
    taxonPanel: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: ""
        }
    },
    taxonPanelVisible: false,
    // Further classes of the left pane, holding the map and data panes, e.g. to give a pane's map the whole column
    leftPaneClass: "",
    // Map of pane key to markup shown in the pane's data pane in place of the map, e.g. a gallery
    paneMarkup: {},
    // Map of the class of an empty element of a pane's section to the markup to be placed within it
    sectionInserts: {},
    // Handles a click within a pane's section or data pane, e.g. on markup supplied in paneMarkup or sectionInserts
    paneClick: "$method:fluid.identity({0}:event)",
    // The extirpation risk analysis, shown by a pane whose settings have visibleSolow - see solow.js
    solowParams: {
        baselineYear: 1859,
        analysisYear: 2025
    },
    // The filters of the analysis's table of taxa, each the members of a hortis.valueFilter
    taxaFilterRecords: [],
    // The columns of the analysis's table of taxa, as for hortis.dataTable
    taxonColumns: [],
    solowTaxa: {
        $component: {
            $layers: "bioreportr.solowTaxa",
            filterRecords: "{storyPage}.taxaFilterRecords",
            columns: "{storyPage}.taxonColumns"
        }
    },
    solowRadius: {
        $component: {
            $layers: "bioreportr.solowRadius"
        }
    },
    solowTaxonObs: "$compute:bioreportr.solowObsForTaxon({self}.obsRows, {self}.solowTaxa.selectedTaxon)",
    // The annotations of records the project keeps, e.g. of planted populations, as a CSV file relative to the story page,
    // if it has any - records they suspend from the calculation of extirpation probability are left out of the populations
    recordAnnotationsFile: null,
    recordAnnotations: "$compute:bioreportr.loadRecordAnnotations({self}.recordAnnotationsFile)",
    solowEPObs: "$compute:bioreportr.solowObsForEP({self}.solowTaxonObs, {self}.recordAnnotations)",
    solowTaxonInfo: {
        $component: {
            $layers: "bioreportr.solowTaxonInfo",
            taxon: "{storyPage}.solowTaxa.selectedTaxon",
            taxonObsRows: "{storyPage}.solowTaxonObs"
        }
    },
    solowHasTaxon: "$compute:hortis.isValue({self}.solowTaxa.selectedTaxon)",
    // A panel of the taxon chosen for the extirpation risk analysis, which a project may supply in place of the standard
    // solowTaxonInfo, e.g. the same panel as its atlas shows - empty unless it does
    solowTaxonPanel: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: ""
        }
    },
    solowHasPanel: "$compute:bioreportr.storyPage.hasMarkup({self}.solowTaxonPanel.markup)",
    // The records of the chosen taxon, most recent first, since the last known sightings are the best guide to where to look
    solowRecordsTable: {
        $component: {
            $layers: "hortis.dataTable",
            rows: "{storyPage}.solowTaxonObs",
            columns: "$compute:bioreportr.withoutColumn({storyPage}.recordColumns, taxon_name)",
            sortable: true,
            sortColumn: "eventDate",
            sortDirection: -1,
            rowSelectable: true,
            selectedRow: "{storyPage}.map.recordSelector.selectedRow",
            selectRow: "$method:hortis.libreMap.recordSelector.select({storyPage}.map.recordSelector, {0}:row)"
        }
    },
    solowRecordsCollapsed: true,
    toggleSolowRecords: "$method:bioreportr.storyPage.toggle({self}, solowRecordsCollapsed)",
    downloadSolowRecords: "$method:bioreportr.storyPage.downloadTaxonObs({self}.solowTaxa.selectedTaxon, {self}.solowTaxonObs)",
    solowClusters: "$compute:bioreportr.solow.clusters({self}.solowEPObs, {self}.solowRadius.radius, {self}.solowParams)",
    solowMapLayer: {
        $component: {
            $layers: "bioreportr.solowMapLayer",
            clusters: "{storyPage}.solowClusters",
            solowRadius: "{storyPage}.solowRadius.radius",
            visible: "{storyPage}.activePane.visibleSolow"
        }
    },
    // The bars between a taxon panel and the records beneath it, shown by CSS only while both are visible
    solowRecordsResizeBar: {
        $component: {
            $layers: "hortis.resizeBar",
            axis: "vertical",
            minBefore: 120,
            minAfter: 96
        }
    },
    taxonPanelResizeBar: {
        $component: {
            $layers: "hortis.resizeBar",
            axis: "vertical",
            minBefore: 120,
            minAfter: 96
        }
    },
    // The bars dividing the map from the data pane beneath it, the map and data from the story, and the panes of the
    // story from the filters beneath them
    mapResizeBar: {
        $component: {
            $layers: "hortis.resizeBar",
            axis: "vertical"
        }
    },
    mainResizeBar: {
        $component: {
            $layers: "hortis.resizeBar",
            axis: "horizontal"
        }
    },
    contentResizeBar: {
        $component: {
            $layers: "hortis.resizeBar",
            axis: "vertical"
        }
    },
    // true once the observations shown are the real ones - a rendering from placeholder data, e.g. by a static build
    // of the page, marks the page as loading until the real data has loaded
    loaded: "$compute:bioreportr.storyPage.loaded({self}.finalFilteredObs, {self}.isPlaceholder, {self}.regionIndirection.isPlaceholder)",
    // Becomes true once the page is loaded and has rendered what it derives from its genuine data, which it does over
    // several tasks - the page's material is hidden until then, see layouts/story/baseof.html
    revealed: false,
    reveal: "$effect:bioreportr.storyPage.reveal({self}, {self}.loaded, {global})",
    filtersCollapsed: true,
    toggleFilters: "$method:bioreportr.storyPage.toggleFilters({self})",
    downloadObs: "$method:bioreportr.storyPage.downloadObs({self}.finalFilteredObs)",
    recordsExpanded: "$compute:hortis.negate({self}.recordsCollapsed)",
    solowRecordsExpanded: "$compute:hortis.negate({self}.solowRecordsCollapsed)",
    solowRecordsSpecies: "$compute:bioreportr.storyPage.taxonLabel({self}.solowTaxa.selectedTaxon)"
});

/**
 * Compute the classes of the parts of the story page which are shown or hidden according to the active pane. A pane
 * whose settings have foldVizControlsOnTaxon, e.g. the curation pane, folds away the checklist once a taxon, or a
 * record, is chosen.
 * @param {PaneSettings} pane - The active pane
 * @param {TaxonRow|null} chosenTaxon - The taxon chosen in the checklist's search, if any
 * @param {String|null} recordId - The id of the record selected, if any
 * @return {Object<String, String>} The classes of each part
 */
bioreportr.storyPage.classes = function (pane, chosenTaxon, recordId) {
    const hidden = visible => visible ? "" : "fl-hidden";
    return {
        map: pane.visibleMap ? "" : "mxcw-hideMap",
        vizControls: hidden(pane.visibleVizControls && !(pane.foldVizControlsOnTaxon && (chosenTaxon || hortis.isValue(recordId)))),
        obsFilters: hidden(pane.visibleObsFilters),
        filters: hidden(pane.visibleFilters),
        obsTable: hidden(pane.visibleObsTable),
        solow: hidden(pane.visibleSolow)
    };
};

bioreportr.storyPage.toggleFilters = function (that) {
    that.filtersCollapsed = !that.filtersCollapsed;
};

/**
 * Flip a boolean member of a component, e.g. whether a panel is collapsed.
 * @param {fluid.component} that - The component
 * @param {String} member - The name of the member
 */
bioreportr.storyPage.toggle = function (that, member) {
    that[member] = !that[member];
};

/**
 * Determine whether a slot has been given markup by the project.
 * @param {String} markup - The slot's markup
 * @return {Boolean} `true` if it has any
 */
bioreportr.storyPage.hasMarkup = markup => !!markup;
</script>

<template>
    <div class="imerss-main" @class="imerss-loading:!@{revealed}">
        <div class="mxcw-leftPane @{leftPaneClass}" data-mxcw-startup-hidden="map">
            <div class="mxcw-map fld-imerss-nodismiss-map @{classes.map}" @id="map"></div>
            <div @id="mapResizeBar"></div>
            <div class="mxcw-data fld-imerss-nodismiss-map">
                <div class="mxcw-data-pane-widget mxcw-atlas-taxon-holder" @class="mxcw-atlas-has-taxon:@{taxonPanelVisible}"><div @id="taxonPanel"></div></div>
                <div @id="taxonPanelResizeBar"></div>
                <div class="mxcw-data-pane-widget mxcw-obs-table-holder @{classes.obsTable}" @class="mxcw-records-collapsed:@{recordsCollapsed}"
                    @onclick="{self}.recordTableClick({0})">
                    <div class="mxcw-obs-table-controls">
                        <button type="button" class="mxcw-records-toggle mxcw-data-widget-text" aria-expanded="@{recordsExpanded}"
                            aria-controls="mxcw-records-table" @onclick="{self}.toggleRecords()">Records<span class="mxcw-records-filter-label" title="@{recordsLabel.title}">@{recordsLabel.text}</span></button>
                        <button type="button" class="imerss-download-button mxcw-record-reset" title="Clear the selected record"
                            aria-label="Clear the selected record" disabled="@{noRecordSelected}" @onclick="{self}.resetRecord()">
                            <svg width="24" height="24" aria-hidden="true"><use href="#imerss-i-reset"/></svg>
                        </button>
                        <span class="imerss-download-button imerss-basic-tooltip" title="Download records as CSV" @onclick="{self}.downloadObs()">
                            <svg width="24" height="24"><use href="#imerss-i-download"/></svg>
                        </span>
                    </div>
                    <div id="mxcw-records-table" class="mxcw-obs-table hortis-datatable" @id="obsTable"></div>
                </div>
                <!-- The slider of the population radius, in a slim strip beneath the map, above the panel of the taxon -->
                <div class="mxcw-data-pane-widget mxcw-solow-widgets-holder @{classes.solow}" @class="mxcw-solow-has-taxon:@{solowHasTaxon}">
                    <div class="mxcw-solow-radius-holder"><div @id="solowRadius"></div></div>
                    <div class="mxcw-solow-taxon-holder">
                        <div @id="solowTaxonPanel"></div>
                        <div class="mxcw-solow-standard-panel" @class="fl-hidden:@{solowHasPanel}"><div @id="solowTaxonInfo"></div></div>
                    </div>
                </div>
                <div @id="solowRecordsResizeBar"></div>
                <div class="mxcw-data-pane-widget mxcw-solow-records-holder @{classes.solow}" @class="mxcw-solow-records-collapsed:@{solowRecordsCollapsed}">
                    <div class="mxcw-obs-table-controls">
                        <button type="button" class="mxcw-records-toggle mxcw-data-widget-text" aria-expanded="@{solowRecordsExpanded}"
                            aria-controls="mxcw-solow-records-table" @onclick="{self}.toggleSolowRecords()">Records<span class="mxcw-solow-records-species">@{solowRecordsSpecies}</span></button>
                        <button type="button" class="imerss-download-button mxcw-record-reset" title="Clear the selected record"
                            aria-label="Clear the selected record" disabled="@{noRecordSelected}" @onclick="{self}.resetRecord()">
                            <svg width="24" height="24" aria-hidden="true"><use href="#imerss-i-reset"/></svg>
                        </button>
                        <span class="imerss-download-button imerss-basic-tooltip" title="Download this species' records as CSV" @onclick="{self}.downloadSolowRecords()">
                            <svg width="24" height="24"><use href="#imerss-i-download"/></svg>
                        </span>
                    </div>
                    <div id="mxcw-solow-records-table" class="mxcw-solow-records-table hortis-datatable" @id="solowRecordsTable"></div>
                </div>
                <div class="mxcw-dataPanes" @id="dataPanes"></div>
            </div>
        </div>
        <div @id="mainResizeBar"></div>
        <div class="imerss-page">
            <div @id="siteNav"></div>
            <div class="mxcw-story-holder">
                <div class="max-xl:hx-hidden hx-h-0 hx-w-64 hx-shrink-0"></div>
                <div class="mxcw-container">
                    <div class="mxcw-content-holder">
                        <div class="mxcw-section-nav">
                            <nav class="chevron-nav" role="tablist" aria-label="Section navigation" @id="sectionTabs"></nav>
                        </div>
                        <div class="mxcw-content imerss-nodismiss-map" data-mxcw-startup-hidden @id="storyPanes"></div>
                    </div>
                    <div @id="contentResizeBar"></div>
                    <div class="imerss-container @{classes.vizControls}" data-mxcw-startup-hidden>
                        <div class="imerss-filter-panel @{classes.obsFilters}" @class="imerss-filters-collapsed:@{filtersCollapsed}">
                            <div class="imerss-panel-label imerss-filters-header">
                                <button type="button" class="imerss-filters-toggle" aria-expanded="@{filtersCollapsed}"
                                    aria-controls="imerss-main-filters" @onclick="{self}.toggleFilters()">Filters:</button>
                                <div @id="filterControls"></div>
                            </div>
                            <div id="imerss-main-filters" class="imerss-filters imerss-main-filters @{classes.filters}">
                                <div class="imerss-filter"></div>
                                <div class="imerss-status-filter imerss-filter" @id="statusFilter"></div>
                                <div class="imerss-collector-filter imerss-filter" @id="collectorFilter"></div>
                                <!-- Filled only by a story defining these filters, as the Saanich story does -->
                                <div class="imerss-locality-filter imerss-filter" @id="localityFilter"></div>
                                <div class="imerss-time-filter imerss-filter" @id="timePeriodFilter"></div>
                            </div>
                            <div @id="recordReporter"></div>
                            <div @id="checklist"></div>
                        </div>
                        <div class="mxcw-solow-taxa @{classes.solow}" @id="solowTaxa"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<symbols>
    <symbol id="imerss-i-exclamation" viewBox="0 0 24 24" stroke="#ffac1c">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13.253 5.98 12 13.5l-1.253-7.52a1.27 1.27 0 1 1 2.506 0Z"/>
        <circle cx="12" cy="19" r="1" stroke-width="2"/>
    </symbol>
    <symbol id="imerss-i-question" viewBox="0 0 512 512" fill="#55b">
        <g transform="translate(256,256) scale(0.8) translate(-256,-256)">
            <path d="M396,85c-13-25-34-46-59-61C311,9,280,0,247,0c-41-0-76,11-101,26c-26,15-37,32-37,32c-4,4-7,9-7,15 c0,6,3,11,7,15l36,29c7,6,18,6,25-1c0,0,4-8,18-16c14-8,32-14,59-14c24,0,44,9,58,21c7,6,12,13,15,19c3,6,4,11,4,16 c0,14-3,23-7,30c-3,6-7,11-12,16c-7,7-17,14-29,20c-11,6-23,12-36,19c-14,8-29,19-40,36c-5,8-10,18-12,28 c-3,10-4,20-4,31c0,11,0,21,0,21c0,11,9,19,19,19h47c11,0,19-9,19-19c0,0,0-9,0-21c0-4,0-7,1-8c1-3,1-3,2-5 c1-1,4-4,9-6c7-4,18-9,31-16c19-10,42-25,62-48c10-12,18-26,24-42c6-16,9-34,9-54C410,121,405,102,396,85z"/>
            <path d="M229,406c-29,0-53,24-53,53c0,29,24,53,53,53c29,0,53-24,53-53C282,430,258,406,229,406z"/>
        </g>
    </symbol>
    <symbol id="imerss-i-tick" viewBox="0 0 70 70" fill="#5b5">
        <g transform="translate(35,35) scale(0.75) translate(-35,-35)">
            <path d="M26.474,70c-2.176,0-4.234-1.018-5.557-2.764L3.049,43.639C0.725,40.57,1.33,36.2,4.399,33.875 c3.074-2.326,7.441-1.717,9.766,1.35l11.752,15.518L55.474,3.285c2.035-3.265,6.332-4.264,9.604-2.232 c3.268,2.034,4.266,6.334,2.23,9.602l-34.916,56.06c-1.213,1.949-3.307,3.175-5.6,3.279C26.685,69.998,26.58,70,26.474,70z"/>
        </g>
    </symbol>
</symbols>
