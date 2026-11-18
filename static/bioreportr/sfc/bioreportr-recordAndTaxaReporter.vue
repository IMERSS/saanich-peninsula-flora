<fluid-import src="%imerss-bioinfo/src/client/sfc/core/hortis-recordReporter.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script>
"use strict";

// Reports how many observations survive the filters, and how many taxa of the project's summary they hold - with any taxa
// kept off the checklist which the Checklist status filter shows - see bioreportr.checklistStatusFilter
fluid.def("bioreportr.recordAndTaxaReporter", {
    $layers: "hortis.recordReporter",
    // taxa: Object<String, Boolean> - the taxa of the surviving observations and their ancestors
    // rowById: Object<String, TaxonRow>
    // The checklist statuses shown, whose taxa kept off the list are counted beside the summary's
    statusesShown: "{storyPage}.checklistStatusFilter.shown",
    taxaCount: "$compute:bioreportr.recordAndTaxaReporter.taxaCount({self}.taxa, {self}.rowById, {self}.statusesShown)"
});

fluid.registerNamespace("bioreportr.recordAndTaxaReporter");

bioreportr.recordAndTaxaReporter.taxaCount = function (taxa, rowById, statusesShown = []) {
    // A taxon kept off the list is counted only while its status is shown, since it may also be the parent of one of
    // the list's own taxa, e.g. a species of which a variety is listed, and so among the taxa of the list's records
    return hortis.formatInt(Object.keys(taxa).filter(id => rowById[id]?.inSummary ||
        rowById[id]?.checklist_status && statusesShown.includes(rowById[id].checklist_status)).length);
};
</script>

<template>
    <div class="imerss-reporter imerss-record-reporter">
        <p>Displaying <b>@{counts.filteredRows}</b> of <span>@{counts.allRows}</span> records for <span>@{taxaCount}</span> taxa</p>
    </div>
</template>
