<script>
"use strict";

// Written by src/js/storyBuild.js from bioreportr.yaml - do not edit. The story's data files, relative to the story page,
// and the settings it shares with the project's R scripts, laid over its story page by naming bioreportr.storyData in the
// $layers of its <project>-story.vue

fluid.def("bioreportr.storyData", {
    $layers: "fluid.component",
    obsFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-catalogue_2026-11-15-selected-labels.csv",
    regionIndirectionFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-catalogue_2026-11-15-selected-regionIndirection.csv",
    taxaFile: "../local/data/tabular/Saanich_Tracheophyta_ultimate-summary_2026-11-15-prepared-taxa.csv",
    curationHistoryFile: "../local/data/tabular/Saanich_Tracheophyta_curation-history_2026-11-15.csv",
    recordAnnotationsFile: "../local/data/tabular/Saanich_Tracheophyta_record-annotations_2026-11-15.csv",
    excludedTaxaFile: "../local/data/tabular/Saanich_Tracheophyta_excluded-taxa_2026-11-15.csv",
    protectedMappedOnly: false
});
</script>
