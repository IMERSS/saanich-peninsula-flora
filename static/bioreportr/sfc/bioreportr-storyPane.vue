<script src="../js/plotly-2.1.1.js" fluid-client data-fl-scope="global"></script>
<script src="../js/htmlwidgets.js" fluid-client data-fl-scope="global"></script>
<script src="../js/htmlwidgets-plotly.js" fluid-client data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/i6/story.js"></script>
<script>
"use strict";

// One pane of the story page, whose section, knitted from R Markdown and extracted by storyBuild.js, is fetched and
// rendered verbatim. Only the active pane is shown. Its HTML widgets, e.g. plotly charts, are rendered in the browser
fluid.def("bioreportr.storyPane", {
    $layers: "fluid.component",
    // pane: PaneSettings - the pane's settings, as the $for iteration variable
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, {self}.pane.paneKey)",
    url: "$compute:bioreportr.storyPane.url({storyPage}.storyBase, {self}.pane.file)",
    section: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "$compute:bioreportr.fetchText({storyPane}.url)"
        }
    },
    widgets: {
        $bindable: {
            bind: "bioreportr.storyPane.renderWidgets({self}.section.view.renderedContainer, {global}.HTMLWidgets)",
            onceOnly: true
        }
    }
});
</script>

<template>
    <div class="mxcw-storyPane" @class="mxcw-activePane:@{active}" data-pane="@{pane.paneKey}">
        <div @id="section"></div>
    </div>
</template>
