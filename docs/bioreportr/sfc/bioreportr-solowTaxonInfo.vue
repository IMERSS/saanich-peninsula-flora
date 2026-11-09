<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/i6/solow.js"></script>
<script>
"use strict";

// The information shown about the taxon chosen for the extirpation risk analysis
fluid.def("bioreportr.solowTaxonInfo", {
    $layers: "fluid.component",
    // taxon: TaxonRow|null, taxonObsRows: Object[] - supplied by the story page
    model: "$compute:bioreportr.solowTaxonInfo.model({self}.taxon, {self}.taxonObsRows)",
    image: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{solowTaxonInfo}.model.taxonImage"
        }
    }
});
</script>

<template>
    <div class="mxcw-solow-taxon-pane" @class="fl-hidden:@{model.none}">
        <div class="mxcw-taxon-image" @id="image"></div>
        <div class="mxcw-taxon-info">
            <div class="mxcw-taxon-name">Taxon: @{model.taxonName}</div>
            <dl class="mxcw-taxon-fields">
                <dt>Date first seen:</dt> <dd>@{model.dateFirstSeen}</dd>
                <dt>Date last seen:</dt> <dd>@{model.dateLastSeen}</dd>
                <dt>Total sightings:</dt> <dd>@{model.numObs}</dd>
                <dt>Regional EP:</dt> <dd>@{model.regionalEP}</dd>
            </dl>
        </div>
    </div>
</template>
