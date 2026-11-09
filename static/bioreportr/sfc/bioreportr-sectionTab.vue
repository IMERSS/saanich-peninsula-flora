<script src="../js/i6/story.js"></script>
<script>
"use strict";

// The tab of one pane in the story page's section navigation
fluid.def("bioreportr.sectionTab", {
    $layers: "fluid.component",
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, {self}.pane.paneKey)",
    select: "$method:bioreportr.storyPage.selectPane({storyPage}, {self}.pane.paneKey)"
});
</script>

<template>
    <button class="chevron-tab" @class="active:@{active}" type="button" role="tab" aria-selected="@{active}"
        @onclick="{self}.select()">@{pane.shortTitle}</button>
</template>
