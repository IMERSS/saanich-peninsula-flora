<fluid-import src="bioreportr-curationForm.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script src="../js/curation.js"></script>
<script>
"use strict";

// Community curation of the taxa of a story - see notes/community-curation-design.md

// The curation state of a story page, held as its member `curation`: the notes consolidated from GitHub, those pending
// in local storage, the user signed in, and the submission of notes
fluid.def("bioreportr.curation", {
    $layers: "fluid.component",
    // The files written by the consolidation job, src/js/consolidateCuration.js, relative to the story page
    configFile: "../curation/config.json",
    curationsFile: "../curation/curations.csv",
    claimStatusFile: "../curation/claimStatus.json",
    config: "$compute:fluid.fetchJSON({self}.configFile)",
    claimStatus: "$compute:fluid.fetchJSON({self}.claimStatusFile)",
    records: {
        $component: {
            $layers: "hortis.csvReader",
            url: "{curation}.curationsFile"
        }
    },
    paneKey: "$compute:bioreportr.curation.paneKey({storyPage}.panes)",
    storageKey: "$compute:bioreportr.curation.storageKey({self}.config)",
    tokenKey: "bioreportr-curation-token",
    // Advanced whenever the pending notes, or the token, are written to local storage, so that they are read again
    pendingVersion: 0,
    tokenVersion: 0,
    pending: "$compute:bioreportr.curation.readPending({global}, {self}.storageKey, {self}.pendingVersion)",
    byTaxon: "$compute:bioreportr.curation.byTaxon({self}.records.rows, {self}.pending, {self}.claimStatus)",
    prune: "$effect:bioreportr.curation.prune({self}, {self}.pending, {self}.claimStatus, {self}.records.rows, {global})",
    connected: "$compute:bioreportr.curation.isConnected({self}.config)",
    backend: "$compute:bioreportr.curation.makeBackend({self}.config, {global})",
    token: "$compute:bioreportr.curation.readToken({self}.tokenKey, {self}.tokenVersion, {global})",
    takeSession: "$effect:bioreportr.curation.takeSession({self}, {self}.backend, {global})",
    // The user signed in, with their `login`, or null if none is
    viewer: null,
    loadViewer: "$effect:bioreportr.curation.loadViewer({self}, {self}.backend, {self}.token)",
    // A message on the progress of a submission
    status: "",
    submit: "$method:bioreportr.curation.submit({self}, {0}:taxon, {1}:answers, {global})",
    signOut: "$method:bioreportr.curation.signOut({self}, {global})"
});

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

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from a project's content/story/Curation.Rmd, whose front matter names bioreportr.curationPane as its
     paneComponent. Edit the R Markdown and knit it, then run "npm run story", which replaces everything between
     <template> and </template> and nothing else in this file. Since this component is shared between projects, the
     section written is that of the project last built - each project writes its own. The R Markdown places the form in
     a raw HTML block, ```{=html} <div @id="curationForm"></div> ``` -->
<template>
<div id="community-consensus" class="section level2 mxcw-paneKey-Curation"><h2>Community consensus</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">

<div class="mxcw-curation-invitation">
<p>This atlas is a living flora of the W̱SÁNEĆ/Saanich Peninsula, and its
records are only as good as what we know of them. If you know whether a
plant is still to be found here, whether it was planted, or whether it
has failed to establish, please add your note.</p>
<p><span class="saanich-callout">Click on any taxon in the checklist
below</span> to choose it for curation. You can also choose a taxon from
any other part of the atlas, through the speech bubble beside its
name.</p>
</div>
<div class="mxcw-curation-form-holder" @id="curationForm"></div>
</div></div></div>
</template>
