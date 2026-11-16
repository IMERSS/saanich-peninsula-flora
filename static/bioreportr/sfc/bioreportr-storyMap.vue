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

/**
 * Compute the predicates of a filter of the observations to those within any of the polygons drawn, as
 * hortis.libreMap.polygonFilter.predicates does, but from plain copies of the polygons rather than their proxies.
 * @param {Object[]} filterState - The polygons drawn, as GeoJSON features
 * @return {Object[]} The predicates
 */
bioreportr.storyMap.polygonPredicates = function (filterState) {
    const features = bioreportr.storyMap.bareFeatures(filterState);
    return features.length === 0 ? [] :
        [{field: ["decimalLongitude", "decimalLatitude"], op: "inPolygons", value: {type: "FeatureCollection", features}}];
};

// Copy nested arrays of numbers, e.g. a polygon's rings, element by element, so that no proxy is read whole
bioreportr.storyMap.copyCoordinates = function (value) {
    const bare = fluid.unwrapProxy(value);
    return Array.isArray(bare) ? Array.from({length: bare.length}, (x, i) => bioreportr.storyMap.copyCoordinates(bare[i])) : Number(bare);
};

/**
 * The polygons drawn, as plain GeoJSON features holding their geometry alone.
 * @param {Object[]} filterState - The polygons drawn, possibly as a proxy
 * @return {Object[]} The features
 */
bioreportr.storyMap.bareFeatures = function (filterState) {
    const bare = fluid.unwrapProxy(filterState) || [];
    return Array.from({length: bare.length}, (x, i) => fluid.unwrapProxy(bare[i])).filter(feature => feature?.geometry).map(feature => ({
        type: "Feature",
        properties: {},
        geometry: {type: String(fluid.unwrapProxy(feature.geometry).type), coordinates: bioreportr.storyMap.copyCoordinates(fluid.unwrapProxy(feature.geometry).coordinates)}
    }));
};

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
    // The predicates of the polygons drawn, from plain copies of them - imerss-bioinfo 1.22.0's own embed the proxied
    // polygons, which can't be serialised, so that any polygon drawn leaves every selection unavailable. To be dropped
    // once the fix is released upstream - see bioreportr.storyMap.polygonPredicates
    polygonDraw: {
        $component: {
            predicates: "$compute:bioreportr.storyMap.polygonPredicates({self}.filterState)"
        }
    },
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
    highlightRegion: "$effect:bioreportr.storyMap.highlightRegion({self}.readyMap, {storyPage}.selectedRegion, {storyPage}.mapData)",
    // A pane opened from one without a map is placed on its camera once the map has its size - see
    // bioreportr.storyMap.recentre
    recentre: "$effect:bioreportr.storyMap.recentre({self}.readyMap, {storyPage}.mapData, {storyPage}.activePane)",
    // On a phone one finger scrolls the page past the map, and two move the map - see bioreportr.storyMap.phoneGestures
    phoneGestures: "$effect:bioreportr.storyMap.phoneGestures({self}.readyMap, {global})",
    legendRows: "$compute:bioreportr.storyMap.legendRows({storyPage}.activePane, {storyPage}.regionIndirectionRows, {storyPage}.mapData.style.layers)",
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
