<fluid-import src="bioreportr-atlasPanel.vue"></fluid-import>
<fluid-import src="bioreportr-lostPlantsPane.vue"></fluid-import>
<script>
"use strict";

// The story page's wiring of the Lost Plants pane, whose gallery of "lost" plants is shown in place of the map - see
// bioreportr-lostPlantsPane.vue. A project names bioreportr.storyPageLostPlants in the $layers of its
// <project>-story.vue, together with bioreportr.atlasPanel. It has a file of its own, since a Single File Component is
// loaded only when the layer named after its file is demanded

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

fluid.def("bioreportr.storyPageLostPlants", {
    $layers: "fluid.component",
    // The gallery of "lost" plants shown beside the Lost Plants pane, in place of the map
    lostPlants: {
        $component: {
            $layers: "bioreportr.lostPlants"
        }
    },
    paneMarkup: "$compute:bioreportr.lostPlants.paneMarkup({self}.lostPlants.markup)"
});
</script>
