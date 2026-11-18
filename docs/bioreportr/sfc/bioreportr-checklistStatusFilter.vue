<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="%imerss-bioinfo/src/client/js/i6/filters.js"></script>
<script src="../js/story.js"></script>
<style src="%pretty-checkbox/dist/pretty-checkbox.min.css"></style>
<script>
"use strict";

// Filters the records by the checklist status of their taxa - the list's own, those the curators excluded from it, and
// those under review or never reviewed - see scripts/prepare_set_aside.R, which marks each record by its `checklist`.
// The list's own alone are shown until another status is chosen, so that nothing counted from them changes. A status
// other than the list's is honoured only by the panes named in `openPanes` - the Atlas, where the taxa kept off the list
// may be mapped and browsed, and Living Data, where they may be curated - every other pane keeping to the list's own,
// whatever is chosen. The filter is always active, since it is what keeps the records of the taxa kept off the list out
// of every other pane. A story with no taxa kept off the list, which names no excludedTaxaFile, has no such records,
// and the filter neither shows nor filters. The statuses chosen are held in the URL as `listing`, e.g.
// "listing:excluded+underReview"
fluid.def("bioreportr.checklistStatusFilter", {
    $layers: "hortis.obsFilter",
    filterName: "Checklist",
    isActive: true,
    // Whether it is shown on the pane shown - it is applied on every pane, whether shown or not, since it keeps the
    // records of the taxa kept off the list out of every pane which does not honour them - see filterPanes of the story page
    shownHere: "$compute:bioreportr.storyPage.filterShown({storyPage}.filterPanes, {self}.filterName, {storyPage}.activePaneKey, {storyPage}.activePane.visibleFilters)",
    // The statuses, in their order, each with its label
    statuses: [
        {key: "listed", label: "on the checklist"},
        {key: "excluded", label: "excluded"},
        {key: "underReview", label: "under review"}
    ],
    // The panes which honour a choice of statuses other than the list's own
    openPanes: ["Status", "Curation"],
    filterState: "{storyPage}.checklistStatuses",
    hasSetAside: "{storyPage}.hasSetAside",
    chosen: "$compute:bioreportr.checklistStatusFilter.chosen({self}.filterState)",
    checked: "$compute:bioreportr.checklistStatusFilter.checked({self}.chosen, {self}.statuses)",
    filterSummary: "$compute:bioreportr.checklistStatusFilter.summarise({self}.chosen, {self}.statuses)",
    // The statuses the pane shown honours - those chosen, on a pane honouring them, or else the list's own alone
    shown: "$compute:bioreportr.checklistStatusFilter.shown({self}.chosen, {storyPage}.activePaneKey, {self}.openPanes, {self}.curatedTaxon, {self}.curationPane)",
    // The taxon chosen in Living Data, whose own status is always shown there, so that one kept off the list shows its
    // records however it was reached - and the pane on which that holds
    curatedTaxon: "{storyPage}.curationTaxon",
    curationPane: "Curation",
    predicates: "$compute:bioreportr.checklistStatusFilter.predicates({self}.shown, {self}.hasSetAside)",
    // How many records of the taxa kept off the list the map's grid includes - which it counts among the list's own, so
    // that it barely changes as they are chosen - said by a key on the map while any are - see
    // bioreportr.checklistStatusFilter.showKey
    setAsideCounts: `$compute:bioreportr.checklistStatusFilter.counts({vizLoader}.pkg, {storyPage}.finalFilteredObs, {self}.shown,
        {self}.hasSetAside)`,
    showKey: "$effect:bioreportr.checklistStatusFilter.showKey({storyPage}.map.readyMap, {self}.setAsideCounts, {self}.statuses, {global})",
    toggle: "$method:bioreportr.checklistStatusFilter.toggle({storyPage}, {self}.chosen, {0}:status)",
    reset: "$method:bioreportr.checklistStatusFilter.reset({storyPage})"
});

fluid.registerNamespace("bioreportr.checklistStatusFilter");

/**
 * The statuses chosen, from the filter's state - the list's own alone if none is.
 * @param {String|undefined} filterState - The statuses chosen, joined by "+", as held in the URL
 * @return {String[]} The statuses
 */
bioreportr.checklistStatusFilter.chosen = function (filterState) {
    const chosen = String(filterState || "").split("+").filter(Boolean);
    return chosen.length ? chosen : ["listed"];
};

bioreportr.checklistStatusFilter.checked = (chosen, statuses) => Object.fromEntries(statuses.map(({key}) => [key, chosen.includes(key)]));

bioreportr.checklistStatusFilter.summarise = function (chosen, statuses) {
    return chosen.length === 1 && chosen[0] === "listed" ? "" :
        statuses.filter(({key}) => chosen.includes(key)).map(({label}) => label).join(", ");
};

/**
 * The statuses the pane shown honours - those chosen, on a pane which honours them, or else the list's own alone - and in
 * Living Data, the status of the taxon chosen there, if it is one kept off the list.
 * @param {String[]} chosen - The statuses chosen
 * @param {String} activePaneKey - The key of the pane shown
 * @param {String[]} openPanes - The panes which honour a choice of statuses other than the list's own
 * @param {TaxonRow|null} [curatedTaxon] - The taxon chosen in Living Data
 * @param {String} [curationPane] - The key of Living Data's pane
 * @return {String[]} The statuses
 */
bioreportr.checklistStatusFilter.shown = function (chosen, activePaneKey, openPanes, curatedTaxon, curationPane) {
    const shown = openPanes.includes(activePaneKey) ? chosen : ["listed"];
    const own = activePaneKey === curationPane && curatedTaxon?.checklist_status;
    return own && !shown.includes(own) ? [...shown, own] : shown;
};

/**
 * The predicates of the filter - the records of the taxa of the statuses shown. None for a story with no taxa kept off
 * the list.
 * @param {String[]} shown - The statuses shown
 * @param {Boolean} hasSetAside - Whether the story holds taxa kept off the list
 * @return {Object[]} The predicates
 */
bioreportr.checklistStatusFilter.predicates = (shown, hasSetAside) => hasSetAside ? [{field: "checklist", op: "in", value: shown}] : [];

/**
 * Choose a status, or no longer choose it - at least one is always chosen.
 * @param {bioreportr.storyPage} storyPage - The story page, which holds the statuses chosen
 * @param {String[]} chosen - The statuses chosen
 * @param {String} status - The status
 */
bioreportr.checklistStatusFilter.toggle = function (storyPage, chosen, status) {
    const next = chosen.includes(status) ? chosen.filter(key => key !== status) : [...chosen, status];
    bioreportr.checklistStatusFilter.choose(storyPage, next);
};

/**
 * Choose the given statuses - the list's own alone being held as no choice at all, so that the URL is unchanged.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String[]} statuses - The statuses
 */
bioreportr.checklistStatusFilter.choose = function (storyPage, statuses) {
    const kept = statuses.filter(Boolean);
    storyPage.checklistStatuses = kept.length === 0 || kept.length === 1 && kept[0] === "listed" ? null : kept.join("+");
};

// The label of each status of a taxon kept off the list, as its suggestions in a search give it
bioreportr.checklistStatusFilter.suggestionLabels = {excluded: "excluded", underReview: "under review"};

/**
 * The taxa offered by the checklist's search - those of its entries, and in Living Data, every taxon kept off the list,
 * so that one may be found there to be curated whatever is chosen in the Checklist status filter.
 * @param {Object<String, ChecklistEntry>} idToEntry - The checklist's entries, by taxon id
 * @param {TaxonRow[]} taxaRows - Every taxon
 * @param {String} activePaneKey - The key of the pane shown
 * @param {String} curationPane - The key of Living Data's pane
 * @return {TaxonRow[]} The taxa
 */
bioreportr.checklistStatusFilter.searchRows = function (idToEntry, taxaRows, activePaneKey, curationPane) {
    const rows = hortis.checklist.entryRows(idToEntry);
    if (activePaneKey === curationPane) {
        const has = new Set(rows.map(row => row.id));
        taxaRows.forEach(row => {
            if (row.checklist_status && row.scientificName && !has.has(row.id)) {
                rows.push(row);
            }
        });
    }
    return rows;
};

/**
 * A suggestion of the search, as the checklist gives it, marked with the status of a taxon kept off the list.
 * @param {TaxonRow} row - The taxon
 * @return {String} The suggestion
 */
bioreportr.checklistStatusFilter.suggestion = function (row) {
    const label = bioreportr.checklistStatusFilter.suggestionLabels[row?.checklist_status];
    return hortis.autocompleteSuggestionForTaxonRow(row) + (label ? ` (${label})` : "");
};

/**
 * Count the records of the taxa kept off the list which are shown, and can be mapped - those of the statuses shown other
 * than the list's own, among the records surviving every filter - by status.
 * @param {VizPackage} pkg - The data package
 * @param {Selection} finalFilteredObs - The records surviving every filter
 * @param {String[]} shown - The statuses shown
 * @param {Boolean} hasSetAside - Whether the story holds taxa kept off the list
 * @return {Object<String, Number>} The number of records of each status, none if none is shown
 */
bioreportr.checklistStatusFilter.counts = function (pkg, finalFilteredObs, shown, hasSetAside) {
    const togo = {};
    if (hasSetAside) {
        shown.filter(status => status !== "listed").forEach(status => {
            const count = hortis.selectionRows(pkg, hortis.selectObs(pkg,
                [{field: "checklist", op: "in", value: [status]}, ...bioreportr.coordinatePredicates], finalFilteredObs)).length;
            if (count) {
                togo[status] = count;
            }
        });
    }
    return togo;
};

/**
 * Say on the map how many records of the taxa kept off the list its grid includes, by status, while any are - since
 * they fall mostly in cells already holding the list's records, the grid alone barely shows them. The key is made once,
 * and hidden while none is shown.
 * @param {maplibregl.Map} map - The story's map, once ready
 * @param {Object<String, Number>} counts - The records of each status - see bioreportr.checklistStatusFilter.counts
 * @param {Object[]} statuses - The filter's statuses, each with its `key` and `label`
 * @param {Window} window - The window holding the page
 */
bioreportr.checklistStatusFilter.showKey = function (map, counts, statuses, window) {
    if (!map || !counts) {
        return;
    }
    const container = map.getContainer();
    let key = container.querySelector(".mxcw-set-aside-key");
    if (!key) {
        key = window.document.createElement("div");
        key.className = "mxcw-set-aside-key";
        container.appendChild(key);
    }
    const encode = hortis.dataTable.encode;
    const parts = statuses.filter(({key: status}) => counts[status]).map(({key: status, label}) =>
        `<span class="mxcw-set-aside-key-row">${encode(hortis.formatInt(counts[status]))} ${encode(label)}</span>`);
    key.innerHTML = parts.length ? `<span>Grid includes</span>${parts.join("<span>·</span>")}<span>records</span>` : "";
    key.hidden = parts.length === 0;
};

bioreportr.checklistStatusFilter.reset = function (storyPage) {
    storyPage.checklistStatuses = null;
};

bioreportr.checklistStatusFilter.click = function (event, that) {
    const input = event.target.closest("input[data-status]");
    if (input) {
        that.toggle(input.dataset.status);
    }
};
</script>

<template>
    <div class="imerss-checklist-status-filter" @class="fl-hidden:!@{hasSetAside}" @onclick="bioreportr.checklistStatusFilter.click({0}, {self})"
        title="Taxa kept off the checklist by its curators may be shown too, with their records">
        <div class="imerss-filter-title">@{filterName}:</div>
        <div class="imerss-filter-body imerss-region-filter-rows">
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="listed" checked="@{checked.listed}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">on the checklist</div>
            </div>
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="excluded" checked="@{checked.excluded}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">excluded</div>
            </div>
            <div class="imerss-filter-row">
                <div class="imerss-row-checkbox"><span class="pretty p-icon">
                    <input type="checkbox" class="checklist-check" data-status="underReview" checked="@{checked.underReview}"/>
                    <span class="state p-success"><i class="icon mdi mdi-check"></i><label></label></span>
                </span></div>
                <div class="imerss-row-label">under review</div>
            </div>
        </div>
    </div>
</template>

<style>
/* The key on the map saying how many records of the taxa kept off the list its grid includes, shown while any are -
   placed at the map's foot, clear of its legend of the grid */
.mxcw-set-aside-key {
    position: absolute;
    left: 50%;
    bottom: 34px;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    padding: 5px 10px;
    color: #0d3040;
    font-size: var(--story-small);
    background: rgba(255, 255, 255, 0.92);
    border-radius: var(--data-table-radius);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transform: translateX(-50%);
    pointer-events: none;
}

.mxcw-set-aside-key[hidden] {
    display: none;
}
</style>

