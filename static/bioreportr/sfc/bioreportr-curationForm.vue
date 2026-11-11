<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script src="../js/curation.js"></script>
<script>
"use strict";

// The form of the curation pane, on which a member of the community records what they know of the taxon chosen - see
// notes/community-curation-design.md. It is placed by the pane's R Markdown, in an element <div @id="curationForm">
fluid.def("bioreportr.curationForm", {
    $layers: "fluid.component",
    taxon: "{storyPage}.curationTaxon",
    model: `$compute:bioreportr.curationForm.model({self}.taxon, {storyPage}.curation.byTaxon, {storyPage}.curation.viewer,
        {storyPage}.curation.connected, {storyPage}.curation.status)`,
    image: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.image"
        }
    },
    consensus: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.consensus"
        }
    },
    controls: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.controls"
        }
    },
    submit: "$method:bioreportr.curationForm.submit({storyPage}.curation, {self}.taxon, {0}:event, {global})",
    signIn: "$method:bioreportr.curation.signIn({storyPage}.curation.backend, {global})",
    signOut: "$method:bioreportr.curation.signOut({storyPage}.curation, {global})",
    // Brings back the checklist, from which another taxon may be chosen
    chooseAnother: "$method:bioreportr.curationForm.chooseAnother({storyPage})"
});

bioreportr.curationForm.chooseAnother = function (storyPage) {
    storyPage.checklist.search.reset();
};
</script>

<template>
    <div class="mxcw-curation-form-root">
    <div class="mxcw-curation-form" @class="fl-hidden:!@{model.hasTaxon}">
        <div class="mxcw-curation-pending" @class="fl-hidden:!@{model.pending}">Your comment has been submitted and is being processed</div>
        <div class="mxcw-curation-taxon">
            <div class="mxcw-curation-photo" @id="image"></div>
            <dl class="mxcw-curation-names">
                <dt>Taxon name:</dt> <dd><i>@{model.taxonName}</i></dd>
                <dt>Link name:</dt> <dd>@{model.linkName}</dd>
                <dt>Common name:</dt> <dd>@{model.commonName}</dd>
            </dl>
        </div>
        <form class="mxcw-curation-note-form" onsubmit="return false">
            <!-- The controls are rendered as markup, not bound to the model, since a binding of a control is two-way and the
                 user's choices would be written into the model - see bioreportr.curationForm.controlsMarkup -->
            <div @id="controls"></div>
            <div class="mxcw-curation-account">
                <span @class="fl-hidden:@{model.connected}">Community curation is not yet connected to GitHub, so notes can't be submitted from this site yet.</span>
                <span @class="fl-hidden:!@{model.signedOut}">
                    <button type="button" class="mxcw-curation-button" @onclick="{self}.signIn()">Sign in with GitHub</button>
                    to add your note - or <a href="https://github.com/signup" target="_blank" rel="noopener">create a GitHub account</a>
                </span>
                <span @class="fl-hidden:!@{model.signedIn}">Signed in as <b>@{model.viewerLogin}</b>
                    <button type="button" class="mxcw-curation-link" @onclick="{self}.signOut()">sign out</button></span>
                <button type="button" class="mxcw-curation-button mxcw-curation-submit" @class="fl-hidden:!@{model.signedIn}"
                    @onclick="{self}.submit({0})">@{model.submitLabel}</button>
            </div>
            <div class="mxcw-curation-status" aria-live="polite">@{model.status}</div>
        </form>
        <div class="mxcw-curation-consensus">
            <h3>Community consensus</h3>
            <div @id="consensus"></div>
        </div>
        <button type="button" class="mxcw-curation-link mxcw-curation-choose" @onclick="{self}.chooseAnother()">Choose another taxon</button>
    </div>
    </div>
</template>
