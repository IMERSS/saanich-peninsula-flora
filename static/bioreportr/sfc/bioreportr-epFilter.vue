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
    // The handles are placed from code: the renderer writes the value of a bound input back into what it is bound to,
    // which left the readings stuck and the other handle out of place
    placeHandles: "$effect:bioreportr.epFilter.placeHandles({self}.display, {global}.document)",
    filterSummary: "$compute:bioreportr.epFilter.summarise({self}.filterState)",
    doFilter: "$method:bioreportr.epFilter.doFilter({0}:rows, {1}:filterState)",
    reset: "$method:bioreportr.epFilter.reset({self})"
});

/**
 * Place the handles of the sliders at the range of the filter's state.
 * @param {Object} display - The range as percentages, with members `min` and `max`
 * @param {Document} dokkument - The document holding the filter
 */
bioreportr.epFilter.placeHandles = function (display, dokkument) {
    const min = dokkument.querySelector(".mxcw-ep-min"), max = dokkument.querySelector(".mxcw-ep-max");
    if (min && max) {
        min.value = display.min;
        max.value = display.max;
    }
};
</script>

<template>
    <div class="imerss-ep-filter-body" @oninput="bioreportr.epFilter.input({0}, {self})">
        <div class="imerss-filter-title">@{filterName}:</div>
        <div class="imerss-filter-body mxcw-ep-range">
            <label><span>Min</span><input type="range" class="mxcw-ep-min" min="0" max="100" step="5" value="0"
                aria-label="Minimum extirpation probability"/><output>@{display.minText}</output></label>
            <label><span>Max</span><input type="range" class="mxcw-ep-max" min="0" max="100" step="5" value="100"
                aria-label="Maximum extirpation probability"/><output>@{display.maxText}</output></label>
        </div>
    </div>
</template>
