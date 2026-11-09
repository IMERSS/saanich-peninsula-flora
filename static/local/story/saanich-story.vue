<fluid-import src="../../bioreportr/sfc/bioreportr-storyPage.vue"></fluid-import>
<!-- The iNaturalist panels of the Top Contributions pane -->
<script src="%@imerss/inat-components/dist/standalone.min.js" fluid-client data-fl-scope="global"></script>
<script>
"use strict";

// The story page of the Saanich Peninsula vascular plant report. Its paths are relative to the story page, served at
// /story/, whose panes are written by bagatelle's src/story/storyBuild.js into static/story

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
    solowParams: {
        baselineYear: 1859,
        analysisYear: 2025
    },
    taxonColumns: [
        {key: "scientificName", label: "Taxon name"},
        {key: "solow_EP", label: "EP"},
        {key: "n_obs", label: "obs"},
        {key: "taxon_rank", label: "Rank"},
        {key: "introduction_status", label: "Introduction"},
        {key: "provenance_status", label: "Has Voucher"},
        {key: "commonName", label: "Common Name"},
        {key: "reportingStatus", label: "Reporting status"},
        {key: "id", label: "ID"},
        {key: "iNaturalistTaxonName", label: "Link name"}
    ],
    taxaFilterRecords: [
        {filterName: "Infrataxon Status", fieldName: "infrataxon_status", fieldValues: ["infrataxon", "non-infrataxon"]},
        {filterName: "Introduction Status", fieldName: "introduction_status", fieldValues: ["native", "exotic", "unknown"]},
        {filterName: "Provenance Status", fieldName: "provenance_status", fieldValues: ["voucher", "no_voucher", "unknown"]},
        {filterName: "Conservation Status", fieldName: "provincial_concern", fieldValues: ["concern", "secure"]},
        {filterName: "Graminoid status", fieldName: "graminoid", fieldValues: ["graminoid", "non-graminoid"], valueOf: "hortis.graminoidValue"}
    ],
    paneOverrides: {
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
                    desc: "This page lists the most recent observations of vascular plants made in the Saanich Peninsula. Click on any of them to go to the iNaturalist site for more information."
                }, { // commonTaxa
                    desc: "This page lists the most commonly reported species in the Saanich Peninsula. You can use the dropdown at the top right to filter the results to a particular year."
                }, { // favourites
                    desc: "Any time iNaturalist users encounter an observation they like, they can choose to \"favourite\" it. This page lists the most favourited vascular plants observations made in the Saanich Peninsula."
                }]
            }]
        }
    },
    map: {
        $component: {
            $layers: ["hortis.libreMap.withTiles", "hortis.libreMap.esriTiles"],
            zoomDuration: 0,
            slowZoomDuration: 0,
            countTransform: "saanich.weibullCount",
            inverseCountTransform: "saanich.inverseWeibullCount"
        }
    }
});
</script>
