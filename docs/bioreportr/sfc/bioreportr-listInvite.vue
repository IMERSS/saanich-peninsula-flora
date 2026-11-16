<script>
"use strict";

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
fluid.registerNamespace("bioreportr.listInvite");

// The invitation to make a list, a tile laid over the Atlas's map on first view - see bioreportr-storyPage.vue's slot
// listInvite. It is closed by its X, which is remembered for the rest of the visit, or by making a selection of a place
fluid.def("bioreportr.listInvite", {
    $layers: "fluid.component",
    // The panes on which the invitation is shown
    panes: ["Status"],
    // The key under which its closing is remembered in the browser's storage
    storageKey: "bioreportr-list-invite-closed",
    dismissed: false,
    restore: "$effect:bioreportr.listInvite.restore({self}, {self}.storageKey, {global})",
    hasSelection: "$compute:bioreportr.listInvite.hasSelection({storyPage}.selectedRegion, {storyPage}.map.polygonDraw.filterState, {storyPage}.map.gridSelector.filterState)",
    shown: "$compute:bioreportr.listInvite.shown({storyPage}.activePaneKey, {self}.panes, {self}.dismissed, {self}.hasSelection)",
    close: "$method:bioreportr.listInvite.close({self}, {self}.storageKey, {global})",
    draw: "$method:bioreportr.listInvite.draw({self}, {storyPage})",
    // A button over the map clears the area drawn, which the shape tool's own bin does less plainly
    hasPolygon: "$compute:bioreportr.listInvite.hasPolygon({storyPage}.map.polygonDraw.filterState)",
    clearArea: "$method:bioreportr.listInvite.clearArea({storyPage})"
});

bioreportr.listInvite.restore = function (that, storageKey, window) {
    let closed = false;
    try {
        closed = window.sessionStorage.getItem(storageKey) === "true";
    } catch (e) {
        closed = false;
    }
    if (closed) {
        // Deferred since an effect may not write signals
        fluid.invokeLater(() => that.dismissed = true);
    }
};

bioreportr.listInvite.hasSelection = (region, polygons, cell) => !!region || fluid.makeArray(fluid.unwrapProxy(polygons)).length > 0 ||
    hortis.isValue(fluid.unwrapProxy(cell)) && !(Array.isArray(fluid.unwrapProxy(cell)) && fluid.unwrapProxy(cell).length === 0) &&
    !(typeof(fluid.unwrapProxy(cell)) === "object" && Object.keys(fluid.unwrapProxy(cell) || {}).length === 0);

bioreportr.listInvite.shown = (activePaneKey, panes, dismissed, hasSelection) => fluid.makeArray(panes).includes(activePaneKey) && !dismissed && !hasSelection;

bioreportr.listInvite.close = function (that, storageKey, window) {
    that.dismissed = true;
    try {
        window.sessionStorage.setItem(storageKey, "true");
    } catch (e) {
        // A browser without storage shows the invitation again when the page reloads
    }
};

bioreportr.listInvite.hasPolygon = polygons => (fluid.unwrapProxy(polygons) || []).length > 0;

bioreportr.listInvite.clearArea = function (storyPage) {
    storyPage.map.polygonDraw.reset();
};

/**
 * Start drawing an area on the map, as the shape tool at its top left does, the invitation stepping aside for this view.
 * @param {bioreportr.listInvite} that - The invitation
 * @param {bioreportr.storyPage} storyPage - The story page
 */
bioreportr.listInvite.draw = function (that, storyPage) {
    that.dismissed = true;
    const record = fluid.unwrapProxy(storyPage.map.polygonDraw.mapboxDraw);
    record?.draw?.changeMode("draw_polygon");
};
</script>

<style>
/* The invitation to make a list, over the Atlas's map - see bioreportr.listInvite */
.mxcw-list-invite {
    position: absolute;
    top: 12px;
    left: 56px;
    z-index: 6;
    max-width: 340px;
    padding: 12px 14px;
    color: #eefaff;
    background: rgba(13, 48, 64, 0.94);
    border-top: 3px solid #FDF2CE;
    border-radius: var(--data-table-radius, 6px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    font-size: var(--story-data);
}

.mxcw-list-invite h3 {
    margin: 0 20px 6px 0;
    font-size: var(--story-body);
    font-weight: 700;
    color: #FDF2CE;
}

.mxcw-list-invite p {
    margin: 0 0 8px;
}

.mxcw-list-invite-close {
    position: absolute;
    top: 6px;
    right: 8px;
    padding: 0 4px;
    font-size: 18px;
    line-height: 1;
    color: #eefaff;
    background: none;
    border: none;
    cursor: pointer;
}

/* The button clearing the area drawn, at the top right of the map */
.mxcw-clear-area {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 6;
    padding: 4px 12px;
    font-size: var(--story-data);
    font-weight: 700;
    color: #0b2430;
    background: #FDF2CE;
    border: none;
    border-radius: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    cursor: pointer;
}

.mxcw-list-invite-draw {
    padding: 3px 10px;
    font: inherit;
    font-weight: 700;
    color: #0b2430;
    background: #FDF2CE;
    border: none;
    border-radius: 12px;
    cursor: pointer;
}
</style>

<template>
    <div>
    <button type="button" class="mxcw-clear-area" @class="fl-hidden:!@{hasPolygon}" title="Clear the area drawn on the map"
        @onclick="{self}.clearArea()">Clear drawn area ×</button>
    <div class="mxcw-list-invite" @class="fl-hidden:!@{shown}" role="dialog" aria-label="Make a plant list">
        <button type="button" class="mxcw-list-invite-close" title="Close" aria-label="Close" @onclick="{self}.close()">×</button>
        <h3>Make a plant list!</h3>
        <p>Draw an area with the shape tool at the top left of the map, double-clicking to finish—or click a grid cell. The
            plants you selected will be listed in the checklist bottom right. Download the formatted checklist to aid your
            searches.</p>
        <button type="button" class="mxcw-list-invite-draw" @onclick="{self}.draw()">Draw an area</button>
    </div>
    </div>
</template>
