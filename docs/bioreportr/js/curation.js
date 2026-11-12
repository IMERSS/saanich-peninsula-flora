/*
Copyright 2026 IMERSS
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

// Community curation of the taxa and records of a story - see notes/community-curation-design.md. Each note is a
// comment on the thread of its taxon in the project's GitHub Discussions, and is of one of three types: on the
// provenance of a taxon, on its taxonomy, or on an observation, e.g. correcting its position. A GitHub Actions job
// consolidates notes on taxa into taxa.csv and those on observations into observations.csv, with claimStatus.json
// listing the claims consolidated. A note submitted from this page is held in local storage until its claim appears
// there, and is shown meanwhile as if it were consolidated

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

fluid.registerNamespace("bioreportr.curation");
fluid.registerNamespace("bioreportr.curation.backends");
fluid.registerNamespace("bioreportr.curationForm");

/**
 * A note on a taxon or an observation, as consolidated into taxa.csv or observations.csv, or held locally until it is.
 * @typedef {Object} CurationNote
 * @property {String} type - One of the `bioreportr.curation.types` - "provenance" for a note written before types were
 * introduced
 * @property {String} taxonId - The id of the taxon, or of the observation's taxon
 * @property {String} taxonName - The taxon's scientific name
 * @property {String} [recordId] - The id of the observation, for a note of type "observation", as computed by
 * `hortis.libreMap.recordId`
 * @property {String} claimId - The 21 character Nano ID allocated to the note's submission
 * @property {String} author - The GitHub login of the note's author
 * @property {String} submitted - The time of submission, as an ISO 8601 string
 * @property {String} [present] - For a note on provenance, the vote on whether the taxon is present, one of the
 * `bioreportr.curation.votes`
 * @property {String} [planted] - The vote on whether it is planted
 * @property {String} [waif] - The vote on whether it is a waif, or unestablished
 * @property {String} [lat] - For a note on an observation, the latitude of its corrected position, or the empty string
 * if the note corrects none
 * @property {String} [long] - The longitude of its corrected position
 * @property {String} comment - Free text - for a note on taxonomy, the correction of the taxon's synonymy
 * @property {String} url - The URL of the note's comment on GitHub, if known
 * @property {String} [commentId] - The node id of the note's comment on GitHub, kept with a pending note
 * @property {Boolean} [pending] - `true` for a note held locally whose claim is not yet consolidated
 */

// The questions of the vote, with their labels
bioreportr.curation.questions = [["present", "Present"], ["planted", "Planted"], ["waif", "Waif / unestablished"]];

// The answers to each question
bioreportr.curation.votes = ["yes", "no", "no opinion"];

// The line marking the YAML block of a comment as a curation note
bioreportr.curation.marker = "# bioreportr-curation";

// The types of note - on a taxon's provenance, on its taxonomy, and on an observation
bioreportr.curation.taxonTypes = ["provenance", "taxonomy"];
bioreportr.curation.types = [...bioreportr.curation.taxonTypes, "observation"];

// The fields of each type of note written into its comment, in order
bioreportr.curation.commentFields = {
    provenance: ["claimId", "type", "taxonId", "taxonName", "present", "planted", "waif", "comment"],
    taxonomy: ["claimId", "type", "taxonId", "taxonName", "comment"],
    observation: ["claimId", "type", "recordId", "taxonId", "taxonName", "lat", "long", "comment"]
};

/**
 * The type of a note - one written before types were introduced is on provenance.
 * @param {CurationNote} note - The note
 * @return {String} Its type, one of the `bioreportr.curation.types`
 */
bioreportr.curation.noteType = note => note.type || "provenance";

/**
 * The subject of a note, of which each author has at most one note - a type of note on a taxon, or an observation.
 * @param {CurationNote} note - The note
 * @return {String} The key of its subject
 */
bioreportr.curation.subjectKey = function (note) {
    const type = bioreportr.curation.noteType(note);
    return type === "observation" ? "observation|" + note.recordId : type + "|" + note.taxonId;
};

// The alphabet of Nano ID
bioreportr.curation.nanoidAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

/**
 * Allocate a claim id - a 21 character Nano ID, from the browser's cryptographic random numbers.
 * @param {Crypto} crypto - The window's crypto
 * @return {String} The claim id
 */
bioreportr.curation.nanoid = function (crypto) {
    const bytes = crypto.getRandomValues(new Uint8Array(21));
    return Array.from(bytes, byte => bioreportr.curation.nanoidAlphabet[byte & 63]).join("");
};

/**
 * Render a note as the body of its comment - a sentence for readers of the thread, then the note as a flat YAML block,
 * each value quoted as JSON, which YAML reads as a double-quoted string.
 * @param {CurationNote} note - The note
 * @param {String} pageUrl - The URL of the page from which it was submitted
 * @return {String} The body of the comment
 */
bioreportr.curation.commentBody = function (note, pageUrl) {
    const type = bioreportr.curation.noteType(note);
    const lines = bioreportr.curation.commentFields[type].map(field => field + ": " + JSON.stringify(String(note[field] ?? "")));
    const headings = {
        provenance: `Curation note on the provenance of *${note.taxonName}*`,
        taxonomy: `Curation note on the taxonomy of *${note.taxonName}*`,
        observation: `Curation note on a record of *${note.taxonName}*, ${note.recordId}` +
            (note.lat ? `, correcting its position to ${note.lat}, ${note.long}` : "")
    };
    return `${headings[type]}, submitted from ${pageUrl}\n\n\`\`\`yaml\n${bioreportr.curation.marker}\n${lines.join("\n")}\n\`\`\`\n`;
};

/**
 * Read the fields of the note held by a comment's body, as written by `bioreportr.curation.commentBody` - each line of
 * its YAML block holding a field whose value is quoted as JSON.
 * @param {String} body - The body of the comment
 * @return {Object|null} The fields of the note, or null if the comment holds none
 */
bioreportr.curation.readCommentFields = function (body) {
    const blocks = [...String(body || "").matchAll(/```ya?ml\r?\n([\s\S]*?)```/g)].map(match => match[1]);
    const block = blocks.find(text => text.trim().startsWith(bioreportr.curation.marker));
    const read = value => {
        let togo = value;
        try {
            togo = JSON.parse(value);
        } catch (error) {
            togo = value;
        }
        return togo;
    };
    return block ? Object.fromEntries(block.split(/\r?\n/).map(line => line.match(/^(\w+):\s*(.*)$/)).filter(match => match)
        .map(match => [match[1], String(read(match[2].trim()))])) : null;
};

/** Notes, consolidated and pending **/

/**
 * The key in local storage of a project's pending notes - each project's notes are kept apart, should two share an origin.
 * @param {Object} config - The contents of the project's curation config.json
 * @return {String} The key
 */
bioreportr.curation.storageKey = config => "bioreportr-curation-claims:" + (config.repository || "local");

/**
 * Read the pending notes held in local storage.
 * @param {Window} window - The window
 * @param {String} storageKey - The key of the notes in local storage
 * @param {Number} [pendingVersion] - Advanced whenever the notes are written, so that they are read again
 * @return {Object<String, CurationNote>} The notes, by claim id
 */
bioreportr.curation.readPending = function (window, storageKey, pendingVersion) { // eslint-disable-line no-unused-vars
    let togo = {};
    try {
        togo = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch (error) {
        togo = {};
    }
    return togo;
};

/**
 * Write the pending notes into local storage.
 * @param {Window} window - The window
 * @param {String} storageKey - The key of the notes in local storage
 * @param {Object<String, CurationNote>} pending - The notes, by claim id
 */
bioreportr.curation.writePending = function (window, storageKey, pending) {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(pending));
    } catch (error) {
        console.error("Could not keep the curation note in local storage", error);
    }
};

/**
 * Determine the claims which have been consolidated - those of claimStatus.json, together with any in taxa.csv or
 * observations.csv. A claim's status in claimStatus.json is "consolidated" - any other status is not yet counted.
 * @param {Object<String, String>} claimStatus - The contents of claimStatus.json
 * @param {CurationNote[]} taxonRows - The rows of taxa.csv
 * @param {CurationNote[]} observationRows - The rows of observations.csv
 * @return {Set<String>} The ids of the claims consolidated
 */
bioreportr.curation.consolidatedClaims = function (claimStatus, taxonRows, observationRows) {
    return new Set([...Object.keys(claimStatus || {}).filter(claimId => claimStatus[claimId]),
        ...taxonRows.map(row => row.claimId), ...observationRows.map(row => row.claimId)]);
};

/**
 * Index the notes of some types by their subjects - those consolidated, and those pending locally whose claims are not
 * yet consolidated. A pending note displaces its author's consolidated note on the same subject, since it will
 * replace it.
 * @param {CurationNote[]} rows - The consolidated notes
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Set<String>} consolidated - The ids of the claims consolidated
 * @param {String[]} types - The types of note indexed
 * @param {Function} keyOf - Accepts a note and returns the key by which it is indexed
 * @return {Object<String, CurationNote[]>} The notes, by key, most recent first
 */
bioreportr.curation.indexNotes = function (rows, pending, consolidated, types, keyOf) {
    const typed = note => ({...note, type: bioreportr.curation.noteType(note)});
    const pendingNotes = Object.values(pending).map(typed)
        .filter(note => types.includes(note.type) && !consolidated.has(note.claimId)).map(note => ({...note, pending: true}));
    const authored = note => bioreportr.curation.subjectKey(note) + "|" + note.author;
    const displaced = new Set(pendingNotes.map(authored));
    const togo = {};
    [...rows.map(typed).filter(row => !displaced.has(authored(row))), ...pendingNotes].forEach(note => {
        (togo[keyOf(note)] ||= []).push(note);
    });
    Object.values(togo).forEach(notes => notes.sort((a, b) => String(b.submitted).localeCompare(String(a.submitted))));
    return togo;
};

/**
 * Index the notes on every taxon, of both types, by taxon id.
 * @param {CurationNote[]} rows - The rows of taxa.csv
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Set<String>} consolidated - The ids of the claims consolidated
 * @return {Object<String, CurationNote[]>} The notes of each taxon, by taxon id, most recent first
 */
bioreportr.curation.byTaxon = function (rows, pending, consolidated) {
    return bioreportr.curation.indexNotes(rows, pending, consolidated, bioreportr.curation.taxonTypes, note => note.taxonId);
};

/**
 * Index the notes on every observation, by record id.
 * @param {CurationNote[]} rows - The rows of observations.csv
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Set<String>} consolidated - The ids of the claims consolidated
 * @return {Object<String, CurationNote[]>} The notes of each observation, by record id, most recent first
 */
bioreportr.curation.byObservation = function (rows, pending, consolidated) {
    return bioreportr.curation.indexNotes(rows.map(row => ({...row, type: "observation"})), pending, consolidated, ["observation"],
        note => note.recordId);
};

/**
 * The notes of one type amongst some notes.
 * @param {CurationNote[]} notes - The notes
 * @param {String} type - The type
 * @return {CurationNote[]} The notes of that type
 */
bioreportr.curation.ofType = (notes, type) => notes.filter(note => bioreportr.curation.noteType(note) === type);

/**
 * Drop from local storage the pending notes whose claims have been consolidated. Deferred, since an effect may not
 * write signals.
 * @param {bioreportr.curation} that - The curation component, whose `pendingVersion` is advanced if any is dropped
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Set<String>} consolidated - The ids of the claims consolidated
 * @param {Window} window - The window
 */
bioreportr.curation.prune = function (that, pending, consolidated, window) {
    const dropped = Object.keys(pending).filter(claimId => consolidated.has(claimId));
    if (dropped.length > 0) {
        const kept = Object.fromEntries(Object.entries(pending).filter(([claimId]) => !consolidated.has(claimId)));
        bioreportr.curation.writePending(window, that.storageKey, kept);
        fluid.invokeLater(() => that.pendingVersion++);
    }
};

/**
 * Check, once the user is signed in, that the comments of their pending notes are still on GitHub, and drop from local
 * storage any note whose comment has gone - deleted by its author on GitHub, or with its thread, before it could be
 * consolidated. Otherwise such a note would be shown, as being processed, for ever. A note is dropped only when GitHub
 * reports its comment not to exist: one which can't be checked, e.g. since GitHub can't be reached, is kept, to be
 * checked when the page is next loaded. Runs when the page starts and when the user signs in, rather than whenever the
 * pending notes change, since a note just submitted has no need of it.
 * @param {bioreportr.curation} that - The curation component, whose `pendingVersion` is advanced if any is dropped
 * @param {Object} backend - The backend, checking comments if it has `missingComments`
 * @param {String|null} token - The user's token, if signed in
 * @param {Window} window - The window
 */
bioreportr.curation.verifyPending = function (that, backend, token, window) {
    const pending = fluid.cell.untracked(() => that.pending);
    // Notes kept before comments' ids were kept with them can't be checked reliably, so are left to be consolidated
    const notes = Object.values(pending || {}).filter(note => note.commentId);
    if (token && backend.missingComments && notes.length > 0) {
        backend.missingComments(token, notes).then(missing => {
            if (missing.length > 0) {
                const current = bioreportr.curation.readPending(window, that.storageKey);
                missing.forEach(claimId => delete current[claimId]);
                bioreportr.curation.writePending(window, that.storageKey, current);
                that.pendingVersion++;
            }
        }, error => {
            console.error("Could not check the comments of pending curation notes", error);
        });
    }
};

/**
 * Summarise the notes on the provenance of a taxon - the number of each answer to each question.
 * @param {CurationNote[]} notes - The notes on the provenance of the taxon
 * @return {Object<String, Object<String, Number>>} For each question, the count of each answer
 */
bioreportr.curation.tally = function (notes) {
    return Object.fromEntries(bioreportr.curation.questions.map(([question]) => [question,
        Object.fromEntries(bioreportr.curation.votes.map(vote => [vote, notes.filter(note => note[question] === vote).length]))]));
};

/**
 * Render the tally of the votes on a taxon, as a row of each question with the counts of its answers.
 * @param {CurationNote[]} notes - The notes on the provenance of the taxon
 * @return {String} The markup of the tally
 */
bioreportr.curation.tallyMarkup = function (notes) {
    const tally = bioreportr.curation.tally(notes);
    return `<div class="mxcw-curation-tally">${bioreportr.curation.questions.map(([question, label]) => `
        <span class="mxcw-curation-tally-question">${label}</span>
        ${bioreportr.curation.votes.map(vote => `<span class="mxcw-curation-tally-count" title="${vote}">${vote} ${tally[question][vote]}</span>`).join("")}`).join("")}</div>`;
};

/**
 * Render the votes on a taxon in brief, for a tooltip - for each question, only the answers given, e.g.
 * "Present: yes", or "Present: yes 2, no 1" once several people have answered. Answers of "no opinion" are left out,
 * as is a question with no other answer.
 * @param {CurationNote[]} notes - The notes on the provenance of the taxon
 * @return {String} The markup of the votes, or the empty string if none has been given
 */
bioreportr.curation.briefTallyMarkup = function (notes) {
    const tally = bioreportr.curation.tally(notes);
    const rows = bioreportr.curation.questions.map(([question, label]) => {
        const given = bioreportr.curation.votes.filter(vote => vote !== "no opinion" && tally[question][vote] > 0);
        const answers = given.map(vote => notes.length > 1 ? `${vote} ${tally[question][vote]}` : vote).join(", ");
        return given.length > 0 ? `<div><span class="mxcw-curation-tally-question">${label}:</span> ${answers}</div>` : "";
    }).join("");
    return rows ? `<div class="mxcw-curation-brief">${rows}</div>` : "";
};

/** The speech bubbles of the checklist **/

/**
 * Render a checklist's tree, as `hortis.checklist.renderTree` does, with a speech bubble beside each taxon's name
 * leading to the curation of that taxon - shown on hovering over the taxon, and always if it has notes. Clicks and
 * hovers on the bubbles are handled here, and others passed to the checklist's own handlers.
 * @param {hortis.checklist} that - The checklist
 * @param {ChecklistEntry} rootEntry - The root entry
 * @param {Object<String, RowState>} idToState - Map of taxon id to row state
 * @param {String|null} selectedId - The id of the currently selected taxon, if any
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 * @return {VNode} The tree to be rendered
 */
bioreportr.curation.renderChecklistTree = function (that, rootEntry, idToState, selectedId, byTaxon) {
    const options = {
        simple: !!that.filterRanks,
        selectable: that.selectable,
        unfoldable: that.unfoldable,
        decorate: that.decorate ? fluid.getGlobalValue(that.decorate) : null,
        selectedId
    };
    const list = hortis.checklist.listNode(rootEntry.children, options, idToState);
    if (list) {
        bioreportr.curation.addBubbles(list, byTaxon);
    }
    const hover = "bioreportr.curation.checklistHover({0}, {checklist})";
    const root = {tag: "div", attrs: {
        "@onclick": "bioreportr.curation.checklistClick({0}, {checklist})",
        "@onmouseover": hover,
        "@onmousemove": hover,
        "@onmouseleave": hover
    }, children: list ? [fluid.markVerbatim(list)] : []};
    return {tag: "fragment", children: [root]};
};

/**
 * Place a speech bubble after the name of each taxon of a rendered list, and of the lists beneath it.
 * @param {VNode} list - A `ul` rendered by `hortis.checklist.listNode`, modified in place
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 */
bioreportr.curation.addBubbles = function (list, byTaxon) {
    list.children.forEach(item => {
        const name = item.children.find(child => child.tag === "p" && child.attrs?.["data-row-id"]);
        if (name) {
            const id = name.attrs["data-row-id"];
            const noted = !!byTaxon[id];
            const bubble = {tag: "span", attrs: {
                "class": "mxcw-curation-bubble" + (noted ? " mxcw-curation-noted" : ""),
                "data-curation-id": id,
                "role": "button",
                "aria-label": noted ? "Community notes on this taxon" : "Add a community note on this taxon"
            }, children: []};
            const sublist = item.children.findIndex(child => child.tag === "ul");
            item.children.splice(sublist === -1 ? item.children.length : sublist, 0, bubble);
            if (sublist !== -1) {
                bioreportr.curation.addBubbles(item.children[sublist + 1], byTaxon);
            }
        }
    });
};

/**
 * Handle a click within a checklist - on a speech bubble, which pins the summary of its taxon's notes where it is, so
 * that the pointer can move into it, to follow its link to the curation pane or to copy its text, or else as the
 * checklist itself does. A pinned summary is dismissed by a press outside it - see `bioreportr.curation.pinDismiss`.
 * @param {Event} event - The click
 * @param {hortis.checklist} checklist - The checklist
 */
bioreportr.curation.checklistClick = function (event, checklist) {
    const bubble = event.target.closest(".mxcw-curation-bubble");
    if (bubble) {
        const id = bioreportr.curation.hoverPrefix + bubble.dataset.curationId;
        checklist.curationPin = id;
        checklist.hoverAt(id, event);
    } else {
        hortis.checklist.click(event, checklist);
    }
};

/**
 * Mark the checklist's tooltip as pinned, or not, so that it takes the pointer, and route a click on its link to the
 * curation pane.
 * @param {hortis.checklist} checklist - The checklist
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {TooltipRecord} tooltip - The checklist's tooltip
 * @param {String|null} pin - The hover id of the pinned summary, or null if none is pinned
 */
bioreportr.curation.pinTooltip = function (checklist, storyPage, tooltip, pin) {
    tooltip.node.classList.toggle("mxcw-tip-pinned", !!pin);
    tooltip.node.onclick = event => {
        const link = event.target.closest?.("[data-curation-open]");
        if (link) {
            event.preventDefault();
            checklist.curationPin = null;
            checklist.hoverAt(null);
            bioreportr.curation.open(storyPage, link.dataset.curationOpen);
        }
    };
};

/**
 * Dismiss a pinned summary when the pointer is pressed outside it. A press on a speech bubble is left to its click,
 * which pins that bubble's summary instead.
 * @param {hortis.checklist} checklist - The checklist
 * @param {PointerPressRecord|null} press - The most recent press of the pointer, as held in `fluid.globalDismissalSignal`
 * @param {TooltipRecord} tooltip - The checklist's tooltip
 */
bioreportr.curation.pinDismiss = function (checklist, press, tooltip) {
    // Whether a summary is pinned is consulted rather than depended upon - pinning one is no reason to look again at the
    // press which pinned it
    if (press && fluid.cell.untracked(() => checklist.curationPin) && !tooltip.node.contains(press.target) &&
        !press.target.closest?.(".mxcw-curation-bubble")) {
        checklist.curationPin = null;
        checklist.hoverAt(null);
    }
};

/**
 * Show a tooltip summarising the notes of a taxon whose speech bubble is under the pointer, or else that of the taxon
 * whose name is under it, as the checklist itself does - unless a summary is pinned.
 * @param {Event} event - A mouse event within the checklist
 * @param {hortis.checklist} checklist - The checklist
 */
bioreportr.curation.checklistHover = function (event, checklist) {
    // A pinned summary stays as it is, whatever the pointer passes over, until it is dismissed
    if (!fluid.cell.untracked(() => checklist.curationPin)) {
        const bubble = event.type === "mouseleave" ? null : event.target.closest?.(".mxcw-curation-bubble");
        if (bubble) {
            checklist.hoverAt(bioreportr.curation.hoverPrefix + bubble.dataset.curationId, event);
        } else {
            hortis.checklist.hover(event, checklist);
        }
    }
};

// The prefix of the hover id of a speech bubble, distinguishing it from that of a taxon's name
bioreportr.curation.hoverPrefix = "curation:";

/**
 * Render the tooltip of a checklist - for a speech bubble, a condensed summary of its taxon's notes, or else that of a
 * taxon.
 * @param {Object<String, TaxonRow>} rowById - The taxa, by id
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 * @param {String} hoverId - The hover id, of a bubble or a taxon
 * @return {String|null} The markup of the tooltip
 */
bioreportr.curation.renderChecklistTooltip = function (rowById, byTaxon, hoverId) {
    const prefix = bioreportr.curation.hoverPrefix;
    return String(hoverId).startsWith(prefix) ? bioreportr.curation.summaryMarkup(rowById[hoverId.substring(prefix.length)],
        byTaxon[hoverId.substring(prefix.length)] || []) : hortis.renderTaxonTooltip(rowById, hoverId);
};

/**
 * Render a condensed summary of the notes on a taxon - their number, the votes given and the latest comments - ending
 * with a link to the curation pane, which may be followed once the summary is pinned.
 * @param {TaxonRow} taxon - The taxon
 * @param {CurationNote[]} notes - Its notes, most recent first
 * @return {String} The markup of the summary
 */
bioreportr.curation.summaryMarkup = function (taxon, notes) {
    const encode = hortis.dataTable.encode;
    const name = taxon ? encode(hortis.rowToScientific(taxon)) : "";
    const comments = notes.filter(note => note.comment).slice(0, 3).map(note =>
        `<li><b>${encode(note.author)}</b>${bioreportr.curation.noteType(note) === "taxonomy" ? " on taxonomy" : ""}: ` +
        `${encode(note.comment.length > 140 ? note.comment.substring(0, 140) + "…" : note.comment)}</li>`).join("");
    const body = notes.length > 0 ? `${bioreportr.curation.briefTallyMarkup(bioreportr.curation.ofType(notes, "provenance"))}${comments ? `<ul class="mxcw-tip-list mxcw-curation-comments">${comments}</ul>` : ""}` :
        "<div class=\"mxcw-tip-note\">No community notes yet</div>";
    return `<div class="mxcw-cell-tip mxcw-curation-tip">
        <div class="mxcw-tip-title"><i>${name}</i> <span>${bioreportr.cellTooltip.plural(notes.length, "note")}</span></div>
        ${body}
        <a class="mxcw-curation-tip-action" href="#" data-curation-open="${taxon ? encode(taxon.id) : ""}">Click here to add your own curation note</a>
    </div>`;
};

/**
 * Find the pane of a story holding its curation - the one whose section is rendered by `bioreportr.curationPane`.
 * @param {PaneSettings[]} panes - The panes of the story
 * @return {String|null} The pane's key, or null if the story has none
 */
bioreportr.curation.paneKey = function (panes) {
    return panes.find(pane => pane.paneComponent === "bioreportr.curationPane")?.paneKey ?? null;
};

/**
 * Open the curation of a taxon - the story's curation pane, with the taxon chosen in the checklist's search, so that
 * the map and records show the taxon.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} taxonId - The id of the taxon
 */
bioreportr.curation.open = function (storyPage, taxonId) {
    const paneKey = bioreportr.curation.paneKey(storyPage.panes);
    if (paneKey) {
        storyPage.checklist.search.select(taxonId);
        storyPage.selectPane(paneKey);
    }
};

/**
 * Open the curation of an observation - the story's curation pane, with the observation selected, as on the map, and
 * its taxon chosen in the checklist's search, so that the map and records show the taxon's records. The observation's
 * selection is kept as the pane changes - see `bioreportr.storyPage.clearRecordOnPaneChange`.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {String} recordId - The id of the observation, as computed by `hortis.libreMap.recordId`
 */
bioreportr.curation.openRecord = function (storyPage, recordId) {
    const paneKey = bioreportr.curation.paneKey(storyPage.panes);
    const selector = storyPage.map.recordSelector;
    const row = selector.recordIndex.byId.get(recordId);
    if (paneKey && row) {
        bioreportr.storyPage.keepRecord.set(storyPage, recordId);
        storyPage.checklist.search.select(String(hortis.rowToLinkTaxonId(row)));
        storyPage.selectPane(paneKey);
        selector.filterState = recordId;
    }
};

/**
 * The observation chosen for curation - the record selected, on the map or in a table of records, whilst the curation
 * pane is shown.
 * @param {PaneSettings} activePane - The pane shown
 * @param {String|null} recordId - The id of the record selected, if any
 * @param {Object|null} row - The record selected, if any
 * @return {Object|null} The observation chosen for curation, with members `recordId` and `row`, if any
 */
bioreportr.curation.chosenObservation = function (activePane, recordId, row) {
    return activePane.paneComponent === "bioreportr.curationPane" && row ? {recordId, row} : null;
};

/** The speech bubbles of the tables of records **/

// The column of a table of records holding the speech bubble of each record
bioreportr.curation.bubbleColumn = {key: "", label: "", width: "1.75em", formatter: "bioreportr.curation.recordBubbleCell"};

/**
 * Determine the columns of a table of records, as `hortis.dataTable.resolveColumns` does, with the speech bubbles first.
 * @param {Object[]} rows - The rows
 * @param {Object[]} columns - The configured columns
 * @return {Object[]} The columns
 */
bioreportr.curation.recordTableColumns = function (rows, columns) {
    return [bioreportr.curation.bubbleColumn, ...hortis.dataTable.resolveColumns(rows, columns)];
};

// What `bioreportr.curation.recordBubbleCell` needs of the table being rendered, held only whilst it is rendered by
// `bioreportr.curation.recordTableBody`, since a column's formatter is given only the cell's value and row
bioreportr.curation.cellContext = null;

/**
 * Render the body of a table of records, as `hortis.dataTable.bodyMarkup` does, with a speech bubble beside each
 * record leading to its curation - shown on hovering over the record, and always if it has notes.
 * @param {Object[]} rows - The rows in their displayed order
 * @param {Object[]} columns - The columns, beginning with `bioreportr.curation.bubbleColumn`
 * @param {Object} window - The window of rows rendered
 * @param {Number} rowHeight - The height of a row, in pixels
 * @param {Boolean} rowSelectable - Whether a row may be selected
 * @param {Object|null} selectedRow - The selected row, if any
 * @param {Object<String, CurationNote[]>} byObservation - The notes of each observation, by record id
 * @param {Object} recordIndex - The index of every observation, as computed by `hortis.libreMap.recordIndex`
 * @return {String} The markup of the body's rows
 */
bioreportr.curation.recordTableBody = function (rows, columns, window, rowHeight, rowSelectable, selectedRow, byObservation, recordIndex) {
    bioreportr.curation.cellContext = {byObservation, recordIndex};
    try {
        return hortis.dataTable.bodyMarkup(rows, columns, window, rowHeight, rowSelectable, selectedRow);
    } finally {
        bioreportr.curation.cellContext = null;
    }
};

/**
 * Render the speech bubble of a record, as the formatter of `bioreportr.curation.bubbleColumn`. It is a button, so
 * that clicking it doesn't select the record's row.
 * @param {Any} value - The cell's value, which is unused
 * @param {Object} row - The record
 * @return {String} The markup of the bubble
 */
bioreportr.curation.recordBubbleCell = function (value, row) {
    const context = bioreportr.curation.cellContext;
    const recordId = context?.recordIndex.ids.get(row);
    const count = recordId ? (context.byObservation[recordId] || []).length : 0;
    const title = count > 0 ? bioreportr.cellTooltip.plural(count, "community note") + " on this record - click to see or add yours" :
        "Correct where this record was made, or add a note on it";
    return recordId ? `<button type="button" class="mxcw-curation-bubble mxcw-curation-record-bubble${count > 0 ? " mxcw-curation-noted" : ""}"` +
        ` data-curation-record="${hortis.dataTable.encode(recordId)}" title="${title}" aria-label="${title}"></button>` : "";
};

/**
 * Handle a click within a table of records - on a speech bubble, which opens the curation of its record.
 * @param {Event} event - The click
 * @param {bioreportr.storyPage} storyPage - The story page
 */
bioreportr.curation.recordTableClick = function (event, storyPage) {
    const bubble = event.target.closest?.("[data-curation-record]");
    if (bubble) {
        bioreportr.curation.openRecord(storyPage, bubble.dataset.curationRecord);
    }
};

/**
 * The taxon chosen for curation - that chosen in the checklist's search, whilst the curation pane is shown. The search's
 * state, when decoded from the URL, holds only the taxon's id, so the taxon's row is looked up.
 * @param {PaneSettings} activePane - The pane shown
 * @param {Object|null} chosen - The state of the checklist's search - the taxon chosen, or an object holding its `id`
 * @param {Object<String, TaxonRow>} rowById - The taxa, by id
 * @return {TaxonRow|null} The taxon chosen for curation, if any
 */
bioreportr.curation.chosenTaxon = function (activePane, chosen, rowById) {
    return activePane.paneComponent === "bioreportr.curationPane" && chosen ? rowById[chosen.id] || null : null;
};

/** Signing in and submission **/

/**
 * Determine whether a story's curation is connected to somewhere to submit its notes.
 * @param {Object} config - The contents of the project's curation config.json
 * @return {Boolean} `true` if notes may be submitted
 */
bioreportr.curation.isConnected = function (config) {
    return config.backend === "memory" || !!(config.repository && config.repositoryId && config.categoryId && config.oauthEndpoint);
};

/**
 * Create the backend submitting a story's notes, as named by the `backend` of its configuration.
 * @param {Object} config - The contents of the project's curation config.json
 * @param {Window} window - The window
 * @return {Object} The backend, as created by one of `bioreportr.curation.backends`
 */
bioreportr.curation.makeBackend = function (config, window) {
    const make = bioreportr.curation.backends[config.backend || "github"];
    return make(config, window);
};

/**
 * Read the user's token from local storage.
 * @param {String} tokenKey - The key of the token in local storage
 * @param {Number} tokenVersion - Advanced whenever the token is written, so that it is read again
 * @param {Window} window - The window
 * @return {String|null} The token, if the user has signed in
 */
bioreportr.curation.readToken = function (tokenKey, tokenVersion, window) {
    let token = null;
    try {
        token = window.localStorage.getItem(tokenKey);
    } catch (error) {
        token = null;
    }
    return token;
};

/**
 * Take up a session returned to the page after signing in, exchanging it for the user's token, which is kept in local
 * storage. The session is removed from the page's URL.
 * @param {bioreportr.curation} that - The curation component, whose `tokenVersion` is advanced once the token is kept
 * @param {Object} backend - The backend
 * @param {Window} window - The window
 */
bioreportr.curation.takeSession = function (that, backend, window) {
    // Nothing to take up where there is no browser, e.g. under hydrate.js
    const url = window.location ? new window.URL(window.location.href) : null;
    const session = url?.searchParams.get("curation_session");
    if (session && backend.exchangeSession) {
        url.searchParams.delete("curation_session");
        window.history.replaceState(window.history.state, "", url.toString());
        backend.exchangeSession(session).then(token => {
            window.localStorage.setItem(that.tokenKey, token);
            that.tokenVersion++;
        }, error => {
            that.status = "Signing in to GitHub failed: " + error.message;
        });
    }
};

/**
 * Look up the user signed in, writing it into the component's `viewer`.
 * @param {bioreportr.curation} that - The curation component
 * @param {Object} backend - The backend
 * @param {String|null} token - The user's token, if signed in
 */
bioreportr.curation.loadViewer = function (that, backend, token) {
    if (token || backend.alwaysSignedIn) {
        backend.viewer(token).then(viewer => {
            that.viewer = viewer;
        }, error => {
            // A token which GitHub no longer accepts, e.g. one revoked or expired, is forgotten
            console.error("Could not look up the user signed in to GitHub", error);
            that.signOut();
        });
    } else {
        fluid.invokeLater(() => that.viewer = null);
    }
};

bioreportr.curation.signIn = function (backend, window) {
    backend.signIn(window.location.href);
};

bioreportr.curation.signOut = function (that, window) {
    try {
        window.localStorage.removeItem(that.tokenKey);
    } catch (error) {
        // Nothing to forget
    }
    that.viewer = null;
    that.tokenVersion++;
};

/**
 * Submit a note on a taxon or an observation, displacing the user's earlier note on the same subject. The note is
 * allocated a claim id and kept in local storage, so that it is shown at once, as if it were consolidated.
 * @param {bioreportr.curation} that - The curation component
 * @param {String} type - The type of the note, one of the `bioreportr.curation.types`
 * @param {Object} subject - What the note is on, with members `taxonId` and `taxonName`, and `recordId` for an observation
 * @param {Object} answers - The answers of the form - `comment`, and for provenance a member for each question, and
 * for an observation the `lat` and `long` of its corrected position, if any
 * @param {Window} window - The window
 * @return {Promise} Resolving once the note has been submitted
 */
bioreportr.curation.submit = async function (that, type, subject, answers, window) {
    const note = {
        claimId: bioreportr.curation.nanoid(window.crypto),
        type,
        taxonId: String(subject.taxonId),
        taxonName: subject.taxonName,
        ...type === "observation" ? {recordId: subject.recordId, lat: answers.lat ?? "", long: answers.long ?? ""} : {},
        author: that.viewer.login,
        submitted: new Date().toISOString(),
        ...type === "provenance" ? Object.fromEntries(bioreportr.curation.questions.map(([question]) => [question, answers[question] || "no opinion"])) : {},
        comment: (answers.comment || "").trim(),
        url: ""
    };
    that.status = "Submitting your note ...";
    try {
        const hash = fluid.hashManager.render({pane: that.paneKey, taxon: note.taxonId, record: note.recordId});
        const pageUrl = window.location.origin + window.location.pathname + hash;
        const comment = await that.backend.submit(that.token, note, bioreportr.curation.commentBody(note, pageUrl));
        const pending = bioreportr.curation.readPending(window, that.storageKey);
        // Only one note on each subject is kept, as the one submitted displaces the earlier
        const subject = bioreportr.curation.subjectKey(note);
        Object.keys(pending).filter(claimId => bioreportr.curation.subjectKey(pending[claimId]) === subject).forEach(claimId => delete pending[claimId]);
        pending[note.claimId] = {...note, url: comment.url || "", commentId: comment.id || ""};
        bioreportr.curation.writePending(window, that.storageKey, pending);
        that.pendingVersion++;
        that.status = "";
    } catch (error) {
        console.error("Could not submit the curation note", error);
        that.status = "Your note could not be submitted: " + error.message;
    }
};

/** Backends **/

/**
 * A backend holding notes as comments on GitHub Discussions, posted as the signed-in user through GitHub's GraphQL API,
 * one thread per taxon in a category of the project's repository, as giscus does. A taxon's thread holds every type of
 * note - on its provenance, its taxonomy and its observations. Signing in goes through the token
 * exchange named by the configuration's `oauthEndpoint` - see src/curation/oauthWorker.mjs and
 * notes/curation-token-exchange.md.
 * @param {Object} config - The contents of the project's curation config.json
 * @param {Window} window - The window
 * @return {Object} The backend
 */
bioreportr.curation.backends.github = function (config, window) {
    const endpoint = (config.oauthEndpoint || "").replace(/\/$/, "");
    const graphql = async function (token, query, variables) {
        const response = await window.fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {"Authorization": "bearer " + token, "Content-Type": "application/json"},
            body: JSON.stringify({query, variables})
        });
        const result = await response.json();
        if (!response.ok || result.errors) {
            throw new Error(result.errors ? result.errors.map(error => error.message).join("; ") : response.status + " " + response.statusText);
        }
        return result.data;
    };
    const threadTitle = note => "taxon:" + note.taxonId + " " + note.taxonName;
    const findThread = async function (token, taxonId) {
        const query = `repo:${config.repository} in:title "taxon:${taxonId}"`;
        const data = await graphql(token, `query($query: String!) {
            search(type: DISCUSSION, query: $query, first: 20) { nodes { ... on Discussion { id title category { id } } } }
        }`, {query});
        return data.search.nodes.find(node => node.category?.id === config.categoryId && node.title.split(" ")[0] === "taxon:" + taxonId);
    };
    /**
     * Find which of some notes' comments no longer exist on GitHub, in one query, looking each up by its node id. Only a
     * comment which GitHub reports as not found is counted as missing.
     * @param {String} token - The user's token
     * @param {CurationNote[]} notes - The notes, each with its `commentId`
     * @return {Promise<String[]>} The claim ids of the notes whose comments are missing
     */
    const missingComments = async function (token, notes) {
        const fields = notes.map((note, i) => `n${i}: node(id: $n${i}) { id }`);
        const params = notes.map((note, i) => `$n${i}: ID!`);
        const variables = Object.fromEntries(notes.map((note, i) => ["n" + i, note.commentId]));
        const response = await window.fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {"Authorization": "bearer " + token, "Content-Type": "application/json"},
            body: JSON.stringify({query: `query(${params.join(", ")}) { ${fields.join(" ")} }`, variables})
        });
        const result = await response.json();
        if (!response.ok || !result.data) {
            throw new Error(result.errors ? result.errors.map(error => error.message).join("; ") : response.status + " " + response.statusText);
        }
        // A node which is gone is returned as null, with an error of type NOT_FOUND naming it in its path
        const notFound = new Set((result.errors || []).filter(error => error.type === "NOT_FOUND").map(error => error.path?.[0]));
        return notes.filter((note, i) => notFound.has("n" + i) && result.data["n" + i] === null).map(note => note.claimId);
    };
    return {
        missingComments,
        signIn: redirect => {
            window.location.href = endpoint + "/authorize?redirect_uri=" + encodeURIComponent(redirect);
        },
        exchangeSession: async function (session) {
            const response = await window.fetch(endpoint + "/token", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({session})
            });
            const result = await response.json();
            if (!response.ok || !result.token) {
                throw new Error(result.error || response.statusText);
            }
            return result.token;
        },
        viewer: async function (token) {
            const data = await graphql(token, "query { viewer { login avatarUrl url } }", {});
            return data.viewer;
        },
        submit: async function (token, note, body) {
            let thread = await findThread(token, note.taxonId);
            if (!thread) {
                const created = await graphql(token, `mutation($input: CreateDiscussionInput!) {
                    createDiscussion(input: $input) { discussion { id } }
                }`, {input: {repositoryId: config.repositoryId, categoryId: config.categoryId, title: threadTitle(note),
                    body: `Community curation notes on *${note.taxonName}* - on its provenance, its taxonomy and its records. Each comment is one person's note, submitted from the site.`}});
                thread = created.createDiscussion.discussion;
            } else {
                // Displace the user's earlier notes on the same subject - the same type of note on the taxon, or the same observation
                const data = await graphql(token, `query($id: ID!) {
                    node(id: $id) { ... on Discussion { comments(first: 100) { nodes { id viewerDidAuthor body } } } }
                }`, {id: thread.id});
                const subject = bioreportr.curation.subjectKey(note);
                const earlier = data.node.comments.nodes.filter(comment => {
                    const fields = comment.viewerDidAuthor ? bioreportr.curation.readCommentFields(comment.body) : null;
                    return fields && bioreportr.curation.subjectKey(fields) === subject;
                });
                for (const comment of earlier) {
                    await graphql(token, `mutation($id: ID!) { deleteDiscussionComment(input: {id: $id}) { comment { id } } }`, {id: comment.id});
                }
            }
            const added = await graphql(token, `mutation($id: ID!, $body: String!) {
                addDiscussionComment(input: {discussionId: $id, body: $body}) { comment { id url } }
            }`, {id: thread.id, body});
            return added.addDiscussionComment.comment;
        }
    };
};

/**
 * A backend keeping notes only in the browser, for trying the curation pane without GitHub, e.g. in testing. Its user
 * is always signed in, as the configuration's `memoryUser`, or else "local-user".
 * @param {Object} config - The contents of the project's curation config.json
 * @return {Object} The backend
 */
bioreportr.curation.backends.memory = function (config) {
    return {
        alwaysSignedIn: true,
        signIn: () => {},
        viewer: () => Promise.resolve({login: config.memoryUser || "local-user", avatarUrl: "", url: ""}),
        submit: (token, note, body) => {
            bioreportr.curation.backends.memory.submitted.push({note, body});
            return Promise.resolve({id: note.claimId, url: ""});
        }
    };
};

// The comments submitted to the memory backend, for inspection in testing
bioreportr.curation.backends.memory.submitted = [];

/** The form of the curation pane **/
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
    // Keyed by subject, so that the controls are rendered afresh, discarding any unsubmitted choices, only for another
    const key = "<!-- " + hortis.dataTable.encode(row ? observation.recordId : taxon?.id || "").replace(/--/g, "- -") + " -->";
    const controls = row ? bioreportr.curationForm.observationControlsMarkup(own) :
        taxon ? bioreportr.curationForm.taxonControlsMarkup(authored(bioreportr.curation.ofType(taxonNotes, "provenance")),
            authored(bioreportr.curation.ofType(taxonNotes, "taxonomy"))) : "";
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
        controls: controls ? controls + key : "",
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
 * Render the controls of the form for a taxon - a panel for each type of note, of which CSS shows only that of the tab
 * chosen, so that choosing a tab keeps what has been entered in the other. Each shows the user's own note, if any.
 * @param {CurationNote|null} ownProvenance - The user's own note on the provenance of the taxon, if any
 * @param {CurationNote|null} ownTaxonomy - The user's own note on its taxonomy, if any
 * @return {String} The markup of the controls
 */
bioreportr.curationForm.taxonControlsMarkup = function (ownProvenance, ownTaxonomy) {
    const encode = hortis.dataTable.encode;
    const heads = bioreportr.curation.votes.map(vote => `<span class="mxcw-curation-vote-head">${vote}</span>`).join("");
    const rows = bioreportr.curation.questions.map(([question, label]) => `<span class="mxcw-curation-vote-label">${label}:</span>` +
        bioreportr.curation.votes.map(vote => `<input type="radio" name="${question}" value="${vote}" aria-label="${label}: ${vote}"${(ownProvenance?.[question] || "no opinion") === vote ? " checked" : ""}>`).join("")).join("");
    return `<div class="mxcw-curation-panel" data-type="provenance">
        <fieldset class="mxcw-curation-vote"><legend>Vote</legend><div class="mxcw-curation-vote-grid"><span></span>${heads}${rows}</div></fieldset>
        <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea name="comment" rows="4" aria-label="Comment">${encode(ownProvenance?.comment || "")}</textarea></fieldset>
    </div>
    <div class="mxcw-curation-panel" data-type="taxonomy">
        <fieldset class="mxcw-curation-comment"><legend>Taxonomy</legend>
            <label class="mxcw-curation-field-label" for="mxcw-curation-synonymy">Enter a correction for the synonymy of this taxon</label>
            <textarea id="mxcw-curation-synonymy" name="synonymy" rows="4">${encode(ownTaxonomy?.comment || "")}</textarea></fieldset>
    </div>`;
};

/**
 * Render the controls of the form for an observation - the comment on it. Its corrected position is set by dragging
 * its marker on the map, and shown by the form's template.
 * @param {CurationNote|null} own - The user's own note on the observation, if any
 * @return {String} The markup of the controls
 */
bioreportr.curationForm.observationControlsMarkup = function (own) {
    return `<div class="mxcw-curation-panel" data-type="observation">
        <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea name="observationComment" rows="4"
            aria-label="Comment on this record">${hortis.dataTable.encode(own?.comment || "")}</textarea></fieldset>
    </div>`;
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
 * Submit the form's note, of the type shown, read from its controls - and for an observation, its corrected position.
 * @param {bioreportr.curation} curation - The story page's curation component
 * @param {bioreportr.curationForm} form - The form
 * @param {Event} event - The click on the form's submit button
 * @param {Window} window - The window
 */
bioreportr.curationForm.submit = function (curation, form, event, window) {
    const model = form.model;
    const data = new window.FormData(event.target.closest("form"));
    const answers = {
        provenance: () => Object.fromEntries([...bioreportr.curation.questions.map(([question]) => [question, data.get(question)]), ["comment", data.get("comment")]]),
        taxonomy: () => ({comment: data.get("synonymy")}),
        observation: () => ({comment: data.get("observationComment"),
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
