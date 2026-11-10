<script src="../vendor/plotly-2.1.1.js" fluid-client data-fl-scope="global"></script>
<script src="../vendor/htmlwidgets.js" fluid-client data-fl-scope="global"></script>
<script src="../vendor/htmlwidgets-plotly.js" fluid-client data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="../js/story.js"></script>
<style src="../css/imerss-inat-panels.css"></style>
<script>
"use strict";

// The data pane of one pane of the story page, beside the map, which shows the pane's data widgets - e.g. a chart
// whose slider filters observations by year - whilst the pane is active
fluid.def("bioreportr.dataPane", {
    $layers: "fluid.component",
    // pane: PaneSettings - the pane's settings, as the $for iteration variable
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, {self}.pane.paneKey)",
    content: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "$compute:bioreportr.dataPane.fetch({storyPage}.storyBase, {dataPane}.pane.dataFile)"
        }
    },
    // Markup supplied by the project for this pane, e.g. a gallery shown in place of the map
    paneContent: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "$compute:bioreportr.dataPane.paneMarkup({storyPage}.paneMarkup, {dataPane}.pane.paneKey)"
        }
    },
    paneClick: "$method:bioreportr.storyPane.click({storyPage}, {0}:event)",
    widgets: {
        $bindable: {
            bind: "bioreportr.storyPane.renderWidgets({self}.content.view.renderedContainer, {global}.HTMLWidgets)",
            onceOnly: true
        }
    },
    resize: "$effect:bioreportr.dataPane.resize({self}.widgets, {self}.active, {self}.pane.resizeHeight, {global}.Plotly)",
    iNatPanels: {
        $component: {
            $layers: "bioreportr.iNatPanel",
            $for: {
                source: "{dataPane}.pane.iNatPanels",
                valueAs: "panelOptions",
                keyAs: "index"
            }
        }
    },
    sliders: {
        $component: {
            $layers: "bioreportr.choroplethSlider",
            $for: {
                source: "{dataPane}.pane.sliders",
                valueAs: "slider"
            }
        }
    }
});

// Filters observations to those made up to the year chosen by the slider of a data widget, whilst its pane is active
fluid.def("bioreportr.choroplethSlider", {
    $layers: "hortis.obsFilter",
    // slider: Object - as the $for iteration variable, with members `widgetId`, and optionally `animate` and `delay`
    isActive: "{dataPane}.active",
    labels: [],
    sliderIndex: 0,
    element: "$compute:bioreportr.choroplethSlider.element({dataPane}.widgets, {self}.slider.widgetId)",
    binding: {
        $bindable: {
            bind: "bioreportr.choroplethSlider.bind({self}, {self}.element, {global}.Plotly)",
            unbind: "bioreportr.choroplethSlider.unbind({boundValue})",
            onceOnly: true
        }
    },
    yearCache: "$compute:bioreportr.choroplethSlider.yearCache({vizLoader}.obsRows)",
    filterState: "$compute:bioreportr.choroplethSlider.filterState({self}.labels, {self}.sliderIndex)",
    filterSummary: {count: 0, title: ""},
    doFilter: "$method:bioreportr.choroplethSlider.doFilter({0}:obsRows, {1}:filterState, {self}.yearCache)",
    reset: "$method:fluid.identity"
});

// A panel of iNaturalist's observations of a taxon in a place, rendered by the @imerss/inat-components library, which
// the project loads - see the driver of its story page
fluid.def("bioreportr.iNatPanel", {
    $layers: "fluid.component",
    options: "$compute:bioreportr.iNatPanel.options({self}.panelOptions)",
    containerId: "$compute:bioreportr.iNatPanel.containerId({dataPane}.pane.paneKey, {self}.index)",
    view: {
        $component: {
            $layers: "fluid.templateViewComponent",
            template: "<div class=\"mxcw-inat-components\" id=\"@{containerId}\"></div>"
        }
    },
    panel: {
        $bindable: {
            bind: "bioreportr.iNatPanel.bind({self}, {self}.view.renderedContainer, {self}.containerId, {self}.options, {global}.inatComponents)",
            onceOnly: true
        }
    }
});

bioreportr.iNatPanel.containerId = (paneKey, index) => "inat-components-" + paneKey + "-" + index;
</script>

<template>
    <div class="mxcw-dataPane mxcw-dataPane-@{pane.paneKey}" @class="fl-hidden:!@{active}">
        <div @id="content"></div>
        <div class="mxcw-iNatPanels" @id="iNatPanels"></div>
        <div @onclick="{self}.paneClick({0})"><div @id="paneContent"></div></div>
    </div>
</template>
