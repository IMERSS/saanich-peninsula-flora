# Lists and search events

A design, for review, of two shared bioReportR features, to be carried between this repository,
[howe-sound-mapping-2026](https://github.com/IMERSS/howe-sound-mapping-2026) and the coming Galiano story (a draft of
which is in `galiano-island-flora`) by `copyFrameworkOut.sh`:

* **Lists** - anyone selects an area, a named one such as a park or a Key Biodiversity Area, or one they draw, narrows
  its taxa, and gets a checklist to print, download or share by its URL. No sign-in, no server.
* **Search events**, built on lists - a person declares a search for some of a list's taxa in its area, on a date,
  promotes it, and afterwards logs when it ran and how many searched. The nightly GitHub Action then gathers the
  searchers' iNaturalist observations from the area and window, and records each target as **detected** or **searched
  for and not detected**, with its effort, in the form the protocol of
  [detecting-local-extinction](https://imerss.github.io/detecting-local-extinction) reads, so that the community's
  searches feed its models of detection and extirpation.

Many of the community, the project lead among them, learnt these floras by working from lists: following Harvey
Janszen and others to the places where plants had been reported, and looking for them again. A flora is made that way.
Each generation of naturalists takes the list the last one left, goes out with it, and corrects it, and the corrected
list goes to the next. These features make that practice a tool, and make its results count.

So the way in is not a new pane but the **Atlas**, the pane most visitors reach. §1 proposes how it should introduce
the flora: as the work of the naturalists before us, still unfinished, which the reader is invited to continue - by
taking a list into the field, recording what they find, and adding to the curatorial review the data still needs.
Lists (§3) and search events (§4, §5) then grow out of the Atlas. §2 argues the central choice for events: how people
register and log searches.

Nothing here is built. The code cited is as it stands at commit `aa3e0b1`.

## 1. The Atlas: the way in

### 1.1 What the Atlas does now, and what it leaves out

The Atlas is `content/story/Status.Rmd` in each project, with nearly the same words in both. It gives the number of
species and records, and its three tiles, Confirmed, Historical and Newly reported, placed by
`bioreportr.atlas.tilesMarkup` into the empty `mxcw-status-tiles` element of its section. It explains the filters and
the shape tool, and shows a map of reporting status. For Saanich the tiles show 796 confirmed, 138 historical and 168
new species, of the 1,105 in the summary. Choosing a plant opens the panel of `bioreportr.atlas.panelMarkup`: first
and last seen, records, status, and a chart of its records by decade. Behind a **Notes** tab is something no other
atlas has, the plant's line of accounts, oldest first. The sources are named by `curationHistorySources` in
`static/local/story/saanich-story.vue` and rendered by `bioreportr.curationForm.historyMarkup`:

* Szczawinski and Harrison's original account (*Flora of the Saanich Peninsula*, 1972), for 767 taxa
* Harvey Janszen's revised account, for 962
* remarks from the *Flora of the Pacific Northwest*, for 13
* the reviewers' critical notes, for 518, signed by their reviewers, e.g. Terry Ludwar and Emma Menchions
* then the notes added through this site

The counts are of the non-empty columns of `Saanich_Tracheophyta_curation-history_2026-08-20.csv`.

What the Atlas leaves out:

1. **That the flora has authors.** Its text speaks of "records from historical collections, iNaturalist observations
   and other sources". The line of naturalists behind those records is hidden in one tab of one plant at a time.
2. **That the flora is unfinished.** The data show where it is uncertain. Of the 1,105 species in Saanich's summary:
   * 189 have no voucher
   * 48 are known from a single record
   * 45 have no record that can be placed on the map
   * 138 have not been seen since 2000

   None of this is said. The invitation to help, the `mxcw-curation-invitation` of `content/story/Curation.Rmd`, is on
   the last tab, *Living Data*, which few readers reach.
3. **What a reader can do.** There is no list to take out, and no path from the Atlas into the field or into curation
   beyond the checklist's speech bubbles.

### 1.2 The Atlas as a lesson in how a flora is made

The Atlas should teach by showing, in this order, each part a slot of its section, with its words in the project's
R Markdown:

1. **The lists before us.** A strip across the head of the section gives each source of the flora, oldest first, with
   what it gave. For Saanich: the collectors since the flora's first records;
   Szczawinski and Harrison, 1972; Harvey Janszen's revision, and his checklists and journals, 1973-2017, linking to
   *Harvey's footsteps*; the *Flora of the Pacific Northwest*; the reviewers, by name; the iNaturalist community, with
   its number of observers since `recentYear`; and this site's curators, with their number of notes. Each is a link
   which opens the list (§3) of the taxa that source treats, set against what is known now. "Follow Szczawinski and
   Harrison: the 767 plants they described, and which we still find." That is the naturalist's practice made a
   button.
2. **Where it stands.** The three tiles, as now.
3. **What is still uncertain.** A row of **open questions**, each a count and a selection, worded as what would
   settle it:
   * "189 species have no specimen. A specimen, or a photographed observation, would confirm them."
   * "48 are known from a single record."
   * "45 have no record we can place on the map. Do you know where they grew?"
   * "Community notes disagree on whether some are established." This one would be counted from curation's votes.

   Clicking a question selects its taxa in the checklist and on the map, as the tiles select a status. Each taxon's
   panel then leads with that question and its action (§1.3).
4. **How to take part.** Three verbs, each a link:
   * *Look*: make a list of a place, and take it out (§3)
   * *Record*: post to iNaturalist, through the story's project
   * *Review*: add a note, on the Curation pane

   *Search*, declaring a search for the plants of a list, joins them when events arrive (§4).

The criteria for the open questions are settings, each a function over the taxa and their records with its wording,
since what counts as uncertain differs between floras. Their defaults are those above. A reviewer can also mark a taxon
`needsReview` in the R pipeline, with a reason, for doubts no rule can find: a critical note which questions an
identification, say. That flag would be a column of the curation history, which the pipeline already prepares in
`scripts/prepare_curation_history.R`.

### 1.3 The taxon panel invites review

The panel of each plant becomes the place where curation is invited, without becoming a second curation form:

* **Its line of accounts leads**, rather than hiding behind a tab: each source's account, opened to its first line,
  then the community's notes. The panel tells the plant's story first and its statistics second.
* **Its open questions follow**, each with its action:
  * "No specimen is known" offers **Add a note**, which opens the Curation pane on the plant through
    `bioreportr.curation.open`.
  * "Last recorded in 1967, near the pumphouse" offers **List this place** and, later, **Plan a search**.
  * "3 records cannot be placed" offers **Correct a position**, which opens the record for curation through
    `bioreportr.curation.openRecord`.
* **One invitation ends it**: "Know this plant? Add your note - it joins the history above."

The chart of records by decade might also mark the years of the sources, 1972 and Harvey's, so that the reader sees
what each generation found.

### 1.4 Lists as the thread

The learner's cycle is: take the list of a place, look, record, review. The list improves, and the next person takes
it. So a list carries its lineage and its doubts:

* **Each taxon of a list names the earlier lists which treated it**, e.g. *FSP 1972* and *HJ*, and is marked **?**
  when it has an open question. Fieldwork with a list is then also review: a tick beside a doubtful plant is evidence.
* **A list's credit line names the sources and people it draws on**, so that it reads as the collective work it is.
* **Past lists become lists of their own.** The areas of Harvey's regional checklists are already mapped, in
  *Harvey's footsteps* (`scripts/Janszen_checklists_mapbox.R`, from `janszen-legacy-storymap`). Clicking one there
  would open the Atlas's list of that area. His field journals are being digitised by `janszen-legacy-project`:
  * HJ5, the Flora of Saturna, 1973-1981
  * HJ7, c. 1981-1996
  * HJ8, c. 1996-2000
  * HJ9, c. 1999-2003
  * HJ27, c. 2003-2017

  As they are, the places he visited can carry his own lists: "Follow Harvey: what he recorded at a place, and what has
  been seen there since" (§8).

### 1.5 What follows for the rest of the design

* **The list is a mode of the Atlas, not a pane of its own** (§3.7). The Atlas's data pane shows the map with the
  records beneath it, as now, or the list, and its URL says which, e.g. `#pane:Status&view:list&region:...`.
* **The Atlas becomes a pane with a component of its own**, `bioreportr.atlasPane`, so that its R Markdown can bind
  the counts in its words, e.g. `` `<span>@{openQuestions.noVoucher}</span>`{=html} ``, and place the strip, tiles,
  questions and verbs as slots. Today's `sectionInserts` could place them too, but could not put counts into the
  story's own sentences.
* **The Curation pane stays where notes are written**, and the Atlas leads into it from every plant. Its place at the
  end of the menu is for the project lead to weigh (§10).
* **Howe Sound has no curation history yet.** Its `bioreportr.yaml` names no `curationHistory`, so its strip would
  show its own sources: the 2020 UNESCO nomination's species list, which `howe.story.isSighting` already treats as no
  sighting, and the 2026 synthesis. That is a setting, and a question of what its lead wants to say (§10).
* **Lists come first in the phasing** (§9), as part of the Atlas, with events after.

## 2. Engaging users

### 2.1 Who uses this, and what they want

| Who | What brings them | What they need from us | What we need from them |
|---|---|---|---|
| **A curious visitor** - a resident, a walker in a park | "What grows here?" | A list of a place they know, readable on a phone and printable | Nothing |
| **A learner**, coming to know the flora | "Where do I start?" | The Atlas's account of the flora and its sources (§1); a short list of a place they can reach, with common names | Nothing at first; later, observations and notes |
| **A reviewer** - those who know the flora, as its present reviewers do | "What here is wrong, or uncertain?" | The open questions (§1.2), the line of accounts, and the curation form | Notes on provenance, taxonomy and position |
| **A naturalist**, working as Harvey did | "What was here, and has not been seen for years?" | A list of the plants reported here and not seen here recently, with when and by whom they were last seen, to take into the field | Their iNaturalist observations, which they make anyway - and, for a search to count, its targets declared beforehand and its times afterwards |
| **An organiser** - a stewardship group's coordinator, a Native Plant Society or Nature Victoria field trip leader, the project lead | "Let's look for these, together, on a Saturday" | A way to announce a search, a field sheet, and afterwards a result to report back | The event's area, targets and date beforehand; its times and searchers afterwards |
| **A teacher** | A schoolyard or nearby park as a classroom | A short, printable list, with common names | Optional: one search logged under the teacher's iNaturalist account |
| **Park and agency staff** - CRD Regional Parks, BC Parks, Parks Canada, the BC Conservation Data Centre | Species of concern in the areas they manage, and evidence of absence | Lists filtered by conservation rank; a route for their own systematic surveys, which carry GPS tracks | Their surveys, in bulk, in the protocol's form |

Two facts about these people shape the design:

1. **Everyone who searches already uses iNaturalist, and almost no one uses GitHub.** The protocol needs each searcher's
   iNaturalist handle, since effort is reconstructed from their observations (§5.3) - so iNaturalist is not a cost we
   impose, it is the instrument. GitHub is.
2. **Searchers are many, organisers are few, and most searches are solo.** Of the 492 rows of
   `detecting-local-extinction/Analysis_inputs/Search_Effort/Search_Effort_Summary.csv`, 305 are by one observer, 152
   by two, and only 35 by three or more. The easiest path must be the solo naturalist's; an organised event is the same
   record with more searchers and a public page.

So the burden of signing in, whatever it is, should fall on the one person who declares a search, never on those who
join it. A participant should need to do nothing but go, and post their observations to iNaturalist as they always do.

### 2.2 The paths, from curiosity to a search that counts

**The visitor**: on the Atlas, they read where the flora comes from and where it stands (§1.2). They click a park, or
draw round a place on the map - both of which the map already does (§3.3) - and press **List these plants**. The
Atlas turns to its list of that area, with its URL to share; **Print** and **Download CSV** are beside it. Two
clicks; no account.

**The learner**: one of the Atlas's lists before us, e.g. "Follow Szczawinski and Harrison", narrowed to a place they
can reach and to its commonest plants, printed. Each plant's panel tells its story. Whatever they record joins the
record; whatever they notice, they can note.

**The reviewer**: an open question of the Atlas, e.g. "45 have no record we can place on the map", taken plant by
plant, each panel leading to the Curation pane on that plant or record.

**The naturalist**: the visitor's path, then the list's filter **Here: historical** (reported in this area, not seen in it
since the story's `recentYear`), which shows each plant's last record here, its recorder and locality. They print it,
go out, and post observations as usual. That much needs nothing new from them, and its observations reach the story
at its next data refresh, as all iNaturalist records do. For the search to count as *effort* - to say, with evidence,
"looked for and not found" - they need two more steps:

1. **Before** going, **Plan a search for these** on the list: tick the targets, give the date, sign in once, and
   submit. The declaration is timestamped by GitHub (§2.4).
2. **After**, open the search from its link (or from **My searches**) and press **Log this search**. The page has
   already asked iNaturalist, from the browser, for observations made in the area on that day, so it offers: "We found
   23 observations here between 09:42 and 12:55 by *chlorophilia* - is that your search?" They confirm the start and
   end, the number of searchers, and submit. Nothing to type but corrections.

**The organiser**: the naturalist's path, plus a description, a meeting place, a public page to share, a printable
field sheet (§4.5), and at logging, the list of searchers, which the page offers from the iNaturalist handles that
observed in the area and window. Participants need no account of ours: they come, observe, and the organiser names
them when logging. Searchers without iNaturalist accounts count towards the number of searchers, as the protocol's
`Observer.number` does, and their effort is carried by the others' traces (§5.3).

**The teacher**: a list, printed. If they log a search, a class under one account counts as many searchers with one
trace - see §10, question 5.

**Agency staff**: lists as anyone; their surveys enter in bulk, as rows in the protocol's own format, imported by a
maintainer through the R pipeline (§8.2), not through the form.

### 2.3 Ways of registering and logging, compared

| | Burden on the organiser | Burden on participants | iNaturalist handle verified | Targets provably declared before the search | New infrastructure | Moderation |
|---|---|---|---|---|---|---|
| **A. GitHub sign-in, events as Discussions** - curation's machinery | A GitHub account, once; then our own form | None | No - claimed, then tested against the observations harvested | Yes: a Discussion's `createdAt`, and its edit history through GraphQL's `userContentEdits`, are GitHub's, not the author's | None: the token exchange, `bioreportr.curation.backends.github` and the consolidation job exist | GitHub's own: hide, delete, lock, label, block; maintainers notified |
| **B. iNaturalist OAuth, events still stored as Discussions** | None beyond the iNaturalist account they have | None | Yes | Yes, as A | The Worker must hold the GitHub App's private key and post as the App on anyone's behalf - a write proxy, needing rate limits and state it now avoids; an iNaturalist OAuth application to register and maintain | As A, but anyone with an iNaturalist account can write, so new organisers must be held for approval |
| **C. An iNaturalist project per event** | Create a project, and usually a place, on iNaturalist - minutes to tens of minutes, and iNaturalist restricts who may create them | Join the project, for a traditional project; nothing for a collection project | Yes | No: a project's description is free text, editable without history, and holds no structured targets or times | None on our side; harvesting by `project_id` is simple | iNaturalist's; clutters iNaturalist with one-off projects |
| **D. A GitHub issue or Discussion form, prefilled by a link from the list** | A GitHub account, and GitHub's own form | None | No | Yes, as A | None | As A |
| **E. A mixture: A, with B added later, the standing iNaturalist project of each story for promotion, and D as a fallback** | As A, then as B | None | Not at first; yes once B is added | Yes | None at first | As A |

What each costs in reliability:

* **The one real threat to the data is a false non-detection**, which would push a plant's extirpation probability up.
  A false detection needs a false iNaturalist observation, which is iNaturalist's to catch. A non-detection carries
  effort only where its searchers' observations, or a track, show them to have been (§5.3), so a fabricated event
  with no observations behind it adds no effort at all. What a claimant *can* inflate is the scaling: the protocol
  multiplies a trace by the ratio of the logged duration to the span of the observations, and by the ratio of the
  logged searchers to those who posted. So the harvest bounds both (§5.4), and holds larger claims for a maintainer.
  Given that, verifying the iNaturalist handle (B, C) buys less than it seems: the observations themselves are the
  evidence.
* **Pre-declaration needs a clock the author does not control.** A and B have one; C does not.
* **A participant named wrongly** contributes only their own public observations in that area and window - little
  harm, and visible on the event's page, where they can ask for removal.

### 2.4 Recommendation

**E: events stored as GitHub Discussions and signed in with GitHub, through curation's own machinery (A), for the one
person who declares a search; nothing for participants but iNaturalist; one standing iNaturalist project per story,
not one per event, to promote searches and gather their observations in iNaturalist's own interface; and a
prefilled GitHub Discussion (D) as the fallback when the form can't be used. The record names its organiser's GitHub
login and iNaturalist handle separately, so that "Sign in with iNaturalist" (B) can be added later without changing
any record, if the pilots show GitHub to be the barrier it may be.**

The argument:

1. **The only store a static site can write to is GitHub.** Every route that records an event on our side ends in
   GitHub; the question is only whose credentials reach it. A gives the organiser's own, which GitHub authenticates,
   rate-limits and attributes - and which curation already obtains, through `src/curation/oauthWorker.mjs` and
   `bioreportr.curation.signIn`. B makes the Worker, which now holds no state and can do nothing but exchange a code,
   a proxy which writes to the repository for anyone with an iNaturalist account. That is a step change in what the
   Worker can be made to do, and is better taken once there is evidence that it is needed.
2. **The burden falls on few.** Only the declarer signs in. Of those, many will sign in once for both curation and
   events; a second sign-in route for one feature would confuse the site.
3. **GitHub gives what the protocol needs, for nothing.** The Discussion's creation time and edit history fix what was
   declared, and when, beyond the author's reach - which settles the protocol's main demand (§5.1, requirement 1).
   GitHub notifies the organiser of comments, gives participants with accounts a place to say they are coming, and
   gives maintainers labels to approve with and tools to moderate.
4. **iNaturalist does what it does best.** The standing project of each story - for Saanich, project 303782,
   ["Lost" plants of the Saanich Peninsula](https://www.inaturalist.org/projects/lost-plants-of-the-saanich-peninsula),
   already named by `inatSpeciesQuery` in `static/local/story/saanich-story.vue` - collects searchers' observations,
   and its journal announces searches to those who follow it, where naturalists already are. The event page offers the
   announcement's text to copy. A project per event (C) would ask the organiser to build on iNaturalist what our form
   builds in a minute, and could not hold the declaration the protocol needs.
5. **The fallback, D**, costs nothing: the page builds a link to a new Discussion in the events category with the
   declaration's YAML prefilled, for a user whose browser blocks the sign-in, or a maintainer entering a search
   reported by email. The consolidation job reads it like any other.

Its trade-offs, accepted:

* **A GitHub account is a real barrier** for many naturalists, schools and agency staff. It is mitigated, not removed:
  lists need no account; participants need none; a maintainer can enter a declaration on someone's behalf from an
  email or an iNaturalist message, with the declarer named in the record; and B remains open.
* **iNaturalist handles are claimed, not proved.** The harvest tests each handle against observations in the area
  and window, and shows on the event's page whose observations were used.
* **Offline use is paper and the iNaturalist app.** The site is not an offline application. The printed list and
  field sheet (§3.6, §4.5) go into the field; the iNaturalist app records observations, with their times and
  positions, without a connection and uploads them later; the declaration is made before, and the log after, from
  any connection. Declaring at the trailhead needs a signal; one made after the start is still kept, but flagged
  (§5.2).

### 2.5 Moderation and abuse

* **Approval.** A declaration by an organiser not yet trusted is shown as *proposed* until a maintainer adds the label
  `approved` to its Discussion. Organisers named in the project's `trustedOrganisers` (§7.2), and anyone with an
  earlier approved event, are approved on posting. A proposed event is harvested like any other, but its effort is
  not exported to the protocol's files until approved.
* **Bounds.** The harvest holds for review any log whose claimed duration exceeds the span of its observations by more
  than `maxDurationRatio` (default 3), or whose number of searchers exceeds those observed by more than
  `maxSearcherRatio` (default 4), or whose implied pace exceeds the protocol's own warning, 2.5 km/h
  (`warnSpeedThreshold` in `scripts/synthesizeSearchEffort.R`).
* **Removal.** Hiding or deleting a Discussion removes its event at the next consolidation, as for curation.
* **Personal data.** A record holds GitHub logins and iNaturalist handles, both public already, and no names, emails
  or contact details: the organiser gives a meeting place, not a phone number. GPS tracks are clipped to the event's
  area before they are stored (§6.4).

## 3. The list

### 3.1 The list is a view of the story page's existing state

A list is not a new kind of object. It is the checklist of the records which survive the story page's filters, shown
as a table rather than a tree, with the summaries of each taxon *within that selection*. Everything which selects it
is already state of `bioreportr.storyPage`, already held in the URL by `fluid.hashManager`
(`static/vendor/imerss-bioinfo/src/client/js/i6/hashManager.js`):

| Selection | Member | URL key | Defined in |
|---|---|---|---|
| A named area | `selectedRegion`, filtering by `regionFilter` | `region` | `bioreportr-storyPage.vue`, `bioreportr.regionSelectionFilter` in `static/bioreportr/js/story.js` |
| A drawn shape | `map.polygonDraw.filterState` | `polygon`, as WKT | `hortis.libreMap.polygonFilter` in `static/vendor/imerss-bioinfo/src/client/js/i6/polygonDraw.js` |
| A taxon or group | `checklist.search.filterState` | `taxon` | `hortis.taxonSearchFilter` |
| A recorder, locality, period | `collectorFilter`, `localityFilter`, `timePeriodFilter` | by member name | `hortis-collectorFilter.vue`, `saanich-timePeriodFilter.vue` |
| A map cell | `map.gridSelector.filterState` | `cell` | `libreMap.js` |

`{storyPage}.filteredObs` is the result of all of them, and `{storyPage}.taxaFromObs` the taxa it holds. A list adds
only taxon filters of its own (§3.4), its columns and grouping, and its title. This keeps the selection
single-sourced: the Atlas's list, the map, its legend and the record table all follow the one `selectedRegion` or the
one polygon, and a list's URL is simply the Atlas's URL with `view:list`.

### 3.2 Data model

```js
// One row of a list - a taxon, with what is known of it within the selection
{
    taxon,                  // the summary's taxon row: id (the iNaturalist taxon id), scientificName, commonName, rank...
    group,                  // its heading in a grouped list, e.g. "Cyperaceae", or "VASCULAR PLANTS / Cyperaceae"
    here: {
        records,            // records within the selection
        firstYear, lastYear,
        lastRecord,         // the latest record: its eventDate, recordedBy, locality, occurrenceID
        status              // "confirmed" if lastYear >= recentYear, else "historical"; "new" as the summary has it
    },
    regional: {status, ep}, // the taxon's reportingStatus and solow_EP over the whole story, as the summary has them
    ranks: {provincial, bcList, cosewic, sara},  // where the summary carries them - see §3.5
    curation: {notes, present, planted, waif},   // from bioreportr.curation.byTaxon
    sensitive               // §6
}
```

It is computed by `bioreportr.list.rows({storyPage}.filteredObs, {storyPage}.taxa.rowById, ...)`, one pass over the
filtered records - as `bioreportr.atlas.taxonRecords` and `bioreportr.lostPlants.select` already pass over theirs.

The status *here* is the heart of the naturalist's list. A plant confirmed on the peninsula may still be historical in
a given park. *Juncus bolanderi* is confirmed on the peninsula, but in Elk/Beaver Lake Regional Park its last record
is A.S. Harrison's of 1967, "W shore of Elk Lake, near pumphouse" - one of 29 native plants recorded in that park and
not since 2000. That is what sends someone to look.

### 3.3 How an area selects records

* **A named area** selects through the region index, `regionIndirection`, written by `scripts/intersectShapes.R`,
  which labels every record with the regions of each `regionFilterFieldNames` field it falls in - for Saanich,
  `BEC`, `ProtectedArea` (86 areas) and `KBA` (28), e.g. `ProtectedArea,9,Elk/Beaver Lake Regional Park`. This is
  exact, since the intersection is made in R against the accurate shapes, and costs nothing in the browser.
* **A drawn shape** selects by point in polygon, through `hortis.libreMap.polygonFilter.doFilter` and
  `hortis.intersectsAnyFeature` (`static/vendor/imerss-bioinfo/src/geom/geoJSON.js`). The draw control is already on
  the story's map, since `bioreportr.storyMap` bears `hortis.libreMap.withPolygonDraw`, and its state is already in
  the URL as `polygon:POLYGON((...))`, rounded to 5 decimal places, about a metre. Nothing upstream is needed for
  Phase 1.
* **Records without coordinates** fall in no area. The list says how many of the taxon's records anywhere have none,
  as the Atlas's `n_unmapped` does, and the locality filter can find those whose locality names the place.
* **Imprecise records.** A historical record with a coordinate uncertainty of kilometres may lie in an area or not.
  An option, **Include records which may lie here**, admits a record whose circle of uncertainty meets the area, and
  marks the rows admitted only so as *possibly here*. This needs the distance from a point to a polygon, which belongs
  upstream beside `hortis.intersectsFeature` (§7.3).
* **Curation's corrections of position.** A note on a record may correct where it was made
  (`static/curation/observations.csv`, `lat`, `long`), but the story does not yet apply corrections to the records it
  filters. The list would be the first to need it: a framework computation `{storyPage}.correctedObs`, applying
  consolidated corrections, would become the input of `hortis.obsFilters`, so that every pane, and every list, sees
  records where the community has placed them. This is worth doing for its own sake, and is part of Phase 1 only if it
  is cheap enough; otherwise the list says "positions as recorded".

The area of a named region, needed to draw it on the list's map and print, and by the harvest (§5.2), is not in a
form the page can use: its shape is in `static/story/mapData.json` only as part of a pane's map. So the R pipeline
writes a file of the named areas, `areas.geojson`, one feature per region, keyed by `regionField` and `label` as in
the region index, from the same shapes `intersectShapes.R` uses, simplified within 2 m. It is named in
`bioreportr.yaml`, and fetched only by the List and Events panes, so that it adds nothing to the story page's start.

### 3.4 Filters

The list's own filters narrow its taxa, after the area has selected its records. Each is a `hortis.valueFilter`, held
in the URL, so that a list is wholly described by its link:

| Filter | Values | Field | Notes |
|---|---|---|---|
| **Here** | confirmed here, historical here, new | computed, §3.2 | Defaults to all; *historical here* is the searcher's list |
| **Introduction** | native, exotic, unknown | `introduction_status` | As `taxaFilterRecords` in each story already defines it |
| **Conservation** | of concern, secure; or by rank, S1-S3, Red, Blue, SARA-listed | `provincial_concern`; the ranks of §3.5 where present | |
| **Lost** | in the Lost Plants gallery | as `bioreportr.lostPlants.select`, by `minEP` and `maxRecords` | |
| **EP** | a range | `solow_EP` | Regional EP; an EP for the area alone is a later refinement |
| **Group** | the taxonomic groups of the project | the taxon's ancestors, or `report_group` | Howe Sound's groups, §3.5 |
| **Community** | present, planted, waif | curation's votes | A plant the community holds planted is not a search target |
| **Listing** | unlisted taxa (`!`), incorrect localities (`!!`) | `FLAG`, where the summary carries it | Default excludes both, as Howe Sound's `_unlistedRemoved` does |

The keys are short and fixed, e.g. `here:historical&intro:native`, set by each filter's `urlKey`, so that they never
collide with the keys of the extirpation risk pane's taxon filters, which take theirs from their member names.

Each story's `taxaFilterRecords` in `<project>-story.vue` already describes its value filters, with their labels;
the list reuses them, and adds the computed ones above.

### 3.5 Columns and layout

The model is the appendix tables of Howe Sound's 2026 synthesis, in
`adfsimon-bioinfo/Howe_Sound/2026_synthesis/lists/tables/` (not empty: `csv/` and `html/` hold one appendix table
per report group, rendered by `gt` in `scripts/assign_consevation_rankings.R`). Their columns are *Scientific name,
Authority, Common name, Provincial status* (S-rank with its review year, e.g. "S5 (2019)"), *BC list, National
status, SARA status*, with rows grouped under friendly headings such as "frogs and toads (Anura)" from
`classification_display_lookup.csv`, by the rank each report group is grouped at (`appendix_grouping_rules`: family
for plants, lichens and fungi; order for mammals and herptiles; class for terrestrial invertebrates; phylum for algae
and marine animals).

The list offers three column sets, as a project's settings (§7.2):

* **Field** - for the printed sheet: a tick box, scientific name, common name, status here, last seen here (year and
  recorder), and a blank column for notes. Grouped by family. This is Harvey's list.
* **Conservation** - Howe Sound's appendix columns, with status here and EP.
* **Full** - everything of §3.2, for the CSV.

Grouping is by `listGroupRanks`: one rank for a single-group project (family, for the vascular floras), or report
group then its rank for a multi-group one. Within a group, rows sort by scientific name, as the appendices do.

Two corrections to the brief, found in checking:

* **The Howe Sound story is not yet multi-kingdom.** Its catalogue and summary, named in its `bioreportr.yaml`, are
  `AHSBR_Tracheophyta_...`, and its checklist is rooted at Plantae. The synthesis covers every group, but as taxon lists
  without records, and an area can select only taxa with records. So grouping by report group is designed for, and
  becomes live only when a project's catalogue holds several groups - which also needs `rootId` of the checklist made a
  setting (it is Plantae, 47126, in `bioreportr-storyPage.vue`).
* **The conservation ranks are not yet in the stories' summaries.** Saanich's summary has `provincial_concern` and
  `introduction_status`, but no S-rank, BC list, COSEWIC or SARA columns, and no authorities. Adding them is an R
  change (§7.1), from the BC CDC ranking table Howe Sound uses, `rankings/bc-cdc_full_2026-04-10-assigned.csv`, as
  `assign_consevation_rankings.R` joins it. Until then the Conservation set shows `provincial_concern` alone.

The meaning of Howe Sound's variants, as `split_flag_variants` in that script defines them: `_all` every taxon;
`_unlisted` those whose `FLAG` is `!`; `_incorrectLocalityRemoved` those whose `FLAG` is `!!`, despite its name; and
`_unlistedRemoved` the rest, which is what the appendices are built from. That `!` marks a taxon absent from the 2020
UNESCO nomination's list, and `!!` one listed there in error of locality, is my reading - §10, question 12.

### 3.6 Downloads and print

* **CSV** - the Full columns, one row per taxon, named `list-<area>-<date>.csv`, through `hortis.downloadCSV`
  (`imerss-core.js`), which already quotes with Papa Parse. The existing `hortis.checklist.withDownload` downloads
  only names, and needn't change.
* **Print, and PDF** - a print stylesheet in the list's Single File Component, `bioreportr-list.vue`, so that the browser's own
  **Print** and **Save as PDF** give the list alone: a header with the area's name, its outline on a small static map,
  the filters as words ("Native plants reported here and not seen since 2000"), the date, the story's credit, and the
  list's URL with a QR code; then the table, grouped, with group headings kept with their first rows and table headers
  repeated on each page. No PDF library is needed. The QR code is drawn by a small vendored library, or by the
  framework's own few lines, from a short URL: a named area's list URL is short, and a drawn one is simplified to at
  most 100 vertices before encoding.
* **The area itself**, as GeoJSON or GPX, for a GPS or a mapping app such as Avenza - a small addition, for the
  field.

### 3.7 Where it lives

In the Atlas, with links into it from wherever an area is chosen (§1.5):

* **A mode of the Atlas.** The Atlas's data pane shows either the map with its records, as now, or the list of the
  current selection, chosen by a switch above it and held in the URL as `view:list`. The list's controls sit above
  it: the area chooser, an autocomplete over the region index's labels, grouped by field, and **Draw an area**, which
  arms the map's draw control; then the filters, the column set and the title; then **Print**, **Download** and
  **Copy link**. The map stays above the list, so that the area is always in view. The Atlas's lists before us and
  open questions (§1.2) open this mode with their own selections.
* **The list is its own component**, `bioreportr.list` in `static/bioreportr/sfc/bioreportr-list.vue`, with its
  print `<style>`, made a member `list` of the story page by `bioreportr.atlasPanel`. So another pane can show a list
  too - the Events pane shows each event's targets as one (§4.5) - without a second implementation.
* **"List these plants" wherever an area is chosen**: on the card of a protected area or KBA in the Protected Areas
  pane, on a checklist area of *Harvey's footsteps*, in the Atlas's region legend, and beside the map's draw control
  once a shape is drawn. Each is a link, `#pane:Status&view:list&region:<label>` or with the current `polygon`, so
  that it costs the panes nothing but an anchor.

## 4. The search event

### 4.1 Record

An event is one GitHub Discussion in the project's events category (§7.2), titled `event:<eventId> <title>`, whose
body is the **declaration**, a short heading and a flat YAML block, as curation's comments are:

```yaml
# bioreportr-event
eventId: 4fQ2p9xKr0Tz
type: declaration
title: Harrison's plants of the west shore, Elk Lake
area:
  regionField: ProtectedArea
  region: Elk/Beaver Lake Regional Park
  # or, for a drawn area
  # polygon: POLYGON((-123.4012 48.5398,-123.3987 48.5401,...))
days: [2027-04-18]
plannedStart: "09:30"
plannedEnd: "13:00"
meeting: The car park nearest the west shore - details to those who say they're coming
description: A morning on the west shore, looking for two plants A.S. Harrison collected near the pumphouse in 1967
organiser:
  github: chlorophilia
  inat: chlorophilia
targets:
  - {taxonId: "78150", taxonName: Myosotis laxa}
  - {taxonId: "77553", taxonName: Juncus bolanderi}
listUrl: "https://imerss.github.io/saanich-peninsula-flora/story/#pane:Status&view:list&region:...&here:historical"
visibility: public
```

* `eventId` is a 12-character id from curation's Nano ID alphabet (`bioreportr.curation.nanoid`), short enough for a
  URL and a QR code; it doubles as the declaration's claim id for optimistic display, as in curation.
* `taxonId` is the summary's id, which is the iNaturalist taxon id, so the harvest queries it directly.
* `organiser.github` is filled by the page from the sign-in, and checked by the consolidation against the
  Discussion's author; `organiser.inat` is the organiser's claim. For a declaration entered by a maintainer on someone's
  behalf, the two differ, and `enteredBy` names the maintainer.
* `visibility: unlisted` keeps a solo search off the Events pane and map, while still harvested and exported - most
  naturalists won't want their every walk on a public page.

After each day, a **log** is a comment on the Discussion, by the organiser or a maintainer:

```yaml
# bioreportr-event
eventId: 4fQ2p9xKr0Tz
type: log
day: 2027-04-18
start: "09:42"
end: "12:55"
searchers: 7
inat: [chlorophilia, tinnes, frank_lomer]
track: "<encoded polyline, clipped to the area, if a GPS track was uploaded>"
habitat: marsh margin, mixed forest
note: Searched the north and east shores; the west shore was flooded
```

A day may have more than one log, for searches of separate parts of an area at different times; each becomes its own
effort, as the protocol's `Day.effortId` numbers them. A log submitted again displaces the earlier one for its day, as
curation's notes do.

A GPS track is read from a GPX file in the browser, clipped to the area with a margin, thinned to one point per 15
seconds (the protocol's `obsTraceEvery`), and encoded as a polyline with time offsets. Three hours fit in a few
kilobytes, well within a comment's limit of 65,536 characters, so no file storage is needed.

### 4.2 Lifecycle

```
draft ─► proposed ─► upcoming ─► awaiting log ─► completed ─► harvested ─► settled
                          │                                       ▲   │
                          └──► cancelled                          └───┘ re-harvested nightly
```

* **draft** - the form is filled in; the event exists only as its URL, which encodes the declaration, so it can be
  printed and passed round before anyone signs in.
* **proposed** - posted, by an organiser not yet trusted, awaiting the `approved` label (§2.5).
* **upcoming** - approved, before its first day.
* **awaiting log** - its last day has passed without a log. The harvest still runs, provisionally, on the planned times
  and the organiser's handle, so that the page can offer the log prefilled.
* **completed** - logged.
* **harvested** - its observations gathered and its targets decided (§5.2).
* **settled** - `settleDays` (default 30) after its last day, after which identifications made later no longer change
  its result, and it is no longer harvested nightly. A maintainer can re-harvest it on demand.
* **cancelled** - by a log of `type: cancel`, or the Discussion's closing.

### 4.3 Choosing targets

Targets are chosen from the list of the event's area, so that the declaration names taxa with records there - or,
for a search in potential habitat, anywhere in the story: a target need not have been recorded in the area, since the
protocol searches potential as well as historical habitat. **Plan a search for these** on the Atlas's list carries the
list's selection and ticked rows into the form; the organiser can add or remove targets until the event's first
start. Later additions are kept, but flagged as declared after the start (§5.2).

The form warns when a target is infraspecific (the harvest's ambiguity, §5.2), when one is sensitive (§6), and when
there are many: a search for 40 targets is a walk, not a search, and the protocol's habitat-based allocation of effort
(§5.3) makes effort spread thin. A setting, `maxTargets` (default 12), bounds it.

### 4.4 Joining

Participants need not join. They come; they observe; the organiser names them at logging, from the handles the page
offers. A participant with a GitHub account may comment "coming", which the page shows; a participant can also post a
comment of `type: participant` naming their own handle, which the log's handles then include. Observations need no
tag; harvesting is by handle, area and window. An optional observation field, carrying the event's id, may be offered
later for observations made outside the area which belong to the search - not needed at first.

### 4.5 On the map and in a pane

* **A shared Events pane**, `content/story/Events.Rmd` with `paneComponent: bioreportr.eventsPane`: upcoming events
  first, then recent results, each a card with its area, date, organiser, targets and, once harvested, what was found.
  Its map shows each upcoming event's area outlined, and completed ones filled - one colour for an event with a
  detection, another for one without. Clicking an area or a card selects the event, `#pane:Events&event:<eventId>`,
  whose view shows its declaration, its log, a list of its targets with each one's result, the observations used, and
  its links: the Discussion, the list, **Print the field sheet**, **Log this search**, and the announcement for the
  iNaturalist project's journal, ready to copy.
* **The field sheet** is the list's print (§3.6) of the event's targets, headed with the event, its meeting place and
  times, a QR code to its page, boxes for the actual start and end and the number of searchers, a tick box per target,
  and the protocol in three lines: *post an observation of anything every ten minutes or so, so that your path can be
  traced; keep your phone's location on; note when you start and stop.*
* **The Atlas's panel** of a taxon gains a line, "Searched for 4 times since 2026, 31 searcher-hours; last on
  2027-04-18 at Elk Lake, not found", linking to the searches.

### 4.6 The page's state

The events are read as the page starts from `static/events/events.csv` and `effort.csv` (§5.5), written by the
consolidation job, together with the user's own pending submissions, kept in local storage under their claim ids and
displayed optimistically until consolidated - exactly as `bioreportr.curation` does for notes. The components
(§7.3) follow `bioreportr-curation.vue`'s structure, and reuse its backend, sign-in and token handling.

## 5. Harvesting and effort

### 5.1 What the protocol requires

From `detecting-local-extinction`'s documentation (`content/docs/search_effort/`, `extirpation/`), its
`scripts/synthesizeSearchEffort.R` and its `Search_Effort_Summary.csv`, an event can feed the models only if:

1. **It names its targets.** Effort is attributed per target: every row of the summary names one target species, and
   the trace of an effort is applied to each of its targets (`applyTrace`, for each of `thisTargets`). The
   documentation does not say in so many words that targets must be declared before the search, but its whole method -
   the IUCN's "exhaustive surveys", the "intuitive search" of BC's inventory standards, a search weight `W_s` set *a
   priori* for the target's detectability - presumes a search *for* something. A non-detection of a taxon nobody was
   looking for is not evidence of its absence. So: **a non-detection is valid only for a target declared before the
   search began.** Detections are valid whatever was declared, since they are records.
2. **It has a date, and a start and end time,** in local time (`America/Vancouver` in `parse_PST`). The window selects
   each searcher's observations, and its span rescales their trace. The summary's few rows without times have GPS
   tracks instead.
3. **It names its searchers and their number.** The observers' handles select their observations; `Observer.number`,
   which may exceed those with handles, rescales the traces (`obsReweight = observerCount / trackObserverCount`).
4. **It has evidence of where the searchers went**: a GPS track, or iNaturalist observations by each searcher within
   the window, of anything, not only the targets. Each searcher's observations are joined, in time order, into a
   trace interpolated every 15 seconds; a searcher with a single observation gives a stationary trace for the whole
   window. An effort with neither is dropped ("Unexpected empty obs for effort"). Observations of uncertainty below
   10 m are set to 10 m, and those with dubious positions are censored by a patch file, `iNat_obs_patch.csv`. A
   segment implying more than 2.5 km/h is warned of, since that is not searching.
5. **It lies within the study's grid, and in habitat.** Effort is gridded in 30 m cells (`gridcell` in
   `scripts/config.R`), and counts only in cells of the target's historical or potential habitat.
6. **It records detection or non-detection per target**, as 1 or 0.

`Historical.site?` and `Habitat` are descriptive; the model takes habitat from its maps, and `synthesizeSearchEffort.R`
reads neither.

### 5.2 Gathering observations and deciding each target

The harvest is a step of the nightly GitHub Action, beside curation's consolidation (§7.2). For each event day which
is logged, or awaiting its log, and not settled:

1. **Its area**: a region's feature from `areas.geojson`, or the decoded polygon, and their bounding box.
2. **Its observations**, from iNaturalist's public API, in pages of 200 ordered by id:

   ```
   GET https://api.inaturalist.org/v1/observations
       ?user_id=chlorophilia,tinnes,frank_lomer
       &d1=2027-04-18&d2=2027-04-18
       &swlat=48.53&swlng=-123.41&nelat=48.55&nelng=-123.39
       &per_page=200&order_by=id&order=asc&id_above=<last id>
   ```

   and kept if their `time_observed_at`, in local time, lies within the logged window, widened by `windowSlackMinutes`
   (default 15), and their position within the area. An area which is also an iNaturalist place may name it, as
   `place_id`, to narrow the query. One query serves an event, as no taxon is given: the same observations make the
   trace and decide the targets. The job keeps to iNaturalist's request of about one request a second, as
   `bioreportr.lostPlants` already does with `batchDelay`, and names itself in its `User-Agent`.
3. **Each target**, from the observations so kept, whose taxon's `ancestor_ids` include the target's id:
   * **detected** - an observation of the target or a taxon within it, not casual, of quality grade research or needs
     ID. A detection on a needs-ID observation is shown as *unconfirmed* until it reaches research grade, or the event
     settles.
   * **unresolved** - no detection, but an observation identified only to a taxon above the target which contains it,
     e.g. *Sagittaria* for *S. latifolia*. It may yet become a detection, so it blocks a non-detection until it is
     identified more finely or the event settles, when it counts as no detection.
   * **not detected** - neither, and the target was declared before the event's start, as the Discussion's edit
     history shows it, and there is evidence of search (requirement 4).
   * **not counted** - neither, but the target was declared after the start. It is shown, but exported with
     `declaredBeforeStart: false`, for the analyst to exclude.
4. **Incidental detections**: observations of a target by others in the area on the day are noted on the event's page
   as records, but are not the event's.
5. **Its bounds** (§2.5): the claimed duration against the observations' span, and the searchers against those
   observed.

The browser runs steps 1-3 too, live, when an organiser logs a search, so that the log is offered prefilled from the
observations, and the organiser sees before submitting what the job will conclude. The two share one implementation,
`src/js/harvestEvents.js`'s functions, loaded by the page as the curation consolidation's are not - so they are written
as plain functions over plain data, testable under node.

### 5.3 Computing effort, as the protocol does

The harvest writes the protocol's *inputs*, and the protocol's own R computes effort from them, as
`synthesizeSearchEffort.R` does now:

* For each effort and each searcher, their observations in the window, sorted by time, interpolated every 15 seconds
  into a trace (`trackToTrace`, `obsTraceSpan`), with a search weight of `15 × (effortSpan / obsSpan) ×
  (observerCount / trackObserverCount)` seconds per point; or for a GPS track, `60 × Duration.mins / points ×
  observerCount`.
* The traces gridded into 30 m cells and summed per cell, in kiloseconds, per target (`condenseTrace`,
  `writeTargetSummary`), and restricted to the target's habitat.
* Each cell's posterior for extirpation, `(α, β) = (P_r W_p, (1 − P_r) W_p + S_t W_s)`, with `W_s = 15` and the prior
  `P_r` from the target's sighting record by Solow's method - the same method as the story's EP
  (`bioreportr.solowBayesFactor` in `static/bioreportr/js/solow.js`) - and the cells pooled by moment matching into a
  regional estimate.

This is analysis, in R, and per AGENTS.md belongs in an R script in the style of the project's pipelines, run by the
RStudio user, never by the build. The proposal is to bring `synthesizeSearchEffort.R` and the parts of `Analyse.R`
which compute the posteriors into the shared framework, as `scripts/synthesizeSearchEffort.R` and
`scripts/analyseSearchEffort.R`, with each project's grid, boundary, habitat and weights in `scripts/project.R` -
detecting-local-extinction's own configuration, `scripts/config.R`, being its Galiano case. Whether that repository
then reads its inputs from the Galiano story, or keeps its own, is §10, question 11.

The Action computes only what the pages show: searcher-minutes, `Duration × Observers`, as the summary does.

### 5.4 Mapping an event onto the protocol's summary

| Summary column | From the event |
|---|---|
| `Target.Species` | each target's `taxonName` - one row per target per effort, as now |
| `Detection` | 1 if detected; 0 if not detected; rows not counted are exported with `declaredBeforeStart: false` |
| `Location` | the area's label, or the event's title for a drawn area |
| `Historical.site?` | "yes" if the area holds a record of the target from before `recentYear`, computed from the catalogue; else "no" |
| `Habitat` | the log's `habitat`; else the area's BEC unit |
| `Date`, `Month` | the log's `day` |
| `Record` | "observations", or "track + observations" |
| `Tracks` | "yes" if the log has a track |
| `Observers` | the log's iNaturalist handles - which `appendINatNames` already accepts, since it matches `Recorded.by` against both names and handles |
| `Observer.number` | the log's `searchers` |
| `Day.effortId` | the log's index within its day, when a day has several |
| `Start`, `End` | the log's `start` and `end`, as `HH:MM:SS` |
| `Duration.mins`, `Duration.x.Observers.mins` | computed |
| `Note` | the log's `note` |

and, after them, columns the protocol ignores: `eventId`, `source` (`bioreportr-event`, `historical`, `import`),
`declaredAt`, `declaredBeforeStart`, `approved`, `detectionObservations`, `harvestedAt`, `settled`, `url`. The
protocol's `effortId`, `{Date}T{Start}-{first observer}`, follows from these as `parseEffortRow` makes it.

The summary's own rows show effort divided by hand among habitats and targets, in their `Note`s ("search efforts
divided and allocated based on proportional representation of habitats"). Harvested rows are not divided: each target
carries the effort's whole duration, and the trace's intersection with each target's habitat does the allocation, as
`synthesizeSearchEffort.R` already applies one trace to all of an effort's targets.

### 5.5 Output files

Written by the job into `static/events/`, copied into `docs/events/`, and committed only when changed, as
`curation.yml` does for `static/curation/`:

* `events.csv` - one row per event: `eventId, title, status, approved, visibility, organiserGithub, organiserInat,
  regionField, region, polygon, days, plannedStart, plannedEnd, targets, declaredAt, url`.
* `effort.csv` - one row per target per effort, in the columns of §5.4. **This is `Search_Effort_Summary.csv`'s
  format**, so the R pipeline reads it by appending it to the protocol's own table.
* `observations.csv` - every observation used, in the columns of the protocol's
  `iNaturalist_Observations/iNat-obs-*.csv` (`iNaturalist taxon name, iNaturalist taxon ID, ..., observationId`
  as `iNat:<id>`, `Latitude, Longitude, Date observed, Recorded by, Captive/Cultivated, Quality grade,
  coordinateUncertaintyInMeters`), with `eventId` and `obscured` added, and positions withheld as §6 requires.
* `tracks/<effortId>.geojson` - each GPS track, clipped (§6.4), which the R pipeline reads as it reads the
  protocol's KML tracks.
* `claimStatus.json` - the consolidated claim ids, for the page's optimistic display.

All are named once, in a new `events:` section of `bioreportr.yaml`, since both the R scripts and the story page read
them - though unlike the rest of that file they live in `static/events/` rather than `tabular_data/`, being written
by the job.

### 5.6 How results flow back into the stories

* **Rediscoveries, at once.** A detection of a taxon historical in the area, or in the Lost Plants gallery, marks its
  card: "Found again on 18 April 2027, at Elk Lake, by tinnes", linking to the observation and the event. This reads
  `effort.csv` directly, and needs no data refresh. `bioreportr.lostPlants.select` keeps it in the gallery, marked,
  until the next refresh confirms it, so that the gallery doesn't change under the reader's feet.
* **Records, at the next refresh.** The observations themselves reach the catalogue through the usual R pipeline, and
  from it the Atlas's statuses, the Traces timeline and the regional EP.
* **Searches, on the Atlas.** The line of §4.5 on each taxon's panel.
* **Effort-based extirpation**, once the R of §5.3 runs for a project: per taxon, the regional posterior's central
  estimate and interval (`Central`, `Low`, `High` in `apply_region_moments`), written as columns of the summary, and
  shown in the extirpation risk pane beside Solow's EP - "EP 0.82 from the record alone; 0.91 after 31 searcher-hours
  of search" - with the predictive map of occupancy (`continuing_searches/`) as a layer, guiding the next search.
  This needs the target's habitat mapped, which Galiano has (`detecting-local-extinction`'s site classification) and
  the others do not yet.

## 6. Sensitive taxa

### 6.1 Practice to follow

* **iNaturalist** obscures an observation's public position within a cell of 0.2° by 0.2° - about 22 by 15 km here -
  when its taxon is threatened, by the taxon's geoprivacy, or when its observer chooses; or hides it altogether, by
  private geoprivacy. The true position is seen by the observer, and by curators of projects which the observer has
  trusted with it. The API marks such observations `obscured` and gives their `geoprivacy` and `taxon_geoprivacy`.
* **The BC Conservation Data Centre** masks the occurrences of sensitive species, publishing generalised polygons in
  their place, under the province's Species and Ecosystems Data and Information Security (SEDIS) procedures.
* **The stories already drop the positions of obscured iNaturalist observations**: `scripts/prepare_obs.R` sets their
  coordinates to `NA`, so they fall in no area and on no map.

### 6.2 In lists

A list must disclose nothing the story's map does not. Since the map already shows every record which has coordinates,
the real safeguard is in the data: a sensitive taxon's precise records should not be published at all. So:

* **The R pipeline marks taxa `sensitive`** in the summary - from iNaturalist's taxon geoprivacy, the CDC's list, and
  the project's own, `sensitiveTaxa` in `scripts/project.R` - and **generalises their records' coordinates** before
  publishing, as the CDC masks, to a cell of `sensitiveCellKm` (default 1 km), with their uncertainty enlarged to
  match. Their records then fall in areas only as precisely as the cell allows.
* **The list shows a sensitive taxon only in an area of at least `sensitiveMinAreaKm2`** (default 1 km²), or a named
  area; in a smaller drawn area it shows "1 sensitive taxon not listed for an area this small". It gives its last
  year here, never a locality or recorder.
* The catalogues are in public repositories, so a precise record in `tabular_data/` is already public. Generalising
  at publication protects the site, not the repository - §10, question 7.

### 6.3 In events

An event is a public Discussion. Naming a sensitive target, with a small area and a date, says where it grew.

* **The declaration may withhold its sensitive targets.** The page writes, in place of their names, a commitment:
  `sensitiveTargets: {count: 1, digest: <SHA-256 of a random salt and their sorted ids>}`. The organiser keeps the
  salt, which the page saves for them, and the field sheet carries the names. After the search, the log reveals the
  salt and ids, and the job checks the digest - so the targets are shown to have been declared beforehand without being
  disclosed beforehand. The log's reveal can itself be withheld, sending the salt and ids to a maintainer instead, for
  a target whose detection should not be public at all.
* **Public outputs carry no position for a sensitive target's detection**: `effort.csv` gives the area's label, and
  `observations.csv` withholds its observation's position. The R analysis needs precise detections, which it takes
  from iNaturalist with the analyst's own credentials, where the observers have trusted the story's project with them.

### 6.4 Obscured observations and traces

* An obscured observation is never used for a trace, since its public position is false; the protocol's patch file
  does the same for positions known to be dubious.
* For detection, an obscured observation by a searcher in the window counts as **detected (position obscured)** if its
  obscuration cell meets the area.
* **A published trace could de-obscure.** A trace interpolated between two open observations shows where its searcher
  was at the time of an obscured observation made between them. So timed traces are never published: the job
  publishes only the protocol's inputs, untimed beyond each observation's own time; the R pipeline publishes effort
  only gridded and summed; and GPS tracks are clipped to the area with a 100 m margin, which also keeps people's homes
  and routes out of them.

## 7. Layering

### 7.1 Where each piece belongs

| Piece | Layer | Files |
|---|---|---|
| The Atlas's section: its lists before us, tiles, open questions and ways to take part | Shared framework | `static/bioreportr/sfc/bioreportr-atlasPane.vue`, the component `bioreportr.atlasPane` into whose template `storyBuild.js` writes `Status.Rmd`; the computations of its counts and the open questions' criteria in `bioreportr-atlasPanel.vue` |
| The taxon panel's line of accounts, open questions and invitation | Shared framework | `bioreportr.atlas.panelMarkup` and `bioreportr.atlas.notesMarkup` in `bioreportr-atlasPanel.vue` |
| The list, its filters, rows, print and CSV | Shared framework | `static/bioreportr/sfc/bioreportr-list.vue`, holding `bioreportr.list` and its print `<style>`, made a member of the story page by `bioreportr.atlasPanel` |
| The `needsReview` flag and its reason | Shared R | `scripts/prepare_curation_history.R` |
| "List these plants" links | Shared framework | small additions to `bioreportr-protectedPane.vue`, `bioreportr-atlasPanel.vue` and `bioreportr-storyMap.vue` |
| Each story's words for the Atlas and Events panes | Project | `content/story/Status.Rmd`, gaining `paneComponent: bioreportr.atlasPane`; `content/story/Events.Rmd` |
| Each story's sources, open questions and wording | Project | `lineageSources` (extending `curationHistorySources`) and `openQuestions` in `<project>-story.vue` |
| Each story's settings | Project | `static/local/story/<project>-story.vue` - §7.2 |
| The events' state, form, log, sign-in, backend and optimistic display | Shared framework | `bioreportr-events.vue` (`bioreportr.events`, a member `events` of the story page, reusing `bioreportr.curation`'s backend and token); `bioreportr-eventForm.vue`; `bioreportr-eventsPane.vue`; `bioreportr-storyPageEvents.vue` |
| The harvest's functions, shared by page and job | Shared framework | `src/js/harvestEvents.js` |
| Consolidation and harvest | Shared framework, GitHub Action | `src/js/consolidateEvents.js`, run as a further step of `.github/workflows/curation.yml`, kept as one workflow so that its runs never overlap and commit in turn |
| Each project's events settings | Project | `static/curation/config.json`, gaining an `events` block (§7.2) |
| Named areas, `areas.geojson` | Shared R | `scripts/intersectShapes.R`, which already reads the shapes |
| Conservation ranks and authorities in the summary | Shared R | a shared `scripts/assign_conservation_ranks.R`, from Howe Sound's `assign_consevation_rankings.R`, with the ranking table named in `bioreportr.yaml` |
| Sensitive taxa and their generalised records | Shared R | `scripts/prepare_obs.R` and the summary's preparation, with `sensitiveTaxa` in `scripts/project.R` |
| Applying curation's corrections of position | Shared framework | `{storyPage}.correctedObs` in `bioreportr-storyPage.vue` |
| Effort synthesis and posteriors | Shared R, run by hand | `scripts/synthesizeSearchEffort.R`, `scripts/analyseSearchEffort.R`, from detecting-local-extinction |
| Past searches imported in bulk | Shared R, with project data | `scripts/import_past_searches.R`; `tabular_data/<project>_past-searches.csv`, named in `bioreportr.yaml` |
| Distance from a point to a polygon; a checklist's rows as a table | Upstream, imerss-bioinfo | §7.3 |

Every new shared file is added to the list in `copyFrameworkOut.sh`. The panes' Single File Components carry the
comment over their empty `<template>` blocks which the other pane components carry, since `storyBuild.js` writes their
sections into them.

### 7.2 Settings each project overrides

In `<project>-story.vue`, as members of the layers:

| Setting | Saanich | Howe Sound | Galiano |
|---|---|---|---|
| `listColumnSets` | the three of §3.5 | the same; Conservation as Howe's appendices | the same |
| `listGroupRanks` | `["family"]` | `["family"]` now; `["report_group", <rank by group>]` once multi-group | `["family"]` |
| `listFilters` | from `taxaFilterRecords`, with Here, Lost, Community | the same; Listing for its `FLAG` | the same |
| `sensitiveMinAreaKm2` | 1 | 1 | 1 |
| `maxTargets` | 12 | 12 | 12 |
| `recentYear`, `isSighting` | as now, in `bioreportr.atlasPanel` | as now - Howe's `isSighting` excludes the UNESCO nomination's list | as now |

In `static/curation/config.json`, beside curation's own:

```json
{
    "events": {
        "category": "Search events",
        "categoryId": "DIC_...",
        "inatProjectId": 303782,
        "timeZone": "America/Vancouver",
        "trustedOrganisers": ["chlorophilia"],
        "windowSlackMinutes": 15,
        "settleDays": 30,
        "maxDurationRatio": 3,
        "maxSearcherRatio": 4
    }
}
```

In `scripts/project.R`: `sensitiveTaxa`, `sensitiveCellKm`, and an `effort` list - the grid's cell size and frame,
the boundary, the habitat layers and their classes per target, `W_s` and `W_p` - for projects which run the effort
analysis.

Where the projects must differ, e.g. Howe Sound's `FLAG` filter, the difference is a setting with a comment in that
project's story saying why, as AGENTS.md asks.

### 7.3 Upstream changes to imerss-bioinfo

None is needed for Phase 1, which builds on `hortis.libreMap.polygonFilter`, `hortis.urlCodecs.polygons`,
`hortis.intersectsAnyFeature`, `hortis.valueFilter`, `hortis.urlMappedFilter` and `hortis.downloadCSV` as they are.
Worth offering upstream, as patches for a human to apply:

* `hortis.distanceToFeature(feature, point)`, beside `hortis.intersectsFeature` in `src/geom/geoJSON.js`, for records
  which may lie in an area (§3.3), and for clipping tracks.
* `hortis.checklist.rowsToTable(idToEntry, rowSelection, columns, groupRank)`, generalising
  `hortis.checklist.computeLeaves`, so that any checklist, not only a story's list, can export its rows grouped and
  with columns. Until then the framework computes its rows itself.
* Optionally, a circle draw mode for `hortis.libreMap.polygonFilter` ("within 500 m of here"), since MapboxDraw has
  none.

### 7.4 Galiano

Galiano is the natural pilot for events and effort: detecting-local-extinction's grid, habitat map, targets and 492
rows of effort are all Galiano's, and its draft story already has the same panes (`galiano-island-flora/content/story/`)
and a `bioreportr.yaml` of the same form. So:

* Phases 1 and 2 are carried to it by `copyFrameworkOut.sh galiano-island-flora` like the others, with its own
  `Status.Rmd`, `Events.Rmd`, settings and a Discussions category of its own repository.
* Phase 4's effort analysis runs first for Galiano, whose `scripts/project.R` takes its `effort` settings from
  detecting-local-extinction's `config.R`.
* Its past searches (§8) are the protocol's own summary, imported as they stand.

## 8. History

Decades of earlier work can enter the stories, each honest about what it records: as the Atlas's lists before us
(§1.2), when it says what was known of a place, and as past events, when it says what was looked for.

### 8.1 Kinds of past data, and what each can claim

| Source | What it holds | Enters as | Feeds the model as |
|---|---|---|---|
| `Search_Effort_Summary.csv`, 2020-2024, with its GPS tracks and iNaturalist observations | Targeted searches, by the protocol | Past events, `source: protocol`, one per `effortId`, their rows unchanged | Effort, as now |
| Agencies' and consultants' rare plant surveys, with tracks | Targeted searches | Past events by bulk import | Effort, if times and tracks are given |
| Harvey Janszen's field journals, 1973-2017, being digitised by `janszen-legacy-project` (journals HJ5, HJ7, HJ8, HJ9 and HJ27, entered in its `data/data_digitization/occurrence_data/` templates and processed by its own protocol) | Dated visits to places, plants seen, sometimes plants looked for and not found | Records, as its processing delivers them; the list of each place he visited, as a list before us; and past events, `source: journal`, with targets only where the entry names a search, and durations elicited where the entry or the memory of those present supports one | Detections as records; a non-detection only where a search is named and a duration can be given - the protocol's summary already holds elicited durations, as its `Note`s show ("Frank recalls searching for 3 hours") |
| Harvey's checklists, and older lists: Szczawinski and Harrison's *Flora of the Saanich Peninsula* (1972), Howe Sound's 2020 UNESCO nomination list | Taxa known from an area, without dates of search | **Past lists**, not events: a list with its area and source, shown beside the area's list for comparison ("on Harvey's Saltspring list, not recorded since") | Nothing: presence without effort, as `howe.story.isSighting` already treats the UNESCO list as no sighting |
| Curation threads, and naturalists' memories | "Looked for it at Elk Lake in 2019, didn't find it" | Retrospective events, logged by anyone through **Log a past search**: area, date, rough duration, searchers, targets, result; `retrospective: true` | Not counted by default, since declared after the fact; kept for the analyst, and for the Atlas's search history |

The areas of Harvey's checklists are already mapped, in the Remembering pane (`scripts/Janszen_checklists_mapbox.R`;
the `Checklist.*` sources of `static/story/mapData.json`), and would become named areas, so that a past list and a
present list of the same area can be compared.

### 8.2 Entering them

* **By form**, for a few: **Log a past search** is the event form with its dates in the past, which writes the
  declaration and the log together, marked `retrospective`.
* **In bulk**, by a maintainer: rows in the protocol's own columns in `tabular_data/<project>_past-searches.csv`,
  read by `scripts/import_past_searches.R`, which writes them into the same `effort.csv` form with `source` set. The
  digitisation of Harvey's journals is already under way in `janszen-legacy-project`, whose occurrence records carry
  the date and place of each visit. What it would need to add, for a past search, is the journal's mention of a plant
  sought and not found, with any time the entry gives: one more column of its entry template.

## 9. Phasing

Each phase is useful when it ships, and nothing in an earlier phase is undone by a later one: the URL of §3.1 is the
story's own; the list's rows (§3.2) are what the event form selects targets from; the events' records are written
with every field later phases read; and the sign-in is curation's.

### Phase 1: The Atlas as the way in, with lists

* **Scope**: the Atlas's section recast as §1.2 proposes - its lists before us, its tiles, its open questions and its
  ways to take part - with its counts bound into each project's own words; the taxon panel's line of accounts, open
  questions and invitation (§1.3); the list as a mode of the Atlas, with its filters, columns, print and CSV; "List
  these plants" links; the area's download. No sign-in, no new data files - named areas are drawn from the region
  index alone, outlined from the shapes already in `mapData.json` where a pane holds them, and otherwise only as a
  name. A source's list of taxa (*FSP 1972*, *HJ*) comes from the curation history's non-empty columns, which the
  page already loads.
* **Files**: `static/bioreportr/sfc/bioreportr-atlasPane.vue`, `bioreportr-list.vue`; changes to
  `bioreportr-atlasPanel.vue`; small additions to `bioreportr-protectedPane.vue`, `bioreportr-storyMap.vue` and
  `saanich-rememberingPane.vue`; in each project, `content/story/Status.Rmd`, reworded and naming its component, and
  settings in `<project>-story.vue`; `copyFrameworkOut.sh`.
* **Verify, in both sites**: build each with `npm run build`, reading all its output, and serve with
  `--noHTTPCache`. Each count on the Atlas agrees with the same count made in R from the summary and the curation
  history - e.g. Saanich's 189 species without a voucher - and clicking it selects exactly those taxa. For a protected
  area, the list filtered to native species gives the count the Protected Areas card gives for it, from
  `scripts/Protected_map_mapbox.R` - an independent check of the selection. A drawn polygon, its URL reloaded in a
  fresh tab, gives the same list. Back and forward move between areas and between map and list. Each panel's
  invitation opens the Curation pane on its plant, or record. Print preview, in Chrome and Safari, keeps headings with
  their rows. The CSV opens in a spreadsheet with its accents intact. On a phone width, the Atlas's section reads in
  order and the list's controls work. Say plainly where the map could not be checked, since the built-in browser's
  pane is usually hidden. Howe Sound, which has no curation history, shows its own sources and no empty strip.

### Phase 1b: The data lists need (R)

* **Scope**: `areas.geojson`; conservation ranks and authorities in the summary; `sensitive` taxa and their
  generalised records; applying curation's corrections of position, if not done in Phase 1.
* **Files**: `scripts/intersectShapes.R`, a shared `scripts/assign_conservation_ranks.R`, `scripts/prepare_obs.R`,
  `scripts/project.R` and `bioreportr.yaml` in each project, `R/build.R`; `bioreportr-storyPage.vue` for
  `correctedObs`.
* **Verify**: R's counts per area against the page's lists; the number of sensitive records generalised, reported by
  the script; Howe Sound's Conservation columns against its appendix tables.

### Phase 2: Events, declared and logged

* **Scope**: the event form from a list, its declaration and log as Discussions; the Events pane and map; the field
  sheet; the consolidation of events into `events.csv`; the browser's live preview of the observations at logging; the
  prefilled-Discussion fallback; approval by label. No harvest into `effort.csv` yet - the page's preview shows what it
  will be.
* **Files**: `bioreportr-events.vue`, `bioreportr-eventForm.vue`, `bioreportr-eventsPane.vue`,
  `bioreportr-storyPageEvents.vue`, `src/js/harvestEvents.js` (its pure functions, for the preview),
  `src/js/consolidateEvents.js`, `.github/workflows/curation.yml`, each project's `content/story/Events.Rmd` and
  `static/curation/config.json`; `src/curation/enrol.mjs`, to create the category.
* **Verify**: with `bioreportr.curation.backends.memory`, the whole flow offline; then against a test repository
  enrolled as curation's are, a declaration, an edit before and after the start, and a log, consolidated by running
  the job by hand (`workflow_dispatch`); the approval label; deletion of a Discussion removing its event.

### Phase 3: Harvesting

* **Scope**: the job's harvest and its outputs, `effort.csv`, `observations.csv`, tracks; settling; rediscoveries on
  the Lost Plants and Atlas panes; the Atlas's search history.
* **Files**: `src/js/harvestEvents.js`, `src/js/consolidateEvents.js`, `bioreportr-lostPlantsPane.vue`,
  `bioreportr-atlasPanel.vue`, `bioreportr.yaml`.
* **Verify**: **replay the protocol's past searches.** Enter a dozen rows of `Search_Effort_Summary.csv`, with times
  and handles, as events in the test repository, harvest them, and compare the observations each gathers against the
  `iNat_surveys/<effortId>.csv` which `synthesizeSearchEffort.R` wrote for the same effort, and its `effort.csv` rows
  against the summary's. Python may help compare, as AGENTS.md allows for proofing; it must not produce the data.

### Phase 4: Effort and extirpation

* **Scope**: the shared R of §5.3, run first for Galiano; the posterior's columns in the summary; the extirpation risk
  pane's second estimate and occupancy layer.
* **Files**: `scripts/synthesizeSearchEffort.R`, `scripts/analyseSearchEffort.R`, `scripts/project.R`,
  `static/bioreportr/js/solow.js`, `bioreportr-solowTaxa.vue`.
* **Verify**: Galiano's posteriors for *Primula pauciflora* and *Crassula connata* against detecting-local-extinction's
  published figures, from the same inputs.

### Phase 5: History, and if needed, iNaturalist sign-in

* **Scope**: Log a past search; past lists; the bulk import; the import of the protocol's summary into Galiano. Then,
  if Phase 2's pilots show GitHub to be the barrier, "Sign in with iNaturalist" through the Worker.
* **Files**: `scripts/import_past_searches.R`, `bioreportr-eventForm.vue`, `bioreportr-list.vue`;
  `src/curation/oauthWorker.mjs`.

## 10. Open questions for the project lead

Where the protocol and ease of use conflict:

1. **Strict pre-declaration.** A non-detection counts only for a target declared before the start (§5.1). This is
   right for the model, and will disappoint the naturalist who meant to look for a plant and didn't write it down.
   Should targets added up to the end of the day count, flagged, and the analyst decide? The design keeps them either
   way.
2. **"Observe everything."** Traces need each searcher to post observations of anything, often, through the search.
   Many naturalists post only what interests them. Is the field sheet's request enough, or should a GPS track be asked
   for, or should sparse traces be held to a lower weight?
3. **One window per day.** The protocol gives an effort one start and end; a searcher who arrives late is rescaled
   with the rest. Is that close enough, or should each searcher have their own window?
4. **Driving between sites.** The 2.5 km/h warning means a day of several stops must be several efforts. Should an
   event hold several stops, each with its own area and window, from the start?
5. **Groups under one account.** A class of 25 posting through a teacher's account gives `obsReweight` of 25 - a
   class does not search like 25 botanists. Cap the searchers counted per trace, or record groups separately?
6. **Identification.** Should a needs-ID observation count as a detection at all, and is 30 days long enough to
   settle?
7. **Sensitive data in public repositories.** The catalogues in `tabular_data/` hold precise records of sensitive taxa
   in public repositories. Is generalising at publication enough, or should their precise records move to a private
   store?
8. **Sensitive targets**: is the commitment of §6.3 acceptable to the CDC and to iNaturalist's community, or should
   searches for sensitive taxa simply be arranged off the site?

And of design:

9. **GitHub for organisers.** Is the barrier acceptable for a pilot? Who are the first organisers - and would any
   refuse a GitHub account outright?
10. **Moderation.** Who approves new organisers, and how quickly?
11. **The protocol's home.** Should detecting-local-extinction's R move into the shared framework, with that
    repository reading its inputs from the Galiano story, or should the framework only write files for it to read?
12. **Howe Sound's flags.** Is `!` "absent from the 2020 nomination's list" and `!!` "listed there in error of
    locality"? And should its lists default to `_unlistedRemoved`, as its appendices do?
13. **Multi-group Howe Sound.** Is a catalogue of every group planned for the story, without which its lists remain
    vascular?
14. **Where events live.** In each project's own repository, as curation's notes do, or in one shared repository, so
    that a search on the boundary of two stories counts in both?
15. **Effort by hand.** The summary divides some efforts among habitats by hand. Harvested efforts will not (§5.4). Is
    that a change the analysis accepts?
16. **Offline.** Is paper and the iNaturalist app enough, or is an installable, offline list wanted later?

Of the Atlas and its invitation (§1):

17. **The lists before us.** Which sources should the Atlas name for each story, and how? Should the reviewers be
    named on the Atlas itself, and should the iNaturalist community be credited by number or by its leading observers,
    as the Community Science pane does?
18. **The open questions.** Are no voucher, a single record and no mappable record the right first questions? Which
    others matter - a critical note doubting an identification, say? And should reviewers mark `needsReview` by hand,
    with a reason?
19. **Tone.** The Atlas would say, in effect, "this flora is unfinished, and you can help finish it". Is that the
    voice wanted at the story's centre, or should the invitation stay quieter, in the plants' panels?
20. **The Curation pane's place.** Should *Living Data* move nearer the Atlas in the menu, or does the Atlas's
    leading into it from every plant make its place at the end right?
21. **Howe Sound's sources.** Without a curation history, what line of earlier lists does its Atlas show? Is one
    planned, as Saanich's was prepared?
22. **Harvey's lists.** Are his regional checklists themselves - the taxa of each area, not only its outline -
    available to load as lists before us, from `janszen-legacy-storymap` or elsewhere?
