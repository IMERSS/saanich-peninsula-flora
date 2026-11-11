<fluid-import src="%imerss-bioinfo/src/client/sfc/components/hortis-autocomplete.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/filters/hortis-taxonSearchFilter.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/checklist.js"></script>
<script>
"use strict";

// The search of the species list, in the same box and with the same suggestions as the search of the atlas checklist -
// see hortis.taxonSearchFilter. Rather than filtering, the species picked is selected in the list, which is scrolled to it
fluid.def("bioreportr.solowSearch", {
    $layers: "hortis.autocompleteHost",
    controlId: "mxcw-solow-search",
    placeholder: "Search taxa ...",
    minLength: 2,
    renderSuggestion: "hortis.autocompleteSuggestionForTaxonRow",
    renderInputValue: "hortis.autocompleteInputForTaxonRow",
    // The species picked shows the button clearing the search, as the checklist's does
    filterState: "{solowTaxa}.selectedTaxon",
    queryAutocomplete: "$method:hortis.checklist.querySearch({solowTaxa}.taxaFilters.allOutput, {0}:query, {1}:callback, {self}.maxSuggestions)",
    confirmAutocomplete: "$method:bioreportr.solowSearch.confirm({solowTaxa}.taxaTable, {0}:selection, {global}.document, {global})",
    reset: "$method:bioreportr.solowSearch.reset({solowTaxa}.taxaTable, {self}.controlId, {global}.document)"
});

/**
 * Select the species picked from the search in the list, and scroll the list to it.
 * @param {hortis.dataTable} table - The list of species
 * @param {TaxonRow|undefined} selection - The species picked - undefined if the search was left without a choice
 * @param {Document} dokkument - The document holding the list
 * @param {Window} window - The window holding it
 */
bioreportr.solowSearch.confirm = function (table, selection, dokkument, window) {
    if (selection) {
        table.selectedRow = selection;
        window.requestAnimationFrame(() => {
            const index = table.displayRows.indexOf(selection);
            const scrollEl = dokkument.querySelector(".mxcw-solow-taxa .hortis-dataTable-scroll");
            if (index >= 0 && scrollEl) {
                scrollEl.scrollTop = index * table.rowHeight;
            }
        });
    }
};

/**
 * Clear the search, and the species selected in the list.
 * @param {hortis.dataTable} table - The list of species
 * @param {String} controlId - The id of the search box
 * @param {Document} dokkument - The document holding it
 */
bioreportr.solowSearch.reset = function (table, controlId, dokkument) {
    table.selectedRow = null;
    hortis.autocomplete.clear(dokkument, controlId);
};
</script>

<template>
    <div class="imerss-panel-label mxcw-solow-search">
        <span class="imerss-search-checklist">
            <span class="imerss-filter-autocomplete">
                <div @id="autocomplete"></div>
                <div class="imerss-filter-clear imerss-basic-tooltip" @class="fl-hidden:!@{filterState}" title="Reset this filter"
                    @onclick="{self}.reset()">
                    <svg width="24" height="24"><use href="#imerss-i-x-circle-close"/></svg>
                </div>
            </span>
            <svg width="32" height="32"><use href="#imerss-i-search-wide"/></svg>
        </span>
    </div>
</template>

<style>
/* The search above the species list, set as the atlas checklist's search is in its header */
.mxcw-solow-search {
    display: flex;
    align-items: center;
    flex: none;
}
</style>
