<fluid-import src="%imerss-bioinfo/src/client/sfc/filters/hortis-valueFilter.vue"></fluid-import>
<fluid-import src="bioreportr-epFilter.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/components/hortis-dataTable.vue"></fluid-import>
<fluid-import src="%imerss-bioinfo/src/client/sfc/filters/hortis-standardFilterControls.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="../js/solow.js"></script>
<script>
"use strict";

// The taxa of the extirpation risk analysis - a table of the taxa of the project's summary which survive its filters,
// from which a taxon is chosen. The filters are configured by the project as `filterRecords`, each the members of a
// hortis.valueFilter
/**
 * The global name of the function computing the values of a filter of the species list, if its record names one. Every
 * object inherits a `valueOf` method, so only one the record itself holds is taken - otherwise the filter would apply the
 * inherited method as the name of a function, which fails and leaves every filter of the list without effect.
 * @param {Object} record - The record of the filter, from the project's `taxaFilterRecords`
 * @return {String|null} The global name of the function, or null if the filter reads its field directly
 */
fluid.registerNamespace("bioreportr.solowTaxa");
bioreportr.solowTaxa.valueOf = record => Object.prototype.hasOwnProperty.call(record, "valueOf") ? record.valueOf : null;

fluid.def("bioreportr.solowTaxa", {
    $layers: "fluid.component",
    // filterRecords: Object[]
    // columns: Object[] - the columns of the table, as for hortis.dataTable
    filterRecords: [],
    columns: [],
    filtersCollapsed: true,
    toggleFilters: "$method:bioreportr.storyPage.toggleFilters({self})",
    taxaFilters: {
        $component: {
            $layers: "hortis.taxaFilters",
            allInput: "$compute:bioreportr.summaryTaxaRows({vizLoader}.taxa.allRows)",
            filterComps: "{solowTaxa hortis.taxaFilter}"
        }
    },
    filters: {
        $component: {
            $layers: "hortis.valueFilter",
            $for: {
                source: "{solowTaxa}.filterRecords",
                valueAs: "record"
            },
            filterName: "{self}.record.filterName",
            fieldName: "{self}.record.fieldName",
            fieldValues: "{self}.record.fieldValues",
            // The labels shown for the values, if the project gives them - otherwise the values themselves
            fieldLabels: "{self}.record.fieldLabels",
            // Named apart from valueOf, which every object and component inherits from Object.prototype, so that a reference
            // to it finds that method in place of the filter's own setting and makes the filter fail - leaving every filter of
            // the list without effect
            valueFunction: "$compute:bioreportr.solowTaxa.valueOf({self}.record)",
            doFilter: "$method:hortis.valueFilter.doFilter({0}:rows, {1}:filterState, {self}.fieldName, {self}.valueFunction)"
        }
    },
    epFilter: {
        $component: {
            $layers: "bioreportr.epFilter"
        }
    },
    filterControls: {
        $component: {
            $layers: "hortis.standardFilterControls",
            filters: "{solowTaxa hortis.taxaFilter}",
            checklists: [],
            label: ""
        }
    },
    taxaTable: {
        $component: {
            $layers: "hortis.dataTable",
            rows: "{solowTaxa}.taxaFilters.allOutput",
            columns: "{solowTaxa}.columns",
            sortable: true,
            rowSelectable: true,
            sortColumn: "solow_EP",
            sortDirection: -1
        }
    },
    selectedTaxon: "{self}.taxaTable.selectedRow"
});
</script>

<template>
    <div class="mxcw-solow-taxa-holder">
        <div class="mxcw-taxa-filters-holder" @class="imerss-filters-collapsed:@{filtersCollapsed}">
            <div class="imerss-panel-label imerss-filters-header">
                <button type="button" class="imerss-filters-toggle" aria-expanded="@{filtersCollapsed}" @onclick="{self}.toggleFilters()">Filters:</button>
                <div @id="filterControls"></div>
            </div>
            <div class="imerss-filters imerss-taxa-filters">
                <div class="imerss-ep-filter imerss-filter" @id="epFilter"></div>
                <div @id="filters"></div>
            </div>
        </div>
        <div @id="taxaTable"></div>
    </div>
</template>

<style>
/* The filters of the species list: a row for each, its label beside its choices, which are set as chips, so that they
   read in order and leave room for the list beneath them */
.mxcw-solow-taxa .imerss-taxa-filters {
    flex-direction: column;
    align-items: stretch;
    padding: 2px 8px 6px;
}

/* Collapsed with its panel, as before */
.mxcw-solow-taxa .imerss-filters-collapsed .imerss-taxa-filters {
    display: none;
}

.mxcw-solow-taxa .imerss-taxa-filters > div:not(.imerss-filter) {
    display: contents;
}

.mxcw-solow-taxa .imerss-taxa-filters .imerss-filter {
    display: grid;
    grid-template-columns: 8.5em minmax(0, 1fr);
    align-items: center;
    column-gap: 10px;
    margin: 0;
    padding: 5px 0;
    border-top: 1px solid #e5e7eb;
}

.mxcw-solow-taxa .imerss-taxa-filters .imerss-ep-filter {
    border-top: 0;
}

.mxcw-solow-taxa .imerss-taxa-filters .imerss-filter-title {
    margin: 0;
    color: #4b778f;
    font-size: var(--story-data);
    font-weight: 700;
    line-height: 1.3;
}

.mxcw-solow-taxa .imerss-value-filter-rows {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.mxcw-solow-taxa .imerss-value-filter-rows .imerss-filter-row {
    display: flex;
    flex: none;
    width: auto;
    align-items: center;
    margin: 0;
    padding: 1px 10px 1px 6px;
    font-size: var(--story-data);
    border: 1px solid #d5dde2;
    border-radius: 100px;
}

.mxcw-solow-taxa .imerss-taxa-filters .mxcw-ep-range {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.mxcw-solow-taxa .imerss-taxa-filters .mxcw-ep-range label span {
    width: auto;
    color: #4b778f;
}

.mxcw-solow-taxa .imerss-taxa-filters .mxcw-ep-range label {
    display: grid;
    grid-template-columns: 2.6em minmax(0, 1fr) 3em;
    align-items: center;
    gap: 8px;
    font-size: var(--story-data);
}

.mxcw-solow-taxa .imerss-taxa-filters .mxcw-ep-range output {
    text-align: right;
}
</style>
