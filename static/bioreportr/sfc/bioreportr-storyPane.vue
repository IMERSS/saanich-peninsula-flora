<script src="../vendor/plotly-2.1.1.js" fluid-client data-fl-scope="global"></script>
<script src="../vendor/htmlwidgets.js" fluid-client data-fl-scope="global"></script>
<script src="../vendor/htmlwidgets-plotly.js" fluid-client data-fl-scope="global"></script>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script>
"use strict";

// One pane of the story page, whose section is knitted from R Markdown and extracted by storyBuild.js. Only the active
// pane is shown. Its HTML widgets, e.g. plotly charts, are rendered in the browser. The section is rendered in one of
// two ways:
//   - by default, it is fetched from the file storyBuild.js writes for the pane, and rendered verbatim
//   - if the pane's front matter names a `paneComponent`, the section is rendered by that component, defined in a
//     Single File Component into whose <template> block storyBuild.js has written the section - so that the template
//     may bind to the component's members, and the component may bring the script and styles particular to its pane
fluid.def("bioreportr.storyPane", {
    $layers: "fluid.component",
    // pane: PaneSettings - the pane's settings, as the $for iteration variable
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, {self}.pane.paneKey)",
    url: "$compute:bioreportr.storyPane.url({storyPage}.storyBase, {self}.pane.file)",
    fetched: "$compute:bioreportr.fetchText({self}.url)",
    paneClick: "$method:bioreportr.storyPane.click({storyPage}, {0}:event)",
    section: {
        $component: {
            $layers: ["fluid.component", "{self}.sectionLayers"],
            sectionLayers: "$compute:bioreportr.storyPane.sectionLayers({storyPane}.pane)"
        }
    },
    widgets: {
        $bindable: {
            bind: "bioreportr.storyPane.renderWidgets({self}.section.view.renderedContainer, {global}.HTMLWidgets)",
            onceOnly: true
        }
    }
});

// The section of a pane rendered verbatim, as fetched from the file storyBuild.js writes for it, with any of the story
// page's sectionInserts placed within it. A pane rendered by a component of its own fetches nothing
fluid.def("bioreportr.verbatimSection", {
    $layers: "hortis.verbatimSlot",
    markup: "$compute:bioreportr.storyPane.insert({storyPane}.fetched, {storyPage}.sectionInserts)"
});
</script>

<template>
    <div class="mxcw-storyPane" @class="mxcw-activePane:@{active}" data-pane="@{pane.paneKey}">
        <div @onclick="{self}.paneClick({0})"><div @id="section"></div></div>
    </div>
</template>
