<fluid-import src="bioreportr-rememberingPane.vue"></fluid-import>
<script>
"use strict";

// The story page's wiring of the pane in memory of Harvey Janszen, whose map frames the areas of his checklists - see
// bioreportr-rememberingPane.vue. A project names bioreportr.storyPageRemembering in the $layers of its
// <project>-story.vue, after bioreportr.storyPageTraces, whose classes of the left pane it adds to. It has a file of its
// own, since a Single File Component is loaded only when the layer named after its file is demanded

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

fluid.def("bioreportr.storyPageRemembering", {
    $layers: "fluid.component",
    remembering: {
        $component: {
            $layers: "bioreportr.remembering"
        }
    },
    // The classes of the left pane - those of the opening timeline, and while Harvey's pane is shown, its own
    leftPaneClass: "$compute:bioreportr.remembering.leftPaneClass({self}.traces.leftPaneClass, {self}.remembering.active)"
});
</script>
