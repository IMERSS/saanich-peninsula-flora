<fluid-import src="%imerss-bioinfo/src/client/sfc/core/hortis-recordReporter.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script>
"use strict";

// Reports how many observations survive the filters, and how many taxa of the project's summary they hold
fluid.def("bioreportr.recordAndTaxaReporter", {
    $layers: "hortis.recordReporter",
    // taxa: Object<String, Boolean> - the taxa of the surviving observations and their ancestors
    // rowById: Object<String, TaxonRow>
    taxaCount: "$compute:bioreportr.recordAndTaxaReporter.taxaCount({self}.taxa, {self}.rowById)"
});

fluid.registerNamespace("bioreportr.recordAndTaxaReporter");

bioreportr.recordAndTaxaReporter.taxaCount = function (taxa, rowById) {
    return hortis.formatInt(Object.keys(taxa).filter(id => rowById[id]?.inSummary).length);
};
</script>

<template>
    <div class="imerss-reporter imerss-record-reporter">
        <p>Displaying <b>@{counts.filteredRows}</b> of <span>@{counts.allRows}</span> records for <span>@{taxaCount}</span> taxa</p>
    </div>
</template>
