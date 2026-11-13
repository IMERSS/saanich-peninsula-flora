<fluid-import src="bioreportr-curation.vue"></fluid-import>
<script>
"use strict";

// The curation of a story page, laid over bioreportr.storyPage: its curation state, the taxon or observation chosen for
// curation, and the speech bubbles leading to curation beside each taxon of the checklist and each record of the tables
// of records, whose clicks open the curation of their subject
fluid.def("bioreportr.storyPageCuration", {
    // The history of the curatorial notes on each taxon from before the site's own curation, as a CSV file relative to the
    // story page, if the project has one - shown by the History tab of the curation pane, see bioreportr.curation.loadHistory
    curationHistoryFile: null,
    // Community curation of the taxa - see notes/community-curation-design.md and the pane rendered by bioreportr.curationPane
    curation: {
        $component: {
            $layers: "bioreportr.curation"
        }
    },
    // The taxon chosen for curation, whilst the curation pane is shown - that chosen in the checklist's search
    curationTaxon: "$compute:bioreportr.curation.chosenTaxon({self}.activePane, {self}.checklist.search.filterState, {self}.taxa.rowById)",
    // The observation chosen for curation, whilst the curation pane is shown - the record selected, held in the URL
    curationObservation: `$compute:bioreportr.curation.chosenObservation({self}.activePane, {self}.map.recordSelector.filterState,
        {self}.map.recordSelector.selectedRow)`,
    checklist: {
        $component: {
            // Each taxon bears a speech bubble leading to its curation, which summarises its notes on hover
            renderTooltip: "$method:bioreportr.curation.renderChecklistTooltip({self}.rowById, {storyPage}.curation.byTaxon, {0}:hoverId)",
            // The hover id of a summary pinned by clicking its bubble, until a press outside it dismisses it
            curationPin: null,
            pinTooltip: "$effect:bioreportr.curation.pinTooltip({self}, {storyPage}, {self}.tooltip, {self}.curationPin)",
            pinDismiss: {
                $effect: {
                    func: "bioreportr.curation.pinDismiss",
                    args: ["{self}", fluid.globalDismissalSignal, "{self}.tooltip"]
                }
            },
            tree: {
                $component: {
                    view: {
                        $component: {
                            templateTree: `$compute:bioreportr.curation.renderChecklistTree({checklist}, {checklist}.rootEntry,
                                {checklist}.idToState, {checklist}.selectedId, {storyPage}.curation.byTaxon)`
                        }
                    }
                }
            }
        }
    },
    obsTable: {
        $component: {
            // Each record bears a speech bubble leading to its curation - see bioreportr.curation.recordTableBody
            resolvedColumns: "$compute:bioreportr.curation.recordTableColumns({self}.rows, {self}.columns)",
            body: {
                $component: {
                    markup: `$compute:bioreportr.curation.recordTableBody({dataTable}.displayRows, {dataTable}.resolvedColumns,
                        {dataTable}.window, {dataTable}.rowHeight, {dataTable}.rowSelectable, {dataTable}.selectedRow,
                        {storyPage}.curation.byObservation, {storyPage}.map.recordSelector.recordIndex)`
                }
            }
        }
    },
    // Receives each click within the tables of records, from the story page's template - a click on a record's bubble
    // opens its curation
    recordTableClick: "$method:bioreportr.curation.recordTableClick({0}, {self})"
});
</script>
