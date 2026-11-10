<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script>
"use strict";

// Filters the Atlas's records to a span of years chosen by a pair of sliders. A null state shows every record,
// including any without a date. The limits of the sliders are the first and last years of the records
fluid.def("saanich.timePeriodFilter", {
    $layers: "hortis.obsDrivenFilter",
    filterName: "Time period",
    filterState: null,
    // The span shown while a handle is being moved: the records, of which there are many, are filtered only once it is let go
    dragging: null,
    bounds: "$compute:saanich.recordPeriod({self}.obsRows)",
    display: "$compute:saanich.timePeriodFilter.display({self}.bounds, {self}.filterState, {self}.dragging)",
    // The handles are placed from code, since the renderer writes the value of a bound input back into what it is bound to
    placeHandles: "$effect:saanich.timePeriodFilter.placeHandles({self}.display, {global}.document)",
    filterSummary: "$compute:saanich.timePeriodFilter.summarise({self}.filterState)",
    doFilter: "$method:saanich.timePeriodFilter.doFilter({0}:rows, {1}:filterState)",
    reset: "$method:saanich.timePeriodFilter.reset({self})"
});

fluid.registerNamespace("saanich.timePeriodFilter");

saanich.timePeriodFilter.doFilter = function (rows, state) {
    return state ? rows.filter(row => {
        const year = parseInt(row.eventDate, 10);
        return year >= state.min && year <= state.max;
    }) : rows;
};

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
    if (min && max) {
        min.value = display.minPosition;
        max.value = display.maxPosition;
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

// The timer applying each filter's span once its handles have rested, by filter
saanich.timePeriodFilter.timers = new WeakMap();

// How long in milliseconds the handles must rest before the span is applied, should the slider's change event not arrive
saanich.timePeriodFilter.restDelay = 400;

/**
 * Apply a span of years as the filter's state - none if it covers the whole period.
 * @param {saanich.timePeriodFilter} that - The filter
 * @param {Object} span - The span, with members `min` and `max`
 */
saanich.timePeriodFilter.apply = function (that, span) {
    window.clearTimeout(saanich.timePeriodFilter.timers.get(that));
    that.dragging = null;
    that.filterState = span.min <= that.bounds.first && span.max >= that.bounds.last ? null : span;
};

// The years follow a handle as it moves, and the records are filtered once it is let go or has rested a moment
saanich.timePeriodFilter.input = function (event, that) {
    const span = saanich.timePeriodFilter.span(event, that);
    that.dragging = span;
    window.clearTimeout(saanich.timePeriodFilter.timers.get(that));
    saanich.timePeriodFilter.timers.set(that, window.setTimeout(() => saanich.timePeriodFilter.apply(that, span), saanich.timePeriodFilter.restDelay));
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
        <div class="imerss-filter-body saanich-ep-range saanich-time-range">
            <label><span>From</span><input type="range" class="saanich-time-min" min="0" max="1000" step="1"
                value="0" aria-label="Earliest year"/><output>@{display.min}</output></label>
            <label><span>To</span><input type="range" class="saanich-time-max" min="0" max="1000" step="1"
                value="1000" aria-label="Latest year"/><output>@{display.max}</output></label>
        </div>
    </div>
</template>
