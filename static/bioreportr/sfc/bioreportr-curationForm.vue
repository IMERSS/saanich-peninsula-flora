<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script src="../js/curation.js"></script>
<script>
"use strict";

// The form of the curation pane, on which a member of the community records what they know of the taxon or the
// observation chosen - see notes/community-curation-design.md. For a taxon, its tabs choose between notes on its
// provenance and on its taxonomy. For an observation, the user's main task is to correct its position, by dragging a
// duplicate of its marker on the map. It is placed by the pane's R Markdown, in an element <div @id="curationForm">
fluid.def("bioreportr.curationForm", {
    $layers: "fluid.component",
    taxon: "{storyPage}.curationTaxon",
    observation: "{storyPage}.curationObservation",
    // The type of note on a taxon chosen by the form's tabs
    tab: "provenance",
    // The position to which the user has dragged the observation's marker, with its recordId - see
    // bioreportr.curationForm.position
    correction: null,
    model: `$compute:bioreportr.curationForm.model({self}.taxon, {self}.observation, {storyPage}.taxa.rowById, {storyPage}.curation.byTaxon,
        {storyPage}.curation.byObservation, {storyPage}.curation.viewer, {storyPage}.curation.connected, {storyPage}.curation.status,
        {self}.tab, {self}.correction)`,
    image: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.image"
        }
    },
    recordLink: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.recordLink"
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
    dragMarker: {
        $bindable: {
            bind: "bioreportr.curationForm.makeDragMarker({self}, {storyPage}.map.readyMap, {global}.maplibregl)",
            unbind: "bioreportr.curationForm.destroyDragMarker({boundValue})",
            onceOnly: true
        }
    },
    showDragMarker: "$effect:bioreportr.curationForm.showDragMarker({self}.dragMarker, {self}.model.markerPosition)",
    resetPosition: "$method:bioreportr.curationForm.resetPosition({self})",
    selectProvenance: "$method:bioreportr.curationForm.selectTab({self}, provenance)",
    selectTaxonomy: "$method:bioreportr.curationForm.selectTab({self}, taxonomy)",
    submit: "$method:bioreportr.curationForm.submit({storyPage}.curation, {self}, {0}:event, {global})",
    signIn: "$method:bioreportr.curation.signIn({storyPage}.curation.backend, {global})",
    signOut: "$method:bioreportr.curation.signOut({storyPage}.curation, {global})",
    // Brings back the checklist, from which another taxon may be chosen
    chooseAnother: "$method:bioreportr.curationForm.chooseAnother({storyPage})",
    // Returns from an observation to the curation of its taxon
    backToTaxon: "$method:hortis.libreMap.recordSelector.reset({storyPage}.map.recordSelector)"
});

bioreportr.curationForm.chooseAnother = function (storyPage) {
    storyPage.map.recordSelector.reset();
    storyPage.checklist.search.reset();
};

bioreportr.curationForm.selectTab = function (that, tab) {
    that.tab = tab;
};
</script>

<template>
    <div class="mxcw-curation-form-root">
    <div class="mxcw-curation-form" @class="fl-hidden:!@{model.hasSubject}">
        <div class="mxcw-curation-pending" @class="fl-hidden:!@{model.pending}">Your comment has been submitted and is being processed</div>
        <div class="mxcw-curation-rubric" @class="fl-hidden:!@{model.isObservation}">
            <p><b>Help us place this record.</b> Your main task here is to correct where this record was made. If its marker
                on the map is in the wrong place, drag the orange marker to where the plant was actually found, then submit
                your correction. Add a comment saying how you know, e.g. the locality the record names, or a visit of your own.</p>
        </div>
        <div class="mxcw-curation-taxon">
            <div class="mxcw-curation-photo" @id="image"></div>
            <div class="mxcw-taxon-name" @class="fl-hidden:@{model.isObservation}">@{model.displayName}</div>
            <dl class="mxcw-curation-names mxcw-curation-record" @class="fl-hidden:!@{model.isObservation}">
                <dt>Taxon name:</dt> <dd><i>@{model.taxonName}</i></dd>
                <dt>Recorded by:</dt> <dd>@{model.recordedBy}</dd>
                <dt>Date:</dt> <dd>@{model.eventDate}</dd>
                <dt>Locality:</dt> <dd>@{model.locality}</dd>
                <dt>Recorded position:</dt> <dd>@{model.originalText}</dd>
                <dt>Record:</dt> <dd class="mxcw-curation-record-id">@{model.recordId} <span @id="recordLink"></span></dd>
            </dl>
        </div>
        <div class="mxcw-curation-tabs" role="tablist" aria-label="Type of note" @class="fl-hidden:!@{model.isTaxon}">
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.provenanceSelected}"
                @onclick="{self}.selectProvenance()">Provenance</button>
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.taxonomySelected}"
                @onclick="{self}.selectTaxonomy()">Taxonomy</button>
        </div>
        <form class="mxcw-curation-note-form mxcw-curation-type-@{model.type}" onsubmit="return false">
            <div class="mxcw-curation-position" @class="fl-hidden:!@{model.isObservation}">
                <span class="mxcw-curation-field-label">Corrected position:</span> <span>@{model.positionText}</span>
                <button type="button" class="mxcw-curation-link" @class="fl-hidden:!@{model.corrected}" @onclick="{self}.resetPosition()">return the marker to the recorded position</button>
            </div>
            <!-- The controls are rendered as markup, not bound to the model, since a binding of a control is two-way and the
                 user's choices would be written into the model - see bioreportr.curationForm.taxonControlsMarkup -->
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
        <button type="button" class="mxcw-curation-link mxcw-curation-choose" @class="fl-hidden:!@{model.isObservation}"
            @onclick="{self}.backToTaxon()">Back to the taxon</button>
        <button type="button" class="mxcw-curation-link mxcw-curation-choose" @onclick="{self}.chooseAnother()">Choose another taxon</button>
    </div>
    </div>
</template>

<style>
/* The tabs choosing the type of note on a taxon - each type's controls are rendered, and only the chosen type's shown */
.mxcw-curation-tabs {
    display: flex;
    gap: 2px;
    margin: 12px 0 0;
    border-bottom: 1px solid #c9d6dc;
}

.mxcw-curation-tab {
    padding: 6px 14px;
    border: 1px solid #c9d6dc;
    border-bottom: 0;
    border-radius: 4px 4px 0 0;
    background: #eef3f5;
    color: #184e62;
    font: inherit;
    cursor: pointer;
}

.mxcw-curation-tab[aria-selected="true"] {
    position: relative;
    top: 1px;
    background: #fff;
    font-weight: 600;
}

.mxcw-curation-note-form .mxcw-curation-panel {
    display: none;
}

.mxcw-curation-type-provenance .mxcw-curation-panel[data-type="provenance"],
.mxcw-curation-type-taxonomy .mxcw-curation-panel[data-type="taxonomy"],
.mxcw-curation-type-observation .mxcw-curation-panel[data-type="observation"] {
    display: block;
}

.mxcw-curation-field-label {
    display: block;
    margin-bottom: 4px;
    font-weight: 600;
}

/* The rubric of the curation of an observation, and its corrected position */
.mxcw-curation-rubric {
    margin: 0 0 12px;
    padding: 8px 12px;
    border-left: 4px solid #e8711a;
    background: rgba(232, 113, 26, 0.14);
}

.mxcw-curation-rubric p {
    margin: 0;
}

.mxcw-curation-record-id {
    overflow-wrap: anywhere;
}

.mxcw-curation-record-id .imerss-obs-tooltip-link {
    display: inline;
}

.mxcw-curation-position {
    margin: 12px 0 0;
}

.mxcw-curation-position .mxcw-curation-field-label {
    display: inline;
    margin-right: 0.4em;
}
</style>
