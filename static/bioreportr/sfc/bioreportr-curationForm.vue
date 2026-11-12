<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script src="../js/curation.js"></script>
<script>
"use strict";

// The form of the curation pane, on which a member of the community records what they know of the taxon or the
// observation chosen - see notes/community-curation-design.md. For a taxon, its tabs choose between notes on its
// provenance and on its taxonomy, or lead by the Location tab to its records. For an observation, the user's main task is to correct its position, by dragging a
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
    // The records of the taxon, listed by the Location tab - see bioreportr.curationForm.locationRecordsMarkup
    locationRecords: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: `$compute:bioreportr.curationForm.locationRecordsMarkup({curationForm}.taxon, {storyPage}.map.recordSelector.recordIndex,
                {storyPage}.curation.byObservation)`
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
    selectProvenance: "$method:bioreportr.curationForm.selectTab({self}, provenance, {storyPage}.map.recordSelector)",
    selectTaxonomy: "$method:bioreportr.curationForm.selectTab({self}, taxonomy, {storyPage}.map.recordSelector)",
    selectLocation: "$method:bioreportr.curationForm.selectTab({self}, location, {storyPage}.map.recordSelector)",
    chooseRecord: "$method:bioreportr.curationForm.chooseRecord({storyPage}.map.recordSelector, {0}:event)",
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

/**
 * Choose a tab of the form. Whilst a record is curated, under the Location tab, any tab returns to the taxon - the
 * Location tab to its list of records.
 * @param {bioreportr.curationForm} that - The form
 * @param {String} tab - The type of note chosen
 * @param {hortis.libreMap.recordSelector} recordSelector - The map's selector of records
 */
bioreportr.curationForm.selectTab = function (that, tab, recordSelector) {
    that.tab = tab;
    if (hortis.isValue(recordSelector.filterState)) {
        recordSelector.reset();
    }
};
</script>

<template>
    <div class="mxcw-curation-form-root">
    <div class="mxcw-curation-form" @class="fl-hidden:!@{model.hasSubject}">
        <div class="mxcw-curation-pending" @class="fl-hidden:!@{model.pending}">Your comment has been submitted and is being processed</div>
        <div class="mxcw-curation-taxon">
            <div class="mxcw-curation-photo" @id="image"></div>
            <!-- The taxon is named as on every tab, above the particulars of a record when one is chosen -->
            <div class="mxcw-taxon-name">@{model.displayName}</div>
        </div>
        <div class="mxcw-curation-tabs" role="tablist" aria-label="Type of note" @class="fl-hidden:!@{model.hasSubject}">
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.provenanceSelected}"
                @onclick="{self}.selectProvenance()">Provenance</button>
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.taxonomySelected}"
                @onclick="{self}.selectTaxonomy()">Taxonomy</button>
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.locationSelected}"
                @onclick="{self}.selectLocation()">Location</button>
        </div>
        <!-- The Location tab: positions are corrected record by record, so it leads to the taxon's records -->
        <div class="mxcw-curation-location" @class="fl-hidden:!@{model.isLocation}">
            <fieldset><legend>Location</legend>
            <p class="mxcw-curation-hint">Please help improve the accuracy of georeferencing of reports. Choose a record from
                the list below, or select it from the map. Drag the marker to reposition the record, and add a curatorial note to
                justify your correction.</p>
            <!-- The click is caught around the list, whose own element is replaced by its markup -->
            <div @onclick="{self}.chooseRecord({0})"><div @id="locationRecords"></div></div>
            </fieldset>
        </div>
        <!-- A record chosen from the Location tab, framed as the tabs' panels are, its comment following in the form -->
        <div class="mxcw-curation-location" @class="fl-hidden:!@{model.isObservation}">
            <fieldset><legend>Location</legend>
            <p class="mxcw-curation-hint">Drag the orange marker on the map to where this plant was actually found, and add a
                curatorial note below to justify your correction.</p>
            <dl class="mxcw-curation-record">
                <dt>Recorded by:</dt> <dd>@{model.recordedBy}</dd>
                <dt>Date:</dt> <dd>@{model.eventDate}</dd>
                <dt>Locality:</dt> <dd>@{model.locality}</dd>
                <dt>Recorded position:</dt> <dd>@{model.originalText}</dd>
                <dt>Corrected position:</dt> <dd>@{model.positionText}
                    <button type="button" class="mxcw-curation-link" @class="fl-hidden:!@{model.corrected}" @onclick="{self}.resetPosition()">return the marker to the recorded position</button></dd>
                <dt>Record:</dt> <dd class="mxcw-curation-record-id">@{model.recordId} <span @id="recordLink"></span></dd>
            </dl>
            </fieldset>
        </div>
        <form class="mxcw-curation-note-form mxcw-curation-type-@{model.type}" @class="fl-hidden:@{model.isLocation}" onsubmit="return false">
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
        <div class="mxcw-curation-consensus" @class="fl-hidden:@{model.isLocation}">
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

.mxcw-curation-record-id {
    overflow-wrap: anywhere;
}

.mxcw-curation-record-id .imerss-obs-tooltip-link {
    display: inline;
}

/* The Location tab's guidance, and its list of the taxon's records, each a button choosing it */
.mxcw-curation-location {
    margin: 12px 0 0;
}

/* The note heading the panel of each tab - and of a record's location - saying what to enter there */
.mxcw-curation-hint {
    display: block;
    margin: 0 0 10px;
    padding: 8px 12px;
    border-left: 4px solid #e8711a;
    background: rgba(232, 113, 26, 0.14);
    font-weight: 400;
}

/* The particulars of a record being placed, as label and value */
.mxcw-curation-record {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 10px;
    margin: 0;
}

.mxcw-curation-record dt {
    color: #a8c8d0;
}

.mxcw-curation-record dd {
    margin: 0;
}

/* Framed as the other tabs' fieldsets are - see .mxcw-curation-note-form fieldset in imerss-story.css */
.mxcw-curation-location > fieldset {
    margin: 0 0 var(--story-gap);
    padding: 8px 12px 10px;
    border: 1px solid rgba(168, 200, 208, 0.45);
    border-radius: var(--data-table-radius, 8px);
}

.mxcw-curation-location > fieldset > legend {
    padding: 0 6px;
    color: #a8c8d0;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}



.mxcw-curation-location .mxcw-curation-record-list,
.mxcw-curation-location .mxcw-curation-record-list li {
    margin: 0;
    padding: 0;
    list-style: none;
}

.mxcw-curation-location .mxcw-curation-record-list li::before,
.mxcw-curation-location .mxcw-curation-record-list li::marker {
    content: none;
}

.mxcw-curation-record-choice {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0 10px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-bottom: 1px solid rgba(168, 200, 208, 0.3);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.mxcw-curation-record-choice:hover,
.mxcw-curation-record-choice:focus-visible {
    background: rgba(253, 242, 206, 0.12);
}

.mxcw-curation-record-date {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.mxcw-curation-record-who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mxcw-curation-record-flags {
    grid-column: 2;
    color: #fdf2ce;
    font-size: 0.9em;
}

</style>
