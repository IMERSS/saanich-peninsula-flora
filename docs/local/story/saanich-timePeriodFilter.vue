<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script>
"use strict";

// Filters the Atlas's records to a span of years chosen by the two handles of one slider, the earliest year on its left
// and the latest on its right, the span between them highlighted. A null state shows every record,
// including any without a date. The limits of the sliders are the first and last years of the records
fluid.def("saanich.timePeriodFilter", {
    $layers: "hortis.obsDrivenFilter",
    filterName: "Time period",
    filterState: null,
    // The span shown while a handle is being moved: the records, of which there are many, are filtered only once it is let go
    dragging: null,
    // The period of the records, computed once by the story
    bounds: "{storyPage}.recordPeriod",
    display: "$compute:saanich.timePeriodFilter.display({self}.bounds, {self}.filterState, {self}.dragging)",
    // The handles are placed from code, since the renderer writes the value of a bound input back into what it is bound to
    placeHandles: "$effect:saanich.timePeriodFilter.placeHandles({self}.display, {global}.document)",
    filterSummary: "$compute:saanich.timePeriodFilter.summarise({self}.filterState)",
    predicates: "$compute:saanich.timePeriodFilter.predicates({self}.filterState)",
    // The span being dragged is applied once the handles have rested, should the slider's change event not arrive
    applyRested: {
        $effect: {
            func: "saanich.timePeriodFilter.applyRested",
            args: ["{self}", "{self}.dragging"],
            debounce: 400
        }
    },
    reset: "$method:saanich.timePeriodFilter.reset({self})"
});

fluid.registerNamespace("saanich.timePeriodFilter");

/**
 * Compute the predicates of a filter of the records to a span of years - a record without a year is outside any.
 * @param {Object|null} state - The span, with members `min` and `max`, or null if every record is shown
 * @return {Object[]} The predicates
 */
saanich.timePeriodFilter.predicates = state => state ? [{field: {year: "eventDate"}, op: "between", value: [state.min, state.max]}] : [];

// The sliders run over a fixed scale of positions, since the renderer does not keep bound `min` and `max` attributes of an
// input, and each position is converted to a year within the period of the records
saanich.timePeriodFilter.scale = 1000;

saanich.timePeriodFilter.toPosition = (year, bounds) => bounds.last > bounds.first ?
    Math.round((year - bounds.first) / (bounds.last - bounds.first) * saanich.timePeriodFilter.scale) : 0;

saanich.timePeriodFilter.toYear = (position, bounds) =>
    Math.round(bounds.first + position / saanich.timePeriodFilter.scale * (bounds.last - bounds.first));

saanich.timePeriodFilter.display = function (bounds, state, dragging) {
    const span = dragging || state || {min: bounds.first, max: bounds.last};
    return {min: span.min, max: span.max,
        minPosition: saanich.timePeriodFilter.toPosition(span.min, bounds), maxPosition: saanich.timePeriodFilter.toPosition(span.max, bounds)};
};

saanich.timePeriodFilter.placeHandles = function (display, dokkument) {
    const min = dokkument.querySelector(".saanich-time-min"), max = dokkument.querySelector(".saanich-time-max");
    const fill = dokkument.querySelector(".saanich-time-fill");
    if (min && max) {
        min.value = display.minPosition;
        max.value = display.maxPosition;
    }
    // The span chosen is highlighted on the track between the handles
    if (fill) {
        const scale = saanich.timePeriodFilter.scale;
        fill.style.left = `${display.minPosition / scale * 100}%`;
        fill.style.right = `${100 - display.maxPosition / scale * 100}%`;
    }
};

saanich.timePeriodFilter.summarise = state => ({count: state ? 1 : 0, title: state ? `Records from ${state.min} to ${state.max}` : ""});

/**
 * The span of the sliders, the one being moved pushing the other along rather than crossing it.
 * @param {Event} event - The input or change event of one of the sliders
 * @param {saanich.timePeriodFilter} that - The filter, whose current span is that being dragged, else its state, else the whole period
 * @return {Object} The new span, with members `min` and `max`
 */
saanich.timePeriodFilter.span = function (event, that) {
    const bounds = that.bounds;
    const current = that.dragging || that.filterState || {min: bounds.first, max: bounds.last};
    const value = saanich.timePeriodFilter.toYear(+event.target.value, bounds);
    return event.target.classList.contains("saanich-time-min") ? {min: value, max: Math.max(current.max, value)} :
        {min: Math.min(current.min, value), max: value};
};

/**
 * Apply a span of years as the filter's state - none if it covers the whole period.
 * @param {saanich.timePeriodFilter} that - The filter
 * @param {Object} span - The span, with members `min` and `max`
 */
saanich.timePeriodFilter.apply = function (that, span) {
    that.dragging = null;
    that.filterState = span.min <= that.bounds.first && span.max >= that.bounds.last ? null : span;
};

/**
 * Apply the span being dragged, once the handles have rested - see the filter's `applyRested`.
 * @param {saanich.timePeriodFilter} that - The filter
 * @param {Object|null} dragging - The span being dragged, if any
 */
saanich.timePeriodFilter.applyRested = function (that, dragging) {
    const span = fluid.unwrapProxy(dragging);
    if (span) {
        saanich.timePeriodFilter.apply(that, span);
    }
};

// The years follow a handle as it moves, and the records are filtered once it is let go or has rested a moment - see
// the filter's `applyRested`
saanich.timePeriodFilter.input = function (event, that) {
    that.dragging = saanich.timePeriodFilter.span(event, that);
};

saanich.timePeriodFilter.change = function (event, that) {
    saanich.timePeriodFilter.apply(that, saanich.timePeriodFilter.span(event, that));
};

saanich.timePeriodFilter.reset = function (that) {
    that.dragging = null;
    that.filterState = null;
};
</script>

<template>
    <div class="imerss-time-filter" @oninput="saanich.timePeriodFilter.input({0}, {self})" @onchange="saanich.timePeriodFilter.change({0}, {self})">
        <div class="imerss-filter-title">@{filterName}:</div>
        <!-- One track with two handles - two range inputs laid over each other, each letting only its handle be dragged -
             the earliest year shown at its left and the latest at its right -->
        <div class="imerss-filter-body saanich-time-range">
            <output class="saanich-time-year">@{display.min}</output>
            <div class="saanich-time-track">
                <div class="saanich-time-fill"></div>
                <input type="range" class="saanich-time-min" min="0" max="1000" step="1" value="0" aria-label="Earliest year"/>
                <input type="range" class="saanich-time-max" min="0" max="1000" step="1" value="1000" aria-label="Latest year"/>
            </div>
            <output class="saanich-time-year">@{display.max}</output>
        </div>
    </div>
</template>

<style>
/* The time period filter's slider: the earliest year, a single track holding both handles with the span between them
   highlighted, and the latest year, on one line */
#imerss-main-filters .saanich-time-range {
    display: grid;
    grid-template-columns: 2.8em minmax(0, 1fr) 2.8em;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: var(--story-data);
}

#imerss-main-filters .saanich-time-year {
    color: #4b778f;
    font-variant-numeric: tabular-nums;
    text-align: center;
}

.saanich-time-track {
    position: relative;
    height: 22px;
}

/* The track itself, beneath the handles, and the span chosen upon it */
.saanich-time-track::before,
.saanich-time-fill {
    position: absolute;
    top: 50%;
    height: 4px;
    border-radius: 2px;
    transform: translateY(-50%);
}

.saanich-time-track::before {
    content: "";
    left: 0;
    right: 0;
    background: #d4dde2;
}

.saanich-time-fill {
    left: 0;
    right: 0;
    background: #4b778f;
}

/* The two inputs lie over each other across the whole track, transparent but for their handles, which alone take the
   pointer, so that either may be dragged wherever it stands */
.saanich-time-track input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
    appearance: none;
}

.saanich-time-track input[type="range"]::-webkit-slider-runnable-track {
    background: none;
}

.saanich-time-track input[type="range"]::-moz-range-track {
    background: none;
}

.saanich-time-track input[type="range"]::-webkit-slider-thumb {
    width: 16px;
    height: 16px;
    background: #ffffff;
    border: 2px solid #4b778f;
    border-radius: 50%;
    cursor: pointer;
    pointer-events: auto;
    -webkit-appearance: none;
    appearance: none;
}

.saanich-time-track input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #ffffff;
    border: 2px solid #4b778f;
    border-radius: 50%;
    cursor: pointer;
    pointer-events: auto;
}

.saanich-time-track input[type="range"]:focus-visible::-webkit-slider-thumb {
    outline: 2px solid #4b778f;
    outline-offset: 2px;
}
</style>
