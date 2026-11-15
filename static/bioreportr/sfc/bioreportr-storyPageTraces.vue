<fluid-import src="bioreportr-atlasPanel.vue"></fluid-import>
<fluid-import src="bioreportr-tracesPane.vue"></fluid-import>
<script>
"use strict";

// The story page's wiring of the opening pane, In Memory of Plants, whose timeline of plants' key moments plays across
// the map - see bioreportr-tracesPane.vue. A project names bioreportr.storyPageTraces in the $layers of its
// <project>-story.vue, together with bioreportr.atlasPanel. It has a file of its own, since a Single File Component is
// loaded only when the layer named after its file is demanded

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

fluid.def("bioreportr.storyPageTraces", {
    $layers: "fluid.component",
    traces: {
        $component: {
            $layers: "bioreportr.traces"
        }
    },
    // The classes of the story's left pane - those of the timeline, to which a project may add its own
    leftPaneClass: "{self}.traces.leftPaneClass"
});
</script>
