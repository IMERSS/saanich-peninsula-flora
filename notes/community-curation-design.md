# Community curation of records

A shared bioReportR feature, carried between this repository and
[howe-sound-mapping-2026](https://github.com/IMERSS/howe-sound-mapping-2026) by `copyFrameworkOut.sh`, through which
members of the community record what they know of a taxon. It follows the design in `emma-curation-design.png`.

## 1. What the user sees

### 1.1 The Community Consensus pane

* A new pane, **Community Consensus**, is the last tab of each story's menu. It is an ordinary R Markdown pane,
  `content/story/Curation.Rmd`, whose front matter names the shared component `bioreportr.curationPane`.
* Beside it, as in the design, the map and the table of records show the records of the taxon being curated.
* With no taxon chosen, the pane shows an invitation, written in its R Markdown, to click on a taxon in the checklist
  beneath, which is shown as on the other panes.
* Once a taxon is chosen, the checklist and its filters fold away, and the pane shows the curation form:
  * the taxon's photo, **Taxon name**, **Link name** (its iNaturalist name) and **Common name**
  * **Vote**: for each of *Present*, *Planted* and *Waif / unestablished*, one of *yes*, *no* or *no opinion*
  * **Comment**: free text
  * a button submitting the note, and a link choosing another taxon, which brings the checklist back
  * the consensus so far: a count of the votes for each question, and the notes of the community, each with its
    author, date and link to its comment on GitHub
* If the user has a submission for this taxon which is not yet consolidated (§3), the form is headed by a highlight:
  **"Your comment has been submitted and is being processed"**, and shows that submission.

### 1.2 The speech bubble in every checklist

* Hovering over any taxon in a checklist, on any pane, shows a small outlined speech bubble beside its name. Clicking
  it opens the Community Consensus pane on that taxon.
* A taxon with any notes, whether consolidated or the user's own pending submission, shows a filled bubble
  permanently. Hovering over the filled bubble shows a tooltip condensing its notes - the number of notes, the votes
  for each question and the latest comments - ending with **"Click to add your own curation note"**.

### 1.3 Signing in

As for giscus: a user who has not signed in to GitHub is offered **Sign in with GitHub**, which takes them to
GitHub to sign in, or to create an account, and authorise the site, and back to the pane they left. Once signed in, the
form names them, and offers to sign out.

## 2. State in the URL

The taxon chosen is the state of the story page's existing taxon filter, held in the URL by `fluid.hashManager` as
`taxon:<id>`, together with the pane, e.g. `#pane:Curation&taxon:48070`. So:

* clicking a bubble selects the pane and the taxon together
* clicking a taxon in the checklist of the Community Consensus pane chooses it
* the map and the table of records are filtered to the taxon by the filter itself, as the design shows
* a link to a taxon's curation can be shared, and the browser's history moves between taxa

## 3. Persistence

### 3.1 Threads and comments, as in giscus

* Each taxon has one thread, a **GitHub Discussion** in a category of the project's own repository - by default
  General, which GitHub creates when Discussions are enabled - titled `taxon:<taxonId> <scientific name>`. It is created by the first submission for the taxon.
* Each submission is one **comment** on that thread, posted as the signed-in user through the GitHub GraphQL API,
  whose body is a short heading and a flat YAML block derived from the form:

  ```yaml
  # bioreportr-curation
  claimId: V1StGXR8_Z5jdHi6B-myT
  taxonId: "48070"
  taxonName: Sagittaria latifolia
  present: yes
  planted: no opinion
  waif: no
  comment: Seen at Elk Lake in 2019, in the marsh at the north end
  ```

  Each vote is one of `yes`, `no` and `no opinion`.
* **One note per user per taxon**: a fresh submission displaces the user's earlier one - their earlier curation
  comments on the thread are deleted, and the new one added.

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
* it reads every comment of every thread in the category, keeps the latest curation comment of each author for each
  taxon, and writes
  * `static/curation/curations.csv` - one row per note: `taxonId, taxonName, claimId, author, submitted, present,
    planted, waif, comment, url`
  * `static/curation/claimStatus.json` - `{"<claimId>": 1, ...}` for every claim consolidated into the CSV
* it copies both into `docs/curation`, and commits them if they have changed. A job finding nothing changed commits
  nothing, so its own publication does not set it off again.

The story page reads `curations.csv` and `claimStatus.json` as it starts, alongside its other data.

### 3.4 Optimistic concurrency

* Each submission is allocated a **claim id**, a 21-character Nano ID, which is written into its comment and kept in
  the browser's local storage, with the note itself.
* The page renders the union of the consolidated notes and the user's pending ones, a pending note displacing the
  same user's consolidated note for the same taxon. So everything appears just as if the note were already in the
  CSV, except for the highlight of §1.1 in the pane.
* Once a claim id appears in `claimStatus.json`, the page drops the note from local storage.

## 4. Code

| Part | Where |
|---|---|
| The curation state - configuration, notes, pending claims, sign-in, submission | `bioreportr.curation` in `static/bioreportr/js/curation.js`, a member `curation` of `bioreportr.storyPage` |
| The pane's section, rendering its R Markdown | `static/bioreportr/sfc/bioreportr-curationPane.vue` |
| The form | `static/bioreportr/sfc/bioreportr-curationForm.vue`, placed by the R Markdown in a slot `<div @id="curationForm"></div>` |
| The bubbles and their tooltips in the checklist | `bioreportr.curation.renderChecklistTree` etc. in `curation.js`, rendering the story page's checklist |
| Storage of comments | `bioreportr.curation.backends.github`, and `bioreportr.curation.backends.memory`, for testing and local work without GitHub |
| Token exchange | `src/curation/oauthWorker.mjs`, deployed by each project, or shared between them |
| Consolidation | `src/js/consolidateCuration.js` and `.github/workflows/curation.yml` |
| Styles | `static/bioreportr/css/imerss-story.css` |

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
