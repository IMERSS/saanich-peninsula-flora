<script src="../js/solow.js"></script>
<script>
"use strict";

// The slider choosing the radius within which observations of a taxon belong to the same population
fluid.def("bioreportr.solowRadius", {
    $layers: "fluid.component",
    // The index of the default radius among the snap values, which a story may override along with selectedIndex
    defaultIndex: 4,
    selectedIndex: 4,
    defaultRadius: "$compute:bioreportr.solowRadius.indexToRadius({self}.defaultIndex)",
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
    <!-- A slim strip: its title, the slider with its scale beneath, and the radius chosen. The default is told on hovering -->
    <div class="mxcw-solow-radius" title="Aggregates sightings into populations - the default radius is @{defaultRadius} m">
        <div class="mxcw-solow-radius-title">Population radius</div>
        <div class="mxcw-solow-radius-scale">
            <div class="mxcw-solow-radius-slider-wrap">
                <div class="mxcw-solow-radius-track">
                    <div class="mxcw-solow-radius-fill" style="@{display.fill}"></div>
                    <input type="range" class="mxcw-solow-radius-input" min="0" max="6" step="1" value="@{selectedIndex}"
                        aria-label="Population radius in metres" @oninput="bioreportr.solowRadius.input({0}, {self})"/>
                </div>
            </div>
            <div class="mxcw-solow-radius-snap-markers" @id="ticks"></div>
        </div>
        <div class="mxcw-solow-radius-current-value">@{display.value}</div>
    </div>
</template>
