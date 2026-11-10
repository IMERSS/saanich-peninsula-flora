<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="../js/solow.js"></script>
<script>
"use strict";

// Filters the taxa of the extirpation risk analysis by their range of extirpation probability, chosen by a pair of
// sliders
fluid.def("bioreportr.epFilter", {
    $layers: "hortis.taxaFilter",
    filterName: "Extirpation probability (EP)",
    // The range, between 0 and 1
    filterState: {min: 0, max: 1},
    display: "$compute:bioreportr.epFilter.display({self}.filterState)",
    filterSummary: "$compute:bioreportr.epFilter.summarise({self}.filterState)",
    doFilter: "$method:bioreportr.epFilter.doFilter({0}:rows, {1}:filterState)",
    reset: "$method:bioreportr.epFilter.reset({self})"
});
</script>

<template>
    <div class="imerss-ep-filter-body" @oninput="bioreportr.epFilter.input({0}, {self})">
        <div class="imerss-filter-title">@{filterName}:</div>
        <div class="imerss-filter-body mxcw-ep-range">
            <label><span>Min</span><input type="range" class="mxcw-ep-min" min="0" max="100" step="5" value="@{display.min}"
                aria-label="Minimum extirpation probability"/><output>@{display.minText}</output></label>
            <label><span>Max</span><input type="range" class="mxcw-ep-max" min="0" max="100" step="5" value="@{display.max}"
                aria-label="Maximum extirpation probability"/><output>@{display.maxText}</output></label>
        </div>
    </div>
</template>
