<fluid-import src="../../bioreportr/sfc/bioreportr-storyPage.vue"></fluid-import>
<!-- The story's data files, as its bioreportr.yaml names them - written by src/js/storyBuild.js -->
<fluid-import src="../../story/bioreportr-storyData.vue"></fluid-import>
<!-- The Atlas's filters of records by time period - its filter by locality is a collector filter over another field -->
<fluid-import src="saanich-timePeriodFilter.vue"></fluid-import>
<!-- The iNaturalist panels of the Top Contributions pane -->
<script src="%@imerss/inat-components/dist/standalone.min.js" fluid-client data-fl-scope="global"></script>
<!-- The atlas's panel, tiles and tooltips, and the panes shared with the other bioReportR stories, each rendering its
     section from its own template - see paneComponent in the front matter of content/story/Traces.Rmd, LostPlants.Rmd
     and Protected.Rmd -->
<fluid-import src="../../bioreportr/sfc/bioreportr-atlasPanel.vue"></fluid-import>
<fluid-import src="../../bioreportr/sfc/bioreportr-storyPageTraces.vue"></fluid-import>
<fluid-import src="../../bioreportr/sfc/bioreportr-storyPageLostPlants.vue"></fluid-import>
<fluid-import src="../../bioreportr/sfc/bioreportr-storyPageProtectedAreas.vue"></fluid-import>
<!-- The pane in memory of Harvey Janszen, which frames the areas of his checklists - see content/story/Remembering.Rmd -->
<fluid-import src="../../bioreportr/sfc/bioreportr-storyPageRemembering.vue"></fluid-import>
<!-- The rest particular to this story, which builds on the story page's own summaries in story.js -->
<script src="../../bioreportr/js/story.js"></script>
<script src="../js/saanich.js"></script>
<script>
"use strict";

// The story page of the Saanich Peninsula vascular plant report. Its atlas and the panes it shares with the other
// bioReportR stories are layers of the story page defined in static/bioreportr/sfc, given this story's settings here.
// Its paths are relative to the
// story page, served at /story/, whose panes are written by src/js/storyBuild.js into static/story

fluid.registerNamespace("saanich");

// The proportion of the maximum count shown by each cell of the map's grid is scaled by a Weibull distribution, so
// that the few cells with very many observations do not wash out the rest - see the legend
saanich.weibullCount = (x, maxCount) => maxCount < 200 ? x : 1 - Math.exp(-Math.pow(x / 0.012, 0.5));

saanich.inverseWeibullCount = (x, maxCount) => maxCount < 200 ? x : 0.012 * Math.pow(-Math.log(1 - x), 1 / 0.5);

fluid.def("saanich.story", {
    $layers: ["bioreportr.storyPage", "bioreportr.storyData", "bioreportr.atlasPanel", "bioreportr.storyPageTraces", "bioreportr.storyPageLostPlants",
        "bioreportr.storyPageProtectedAreas", "bioreportr.storyPageRemembering"],
    gridResolution: 1000,
    // The regions which may filter the records - a category of protected area, or all the KBAs, is matched through rows
    // of the region index giving each area or KBA the label of its group, see GroupField in scripts/intersectShapes.R
    regionFilterFieldNames: ["BEC", "ProtectedArea", "KBA"],
    // The period of the records, over which the extirpation risk analysis always runs
    recordPeriod: "$compute:saanich.recordPeriod({self}.pkg)",
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
    // In the order in which a search is most often narrowed, each value with the label shown for it
    taxaFilterRecords: [
        {filterName: "Introduction", fieldName: "introduction_status", fieldValues: ["native", "exotic", "unknown"],
            fieldLabels: ["Native", "Exotic", "Unknown"]},
        {filterName: "Conservation", fieldName: "provincial_concern", fieldValues: ["concern", "secure"],
            fieldLabels: ["Of concern", "Secure"]},
        {filterName: "Provenance", fieldName: "provenance_status", fieldValues: ["voucher", "no_voucher", "unknown"],
            fieldLabels: ["Vouchered", "Not vouchered", "Unknown"]},
        {filterName: "Rank", fieldName: "infrataxon_status", fieldValues: ["non-infrataxon", "infrataxon"],
            fieldLabels: ["Species", "Subspecies or variety"]},
        {filterName: "Graminoid", fieldName: "graminoid", fieldValues: ["graminoid", "non-graminoid"], valueOf: "hortis.graminoidValue",
            fieldLabels: ["Graminoid", "Other"]}
    ],
    // The columns of the table of records, ordered to bring forward what helps in finding the plant again and in assessing
    // the record - the rest of each record's fields, e.g. its licence or GBIF id, are in the download of the records.
    // This order is deliberately this story's own, serving the search for its "lost" plants, and is not the shared
    // default: bioreportr.storyPage leaves recordColumns empty, for each story to give its own
    recordColumns: [
        {key: "eventDate", label: "Date", formatter: "saanich.formatDate"},
        {key: "taxon_name", label: "Taxon"},
        // Where to look: the place named, its position and how far from it the plant may be, and the elevation
        {key: "locality", label: "Locality"},
        {key: "decimalLatitude", label: "Latitude"},
        {key: "decimalLongitude", label: "Longitude"},
        {key: "coordinateUncertaintyInMeters", label: "Uncertainty (m)"},
        {key: "elevation", label: "Elevation"},
        // Who found it, and the evidence for it - a specimen, an observation or a list - by which it may be checked
        {key: "recordedBy", label: "Recorder"},
        {key: "basisOfRecord", label: "Record type"},
        {key: "collectionCode", label: "Source"},
        {key: "institutionCode", label: "Institution"},
        {key: "catalogNumber", label: "Catalogue no."},
        // Whether it was planted or escaped, by which a find may be weighed
        {key: "establishmentMeans", label: "Establishment"},
        {key: "occurrenceID", label: "Occurrence ID"}
    ],
    // The taxa of the summary with their counts of records with and without coordinates
    summaryTaxa: "$compute:bioreportr.summaryTaxaRows({self}.taxa.allRows)",
    annotatedTaxa: "$compute:saanich.annotateGeoref({self}.summaryTaxa, {self}.pkg)",
    solowTaxa: {
        $component: {
            taxaFilters: {
                $component: {
                    allInput: "{storyPage}.annotatedTaxa"
                }
            }
        }
    },
    // The Atlas's records may also be narrowed by the places named in them and by a span of years, filters placed by the
    // slots of the same names in the story page's filter panel
    // The species of the Community Science pane, which open on the Atlas, are those of the iNaturalist project of its
    // panels - see paneOverrides below
    inatSpeciesQuery: {project_id: 303782},
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
    // The Saanich Peninsula's record spans more than 160 years, so the opening timeline's pass is unhurried, and opens on
    // a random year - see bioreportr.traces.pacingDefaults in bioreportr-tracesPane.vue
    traces: {
        $component: {
            pacing: {
                targetMs: 240000
            }
        }
    },
    // Populations are aggregated at 1000 m by default, the third of the radius slider's snap values
    solowRadius: {
        $component: {
            defaultIndex: 2,
            selectedIndex: 2
        }
    },
    // The sources of that history, by the column of the file holding each, oldest first - each with the citation which
    // follows its notes on the cards of the Lost Plants gallery, none for the reviewers, who sign their own notes
    curationHistorySources: [
        // Each with the year and words by which the Atlas names it among the lists before us, and the abbreviation by which
        // a list marks the plants it treated - see bioreportr.atlas.sourcesMarkup and bioreportr.list
        {field: "original", source: "Szczawinski & Harrison", label: "Original account", cite: "Szczawinski & Harrison 1972",
            year: "1972", description: "Flora of the Saanich Peninsula", abbreviation: "FSP"},
        {field: "harvey", source: "Harvey Janszen", label: "Revised account", cite: "Janszen 2021",
            year: "1973–2017", description: "His revision of the Flora", abbreviation: "HJ"},
        {field: "fpnw", source: "Flora of the Pacific Northwest", label: "Remarks", cite: "Flora of the Pacific Northwest",
            year: "2018", description: "Remarks on the peninsula's plants", abbreviation: "FPNW"},
        {field: "critical", source: "Reviewers", label: "Critical notes", cite: "",
            year: "Today", description: "Critical review of each account", abbreviation: "Rev"}
    ],
    // The extirpation risk pane opens on whichever species is at the top of its list, with the map fitted to its records
    solowShown: "$compute:bioreportr.storyPage.isActive({self}.activePaneKey, Solow)",
    selectTopSpecies: "$effect:saanich.selectTopSpecies({self}, {self}.solowShown, {self}.loaded, {self}.solowTaxa.taxaTable.displayRows)",
    // The Download list panel names the story's whole area so, and its files so - see bioreportr-list.vue
    list: {
        $component: {
            areaName: "the whole Saanich Peninsula",
            // The stem of each downloaded checklist's file name - the site's title without its W̱SÁNEĆ, for a plain name
            fileStem: "Flora-of-the-Saanich-Peninsula"
        }
    },
    paneOverrides: {
        Traces: {
            visibleMap: true
        },
        Remembering: {
            visibleMap: true,
            // Harvey's pane frames the areas of his checklists itself - see bioreportr.remembering.frame
            framesItself: true
        },
        Solow: {
            layers: ["reknitr.solowPaneHandler"]
        },
        TopContributions: {
            iNatPanels: [{
                // The iNaturalist project "Lost" plants of the Saanich Peninsula, whose own rules choose its observations
                project: {
                    id: 303782,
                    str: "lostplants"
                },
                features: [{ // recentObservations
                    desc: "Recent observations of the Saanich Peninsula's \"lost\" plants"
                }, { // commonTaxa
                    desc: "The Saanich Peninsula's \"lost\" plants most often found again"
                }, { // favourites
                    desc: "The most favourited observations of the Saanich Peninsula's \"lost\" plants"
                }, { // stats
                    desc: "Statistics of the observations of the Saanich Peninsula's \"lost\" plants"
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
