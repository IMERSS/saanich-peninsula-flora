<fluid-import src="bioreportr-curation.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script>
"use strict";

fluid.registerNamespace("bioreportr.curationForm");

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
    // The user's entries into the form's controls, to which they are bound. A reactive root, so that the controls'
    // writes beneath it are held in it, rather than beside it. Seeded afresh, discarding any unsubmitted entries,
    // whenever the subject or the user's own notes on it change - see bioreportr.curationForm.draftSeed
    draft: {
        $reactiveRoot: {}
    },
    draftSeed: `$compute:bioreportr.curationForm.draftSeed({self}.taxon, {self}.observation, {storyPage}.curation.byTaxon,
        {storyPage}.curation.byObservation, {storyPage}.curation.viewer)`,
    seedDraft: "$effect:bioreportr.curationForm.seedDraft({self}, {self}.draftSeed)",
    // Which radio of each question of provenance is checked
    choices: "$compute:bioreportr.curationForm.choices({self}.draft)",
    vote: "$method:bioreportr.curationForm.vote({self}, {0}, {1})",
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
    submit: "$method:bioreportr.curationForm.submit({storyPage}.curation, {self})",
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

/**
 * The corrected position of an observation shown by the form - that to which the user has dragged its marker, or
 * else that of their own note on it, if any.
 * @param {String} recordId - The id of the observation
 * @param {CurationNote|null} own - The user's own note on the observation, if any
 * @param {Object|null} correction - The user's correction in the form, if any, with its `recordId`, and either `lat` and
 * `long` or `cleared`
 * @return {Object|null} The corrected position, with members `lat` and `long`, or null if it is uncorrected
 */
bioreportr.curationForm.position = function (recordId, own, correction) {
    const ownPosition = own && own.lat !== "" && own.lat !== undefined ? {lat: +own.lat, long: +own.long} : null;
    return correction?.recordId === recordId ? correction.cleared ? null : {lat: correction.lat, long: correction.long} : ownPosition;
};

/**
 * Render a position for reading.
 * @param {Object} position - The position, with members `lat` and `long`
 * @return {String} The position, as latitude and longitude to 5 decimal places, about a metre
 */
bioreportr.curationForm.positionText = position => position.lat.toFixed(5) + ", " + position.long.toFixed(5);

/**
 * Compute what the curation form shows - of the observation chosen for curation, if any, or else of the taxon, of
 * whose notes those of the type chosen by the form's tab are shown.
 * @param {TaxonRow|null} taxon - The taxon chosen for curation, if any
 * @param {Object|null} observation - The observation chosen for curation, if any, with members `recordId` and `row`
 * @param {Object<String, TaxonRow>} rowById - The taxa, by id
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 * @param {Object<String, CurationNote[]>} byObservation - The notes of each observation, by record id
 * @param {Object|null} viewer - The user signed in, if any, with their `login`
 * @param {Boolean} connected - Whether notes may be submitted
 * @param {String} status - A message on the progress of a submission
 * @param {String} tab - The type of note on a taxon chosen by the form's tab, "provenance" or "taxonomy"
 * @param {Object|null} correction - The user's correction of the observation's position, if any - see
 * `bioreportr.curationForm.position`
 * @return {Object} The model of the form
 */
bioreportr.curationForm.model = function (taxon, observation, rowById, byTaxon, byObservation, viewer, connected, status, tab, correction) {
    const row = observation?.row || null;
    const subjectTaxon = row ? rowById[hortis.rowToLinkTaxonId(row)] || null : taxon;
    const type = row ? "observation" : taxon ? tab : "none";
    const taxonNotes = subjectTaxon ? byTaxon[subjectTaxon.id] || [] : [];
    const notes = row ? byObservation[observation.recordId] || [] : bioreportr.curation.ofType(taxonNotes, type);
    const authored = candidates => viewer ? candidates.find(note => note.author === viewer.login) || null : null;
    const own = authored(notes);
    const original = row && hortis.libreMap.hasCoords(row) ? {lat: +row.decimalLatitude, long: +row.decimalLongitude} : null;
    const position = row ? bioreportr.curationForm.position(observation.recordId, own, correction) : null;
    const taxonName = subjectTaxon ? hortis.rowToScientific(subjectTaxon) : row?.taxon_name || "";
    return {
        hasSubject: !!(taxon || row),
        type,
        isTaxon: !row && !!taxon,
        isObservation: !!row,
        provenanceSelected: type === "provenance",
        taxonomySelected: type === "taxonomy",
        subject: {taxonId: subjectTaxon?.id ?? (row ? String(hortis.rowToLinkTaxonId(row)) : ""), taxonName, recordId: observation?.recordId},
        recordId: observation?.recordId || "",
        taxonName,
        // As the taxon is named elsewhere - its scientific name, then its common name in brackets
        displayName: subjectTaxon ? hortis.rowToScientific(subjectTaxon) + (subjectTaxon.commonName ? ` (${subjectTaxon.commonName})` : "") : "",
        commonName: subjectTaxon?.commonName || "",
        image: subjectTaxon ? hortis.renderTaxonImage(subjectTaxon.iNaturalistTaxonImage, subjectTaxon.id) : "",
        recordedBy: row?.recordedBy || "Unknown",
        eventDate: row?.eventDate || "Unknown",
        locality: row?.locality || "",
        recordLink: row ? hortis.libreMap.iNatLinkMarkup(row) : "",
        originalText: original ? bioreportr.curationForm.positionText(original) : "None recorded",
        position,
        positionText: position ? bioreportr.curationForm.positionText(position) : "Not corrected",
        corrected: !!position,
        // Where the draggable marker stands - at the corrected position, or else on the record's own
        markerPosition: row ? position || original : null,
        pending: !!own?.pending,
        connected,
        signedIn: connected && !!viewer,
        signedOut: connected && !viewer,
        viewerLogin: viewer?.login || "",
        submitLabel: own ? "Replace your note" : "Submit your note",
        status,
        consensus: bioreportr.curationForm.consensusMarkup(type, notes)
    };
};

/**
 * Compute what the form's draft is seeded with - the user's own notes on its subject, if any, of each type, so that
 * the draft is seeded afresh for another subject, or once the user's own notes change, e.g. on signing in. Returned as
 * a string, of which an equal value doesn't propagate, so that other changes, e.g. to others' notes, leave the user's
 * entries alone.
 * @param {TaxonRow|null} taxon - The taxon chosen for curation, if any
 * @param {Object|null} observation - The observation chosen for curation, if any, with members `recordId` and `row`
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 * @param {Object<String, CurationNote[]>} byObservation - The notes of each observation, by record id
 * @param {Object|null} viewer - The user signed in, if any, with their `login`
 * @return {String} The draft's seed, encoded as JSON
 */
bioreportr.curationForm.draftSeed = function (taxon, observation, byTaxon, byObservation, viewer) {
    const authored = notes => viewer ? notes.find(note => note.author === viewer.login) || null : null;
    const taxonNotes = taxon ? byTaxon[taxon.id] || [] : [];
    const provenance = authored(bioreportr.curation.ofType(taxonNotes, "provenance"));
    const taxonomy = authored(bioreportr.curation.ofType(taxonNotes, "taxonomy"));
    const ownObservation = observation ? authored(byObservation[observation.recordId] || []) : null;
    return JSON.stringify({
        subject: observation ? "observation:" + observation.recordId : "taxon:" + (taxon?.id || ""),
        ...Object.fromEntries(bioreportr.curation.questions.map(([question]) => [question, provenance?.[question] || "no opinion"])),
        comment: provenance?.comment || "",
        synonymy: taxonomy?.comment || "",
        observationComment: ownObservation?.comment || ""
    });
};

/**
 * Seed the form's draft, the user's entries into its controls.
 * @param {bioreportr.curationForm} that - The form
 * @param {String} seed - The draft's seed, as computed by `bioreportr.curationForm.draftSeed`
 */
bioreportr.curationForm.seedDraft = function (that, seed) {
    that.draft = JSON.parse(seed);
};

/**
 * Compute which radio of each question of provenance is checked, from the draft.
 * @param {Object} draft - The form's draft
 * @return {Object<String, Object>} For each question, whether each of its radios - `yes`, `no` and `none`, for
 * "no opinion" - is checked
 */
bioreportr.curationForm.choices = draft => Object.fromEntries(bioreportr.curation.questions.map(([question]) =>
    [question, {yes: draft[question] === "yes", no: draft[question] === "no", none: draft[question] === "no opinion"}]));

/**
 * Record the user's vote on a question of provenance in the form's draft.
 * @param {bioreportr.curationForm} that - The form
 * @param {String} question - The question, one of `bioreportr.curation.questions`
 * @param {String} vote - The vote, one of `bioreportr.curation.votes`
 */
bioreportr.curationForm.vote = function (that, question, vote) {
    that.draft[question] = vote;
};

/**
 * Render the consensus of the community on the subject of the form - for provenance, the tally of the votes, and for
 * every type, each note.
 * @param {String} type - The type of the notes, one of the `bioreportr.curation.types`, or "none" if there is no subject
 * @param {CurationNote[]} notes - The notes of that type on the subject, most recent first
 * @return {String} The markup of the consensus
 */
bioreportr.curationForm.consensusMarkup = function (type, notes) {
    const encode = hortis.dataTable.encode;
    const none = {
        provenance: "No one has added a note on the provenance of this taxon yet.",
        taxonomy: "No one has added a note on the taxonomy of this taxon yet.",
        observation: "No one has added a note on this record yet."
    };
    const details = {
        provenance: note => bioreportr.curation.questions.map(([question, label]) => `${label}: ${encode(note[question])}`).join(" · "),
        taxonomy: () => "",
        observation: note => note.lat !== "" && note.lat !== undefined && Number.isFinite(+note.lat) ?
            "Corrected position: " + bioreportr.curationForm.positionText({lat: +note.lat, long: +note.long}) : "Position not corrected"
    };
    const items = notes.map(note => {
        const detail = details[type](note);
        return `<li class="mxcw-curation-note">
        <div class="mxcw-curation-note-head"><b>${encode(note.author)}</b> ${encode(bioreportr.eventDay(note.submitted))}${note.pending ? " <i>(being processed)</i>" : ""}
            ${note.url ? `<a href="${encode(note.url)}" target="_blank" rel="noopener">on GitHub</a>` : ""}</div>
        ${detail ? `<div class="mxcw-curation-note-answers">${detail}</div>` : ""}
        ${note.comment ? `<div class="mxcw-curation-note-comment">${encode(note.comment)}</div>` : ""}
    </li>`;
    }).join("");
    return type === "none" ? "" : notes.length === 0 ? `<p class="mxcw-curation-none">${none[type]}</p>` :
        `${type === "provenance" ? bioreportr.curation.tallyMarkup(notes) : ""}<ul class="mxcw-curation-notes">${items}</ul>`;
};

/**
 * Submit the form's note, of the type shown, read from its draft - and for an observation, its corrected position.
 * @param {bioreportr.curation} curation - The story page's curation component
 * @param {bioreportr.curationForm} form - The form
 */
bioreportr.curationForm.submit = function (curation, form) {
    const model = form.model;
    const draft = form.draft;
    const answers = {
        provenance: () => Object.fromEntries([...bioreportr.curation.questions.map(([question]) => [question, draft[question]]), ["comment", draft.comment]]),
        taxonomy: () => ({comment: draft.synonymy}),
        observation: () => ({comment: draft.observationComment,
            lat: model.position ? String(model.position.lat) : "", long: model.position ? String(model.position.long) : ""})
    };
    curation.submit(model.type, model.subject, answers[model.type]());
};

/** The draggable marker correcting an observation's position **/

bioreportr.curationForm.dragMarkerMarkup = `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true">
    <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1Z"/>
    <circle cx="15" cy="15" r="5.5"/>
</svg>`;

/**
 * Create the marker by which the position of an observation is corrected - a duplicate of its marker, which is dragged
 * to where the record was made, writing the position into the form's `correction`. It is added to the map only whilst
 * an observation is chosen - see `bioreportr.curationForm.showDragMarker`.
 * @param {bioreportr.curationForm} that - The form
 * @param {maplibregl.Map} map - The story's map, once ready
 * @param {Object} maplibregl - The MapLibre library
 * @return {Object} A record of the marker, with members `marker`, `map` and `shown`
 */
bioreportr.curationForm.makeDragMarker = function (that, map, maplibregl) {
    const element = map.getContainer().ownerDocument.createElement("div");
    element.className = "mxcw-curation-drag-marker";
    element.title = "Drag me to where this record was made";
    element.innerHTML = bioreportr.curationForm.dragMarkerMarkup;
    const marker = new maplibregl.Marker({element, anchor: "bottom", draggable: true});
    // 6 decimal places is about 10cm, finer than any record is made
    const round = coordinate => Math.round(coordinate * 1e6) / 1e6;
    marker.on("dragend", () => {
        const {lng, lat} = marker.getLngLat();
        that.correction = {recordId: that.model.recordId, lat: round(lat), long: round(lng)};
    });
    return {marker, map, shown: false};
};

/**
 * Place the draggable marker at a position, or remove it from the map if there is none.
 * @param {Object} record - The record of the marker, as created by `bioreportr.curationForm.makeDragMarker`
 * @param {Object|null} position - Where it is to stand, with members `lat` and `long`, or null if no observation is chosen
 */
bioreportr.curationForm.showDragMarker = function (record, position) {
    if (position) {
        record.marker.setLngLat([position.long, position.lat]);
        if (!record.shown) {
            record.marker.addTo(record.map);
            record.shown = true;
        }
    } else if (record.shown) {
        record.marker.remove();
        record.shown = false;
    }
};

bioreportr.curationForm.destroyDragMarker = function (record) {
    record.marker.remove();
};

/**
 * Return the observation's marker to its recorded position, so that the note corrects no position.
 * @param {bioreportr.curationForm} that - The form
 */
bioreportr.curationForm.resetPosition = function (that) {
    that.correction = {recordId: that.model.recordId, cleared: true};
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
            <!-- The controls are bound to the draft, the user's own entries, which the form seeds from their note on each
                 subject - see bioreportr.curationForm.draftSeed. A panel for each type of note is rendered, of which CSS
                 shows only that of the tab chosen, so that choosing a tab keeps what has been entered in the other.
                 The radios' checked states are bound to choices, computed from the draft - a radio's user input is
                 refused there, and reaches the draft through its handler -->
            <div class="mxcw-curation-panel" data-type="provenance">
                <fieldset class="mxcw-curation-vote"><legend>Vote</legend><div class="mxcw-curation-vote-grid"><span></span>
                    <span class="mxcw-curation-vote-head">yes</span><span class="mxcw-curation-vote-head">no</span><span class="mxcw-curation-vote-head">no opinion</span>
                    <span class="mxcw-curation-vote-label">Present:</span>
                    <input type="radio" name="present" aria-label="Present: yes" checked="@{choices.present.yes}" @onchange="{self}.vote(present, yes)">
                    <input type="radio" name="present" aria-label="Present: no" checked="@{choices.present.no}" @onchange="{self}.vote(present, no)">
                    <input type="radio" name="present" aria-label="Present: no opinion" checked="@{choices.present.none}" @onchange="{self}.vote(present, no opinion)">
                    <span class="mxcw-curation-vote-label">Planted:</span>
                    <input type="radio" name="planted" aria-label="Planted: yes" checked="@{choices.planted.yes}" @onchange="{self}.vote(planted, yes)">
                    <input type="radio" name="planted" aria-label="Planted: no" checked="@{choices.planted.no}" @onchange="{self}.vote(planted, no)">
                    <input type="radio" name="planted" aria-label="Planted: no opinion" checked="@{choices.planted.none}" @onchange="{self}.vote(planted, no opinion)">
                    <span class="mxcw-curation-vote-label">Waif / unestablished:</span>
                    <input type="radio" name="waif" aria-label="Waif / unestablished: yes" checked="@{choices.waif.yes}" @onchange="{self}.vote(waif, yes)">
                    <input type="radio" name="waif" aria-label="Waif / unestablished: no" checked="@{choices.waif.no}" @onchange="{self}.vote(waif, no)">
                    <input type="radio" name="waif" aria-label="Waif / unestablished: no opinion" checked="@{choices.waif.none}" @onchange="{self}.vote(waif, no opinion)">
                </div></fieldset>
                <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea rows="4" aria-label="Comment" value="@{draft.comment}"></textarea></fieldset>
            </div>
            <div class="mxcw-curation-panel" data-type="taxonomy">
                <fieldset class="mxcw-curation-comment"><legend>Taxonomy</legend>
                    <label class="mxcw-curation-field-label" for="mxcw-curation-synonymy">Enter a correction for the synonymy of this taxon</label>
                    <textarea id="mxcw-curation-synonymy" rows="4" value="@{draft.synonymy}"></textarea></fieldset>
            </div>
            <div class="mxcw-curation-panel" data-type="observation">
                <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea rows="4"
                    aria-label="Comment on this record" value="@{draft.observationComment}"></textarea></fieldset>
            </div>
            <div class="mxcw-curation-account">
                <span @class="fl-hidden:@{model.connected}">Community curation is not yet connected to GitHub, so notes can't be submitted from this site yet.</span>
                <span @class="fl-hidden:!@{model.signedOut}">
                    <button type="button" class="mxcw-curation-button" @onclick="{self}.signIn()">Sign in with GitHub</button>
                    to add your note - or <a href="https://github.com/signup" target="_blank" rel="noopener">create a GitHub account</a>
                </span>
                <span @class="fl-hidden:!@{model.signedIn}">Signed in as <b>@{model.viewerLogin}</b>
                    <button type="button" class="mxcw-curation-link" @onclick="{self}.signOut()">sign out</button></span>
                <button type="button" class="mxcw-curation-button mxcw-curation-submit" @class="fl-hidden:!@{model.signedIn}"
                    @onclick="{self}.submit()">@{model.submitLabel}</button>
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
