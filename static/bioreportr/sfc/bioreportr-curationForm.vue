<fluid-import src="bioreportr-curation.vue"></fluid-import>
<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script>
"use strict";

fluid.registerNamespace("bioreportr.curationForm");

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
    // The history of the notes on the taxon, shown by the History tab - see bioreportr.curationForm.historyMarkup
    history: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: `$compute:bioreportr.curationForm.historyMarkup({curationForm}.taxon, {storyPage}.curation.historyById,
                {storyPage}.curationHistorySources, {storyPage}.curation.byTaxon)`
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
    selectProvenance: "$method:bioreportr.curationForm.selectTab({self}, provenance, {storyPage}.map.recordSelector)",
    selectTaxonomy: "$method:bioreportr.curationForm.selectTab({self}, taxonomy, {storyPage}.map.recordSelector)",
    selectLocation: "$method:bioreportr.curationForm.selectTab({self}, location, {storyPage}.map.recordSelector)",
    selectHistory: "$method:bioreportr.curationForm.selectTab({self}, history, {storyPage}.map.recordSelector)",
    chooseRecord: "$method:bioreportr.curationForm.chooseRecord({storyPage}.map.recordSelector, {0}:event)",
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
        // The History tab holds no note of its own - it shows those made on the taxon before, and through the site
        historySelected: type === "history",
        isHistory: type === "history",
        // Neither the History nor the Location tab takes a note of its own, so they show no form and no consensus
        noNote: type === "history" || type === "location",
        // The Location tab holds no note of its own - it leads to the records of the taxon, each corrected on its own
        // A record is chosen from the Location tab, which stays selected whilst it is curated
        locationSelected: type === "location" || !!row,
        isLocation: type === "location",
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
        consensus: type === "location" || type === "history" ? "" : bioreportr.curationForm.consensusMarkup(type, notes)
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
 * Render a note's text, with any web address in it a link.
 * @param {String} text - The text
 * @return {String} Its markup
 */
bioreportr.curationForm.linkify = function (text) {
    return hortis.dataTable.encode(text).replace(/https?:\/\/[^\s<)]+[^\s<).,;]/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
};

/**
 * Render the History tab - the notes on the taxon chosen, from the earliest account to those submitted through the
 * site, oldest first.
 * @param {TaxonRow|null} taxon - The taxon chosen for curation
 * @param {Object<String, Object>} historyById - The history of each taxon, by taxon id - see
 * `bioreportr.curation.loadHistory`
 * @param {Object[]} sources - The sources of the history, in the order in which they are shown, oldest first, each with
 * the `field` of the history holding its note, the name of its `source` and a `label` for its note - see
 * `bioreportr.storyPageCuration`
 * @param {Object<String, CurationNote[]>} byTaxon - The notes submitted through the site on each taxon, by taxon id
 * @return {String} The markup of the history
 */
bioreportr.curationForm.historyMarkup = function (taxon, historyById, sources, byTaxon) {
    const encode = hortis.dataTable.encode;
    let togo = "";
    if (taxon) {
        const history = historyById?.[taxon.id] || {};
        const entries = (sources || []).filter(({field}) => history[field])
            .map(({field, source, label}) => `<li class="mxcw-curation-history-entry">
                <div class="mxcw-curation-history-head"><b>${encode(source)}</b> <span>${encode(label)}</span></div>
                <div class="mxcw-curation-history-text">${bioreportr.curationForm.linkify(history[field])}</div>
            </li>`);
        const reviewed = history.reviewedBy ? `<p class="mxcw-curation-history-reviewed">Reviewed by ${encode(history.reviewedBy)}</p>` : "";
        // The notes added through the site, oldest first, follow - so that the history grows with each
        const site = (byTaxon[taxon.id] || []).slice().reverse().map(note => `<li class="mxcw-curation-history-entry mxcw-curation-history-site">
                <div class="mxcw-curation-history-head"><b>${encode(note.author)}</b> <span>${encode(note.type || "note")}, ${encode(bioreportr.eventDay(note.submitted))}${note.pending ? " (being processed)" : ""}</span></div>
                <div class="mxcw-curation-history-text">${note.comment ? bioreportr.curationForm.linkify(note.comment) :
        bioreportr.curation.questions.filter(([question]) => note[question]).map(([question, label]) => `${label}: ${encode(note[question])}`).join(" · ")}</div>
            </li>`);
        togo = entries.length || site.length ? `<ol class="mxcw-curation-history">${entries.join("")}${site.join("")}</ol>${reviewed}` :
            `<p class="mxcw-curation-none">No curatorial notes have been recorded on this taxon yet.</p>`;
    }
    return togo;
};

// How many of a taxon's records the Location tab lists - the rest are found on the map or in the table of records
bioreportr.curationForm.locationRecordLimit = 12;

/**
 * Render the list of the Location tab - the records of the taxon chosen, any without a position first and then the
 * oldest, each a button choosing it
 * for the correction of its position. Records without a position, and those with notes already, are marked.
 * @param {TaxonRow|null} taxon - The taxon chosen for curation
 * @param {Object} recordIndex - The index of the records, as `hortis.libreMap.recordIndex`, whose `ids` map each row to
 * its id
 * @param {Object<String, CurationNote[]>} byObservation - The notes of each record, by record id
 * @return {String} The markup of the list
 */
bioreportr.curationForm.locationRecordsMarkup = function (taxon, recordIndex, byObservation) {
    const encode = hortis.dataTable.encode;
    let togo = "";
    if (taxon && recordIndex?.ids) {
        const records = [...recordIndex.ids.entries()].filter(([row]) => String(hortis.rowToLinkTaxonId(row)) === String(taxon.id))
            // Those most in need of placing first - any without a position, then the oldest, whose localities are vaguest
            .sort(([a], [b]) => hortis.libreMap.hasCoords(a) - hortis.libreMap.hasCoords(b) ||
                String(a.eventDate || "9999").localeCompare(String(b.eventDate || "9999")));
        const shown = records.slice(0, bioreportr.curationForm.locationRecordLimit);
        const items = shown.map(([row, id]) => {
            const notes = byObservation[id]?.length || 0;
            const flags = [!hortis.libreMap.hasCoords(row) && "no position recorded",
                notes && bioreportr.cellTooltip.plural(notes, "note")].filter(Boolean);
            return `<li><button type="button" class="mxcw-curation-record-choice" data-record-id="${encode(id)}">
                <span class="mxcw-curation-record-date">${encode(row.eventDate ? bioreportr.eventDay(row.eventDate) : "Undated")}</span>
                <span class="mxcw-curation-record-who">${encode((row.recordedBy || "Unknown").split(";")[0].trim())}${row.locality ? " · " + encode(row.locality) : ""}</span>
                ${flags.length ? `<span class="mxcw-curation-record-flags">${flags.join(" · ")}</span>` : ""}
            </button></li>`;
        }).join("");
        const more = records.length > shown.length ? `<p class="mxcw-curation-none">and ${records.length - shown.length} more - choose them on the map or in the table of records</p>` : "";
        togo = records.length ? `<ul class="mxcw-curation-record-list">${items}</ul>${more}` : `<p class="mxcw-curation-none">This taxon has no records to correct.</p>`;
    }
    return togo;
};

/**
 * Choose for curation the record whose button was clicked in the Location tab's list, by selecting it as the map
 * would - the form then turns to the record, see `bioreportr.curation.chosenObservation`.
 * @param {hortis.libreMap.recordSelector} recordSelector - The map's selector of records
 * @param {Event} event - The click
 */
bioreportr.curationForm.chooseRecord = function (recordSelector, event) {
    const button = event.target.closest?.(".mxcw-curation-record-choice");
    if (button) {
        const id = button.dataset.recordId;
        const entry = [...recordSelector.recordIndex.ids.entries()].find(([, candidate]) => candidate === id);
        if (entry) {
            recordSelector.select(entry[0]);
        }
    }
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
            <button type="button" role="tab" class="mxcw-curation-tab" aria-selected="@{model.historySelected}"
                @onclick="{self}.selectHistory()">History</button>
        </div>
        <!-- The History tab: the notes on the taxon, from its earliest account to those submitted through the site -->
        <div class="mxcw-curation-location" @class="fl-hidden:!@{model.isHistory}">
            <fieldset><legend>History</legend>
            <p class="mxcw-curation-hint">The history of curatorial notes on this species, from the earliest account to those
                added through this site.</p>
            <div @id="history"></div>
            </fieldset>
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
        <form class="mxcw-curation-note-form mxcw-curation-type-@{model.type}" @class="fl-hidden:@{model.noNote}" onsubmit="return false">
            <!-- The controls are bound to the draft, the user's own entries, which the form seeds from their note on each
                 subject - see bioreportr.curationForm.draftSeed. A panel for each type of note is rendered, of which CSS
                 shows only that of the tab chosen, so that choosing a tab keeps what has been entered in the other.
                 The radios' checked states are bound to choices, computed from the draft - a radio's user input is
                 refused there, and reaches the draft through its handler -->
            <div class="mxcw-curation-panel" data-type="provenance">
                <fieldset class="mxcw-curation-vote"><legend>Provenance</legend>
                    <p class="mxcw-curation-hint">Please enter information on the provenance of this species.</p><div class="mxcw-curation-vote-grid"><span></span>
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
                    <label class="mxcw-curation-hint" for="mxcw-curation-synonymy">Please enter any taxonomic notes regarding this species report.</label>
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
        <div class="mxcw-curation-consensus" @class="fl-hidden:@{model.noNote}">
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

/* Every state of a tab has the same box - the same weight of type, borders and padding - so that choosing one moves
   nothing. A tab overlaps the line beneath the row by its own bottom border, which the chosen tab colours as its panel */
.mxcw-curation-tab {
    margin-bottom: -1px;
    padding: 6px 14px;
    border: 1px solid #9fb6bf;
    border-bottom-color: #c9d6dc;
    border-radius: 4px 4px 0 0;
    background: #b9ccd3;
    color: #3a5965;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
}

.mxcw-curation-tab:hover {
    background: #d7e4e9;
    color: #184e62;
}

.mxcw-curation-tab:focus-visible {
    outline: 2px solid #e8711a;
    outline-offset: -2px;
}

.mxcw-curation-tab[aria-selected="true"] {
    border-color: #c9d6dc;
    border-bottom-color: #fff;
    background: #fff;
    color: #0f3a4a;
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

/* The History tab's timeline of notes, oldest first, down a rule, those added through the site marked in the orange of
   the tabs' guidance */
/* Set in from the box's edge, its dots centred on its rule */
.mxcw-curation-history {
    margin: 4px 0 0 10px;
    padding: 0 0 0 18px;
    border-left: 2px solid rgba(168, 200, 208, 0.45);
    list-style: none;
}

.mxcw-curation-location .mxcw-curation-history-entry {
    position: relative;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
}

.mxcw-curation-location .mxcw-curation-history-entry::marker {
    content: none;
}

.mxcw-curation-history-entry::before {
    content: "";
    position: absolute;
    top: 0.45em;
    /* Half the dot's width and the rule's, back across the list's padding */
    left: -24px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a8c8d0;
}

.mxcw-curation-history-site::before {
    background: #e8711a;
}

.mxcw-curation-history-head span {
    margin-left: 4px;
    color: #a8c8d0;
}

.mxcw-curation-history-text {
    margin-top: 2px;
    overflow-wrap: anywhere;
}

.mxcw-curation-history-text a {
    color: #fdf2ce;
}

.mxcw-curation-history-reviewed {
    margin: 4px 0 0;
    color: #a8c8d0;
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
