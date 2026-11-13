<fluid-import src="bioreportr-curation.vue"></fluid-import>
<fluid-import src="bioreportr-curationForm.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script>
"use strict";

// The section of the curation pane, rendering the pane's R Markdown, which places the form in <div @id="curationForm">
fluid.def("bioreportr.curationPane", {
    $layers: "fluid.component",
    curationForm: {
        $component: {
            $layers: "bioreportr.curationForm"
        }
    }
});
</script>

<style>
/* The speech bubble of each record in the table of records, shown on hovering over its row, and always once it has
   notes - after those of the checklist, in imerss-story.css */
.mxcw-obs-table td:has(> .mxcw-curation-record-bubble) {
    padding: 0 0 0 4px;
}

.mxcw-obs-table .mxcw-curation-record-bubble {
    display: block;
    width: 18px;
    height: 16px;
    padding: 0;
    border: 0;
    background-color: #4b778f;
    cursor: pointer;
    opacity: 0;
    -webkit-mask: var(--mxcw-curation-bubble-outline) center / contain no-repeat;
    mask: var(--mxcw-curation-bubble-outline) center / contain no-repeat;
}

.mxcw-obs-table tr:hover .mxcw-curation-record-bubble,
.mxcw-obs-table .mxcw-curation-record-bubble:focus-visible {
    opacity: 0.8;
}

.mxcw-obs-table .mxcw-curation-record-bubble.mxcw-curation-noted {
    opacity: 1;
    -webkit-mask-image: var(--mxcw-curation-bubble-filled);
    mask-image: var(--mxcw-curation-bubble-filled);
}

.mxcw-obs-table .mxcw-curation-record-bubble:hover {
    opacity: 1;
    background-color: #184e62;
}

/* The marker dragged to correct the position of an observation, a duplicate of its own marker - see
   bioreportr.curationForm.makeDragMarker */
.mxcw-curation-drag-marker {
    /* Above the record's own marker, which it duplicates, so that it can be grabbed */
    z-index: 2;
    cursor: grab;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}

.mxcw-curation-drag-marker:active {
    cursor: grabbing;
}

.mxcw-curation-drag-marker svg {
    display: block;
}

.mxcw-curation-drag-marker path {
    fill: #e8711a;
    stroke: #fff;
    stroke-width: 2;
}

.mxcw-curation-drag-marker circle {
    fill: #fff;
}
</style>

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from a project's content/story/Curation.Rmd, whose front matter names bioreportr.curationPane as its
     paneComponent. Edit the R Markdown and knit it, then run "npm run story", which replaces everything between
     <template> and </template> and nothing else in this file. Since this component is shared between projects, the
     section written is that of the project last built - each project writes its own. The R Markdown places the form in
     a raw HTML block, ```{=html} <div @id="curationForm"></div> ``` -->
<template>
<div id="community-curation" class="section level2 mxcw-paneKey-Curation"><h2>Community Curation</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">

<div class="mxcw-curation-invitation">
<p>We invite you to contribute to a living flora of the W̱SÁNEĆ/Saanich
Peninsula! Please help us to improve the accuracy of the data presented
here by adding curatorial notes regarding the provenance, taxonomy, or
georeferencing of records.</p>
<p><span class="saanich-callout">Click on any taxon in the checklist
below</span> to add a curatorial note. You can also choose a taxon from
any other part of the atlas, through the speech bubble beside its
name.</p>
</div>
<div class="mxcw-curation-form-holder" @id="curationForm"></div>
</div></div></div>
</template>
