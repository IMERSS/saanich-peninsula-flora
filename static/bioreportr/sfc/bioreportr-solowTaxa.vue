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
            valueOf: "{self}.record.valueOf"
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
