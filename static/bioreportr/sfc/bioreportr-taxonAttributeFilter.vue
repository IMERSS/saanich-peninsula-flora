<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-plants.js"></script>
<script src="../js/story.js"></script>
<style src="%pretty-checkbox/dist/pretty-checkbox.min.css"></style>
<script>
"use strict";

// Filters the records by an attribute of their taxa, e.g. their introduction status or their conservation concern, as
// the reporting status filter filters them by the status of their taxa - see bioreportr-statusFilter.vue. Each is
// defined by a record of the story's taxaFilterRecords, which define the filters of the extirpation risk pane's table of
// taxa too, so that each filter has one definition, with the same name and values, wherever it is used:
//   filterName  - its name, e.g. "Introduction"
//   fieldName   - the field of the taxa holding the attribute, e.g. "introduction_status"
//   fieldValues - its values, in their order, and fieldLabels, the label of each
//   valueOf     - optionally, the global name of a function computing the value from a taxon, e.g. hortis.graminoidValue
//   urlKey      - optionally, the key under which its state is held in the URL, by default its fieldName - which is
//                 that of the extirpation risk pane's filter of the same record too, so that the two are one in the URL,
//                 a value chosen in either being chosen in both
//   paneValues  - optionally, the values to which it is fixed on a pane, by the pane's key, e.g. {Protected: ["native"]}
//                 for a pane which assesses only the native flora - shown as chosen and not to be changed there
// No value chosen leaves the records unfiltered. A taxon kept off the checklist is filtered by its attributes as any
// other - see bioreportr.checklistStatusFilter
fluid.def("bioreportr.taxonAttributeFilter", {
    $layers: ["hortis.obsFilter", "hortis.urlMappedFilter"],
    // record: Object - the filter's record, as above
    filterName: "{self}.record.filterName",
    urlKey: "$compute:bioreportr.taxonAttributeFilter.urlKey({self}.record)",
    urlCodec: "hortis.urlCodecs.keys",
    filterState: {},
    // Shown and applied on the panes the story's filterPanes names for it - see bioreportr.storyPage.filterShown
    isActive: "$compute:bioreportr.storyPage.filterShown({storyPage}.filterPanes, {self}.filterName, {storyPage}.activePaneKey, {storyPage}.activePane.visibleFilters)",
    // The values to which the pane shown fixes the filter, if any
    fixed: "$compute:bioreportr.taxonAttributeFilter.fixed({self}.record, {storyPage}.activePaneKey)",
    chosen: "$compute:bioreportr.taxonAttributeFilter.chosen({self}.filterState, {self}.fixed)",
    idsByValue: "$compute:bioreportr.taxonAttributeFilter.idsByValue({vizLoader}.taxa.rowById, {self}.record)",
    predicates: "$compute:bioreportr.taxonAttributeFilter.predicates({self}.chosen, {self}.idsByValue)",
    filterSummary: "$compute:bioreportr.taxonAttributeFilter.summarise({self}.chosen, {self}.record)",
    rows: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "$compute:bioreportr.taxonAttributeFilter.rowsMarkup({taxonAttributeFilter}.record, {taxonAttributeFilter}.chosen, {taxonAttributeFilter}.fixed)"
        }
    },
    toggle: "$method:bioreportr.taxonAttributeFilter.toggle({self}, {0}:value)",
    reset: "$method:bioreportr.taxonAttributeFilter.reset({self})"
});

fluid.registerNamespace("bioreportr.taxonAttributeFilter");

bioreportr.taxonAttributeFilter.urlKey = record => record.urlKey || record.fieldName;

bioreportr.taxonAttributeFilter.fixed = (record, activePaneKey) => record.paneValues?.[activePaneKey] || null;

/**
 * The values chosen - those to which the pane fixes the filter, if it does, or else those chosen in it.
 * @param {Object<String, Boolean>} filterState - The values chosen, as held in the URL
 * @param {String[]|null} fixed - The values to which the pane fixes the filter
 * @return {String[]} The values
 */
bioreportr.taxonAttributeFilter.chosen = (filterState, fixed) => fixed || Object.keys(filterState || {}).filter(key => filterState[key]);

/**
 * Index the taxa by the value of the filter's attribute - those of the summary, and any kept off the checklist.
 * @param {Object<String, TaxonRow>} rowById - The taxa, by id
 * @param {Object} record - The filter's record
 * @return {Map<String, String[]>} The ids of the taxa of each value
 */
bioreportr.taxonAttributeFilter.idsByValue = function (rowById, record) {
    // valueOf read only as the record's own, since every object inherits a method of that name - as in bioreportr.solowTaxa
    const own = Object.prototype.hasOwnProperty.call(record, "valueOf") ? record.valueOf : null;
    const valueOf = own ? fluid.getGlobalValue(own) : row => row[record.fieldName];
    const togo = new Map();
    Object.values(fluid.unwrapProxy(rowById) || {}).forEach(row => {
        if (String(row.inSummary) === "1" || row.checklist_status) {
            const value = String(valueOf(row, record.fieldName) ?? "").trim();
            if (!togo.has(value)) {
                togo.set(value, []);
            }
            togo.get(value).push(String(row.id));
        }
    });
    return togo;
};

/**
 * The predicates of the filter - the records of the taxa of the values chosen, or none if none is.
 * @param {String[]} chosen - The values chosen
 * @param {Map<String, String[]>} idsByValue - The ids of the taxa of each value
 * @return {Object[]} The predicates
 */
bioreportr.taxonAttributeFilter.predicates = (chosen, idsByValue) => chosen.length ?
    [{field: "iNaturalistTaxonId", op: "in", value: chosen.flatMap(value => idsByValue.get(value) || [])}] : [];

bioreportr.taxonAttributeFilter.summarise = (chosen, record) => chosen.length ?
    `${record.filterName}: ${chosen.map(value => record.fieldLabels?.[record.fieldValues.indexOf(value)] || value).join(", ")}` : "";

/**
 * Render the filter's rows, one checkbox for each of its values - disabled where the pane fixes them.
 * @param {Object} record - The filter's record
 * @param {String[]} chosen - The values chosen
 * @param {String[]|null} fixed - The values to which the pane fixes the filter
 * @return {String} The markup of the rows
 */
bioreportr.taxonAttributeFilter.rowsMarkup = function (record, chosen, fixed) {
    const encode = hortis.dataTable.encode;
    return record.fieldValues.map((value, i) => `<div class="imerss-filter-row">
        <div class="imerss-row-checkbox"><span class="pretty p-icon">
            <input type="checkbox" class="checklist-check" data-value="${encode(value)}"${chosen.includes(value) ? " checked" : ""}${fixed ? " disabled" : ""}/>
            <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
        </span></div>
        <div class="imerss-row-label">${encode(record.fieldLabels?.[i] || value)}</div>
    </div>`).join("") + (fixed ? "<div class=\"imerss-filter-row mxcw-filter-fixed\">Fixed for this pane</div>" : "");
};

bioreportr.taxonAttributeFilter.toggle = function (that, value) {
    if (!that.fixed) {
        const state = {...(that.filterState || {})};
        state[value] = !state[value];
        that.filterState = Object.fromEntries(Object.entries(state).filter(([, on]) => on));
    }
};

bioreportr.taxonAttributeFilter.reset = function (that) {
    that.filterState = {};
};

bioreportr.taxonAttributeFilter.click = function (event, that) {
    const input = event.target.closest("input[data-value]");
    if (input) {
        that.toggle(input.dataset.value);
    }
};
</script>

<template>
    <div class="imerss-taxon-attribute-filter imerss-filter" @class="fl-hidden:!@{isActive}" @onclick="bioreportr.taxonAttributeFilter.click({0}, {self})">
        <div class="imerss-filter-title">@{filterName}:</div>
        <div class="imerss-filter-body imerss-region-filter-rows" @id="rows"></div>
    </div>
</template>

<style>
/* A filter which the pane shown fixes, e.g. Introduction on the Protected Areas pane, which assesses the native flora */
.imerss-taxon-attribute-filter .mxcw-filter-fixed {
    font-size: var(--story-small);
    font-style: italic;
    opacity: 0.75;
}
</style>
