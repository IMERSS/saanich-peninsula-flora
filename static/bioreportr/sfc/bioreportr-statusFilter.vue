<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/blitz.js"></script>
<script src="../js/story.js"></script>
<style src="%pretty-checkbox/dist/pretty-checkbox.min.css"></style>
<script>
"use strict";

// Filters observations to the taxa of a single reporting status - confirmed, historical (unconfirmed) or new. The
// status is held by the story page, since it is also chosen from the legend of a pane whose map is coloured by status
fluid.def("bioreportr.statusFilter", {
    $layers: "hortis.obsFilter",
    filterName: "Status",
    filterState: "{storyPage}.selectedStatus",
    statusById: "$compute:hortis.reportingStatusById({vizLoader}.taxa.rowById)",
    checked: "$compute:bioreportr.statusFilter.checked({self}.filterState)",
    filterSummary: "$compute:hortis.collectorFilter.summarise({self}.filterState, {self}.filterName)",
    doFilter: "$method:bioreportr.statusFilter.doFilter({0}:obsRows, {1}:filterState, {self}.statusById)",
    toggle: "$method:bioreportr.statusFilter.toggle({storyPage}, {0}:status)",
    reset: "$method:bioreportr.statusFilter.reset({storyPage})"
});

fluid.registerNamespace("bioreportr.statusFilter");

bioreportr.statusFilter.checked = function (filterState) {
    return {confirmed: filterState === "confirmed", unconfirmed: filterState === "unconfirmed", new: filterState === "new"};
};

bioreportr.statusFilter.toggle = function (storyPage, status) {
    storyPage.selectedStatus = status === storyPage.selectedStatus ? null : status;
};

bioreportr.statusFilter.reset = function (storyPage) {
    storyPage.selectedStatus = null;
};

bioreportr.statusFilter.doFilter = function (obsRows, filterState, statusById) {
    return filterState ? obsRows.filter(row => statusById[row.iNaturalistTaxonId] === filterState) : obsRows;
};

bioreportr.statusFilter.click = function (event, that) {
    const input = event.target.closest("input[data-status]");
    if (input) {
        that.toggle(input.dataset.status);
    }
};
</script>

<template>
    <div class="imerss-status-filter" @onclick="bioreportr.statusFilter.click({0}, {self})">
        <div class="imerss-filter-title">@{filterName}:</div>
        <div class="imerss-filter-body imerss-region-filter-rows">
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="confirmed" checked="@{checked.confirmed}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">confirmed</div>
            </div>
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="unconfirmed" checked="@{checked.unconfirmed}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">historical</div>
            </div>
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="new" checked="@{checked.new}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">new</div>
            </div>
        </div>
    </div>
</template>
