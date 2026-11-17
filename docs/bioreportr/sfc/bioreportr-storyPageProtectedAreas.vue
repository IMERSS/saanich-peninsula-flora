<fluid-import src="bioreportr-atlasPanel.vue"></fluid-import>
<fluid-import src="bioreportr-protectedPane.vue"></fluid-import>
<script>
"use strict";

// The story page's wiring of the Protected Areas pane, whose selections filter the records, the checklist and the map -
// see bioreportr-protectedPane.vue. A project names bioreportr.storyPageProtectedAreas in the $layers of its
// <project>-story.vue, together with bioreportr.atlasPanel. It has a file of its own, since a Single File Component is
// loaded only when the layer named after its file is demanded

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
fluid.registerNamespace("bioreportr.protectedAreas");

fluid.def("bioreportr.storyPageProtectedAreas", {
    $layers: "fluid.component",
    // The Protected Areas pane may also select the native species reported in no protected area, and some of the
    // species of a region - see bioreportr.protectedAreas.regionFilter
    regionFilter: {
        $component: {
            predicates: `$compute:bioreportr.protectedAreas.regionPredicates({self}.filterState, {storyPage}.regionIndirectionRows,
                {storyPage}.regionFilterFieldNames, {storyPage}.protectedAreas.taxonSets, {storyPage}.activePaneKey,
                {storyPage}.protectedAreas.mappedOnly)`
        }
    },
    // The panel of the plant chosen in the checklist - the atlas's, see bioreportr-atlasPanel.vue, or on the Protected
    // Areas pane its smaller one giving the plant's records within the selected region
    taxonPanel: {
        $component: {
            markup: "$compute:bioreportr.protectedAreas.choosePanel({storyPage}.activePaneKey, {storyPage}.atlasPanelMarkup, {storyPage}.protectedAreas.panelMarkup)"
        }
    },
    taxonPanelVisible: "$compute:bioreportr.protectedAreas.panelVisible({self}.taxonPanel.markup, {self}.activePaneKey)",
    // The plant chosen in the checklist is cleared on moving between the selections of the pane - its tabs, categories,
    // areas and figures - since it may not have been recorded within the new one
    // The move from the selection last made in the Protected Areas pane to the current one
    regionTransition: "$compute:bioreportr.protectedAreas.regionTransition({$oldValue}, {self}.selectedRegion, {self}.activePaneKey)",
    clearTaxonOnRegionChange: "$effect:bioreportr.protectedAreas.clearTaxonOnRegionChange({self}, {self}.regionTransition)",
    // The pane selects categories from its chart and individual areas from the map, describing each area on hover
    protectedAreas: {
        $component: {
            $layers: "bioreportr.protectedAreas"
        }
    },
    map: {
        $component: {
            // The pane shows the grid of the native species outside protected areas when they are selected
            gridVisible: "{storyPage}.protectedAreas.gridVisible",
            // A selection of some of the species of a region, made by the figures of the pane, outlines and marks the
            // region itself
            highlightRegion: "$effect:bioreportr.storyMap.highlightRegion({self}.readyMap, {storyPage}.protectedAreas.baseRegion, {storyPage}.mapData)",
            legendRowsMarkup: "$compute:bioreportr.storyMap.legendMarkup({self}.legendRows, {storyPage}.selectedStatus, {storyPage}.protectedAreas.baseRegion)"
        }
    }
});

/**
 * Compute the move from the selection last made to the current one, from the previous move - see `{$oldValue}`. It takes
 * every argument of bioreportr.protectedAreas.clearTaxonOnRegionChange, so that it is recomputed whenever that runs.
 * @param {Object|undefined} previous - The previous move, if any
 * @param {String|null} selectedRegion - The selection - a tab, category, area or figure of the pane
 * @param {String} activePaneKey - The key of the pane shown
 * @return {Object} Members `had`, whether there was a previous selection, `from`, the previous selection, `region`, the
 * current one, and `activePaneKey`
 */
bioreportr.protectedAreas.regionTransition = function (previous, selectedRegion, activePaneKey) {
    const last = fluid.unwrapProxy(previous);
    return {had: last !== undefined, from: last?.region, region: selectedRegion || null, activePaneKey};
};

/**
 * Clear the plant chosen in the checklist on moving between the selections of the Protected Areas pane, since the plant
 * may not have been recorded within the new one.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {Object} regionTransition - The move between selections - see bioreportr.protectedAreas.regionTransition
 */
bioreportr.protectedAreas.clearTaxonOnRegionChange = function (storyPage, regionTransition) {
    const {had, from, region, activePaneKey} = fluid.unwrapProxy(regionTransition);
    if (activePaneKey === "Protected" && had && from !== region) {
        // Deferred since an effect may not write signals
        fluid.invokeLater(() => storyPage.checklist.search.reset());
    }
};
</script>
