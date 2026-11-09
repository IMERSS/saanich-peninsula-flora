<script src="../js/i6/solow.js"></script>
<script>
"use strict";

// The slider choosing the radius within which observations of a taxon belong to the same population
fluid.def("bioreportr.solowRadius", {
    $layers: "fluid.component",
    selectedIndex: 4,
    radius: "$compute:bioreportr.solowRadius.indexToRadius({self}.selectedIndex)",
    display: "$compute:bioreportr.solowRadius.display({self}.selectedIndex)",
    ticks: {
        $component: {
            $layers: "fluid.component",
            $for: {
                source: "{solowRadius}.display.ticks",
                valueAs: "tick"
            },
            view: {
                $component: {
                    $layers: "fluid.templateViewComponent",
                    template: "<div class=\"mxcw-solow-radius-snap-marker\"><div class=\"mxcw-solow-radius-snap-tick\"></div><div class=\"mxcw-solow-radius-snap-label\">@{tick.label}</div></div>"
                }
            }
        }
    }
});
</script>

<template>
    <div class="mxcw-solow-radius">
        <div class="mxcw-solow-radius-title">Population radius (m)</div>
        <div class="mxcw-solow-radius-slider-wrap">
            <div class="mxcw-solow-radius-track">
                <div class="mxcw-solow-radius-fill" style="@{display.fill}"></div>
                <input type="range" class="mxcw-solow-radius-input" min="0" max="6" step="1" value="@{selectedIndex}"
                    aria-label="Population radius in metres" @oninput="bioreportr.solowRadius.input({0}, {self})"/>
            </div>
        </div>
        <div class="mxcw-solow-radius-snap-markers" @id="ticks"></div>
        <div class="mxcw-solow-radius-current-value">@{display.value}</div>
        <div class="mxcw-solow-radius-note">*Aggregate sightings into populations: default = 5000 m</div>
    </div>
</template>
