<fluid-import src="../../bioreportr/sfc/bioreportr-storyPage.vue"></fluid-import>
<!-- The iNaturalist panels of the Top Contributions pane -->
<script src="%@imerss/inat-components/dist/standalone.min.js" fluid-client data-fl-scope="global"></script>
<!-- The gallery of lost plants, the atlas's tiles, panel and tooltips and the other panes particular to this story -->
<script src="../js/i6/saanich.js"></script>
<script>
"use strict";

// The story page of the Saanich Peninsula vascular plant report, with its gallery of lost plants, atlas and the pane
// in memory of Harvey Janszen - see static/local/js/i6/saanich.js. Its paths are relative to the story page, served at
// /story/, whose panes are written by src/js/storyBuild.js into static/story

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
        {key: "BEC", label: "BEC zone"},
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
    // The first pane, with a gallery of "lost" plants in place of the map. The plants are selected from the site's data
    // whenever it loads, so that the gallery follows the data, and their photos are looked up live from iNaturalist
    lostPlants: {
        $component: {
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
        }
    },
    rememberingMarkup: "$compute:saanich.remembering.getMarkup()",
    paneMarkup: "$compute:saanich.paneMarkup({self}.lostPlants.markup, {self}.rememberingMarkup)",
    // The tiles of the atlas's three groups of species, placed in its section, and the count of the gallery's plants
    atlasTiles: "$compute:saanich.atlas.tilesMarkup({self}.taxa.allRows, {self}.byTaxon, {self}.selectedStatus, {self}.recordPeriod.last)",
    sectionInserts: "$compute:saanich.atlas.sectionInserts({self}.atlasTiles, {self}.lostPlants.count)",
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
    earliestRecords: "$compute:saanich.cellTooltip.earliestRecords({self}.obsRows)",
    // The extirpation risk pane opens on whichever species is at the top of its list, with the map fitted to its records
    solowShown: "$compute:bioreportr.storyPage.isActive({self}.activePaneKey, Solow)",
    selectTopSpecies: "$effect:saanich.selectTopSpecies({self}, {self}.solowShown, {self}.loaded, {self}.solowTaxa.taxaTable.displayRows)",
    solowFitTaxon: null,
    fitToTaxon: "$effect:saanich.fitToTaxon({self}.map.readyMap, {self}.solowFitTaxon, {self}.obsRows, {self}.map.zoomDuration)",
    // The opening pane, in memory of plants: their key moments appear across the map as a timeline plays
    traces: {
        $component: {
            $layers: "fluid.component",
            paused: false,
            scrubbing: false,
            active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, Traces)",
            events: "$compute:saanich.traces.buildEvents({storyPage}.taxa.allRows, {storyPage}.byTaxon)",
            control: "$effect:saanich.traces.control({self}, {storyPage}, {storyPage}.map.readyMap, {self}.events, {self}.active, {storyPage}.loaded, {global})",
            showPlayback: "$effect:saanich.traces.showPlayback({self}, {self}.paused)"
        }
    },
    leftPaneClass: "$compute:saanich.traces.leftPaneClass({self}.traces.active, {self}.traces.paused, {self}.traces.scrubbing)",
    paneOverrides: {
        Traces: {
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
            inverseCountTransform: "saanich.inverseWeibullCount",
            // The grid counts records of every type of evidence, not only observations
            legendMarkup: `$compute:saanich.obsGridLegendMarkup({self}.obsQuantiser.grid, {self}.fillStops, {self}.legendStops,
                {self}.maxObsCountOverride, {self}.inverseCountTransform, {self}.obsQuantiser.longResolution, {self}.obsQuantiser.baseLatitude)`,
            // A summary of a map cell, leading with what matters most to the search for lost plants
            gridSelector: {
                $component: {
                    renderTooltip: `$method:saanich.cellTooltip.render({libreMap}.obsQuantiser.grid, {vizLoader}.taxa.rowById,
                        {vizLoader}.finalFilteredObs, {vizLoader}.earliestRecords, {0}:cellId)`
                }
            }
        }
    }
});
</script>
