/*
Copyright 2026 IMERSS
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

// Community curation of the taxa of a story - see notes/community-curation-design.md. Each note on a taxon is a
// comment on a thread of the project's GitHub Discussions, consolidated by a GitHub Actions job into curations.csv,
// with claimStatus.json listing the claims consolidated. A note submitted from this page is held in local storage
// until its claim appears there, and is shown meanwhile as if it were consolidated

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

fluid.registerNamespace("bioreportr.curation");
fluid.registerNamespace("bioreportr.curation.backends");
fluid.registerNamespace("bioreportr.curationForm");

/**
 * A note on a taxon, as consolidated into curations.csv or held locally until it is.
 * @typedef {Object} CurationNote
 * @property {String} taxonId - The id of the taxon
 * @property {String} taxonName - The taxon's scientific name
 * @property {String} claimId - The 21 character Nano ID allocated to the note's submission
 * @property {String} author - The GitHub login of the note's author
 * @property {String} submitted - The time of submission, as an ISO 8601 string
 * @property {String} present - The vote on whether the taxon is present, one of the `bioreportr.curation.votes`
 * @property {String} planted - The vote on whether it is planted
 * @property {String} waif - The vote on whether it is a waif, or unestablished
 * @property {String} comment - Free text
 * @property {String} url - The URL of the note's comment on GitHub, if known
 * @property {Boolean} [pending] - `true` for a note held locally whose claim is not yet consolidated
 */

// The questions of the vote, with their labels
bioreportr.curation.questions = [["present", "Present"], ["planted", "Planted"], ["waif", "Waif / unestablished"]];

// The answers to each question
bioreportr.curation.votes = ["yes", "no", "no opinion"];

// The line marking the YAML block of a comment as a curation note
bioreportr.curation.marker = "# bioreportr-curation";

// The fields of a note written into its comment, in order
bioreportr.curation.commentFields = ["claimId", "taxonId", "taxonName", "present", "planted", "waif", "comment"];

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
    const lines = bioreportr.curation.commentFields.map(field => field + ": " + JSON.stringify(String(note[field] ?? "")));
    return `Curation note on *${note.taxonName}*, submitted from ${pageUrl}\n\n\`\`\`yaml\n${bioreportr.curation.marker}\n${lines.join("\n")}\n\`\`\`\n`;
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
 * Determine the claims which have been consolidated - those of claimStatus.json, together with any in curations.csv.
 * @param {Object<String, Number>} claimStatus - The contents of claimStatus.json
 * @param {CurationNote[]} rows - The rows of curations.csv
 * @return {Set<String>} The ids of the claims consolidated
 */
bioreportr.curation.consolidatedClaims = function (claimStatus, rows) {
    return new Set([...Object.keys(claimStatus || {}).filter(claimId => claimStatus[claimId]), ...rows.map(row => row.claimId)]);
};

/**
 * Index the notes of every taxon - those consolidated, and those pending locally whose claims are not yet consolidated.
 * A pending note displaces its author's consolidated note on the same taxon, since it will replace it.
 * @param {CurationNote[]} rows - The rows of curations.csv
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Object<String, Number>} claimStatus - The contents of claimStatus.json
 * @return {Object<String, CurationNote[]>} The notes of each taxon, by taxon id, most recent first
 */
bioreportr.curation.byTaxon = function (rows, pending, claimStatus) {
    const consolidated = bioreportr.curation.consolidatedClaims(claimStatus, rows);
    const pendingNotes = Object.values(pending).filter(note => !consolidated.has(note.claimId)).map(note => ({...note, pending: true}));
    const displaced = new Set(pendingNotes.map(note => note.taxonId + "|" + note.author));
    const togo = {};
    [...rows.filter(row => !displaced.has(row.taxonId + "|" + row.author)), ...pendingNotes].forEach(note => {
        (togo[note.taxonId] ||= []).push(note);
    });
    Object.values(togo).forEach(notes => notes.sort((a, b) => String(b.submitted).localeCompare(String(a.submitted))));
    return togo;
};

/**
 * Drop from local storage the pending notes whose claims have been consolidated. Deferred, since an effect may not
 * write signals.
 * @param {bioreportr.curation} that - The curation component, whose `pendingVersion` is advanced if any is dropped
 * @param {Object<String, CurationNote>} pending - The pending notes, by claim id
 * @param {Object<String, Number>} claimStatus - The contents of claimStatus.json
 * @param {CurationNote[]} rows - The rows of curations.csv
 * @param {Window} window - The window
 */
bioreportr.curation.prune = function (that, pending, claimStatus, rows, window) {
    const consolidated = bioreportr.curation.consolidatedClaims(claimStatus, rows);
    const dropped = Object.keys(pending).filter(claimId => consolidated.has(claimId));
    if (dropped.length > 0) {
        const kept = Object.fromEntries(Object.entries(pending).filter(([claimId]) => !consolidated.has(claimId)));
        bioreportr.curation.writePending(window, that.storageKey, kept);
        fluid.invokeLater(() => that.pendingVersion++);
    }
};

/**
 * Summarise the notes of a taxon - the number of each answer to each question.
 * @param {CurationNote[]} notes - The notes
 * @return {Object<String, Object<String, Number>>} For each question, the count of each answer
 */
bioreportr.curation.tally = function (notes) {
    return Object.fromEntries(bioreportr.curation.questions.map(([question]) => [question,
        Object.fromEntries(bioreportr.curation.votes.map(vote => [vote, notes.filter(note => note[question] === vote).length]))]));
};

/**
 * Render the tally of the votes on a taxon, as a row of each question with the counts of its answers.
 * @param {CurationNote[]} notes - The notes
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
 * @param {CurationNote[]} notes - The notes
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
        `<li><b>${encode(note.author)}</b>: ${encode(note.comment.length > 140 ? note.comment.substring(0, 140) + "…" : note.comment)}</li>`).join("");
    const body = notes.length > 0 ? `${bioreportr.curation.briefTallyMarkup(notes)}${comments ? `<ul class="mxcw-tip-list mxcw-curation-comments">${comments}</ul>` : ""}` :
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
 * Submit a note on a taxon, displacing the user's earlier note on it. The note is allocated a claim id and kept in
 * local storage, so that it is shown at once, as if it were consolidated.
 * @param {bioreportr.curation} that - The curation component
 * @param {TaxonRow} taxon - The taxon
 * @param {Object} answers - The answers of the form, with a member for each question and `comment`
 * @param {Window} window - The window
 * @return {Promise} Resolving once the note has been submitted
 */
bioreportr.curation.submit = async function (that, taxon, answers, window) {
    const note = {
        claimId: bioreportr.curation.nanoid(window.crypto),
        taxonId: taxon.id,
        taxonName: hortis.rowToScientific(taxon),
        author: that.viewer.login,
        submitted: new Date().toISOString(),
        ...Object.fromEntries(bioreportr.curation.questions.map(([question]) => [question, answers[question] || "no opinion"])),
        comment: (answers.comment || "").trim(),
        url: ""
    };
    that.status = "Submitting your note ...";
    try {
        const pageUrl = window.location.origin + window.location.pathname + "#pane:" + that.paneKey + "&taxon:" + taxon.id;
        const comment = await that.backend.submit(that.token, note, bioreportr.curation.commentBody(note, pageUrl));
        const pending = bioreportr.curation.readPending(window, that.storageKey);
        // Only one note per taxon is kept, as the one submitted displaces the earlier
        Object.keys(pending).filter(claimId => pending[claimId].taxonId === note.taxonId).forEach(claimId => delete pending[claimId]);
        pending[note.claimId] = {...note, url: comment.url || ""};
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
 * one thread per taxon in a category of the project's repository, as giscus does. Signing in goes through the token
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
    return {
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
                    body: `Community curation notes on *${note.taxonName}*. Each comment is one person's note, submitted from the site.`}});
                thread = created.createDiscussion.discussion;
            } else {
                // Displace the user's earlier notes on the taxon
                const data = await graphql(token, `query($id: ID!) {
                    node(id: $id) { ... on Discussion { comments(first: 100) { nodes { id viewerDidAuthor body } } } }
                }`, {id: thread.id});
                const earlier = data.node.comments.nodes.filter(comment => comment.viewerDidAuthor && comment.body.includes(bioreportr.curation.marker));
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
 * Compute what the curation form shows of a taxon.
 * @param {TaxonRow|null} taxon - The taxon chosen for curation, if any
 * @param {Object<String, CurationNote[]>} byTaxon - The notes of each taxon, by taxon id
 * @param {Object|null} viewer - The user signed in, if any, with their `login`
 * @param {Boolean} connected - Whether notes may be submitted
 * @param {String} status - A message on the progress of a submission
 * @return {Object} The model of the form
 */
bioreportr.curationForm.model = function (taxon, byTaxon, viewer, connected, status) {
    const notes = taxon ? byTaxon[taxon.id] || [] : [];
    const own = viewer ? notes.find(note => note.author === viewer.login) : null;
    return {
        hasTaxon: !!taxon,
        taxonName: taxon ? hortis.rowToScientific(taxon) : "",
        // As the taxon is named elsewhere - its scientific name, then its common name in brackets
        displayName: taxon ? hortis.rowToScientific(taxon) + (taxon.commonName ? ` (${taxon.commonName})` : "") : "",
        commonName: taxon?.commonName || "",
        image: taxon ? hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id) : "",
        pending: !!own?.pending,
        // Keyed by taxon, so that the controls are rendered afresh, discarding any unsubmitted choices, only for another taxon
        controls: taxon ? bioreportr.curationForm.controlsMarkup(own) + "<!-- " + taxon.id + " -->" : "",
        connected,
        signedIn: connected && !!viewer,
        signedOut: connected && !viewer,
        viewerLogin: viewer?.login || "",
        submitLabel: own ? "Replace your note" : "Submit your note",
        status,
        consensus: notes.length > 0 ? bioreportr.curationForm.consensusMarkup(notes) : "<p class=\"mxcw-curation-none\">No one has added a note on this taxon yet.</p>"
    };
};

/**
 * Render the controls of the form - the vote on each question, and the comment - showing the user's own note, if any.
 * @param {CurationNote|null} own - The user's own note on the taxon, if any
 * @return {String} The markup of the controls
 */
bioreportr.curationForm.controlsMarkup = function (own) {
    const encode = hortis.dataTable.encode;
    const heads = bioreportr.curation.votes.map(vote => `<span class="mxcw-curation-vote-head">${vote}</span>`).join("");
    const rows = bioreportr.curation.questions.map(([question, label]) => `<span class="mxcw-curation-vote-label">${label}:</span>` +
        bioreportr.curation.votes.map(vote => `<input type="radio" name="${question}" value="${vote}" aria-label="${label}: ${vote}"${(own?.[question] || "no opinion") === vote ? " checked" : ""}>`).join("")).join("");
    return `<fieldset class="mxcw-curation-vote"><legend>Vote</legend><div class="mxcw-curation-vote-grid"><span></span>${heads}${rows}</div></fieldset>
        <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea name="comment" rows="4" aria-label="Comment">${encode(own?.comment || "")}</textarea></fieldset>`;
};

/**
 * Render the consensus of the community on a taxon - the tally of the votes, and each note.
 * @param {CurationNote[]} notes - The notes, most recent first
 * @return {String} The markup of the consensus
 */
bioreportr.curationForm.consensusMarkup = function (notes) {
    const encode = hortis.dataTable.encode;
    const answers = note => bioreportr.curation.questions.map(([question, label]) => `${label}: ${encode(note[question])}`).join(" · ");
    const items = notes.map(note => `<li class="mxcw-curation-note">
        <div class="mxcw-curation-note-head"><b>${encode(note.author)}</b> ${encode(bioreportr.eventDay(note.submitted))}${note.pending ? " <i>(being processed)</i>" : ""}
            ${note.url ? `<a href="${encode(note.url)}" target="_blank" rel="noopener">on GitHub</a>` : ""}</div>
        <div class="mxcw-curation-note-answers">${answers(note)}</div>
        ${note.comment ? `<div class="mxcw-curation-note-comment">${encode(note.comment)}</div>` : ""}
    </li>`).join("");
    return `${bioreportr.curation.tallyMarkup(notes)}<ul class="mxcw-curation-notes">${items}</ul>`;
};

/**
 * Submit the form's note, read from its controls.
 * @param {bioreportr.curation} curation - The story page's curation component
 * @param {TaxonRow} taxon - The taxon chosen for curation
 * @param {Event} event - The click on the form's submit button
 * @param {Window} window - The window
 */
bioreportr.curationForm.submit = function (curation, taxon, event, window) {
    const form = event.target.closest("form");
    const data = new window.FormData(form);
    const answers = Object.fromEntries([...bioreportr.curation.questions.map(([question]) => [question, data.get(question)]), ["comment", data.get("comment")]]);
    curation.submit(taxon, answers);
};
