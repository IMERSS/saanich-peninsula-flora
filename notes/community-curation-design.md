# Community curation of records

A shared bioReportR feature, carried between this repository and
[howe-sound-mapping-2026](https://github.com/IMERSS/howe-sound-mapping-2026) by `copyFrameworkOut.sh`, through which
members of the community record what they know of a taxon, or of an individual record. It follows the design in
`emma-curation-design.png`.

There are three types of note:

* **provenance** - on a taxon: votes on whether it is present, planted or a waif, and a comment
* **taxonomy** - on a taxon: a correction of its synonymy
* **observation** - on a single record: chiefly a correction of where it was made, by dragging its marker on the map,
  and a comment

## 1. What the user sees

### 1.1 The Community Consensus pane

* A new pane, **Community Consensus**, is the last tab of each story's menu. It is an ordinary R Markdown pane,
  `content/story/Curation.Rmd`, whose front matter names the shared component `bioreportr.curationPane`.
* Beside it, as in the design, the map and the table of records show the records of the taxon being curated.
* With no taxon chosen, the pane shows an invitation, written in its R Markdown, to click on a taxon in the checklist
  beneath, which is shown as on the other panes.
* Once a taxon is chosen, the checklist and its filters fold away, and the pane shows the curation form:
  * the taxon's photo, **Taxon name**, **Link name** (its iNaturalist name) and **Common name**
  * two tabs, choosing the type of note:
    * **Provenance**: **Vote**, for each of *Present*, *Planted* and *Waif / unestablished*, one of *yes*, *no* or
      *no opinion*, and **Comment**, free text
    * **Taxonomy**: a text box, **Enter a correction for the synonymy of this taxon**
  * a button submitting the note of the tab shown, and a link choosing another taxon, which brings the checklist back
  * the consensus so far on the tab's type of note: for provenance, a count of the votes for each question, and for
    both, the notes of the community, each with its author, date and link to its comment on GitHub

  Both tabs' controls are rendered, and only the chosen one's shown, so that moving between them keeps what has been
  entered in each.
* Once a record is chosen (§1.3), the form shows instead:
  * a rubric explaining that the user's main task is to correct where the record was made, by dragging the orange
    marker on the map
  * the taxon's photo and name, and the record's recorder, date, locality, recorded position and id, with a link to it
    on iNaturalist if it is from there
  * **Corrected position**, as the marker has been dragged, with a link returning it to the recorded position
  * **Comment**: free text
  * a button submitting the note, and links back to the taxon, and to choose another taxon
  * the notes of the community on the record, each with its corrected position, if any

  On the map, a duplicate of the record's marker, in orange, stands above its own. Dragging it sets the corrected
  position, which is offered again, as the user's own, when they return to the record.
* If the user has a submission of the type shown which is not yet consolidated (§3), the form is headed by a highlight:
  **"Your comment has been submitted and is being processed"**, and shows that submission.

### 1.2 The speech bubble in every checklist

* Hovering over any taxon in a checklist, on any pane, shows a small outlined speech bubble beside its name. Clicking
  it opens the Community Consensus pane on that taxon.
* A taxon with any notes, whether consolidated or the user's own pending submission, shows a filled bubble
  permanently. Hovering over the filled bubble shows a tooltip condensing its notes - the number of notes, the votes
  for each question and the latest comments - ending with **"Click to add your own curation note"**.

### 1.3 The speech bubble of every record

The table of records beneath the map gives each record a speech bubble in its first column, shown on hovering over the
record's row, and always, filled, once the record has notes. Its title gives the number of notes. Clicking it opens the
Community Consensus pane on that record, from any pane - see §2.

### 1.4 Signing in

As for giscus: a user who has not signed in to GitHub is offered **Sign in with GitHub**, which takes them to
GitHub to sign in, or to create an account, and authorise the site, and back to the pane they left. Once signed in, the
form names them, and offers to sign out.

## 2. State in the URL

The taxon chosen is the state of the story page's existing taxon filter, held in the URL by `fluid.hashManager` as
`taxon:<id>`, together with the pane, e.g. `#pane:Curation&taxon:48070`. The record chosen is the record selected on
the map or in the table of records, held in the URL as `record:<id>`, where the id is that by which
`hortis.libreMap.recordSelector` knows it, its `occurrenceID`, e.g.
`#pane:Curation&taxon:60253&record:RBCM:Botany:V175876`. While a record is selected the curation pane shows the record,
and clearing the selection, or **Back to the taxon**, returns it to the taxon. So:

* clicking a bubble selects the pane and the taxon together - for a record, the pane, the record and its taxon. A
  record selected on one pane is otherwise cleared on moving to another, but one selected together with the move is
  kept - see `bioreportr.storyPage.keepRecord`
* selecting a record on the Community Consensus pane, in its table or on the map, chooses it for curation
* clicking a taxon in the checklist of the Community Consensus pane chooses it
* the map and the table of records are filtered to the taxon by the filter itself, as the design shows
* a link to a taxon's curation can be shared, and the browser's history moves between taxa

## 3. Persistence

### 3.1 Threads and comments, as in giscus

* Each taxon has one thread, a **GitHub Discussion** in a category of the project's own repository - by default
  General, which GitHub creates when Discussions are enabled, and in Saanich a category of its own, Curation - titled
  `taxon:<taxonId> <scientific name>`. It is created by the first submission for the taxon, and holds every type of
  note on the taxon and on its records.
* Each submission is one **comment** on that thread, posted as the signed-in user through the GitHub GraphQL API,
  whose body is a short heading and a flat YAML block derived from the form:

  ```yaml
  # bioreportr-curation
  claimId: V1StGXR8_Z5jdHi6B-myT
  type: provenance
  taxonId: "48070"
  taxonName: Sagittaria latifolia
  present: yes
  planted: no opinion
  waif: no
  comment: Seen at Elk Lake in 2019, in the marsh at the north end
  ```

  Each vote is one of `yes`, `no` and `no opinion`. A note on taxonomy has only `comment`, holding the correction of
  the synonymy:

  ```yaml
  # bioreportr-curation
  claimId: 9fLq0Zs3yWm_T1kAhd2Rx
  type: taxonomy
  taxonId: "48070"
  taxonName: Sagittaria latifolia
  comment: Treated as S. latifolia var. latifolia by the Flora of North America
  ```

  A note on a record names it by `recordId`, and gives its corrected position as `lat` and `long`, both empty if the
  note corrects none:

  ```yaml
  # bioreportr-curation
  claimId: kq2Vd8x_Rn0bTz4LwYp7c
  type: observation
  recordId: RBCM:Botany:V175876
  taxonId: "60253"
  taxonName: Alisma plantago-aquatica
  lat: "48.481035"
  long: "-123.453818"
  comment: The label names Spencer pond, which is here
  ```

  A note without `type`, as written before types were introduced, is on provenance.
* **One note per user per subject**: a subject is a type of note on a taxon, or a record. A fresh submission displaces
  the user's earlier one on the same subject - their earlier curation comments on it in the thread are deleted, and
  the new one added. So a user may have a note on a taxon's provenance, another on its taxonomy, and one on each of its
  records.

### 3.2 Sign-in

A static site can't hold the secret which GitHub's OAuth exchange needs, which is why giscus has the giscus.app service.
In the same way, each project names a small **token exchange** service, `oauthEndpoint` in its configuration (§5), of
which the framework provides an implementation as a Cloudflare Worker, `src/curation/oauthWorker.mjs`:

1. `GET /authorize?redirect_uri=<page>` - checks the page's origin against those allowed, and redirects to GitHub's
   authorisation page, carrying the page in a signed `state`.
2. `GET /callback` - GitHub returns here with a code, which the service exchanges for the user's token. It returns to
   the page with `?curation_session=<session>`, the token encrypted, so that it never appears in a URL.
3. `POST /token` - the page posts the session, and receives the token. The page removes the session from its URL, and
   keeps the token in local storage.

The service works with a GitHub App, as giscus uses, given read and write permission on Discussions and installed on
the repository, or with an OAuth App.

### 3.3 Consolidation

GitHub Pages' Jekyll build runs without network access, so it can't read the comments itself. The consolidation is
instead a **GitHub Actions job**, `.github/workflows/curation.yml`, which runs `src/js/consolidateCuration.js`:

* when the site is published (the `page_build` event), whenever a comment or discussion changes, on a schedule, and on
  demand
* it reads every comment of every thread in the category, keeps the latest curation comment of each author on each
  subject, and writes
  * `static/curation/taxa.csv` - one row per note on a taxon: `taxonId, taxonName, type, claimId, author, submitted,
    present, planted, waif, comment, url`, the votes empty for a note on taxonomy
  * `static/curation/observations.csv` - one row per note on a record: `recordId, taxonId, taxonName, claimId, author,
    submitted, lat, long, comment, url`. A position is kept only if both its coordinates are valid
  * `static/curation/claimStatus.json` - `{"<claimId>": "consolidated", ...}` for every claim consolidated into either
    CSV. The status is a word, so that other states of a claim can be told apart later, but the page only asks whether
    a claim has one
* a `curations.csv` left by the earlier version, which held only notes on provenance, is removed
* it copies both into `docs/curation`, and commits them if they have changed. A job finding nothing changed commits
  nothing, so its own publication does not set it off again.

The story page reads `taxa.csv`, `observations.csv` and `claimStatus.json` as it starts, alongside its other data.

### 3.4 Optimistic concurrency

* Each submission is allocated a **claim id**, a 21-character Nano ID, which is written into its comment and kept in
  the browser's local storage, with the note itself.
* The page renders the union of the consolidated notes and the user's pending ones, a pending note displacing the
  same user's consolidated note for the same taxon. So everything appears just as if the note were already in the
  CSV, except for the highlight of §1.1 in the pane.
* Once a claim id appears in `claimStatus.json`, or in either CSV, the page drops the note from local storage.
* A note's comment may be deleted on GitHub before it is consolidated, e.g. by its author there, or with its thread.
  So the page keeps the comment's node id with each pending note, and once the user is signed in, as the page starts
  or on signing in, asks GitHub in one query whether each comment still exists. A note is dropped from local storage
  only when GitHub reports its comment as not found. One which can't be checked, since GitHub can't be reached or the
  token has expired, is kept, to be checked when the page next starts with the user signed in.

## 4. Code

| Part | Where |
|---|---|
| The curation state - configuration, notes, pending claims, sign-in, submission | `bioreportr.curation` in `static/bioreportr/js/curation.js`, a member `curation` of `bioreportr.storyPage` |
| The pane's section, rendering its R Markdown | `static/bioreportr/sfc/bioreportr-curationPane.vue` |
| The form, its tabs and the draggable marker | `static/bioreportr/sfc/bioreportr-curationForm.vue`, placed by the R Markdown in a slot `<div @id="curationForm"></div>`, and `bioreportr.curationForm` in `curation.js` |
| The bubbles and their tooltips in the checklist | `bioreportr.curation.renderChecklistTree` etc. in `curation.js`, rendering the story page's checklist |
| The bubbles of the table of records | `bioreportr.curation.recordTableColumns` and `recordTableBody` in `curation.js`, configured onto the story page's `obsTable` |
| Storage of comments | `bioreportr.curation.backends.github`, and `bioreportr.curation.backends.memory`, for testing and local work without GitHub |
| Token exchange | `src/curation/oauthWorker.mjs`, deployed by each project, or shared between them |
| Consolidation | `src/js/consolidateCuration.js` and `.github/workflows/curation.yml` |
| Styles | `static/bioreportr/css/imerss-story.css`, and the `<style>` blocks of `bioreportr-curationPane.vue` (the bubbles of records and the draggable marker) and `bioreportr-curationForm.vue` (the tabs, and the form for a record) |

## 5. Configuration

Each project has `static/curation/config.json`, read by both the page and the consolidation job:

```json
{
    "backend": "github",
    "repository": "IMERSS/saanich-peninsula-flora",
    "repositoryId": "R_...",
    "category": "General",
    "categoryId": "DIC_...",
    "oauthEndpoint": "https://bioreportr-curation.<account>.workers.dev"
}
```

`repositoryId` and `categoryId` are the node ids of the repository and category, as giscus's configuration page reports
them, and as `src/curation/enrol.mjs` writes them. Until
they and `oauthEndpoint` are filled in, the page shows the notes it has but offers no submission, saying that
community curation is not yet connected.

## 6. Setting up a project

The GitHub App and the token exchange are set up once, for every site. Each repository is then enrolled: Discussions
enabled, which gives it GitHub's standard category General, the App installed, the site's origin allowed by the token
exchange, and `static/curation/config.json` filled in. All of this, and the script `src/curation/enrol.mjs` which automates what GitHub
allows of it, is described in `curation-token-exchange.md`.
