# Binding the curation form's controls

The curation form, `bioreportr.curationForm` in `static/bioreportr/sfc/bioreportr-curationForm.vue`, shows a model
computed from the chosen taxon or observation, the notes on it and the signed-in user. Its controls - the votes on a
taxon's provenance, the comment on it, the correction of its synonymy and the comment on an observation - used to be
rendered as a string of markup, and read back with `FormData` on submission. They are now bound in the form's template
to a writable draft, as Infusion intends. This note sets out the two versions, and why the first was needed.

The form's functions, formerly in `static/bioreportr/js/curation.js`, now sit in the form's own Single File Component,
and those of the curation state, `bioreportr.curation`, in `static/bioreportr/sfc/bioreportr-curation.vue` -
`curation.js` is gone. The "before" excerpts below give the paths as they were.

## Why the controls were rendered as markup

A binding of a control's live state in an Infusion 6 template, such as `<textarea value="@{model.comment}">`, is two-way:
the user's input is written back to the bound reference (see `fluid.liveStateChanged` in Infusion's `FluidView.js`).
Infusion refused such a write to a computed member itself, but not to a path *within* one. Binding a control to
`model.comment` would have let the user's first keystroke replace the whole computed `model` with a plain value holding
only `{comment: ...}`. The model would then have stopped following its inputs, and every other binding to it - the
taxon's name, the tabs, the consensus - would have been frozen at what it last computed.

The form avoided the bug by rendering its controls as markup, held in the model, which `hortis.verbatimSlot` placed
without binding them. This was fixed in Infusion (`fluid.writeableAttrSite` now refuses a write anywhere within a
computed member, with the test "User input into a control bound within a computed value does not detach it from its
inputs" in `FluidViewTests.js`), which lets the form bind its controls.

## Before

The form's definition placed the controls' markup from its model:

```javascript
    controls: {
        $component: {
            $layers: "hortis.verbatimSlot",
            markup: "{curationForm}.model.controls"
        }
    },
    // ...
    submit: "$method:bioreportr.curationForm.submit({storyPage}.curation, {self}, {0}:event, {global})",
```

```html
            <!-- The controls are rendered as markup, not bound to the model, since a binding of a control is two-way and the
                 user's choices would be written into the model - see bioreportr.curationForm.taxonControlsMarkup -->
            <div @id="controls"></div>
```

The model, `bioreportr.curationForm.model` in `static/bioreportr/js/curation.js`, rendered the markup, seeded with the
user's own notes. It appended a comment naming the subject, so that the markup changed, and the controls were
rendered afresh, discarding any unsubmitted entries, only when the subject changed:

```javascript
    // Keyed by subject, so that the controls are rendered afresh, discarding any unsubmitted choices, only for another
    const key = "<!-- " + hortis.dataTable.encode(row ? observation.recordId : taxon?.id || "").replace(/--/g, "- -") + " -->";
    const controls = row ? bioreportr.curationForm.observationControlsMarkup(own) :
        taxon ? bioreportr.curationForm.taxonControlsMarkup(authored(bioreportr.curation.ofType(taxonNotes, "provenance")),
            authored(bioreportr.curation.ofType(taxonNotes, "taxonomy"))) : "";
    // ...
        controls: controls ? controls + key : "",
```

`bioreportr.curationForm.taxonControlsMarkup` and `observationControlsMarkup` built the controls as strings, encoding
the user's own entries into them by hand. On submission, the entries were read back from the DOM:

```javascript
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
```

So the user's entries lived only in the DOM, invisible to the rest of the component. Nothing could react to them, e.g.
to enable the submit button only once something had been entered, and the submission had to find its form from the
click's event.

## After

The form holds the user's entries in a member of its own, `draft`, to which its controls are bound:

```javascript
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
    // ...
    submit: "$method:bioreportr.curationForm.submit({storyPage}.curation, {self})",
```

The controls are written out in the template, each bound to the draft:

```html
            <div class="mxcw-curation-panel" data-type="provenance">
                <fieldset class="mxcw-curation-vote"><legend>Vote</legend><div class="mxcw-curation-vote-grid"><span></span>
                    <span class="mxcw-curation-vote-head">yes</span><span class="mxcw-curation-vote-head">no</span><span class="mxcw-curation-vote-head">no opinion</span>
                    <span class="mxcw-curation-vote-label">Present:</span>
                    <input type="radio" name="present" aria-label="Present: yes" checked="@{choices.present.yes}" @onchange="{self}.vote(present, yes)">
                    <input type="radio" name="present" aria-label="Present: no" checked="@{choices.present.no}" @onchange="{self}.vote(present, no)">
                    <input type="radio" name="present" aria-label="Present: no opinion" checked="@{choices.present.none}" @onchange="{self}.vote(present, no opinion)">
                    <!-- ... Planted and Waif / unestablished alike -->
                </div></fieldset>
                <fieldset class="mxcw-curation-comment"><legend>Comment</legend><textarea rows="4" aria-label="Comment" value="@{draft.comment}"></textarea></fieldset>
            </div>
            <div class="mxcw-curation-panel" data-type="taxonomy">
                <!-- ... -->
                    <textarea id="mxcw-curation-synonymy" rows="4" value="@{draft.synonymy}"></textarea></fieldset>
            </div>
            <div class="mxcw-curation-panel" data-type="observation">
                <!-- ... -->
                    aria-label="Comment on this record" value="@{draft.observationComment}"></textarea></fieldset>
            </div>
```

The functions, in the same file:

```javascript
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

bioreportr.curationForm.seedDraft = function (that, seed) {
    that.draft = JSON.parse(seed);
};

bioreportr.curationForm.choices = draft => Object.fromEntries(bioreportr.curation.questions.map(([question]) =>
    [question, {yes: draft[question] === "yes", no: draft[question] === "no", none: draft[question] === "no opinion"}]));

bioreportr.curationForm.vote = function (that, question, vote) {
    that.draft[question] = vote;
};

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
```

`taxonControlsMarkup`, `observationControlsMarkup`, the model's `controls` and the `controls` slot are gone.

## Commentary

**The draft is a reactive root.** A textarea bound to `@{draft.comment}` writes its input at the path `draft.comment`.
Beneath an ordinary member, such a write is held beside the member, at a path of its own, and the member itself is
unchanged - `form.draft.comment` would never see it. Beneath a `$reactiveRoot`, a write is applied to the root's value
as a whole, so `form.draft` holds every entry (see `fluid.setForComponent` in Infusion's `FluidIL.js`).

**The radios are bound one way.** HTML represents a choice among radios by which one of them is checked, not by a value,
so no single reference can be bound to the group. Each radio's `checked` is bound to `choices`, computed from the
draft, and its `@onchange` handler records the vote in the draft. A radio's own write-back to `choices` is refused, since
`choices` is computed - the same rule as the Infusion fix - and the radio is updated from the draft instead.

One oddity was seen, which no user can meet: when a script types into a textarea and clicks a radio within a single
turn of the event loop, the click fires but the radio is left unchecked, with no `change` event, so the vote is lost.
Some work pending from the typing is apparently applied during the click, re-applying the radio's `checked` from
`choices` before the browser completes its activation. With any turn of the event loop between the two - even a
`setTimeout` of 0, and always between a user's keystroke and click - the vote is recorded. It may be worth a look in
Infusion.

The radios of the three questions are written out in the template rather than generated from
`bioreportr.curation.questions`, which still drives the submission and the consensus. A question added there must be
added to the template too.

**The draft is seeded when its subject changes.** This replaces the subject key appended to the markup. `draftSeed`
encodes the subject and the user's own notes on it as a string. An equal string doesn't propagate, so the draft is
seeded afresh only for another subject, or when the user's own notes change - e.g. on signing in, or once a note they
have submitted is consolidated - and not when others' notes arrive, which would otherwise wipe what the user is typing.

**The seeding effect writes the draft directly.** At first it couldn't: a write made by an effect consulted, tracked,
the member it wrote, the component's layers and the history recording it, so the effect came to depend on the draft
it wrote, and ran again after each of the user's entries, undoing it. The workaround was to pair the effect with a
`$method`, which runs untracked (see `fluid.expandMethodRecord` in Infusion's `FluidIL.js`), and have the effect call
the method to do the write:

```javascript
    seedDraft: "$method:bioreportr.curationForm.seedDraft({self}, {0})",
    seedDraftEffect: "$effect:{self}.seedDraft({self}.draftSeed)",
```

That pairing was easy to get wrong and hard to diagnose, and its need was not a property of the form but a bug in
Infusion, whose `fluid.pathToLive` already said that a write "does not make the writer depend on what it overwrites".
Infusion now holds to that throughout: `fluid.setForComponent` and `fluid.deleteForComponent`, and the component
proxy's `set` and `deleteProperty` traps which call them, run untracked - a write is not a read (test: "An effect
writing a value does not come to depend on it" in `FluidILTests.js`). As in other signal libraries, such as Solid or
Preact Signals, only what an effect reads makes it depend, and an effect may write freely. A read before a write, e.g.
`that.count = that.count + 1`, still tracks the read, as it should.

**What is gained.** The user's entries are now state of the component, rather than of the DOM: they are seen by
`submit` without finding its form from the click's event, they can be observed and reacted to, e.g. by a submit button
enabled only once something has been entered, and they are rendered by the template from that state rather than
encoded into strings by hand. Since each type of note has its own panel and its own members of the draft, switching
tabs keeps what has been entered in each, as before.

## Testing

Tested in headless Chrome on both Saanich and Howe Sound, with the Infusion fix vendored from a local checkout:

* Choosing a taxon seeds the draft with "no opinion" on each question and empty comments
* Typing a comment, voting, switching to the Taxonomy tab and typing a correction, then switching back: all entries are
  held in the draft and shown by the controls
* Submission (with `curation.submit` stubbed) sends the provenance votes and comment, or the taxonomy correction, from
  the draft
* Choosing another taxon seeds the draft afresh, discarding the entries
* On an observation (Saanich, `#pane:Curation&record:QFA0212927`), typing a comment and moving the corrected position
  leaves the comment in place, and submission sends both

It depends on both Infusion fixes - refusing writes within computed values, released in 6.2.2, and untracked writes,
not yet released - so it must not be released before the projects pin an Infusion release holding both.
