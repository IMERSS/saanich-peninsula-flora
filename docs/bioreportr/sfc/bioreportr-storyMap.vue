<script src="%maplibre-gl/dist/maplibre-gl-dev.js" fluid-client data-fl-scope="global"></script>
<script src="%@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw-unminified.js" fluid-client data-fl-scope="global"></script>
<script src="%@popperjs/core/dist/umd/popper-lite.min.js" fluid-client data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/lib/point-in-polygon.js" data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/geom/geoJSON.js" data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/colour.js" data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/tooltip.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/libreMap.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/polygonDraw.js"></script>
<script src="../js/story.js"></script>
<style src="%imerss-bioinfo/src/client/css/maplibre-gl.css"></style>
<style src="%imerss-bioinfo/src/client/css/mapbox-gl-draw.css"></style>
<script>
"use strict";

// The map of the story page, whose style holds the layers of every pane's map, as gathered by storyBuild.js. The
// layers of the active pane are shown, and the camera moved to it. The grid of observations is shown for panes which
// ask for it. A pane's selectable regions are selected by clicking on them or on the rows of its legend, which for a
// pane coloured by reporting status selects a status instead
fluid.def("bioreportr.storyMap", {
    $layers: ["hortis.libreMap.withPolygonDraw", "hortis.libreMap.withObsGridLegend", "hortis.libreObsMap"],
    legendPosition: "bottom-left",
    // Flights between panes whose zoom differs greatly take slowZoomDuration, others the map's zoomDuration
    slowZoomDuration: 3000,
    // Clearing the filters returns the map to the active pane's camera, or else the first pane's which has one
    homeCamera: "$compute:bioreportr.storyMap.homeCamera({storyPage}.mapData, {storyPage}.activePaneKey)",
    cartoKeys: {
        localhost: "cb1_4hrx_2_3dcc491b6c32aa8e72a242f0",
        imerss: "cb1_4hrx_1_114bebb1982ec5829bdf5497"
    },
    style: "$compute:bioreportr.storyMap.styleWithCartoKeys({storyPage}.mapData.style, {self}.cartoKeys, {global}.location)",
    fillPatterns: "{storyPage}.mapData.fillPatterns",
    gridResolution: "{storyPage}.gridResolution",
    gridVisible: "{storyPage}.activePane.visibleGrid",
    maxObsCountOverride: "{storyPage}.activePane.maxObsCountOverride",
    // A summary of a map cell, by the reporting status of its species - see bioreportr.cellTooltip
    gridSelector: {
        $component: {
            renderTooltip: "$method:bioreportr.cellTooltip.render({libreMap}.obsQuantiser.grid, {vizLoader}.taxa.rowById, {0}:cellId)"
        }
    },
    showPane: "$effect:bioreportr.storyMap.showPane({self}, {self}.readyMap, {storyPage}.mapData, {storyPage}.activePaneKey)",
    regionSelector: {
        $component: {
            $layers: "hortis.libreMap.clickHandler",
            handle: "$method:bioreportr.storyMap.handleRegionClick({storyPage}, {libreMap}.map, {0}:event, {storyPage}.activePane.selectableRegions)",
            resetSelection: "$method:bioreportr.storyPage.selectRegion({storyPage}, {self}.noRegion)",
            noRegion: null
        }
    },
    highlightRegion: "$effect:bioreportr.storyMap.highlightRegion({self}.readyMap, {storyPage}.selectedRegion)",
    legendRows: "$compute:bioreportr.storyMap.legendRows({storyPage}.activePane, {storyPage}.regionIndirection.rows, {storyPage}.mapData.style.layers)",
    legendRowsMarkup: "$compute:bioreportr.storyMap.legendMarkup({self}.legendRows, {storyPage}.selectedStatus, {storyPage}.selectedRegion)",
    regionLegend: {
        $bindable: {
            bind: "bioreportr.storyMap.addRegionLegend({self}.readyMap, {storyPage}, {global}.document)",
            onceOnly: true
        }
    },
    renderRegionLegend: "$effect:bioreportr.storyMap.renderRegionLegend({self}.regionLegend, {self}.legendRowsMarkup)",
    sizeTracker: {
        $bindable: {
            bind: "bioreportr.storyMap.trackSize({self}.map, {self}.mapContainer, {global})",
            unbind: "bioreportr.storyMap.untrackSize({boundValue})",
            onceOnly: true
        }
    }
});
</script>
