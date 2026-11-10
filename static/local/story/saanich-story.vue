<fluid-import src="../../bioreportr/sfc/bioreportr-storyPage.vue"></fluid-import>
<!-- The Atlas's filters of records by time period - its filter by locality is a collector filter over another field -->
<fluid-import src="saanich-timePeriodFilter.vue"></fluid-import>
<!-- The iNaturalist panels of the Top Contributions pane -->
<script src="%@imerss/inat-components/dist/standalone.min.js" fluid-client data-fl-scope="global"></script>
<!-- The three panes of this story alone, each rendering its section from its own template - see paneComponent in
     the front matter of content/story/LostPlants.Rmd, Traces.Rmd and Remembering.Rmd -->
<fluid-import src="saanich-tracesPane.vue"></fluid-import>
<fluid-import src="saanich-lostPlantsPane.vue"></fluid-import>
<fluid-import src="saanich-rememberingPane.vue"></fluid-import>
<!-- The atlas's tiles, panel and tooltips and the rest particular to this story, which build on the story page's own
     summaries in story.js -->
<script src="../../bioreportr/js/story.js"></script>
<script src="../js/saanich.js"></script>
<script>
"use strict";

// The story page of the Saanich Peninsula vascular plant report, with its atlas - see static/local/js/saanich.js - and
// the three panes of this story alone, each defined by a Single File Component of its own beside this one: the opening
// timeline, In Memory of Plants, the gallery of lost plants, and the pane in memory of Harvey Janszen. Its paths are
// relative to the story page, served at /story/, whose panes are written by src/js/storyBuild.js into static/story

fluid.registerNamespace("saanich");

// The proportion of the maximum count shown by each cell of the map's grid is scaled by a Weibull distribution, so
// that the few cells with very many observations do not wash out the rest - see the legend
saanich.weibullCount = (x, maxCount) => maxCount < 200 ? x : 1 - Math.exp(-Math.pow(x / 0.012, 0.5));

saanich.inverseWeibullCount = (x, maxCount) => maxCount < 200 ? x : 0.012 * Math.pow(-Math.log(1 - x), 1 / 0.5);

fluid.def("saanich.story", {
    $layers: "bioreportr.storyPage",
    obsFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv",
    obsPlaceholderFile: "../local/data/tabular/placeholder/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv",
    taxaFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv",
    taxaPlaceholderFile: "../local/data/tabular/placeholder/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv",
    regionIndirectionFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-regionIndirection.csv",
    regionIndirectionPlaceholderFile: "../local/data/tabular/placeholder/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-regionIndirection.csv",
    gridResolution: 1000,
    regionFilterFieldNames: ["BEC"],
    // The period of the records, over which the extirpation risk analysis always runs
    recordPeriod: "$compute:saanich.recordPeriod({self}.obsRows)",
    solowParams: "$compute:saanich.solowParams({self}.recordPeriod)",
    taxonColumns: [
        {key: "scientificName", label: "Taxon name"},
        {key: "solow_EP", label: "EP"},
        {key: "n_obs", label: "obs"},
        {key: "n_unmapped", label: "No coords", formatter: "saanich.formatUnmapped"},
        {key: "taxon_rank", label: "Rank"},
        {key: "introduction_status", label: "Introduction"},
        {key: "provenance_status", label: "Has Voucher"},
        {key: "commonName", label: "Common Name"},
        {key: "reportingStatus", label: "Reporting status"},
        {key: "id", label: "ID"},
        {key: "iNaturalistTaxonName", label: "Link name"}
    ],
    taxaFilterRecords: [
        {filterName: "Infrataxon", fieldName: "infrataxon_status", fieldValues: ["infrataxon", "non-infrataxon"]},
        {filterName: "Introduction", fieldName: "introduction_status", fieldValues: ["native", "exotic", "unknown"]},
        {filterName: "Provenance", fieldName: "provenance_status", fieldValues: ["voucher", "no_voucher", "unknown"]},
        {filterName: "Conservation", fieldName: "provincial_concern", fieldValues: ["concern", "secure"]},
        {filterName: "Graminoid", fieldName: "graminoid", fieldValues: ["graminoid", "non-graminoid"], valueOf: "hortis.graminoidValue"}
    ],
    // Ordered to bring forward what helps in assessing a record and in targeting the plant
    recordColumns: [
        {key: "eventDate", label: "Date", formatter: "saanich.formatDate"},
        {key: "taxon_name", label: "Taxon"},
        {key: "locality", label: "Locality"},
        {key: "recordedBy", label: "Recorder"},
        {key: "basisOfRecord", label: "Record type"},
        {key: "institutionCode", label: "Institution"},
        {key: "catalogNumber", label: "Catalogue no."},
        {key: "decimalLatitude", label: "Latitude"},
        {key: "decimalLongitude", label: "Longitude"},
        {key: "coordinateUncertaintyInMetres", label: "Uncertainty (m)"},
        {key: "elevation", label: "Elevation"},
        {key: "individualCount", label: "Count"},
        {key: "establishmentMeans", label: "Establishment"},
        {key: "identifiedBy", label: "Identified by"},
        {key: "dateIdentified", label: "Date identified"},
        {key: "typeStatus", label: "Type status"},
        {key: "collectionCode", label: "Collection"},
        {key: "recordNumber", label: "Record no."},
        {key: "license", label: "Licence"},
        {key: "rightsHolder", label: "Rights holder"},
        {key: "occurrenceID", label: "Occurrence ID"},
        {key: "gbifID", label: "GBIF ID"}
    ],
    // Records indexed by taxon, and the taxa of the summary with their counts of records with and without coordinates
    byTaxon: "$compute:saanich.groupRecords({self}.obsRows)",
    summaryTaxa: "$compute:bioreportr.summaryTaxaRows({self}.taxa.allRows)",
    annotatedTaxa: "$compute:saanich.annotateGeoref({self}.summaryTaxa, {self}.obsRows)",
    solowTaxa: {
        $component: {
            taxaFilters: {
                $component: {
                    allInput: "{storyPage}.annotatedTaxa"
                }
            }
        }
    },
    // The gallery of "lost" plants shown beside the Lost Plants pane - see saanich-lostPlantsPane.vue
    lostPlants: {
        $component: {
            $layers: "saanich.lostPlants"
        }
    },
    paneMarkup: "$compute:saanich.paneMarkup({self}.lostPlants.markup)",
    // The Atlas's records may also be narrowed by the places named in them and by a span of years, filters placed by the
    // slots of the same names in the story page's filter panel
    // The species of the Community Science pane open on the Atlas - see saanich.inatSpecies
    inatSpeciesClick: "$effect:saanich.inatSpecies.bind({self}, {global})",
    // The checklist shows each species' reporting status by an icon - see saanich.checklistDecoration
    checklist: {
        $component: {
            decorate: "saanich.checklistDecoration"
        }
    },
    // The records come from collectors, observers and others alike, so the recorder filter does not call them volunteers
    collectorFilter: {
        $component: {
            placeholder: "Search recorders ..."
        }
    },
    localityFilter: {
        $component: {
            $layers: "hortis.collectorFilter",
            filterName: "Locality",
            fieldName: "locality",
            controlId: "fli-saanich-locality",
            placeholder: "Search localities ...",
            isActive: "{storyPage}.activePane.visibleFilters"
        }
    },
    timePeriodFilter: {
        $component: {
            $layers: "saanich.timePeriodFilter",
            isActive: "{storyPage}.activePane.visibleFilters"
        }
    },
    // Populations are aggregated at 1000 m by default, the third of the radius slider's snap values
    solowRadius: {
        $component: {
            defaultIndex: 2,
            selectedIndex: 2
        }
    },
    // The summary of a map cell calls the historical species lost plants, as the gallery does
    cellTooltipHeadings: {
        unconfirmed: "Lost plants recorded here: records, and year last seen"
    },
    // The tiles of the atlas's three groups of species, placed in its section
    atlasTiles: "$compute:saanich.atlas.tilesMarkup({self}.taxa.allRows, {self}.selectedStatus)",
    sectionInserts: "$compute:saanich.atlas.sectionInserts({self}.atlasTiles)",
    paneClick: "$method:saanich.paneClick({self}, {0}:event, Solow, {global})",
    // The atlas's panel of the plant or group chosen in the checklist
    checklistTaxon: "$compute:saanich.atlas.resolveTaxon({self}.taxa.rowById, {self}.checklist.search.filterState)",
    atlasRecords: "$compute:saanich.atlas.taxonRecords({self}.obsRows, {self}.taxa.rowById, {self}.checklistTaxon)",
    taxonPanel: {
        $component: {
            markup: "$compute:saanich.atlas.panelMarkup({storyPage}.checklistTaxon, {storyPage}.atlasRecords)"
        }
    },
    taxonPanelVisible: "$compute:saanich.atlas.panelVisible({self}.taxonPanel.markup, {self}.activePaneKey, Status)",
    // Summaries of each group of species, shown when hovering over its tile in the atlas or its row of the map's legend
    statusTooltip: {
        $component: {
            $layers: "hortis.withTooltip",
            cache: "$compute:saanich.statusTooltip.makeCache({storyPage}.taxa.allRows)",
            renderTooltip: "$method:saanich.statusTooltip.render({storyPage}.taxa.allRows, {storyPage}.byTaxon, {self}.cache, {0}:status)",
            hover: {
                $bindable: {
                    bind: "saanich.statusTooltip.bind({self}, {global}.document)",
                    unbind: "saanich.statusTooltip.unbind({boundValue})"
                }
            }
        }
    },
    // The extirpation risk pane opens on whichever species is at the top of its list, with the map fitted to its records
    solowShown: "$compute:bioreportr.storyPage.isActive({self}.activePaneKey, Solow)",
    selectTopSpecies: "$effect:saanich.selectTopSpecies({self}, {self}.solowShown, {self}.loaded, {self}.solowTaxa.taxaTable.displayRows)",
    solowFitTaxon: null,
    fitToTaxon: "$effect:saanich.fitToTaxon({self}.map.readyMap, {self}.solowFitTaxon, {self}.obsRows, {self}.map.zoomDuration)",
    // The opening pane, in memory of plants: their key moments appear across the map as a timeline plays - see
    // saanich-tracesPane.vue
    traces: {
        $component: {
            $layers: "saanich.traces"
        }
    },
    // The final pane, in memory of Harvey Janszen, shows the areas of his checklists on the map, described on hover - see
    // saanich-rememberingPane.vue
    remembering: {
        $component: {
            $layers: "saanich.remembering"
        }
    },
    // A pane opened from one without a map is placed on its camera once the map has its size - see saanich.recentre
    recentre: "$effect:saanich.recentre({self}.map.readyMap, {self}.mapData, {self}.activePane)",
    leftPaneClass: "$compute:saanich.traces.leftPaneClass({self}.traces.active, {self}.traces.paused, {self}.traces.scrubbing, {self}.remembering.active)",
    paneOverrides: {
        Traces: {
            visibleMap: true
        },
        Remembering: {
            visibleMap: true
        },
        Solow: {
            layers: ["reknitr.solowPaneHandler"]
        },
        TopContributions: {
            iNatPanels: [{
                taxon: {
                    id: 211194,
                    str: "Vascular plants"
                },
                place: {
                    id: 81137,
                    str: "saanich"
                },
                features: [{ // recentObservations
                    desc: "Recent vascular plant observations on the Saanich Peninsula"
                }, { // commonTaxa
                    desc: "Most commonly reported vascular plants on the Saanich Peninsula"
                }, { // favourites
                    desc: "Most favourited vascular plant observations on the Saanich Peninsula"
                }, { // stats
                    desc: "Observation statistics for vascular plants on the Saanich Peninsula"
                }]
            }]
        }
    },
    map: {
        $component: {
            $layers: ["hortis.libreMap.withTiles", "hortis.libreMap.esriTiles"],
            countTransform: "saanich.weibullCount",
            // A selected record hides the grid only while few enough records are in view - see saanich.showMarkers
            showMarkers: "$compute:saanich.showMarkers({self}.gridVisible, {self}.viewportObs.inView, {self}.markerThreshold, {self}.selectedRecord)",
            inverseCountTransform: "saanich.inverseWeibullCount",
            // The grid counts records of every type of evidence, not only observations
            legendMarkup: `$compute:saanich.obsGridLegendMarkup({self}.obsQuantiser.grid, {self}.fillStops, {self}.legendStops,
                {self}.maxObsCountOverride, {self}.inverseCountTransform, {self}.obsQuantiser.longResolution, {self}.obsQuantiser.baseLatitude)`
        }
    }
});
</script>
