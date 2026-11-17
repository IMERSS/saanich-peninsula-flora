# `bioreportr.read` - a workaround for a fault which does not exist

Investigated 2026-11-17, against Infusion 6.2.6 and imerss-bioinfo 1.25.0 as vendored at `b1d4340`.

## Summary

`bioreportr.read` was introduced as `bioreportr.list.read` in `3cb0aff` ("updated LOST PLANTS tabs Added checklist
functionality"), and hoisted into `static/bioreportr/js/story.js` in `47fff7e` ("work around Infusion 6.2.6
breakages"), which also wrapped three further reads in event handlers with it. It claims that a member of a component
read from an event handler, e.g. `storyPage.taxa`, "arrives as its cell", so that `storyPage.taxa.rowById` is
undefined.

No such fault could be reproduced - not in a minimal model, not in the real story page booted under node, and not in
the built site in a browser. Each of the reads it wraps yields a plain value through the proxy which the call site
actually holds, and every behaviour it was added to rescue works identically with it replaced by the identity
function. The one way found to observe the symptom it describes is to read a component's raw instance rather than its
proxy, which no call site does. It should be removed, together with the double wrapping at its call sites.

A separate claim of `47fff7e`, that an unread `$bindable` taking the map never binds, is a genuine fault of Infusion -
see FLUID-7036 - and is not the subject of this note.

## The implementation

`static/bioreportr/js/story.js`, as of `47fff7e`:

```js
/**
 * Read the present value of a member of a component, as read outside any computation - unwrapping its proxy, and reading
 * a member which arrives as its reactive cell, e.g. one defined by a reference to another, through the cell.
 * @param {any} value - The member as read
 * Needed wherever a member is read from an event handler rather than a computation - e.g. `storyPage.taxa`, a
 * reference to a component, which arrives as its cell, so that `storyPage.taxa.rowById` is undefined unless read through
 * this as `bioreportr.read(storyPage.taxa).rowById`
 * @return {any} Its value
 */
bioreportr.read = function (value) {
    let togo = fluid.unwrapProxy(value);
    // A reference to a member defined by a reference arrives as a cell of a cell
    for (let i = 0; i < 4 && togo && typeof(togo.get) === "function" && "cellId" in togo; ++i) {
        togo = fluid.unwrapProxy(togo.get());
    }
    return togo;
};
```

and its former home, now an alias, in `static/bioreportr/sfc/bioreportr-list.vue`:

```js
// Read a member of a component outside any computation - see bioreportr.read
bioreportr.list.read = value => bioreportr.read(value);
```

Note that the premise of the doc comment is false on its face: `storyPage.taxa` is not "a reference to a component" but
the `$component` `hortis.taxa` itself, defined in `hortis.vizLoader` (imerss-bioinfo `imerss-core.js`), and its
`rowById` is a plain reference to `{self}.indexed.rowById`:

```js
fluid.def("hortis.taxa", {
    $layers: "fluid.component",
    indexed: "$compute:hortis.taxa.index({self}.rows)",
    rowById: "{self}.indexed.rowById",
    allRows: "{self}.indexed.rows",
    ...
});
```

The loop, which follows `.get()` up to four times on anything bearing `cellId`, is a guess at an indefinite depth of
nesting rather than a response to any observed structure.

## Its use sites

The Community Science pane's jump to the Atlas, `bioreportr-atlasPanel.vue:399`, in a promise callback following a
click captured by a listener bound by a `$bindable` whose argument is `{self}` (the story page):

```js
const row = taxon && bioreportr.inatSpecies.atlasRow(bioreportr.read(bioreportr.read(storyPage.taxa).rowById), taxon);
```

The back face of a Lost Plants card, `bioreportr-lostPlantsPane.vue:548`, in a click handler bound by a `$bindable`
whose argument is `{storyPage}`:

```js
rowById: bioreportr.read(bioreportr.read(storyPage.taxa).rowById),
```

The rows of the Download list and printed checklist, `bioreportr-list.vue:69`, reached through the `$method`
`download: "$method:bioreportr.list.download({self}, {storyPage})"` and its sibling `print`:

```js
const stats = bioreportr.list.stats(read(storyPage.pkg), selection);
return bioreportr.list.rows(stats, read(read(storyPage.taxa).rowById), read(storyPage.statusById) || {}, read(storyPage.recentYear),
    read(that.groupRank), read(storyPage.curation?.historyById), read(storyPage.curationHistorySources), {}, [], {});
```

In the same files, other reads of the same members are left unwrapped and work, e.g.
`bioreportr-lostPlantsPane.vue:114`, `storyPage.taxa.allRows`, and `bioreportr-protectedPane.vue:111`,
`storyPage.taxa.rowById`, though these are reached from computations rather than event handlers. The click handler at
`bioreportr-lostPlantsPane.vue:520`, however, itself goes on to call
`storyPage.checklist.search.select(taxonId)` and `storyPage.selectPane("Status")` unwrapped.

## Hypotheses as to how it came about

These are inferences, not established facts.

1. **Inspecting the raw instance from the console.** The one place the described symptom was reproduced is
   `fluid.globalInstantiator.pathToComponent[path].that`, the component's raw instance as held by its shadow, rather
   than the proxy through which the framework hands it to binders, methods and effects. There `taxa`, `statusById`,
   `pkg` and `curation` really are raw cells, and `taxa.rowById` is undefined - precisely the comment's description,
   including "a cell of a cell" for a member defined by a reference. An agent, or a person, debugging an unresponsive
   handler from the browser's console is very likely to reach the component this way, and to conclude that the handler
   sees what the console sees. The author of this note made exactly this mistake in the first probe below.
2. **A misattributed failure.** `47fff7e` was written in the wake of `758f9b3`, which had reverted the vendored
   libraries to a stale imerss-bioinfo and Infusion, and alongside a genuine fault (FLUID-7036) which silenced the map's
   hover cards. With several things broken at once, a handler which failed for another reason - e.g. data not yet
   loaded, which `currentRows` reports by returning `null` - is easily ascribed to the reads within it, and a fix which
   coincides with the restoration of the libraries appears to work.
3. **Generalisation from a true fact.** `fluid.unwrapProxy` is genuinely needed in a few places, e.g.
   `bioreportr.unbind`, and `fluid.flattenSignals` does unwrap `$sitedRef`s and `$component` cells when resolving
   arguments. Knowing that cells exist beneath members, and that the framework unwraps them on the way in, invites the
   supposition that something reading "outside" the framework must do the unwrapping itself.
4. **Escalation by local patching.** `bioreportr.list.read` began as a local helper in one file. Each later site was
   given the same treatment, then the double application `read(read(x).y)` for safety, and finally the helper was
   promoted to the framework with a doc comment asserting the fault as fact - without a reproduction ever being
   recorded at any step.

## Tests and results

All scripts are kept in the session's scratchpad; their essential parts are given here. None writes into the project.

### 1. Minimal model, node

A component with a `taxa` subcomponent shaped like `hortis.taxa`, whose proxy is captured by a `$bindable` and by an
`$effect` and read later from a timer, as an event handler would:

```js
fluid.def("t.taxa", {$layers: "fluid.component", indexed: "$compute:t.index({self}.rows)", rowById: "{self}.indexed.rowById"});
fluid.def("t.storyPage", {$layers: "fluid.component", taxaRows: [{id: "a"}],
    taxa: {$component: {$layers: "t.taxa", rows: "{t.storyPage}.taxaRows"}},
    grab: {$bindable: {bind: "t.capture({self})"}},
    grabEffect: "$effect:t.capture({self})"});
```

Result: `captured.taxa`, `captured.taxa.rowById` and `captured.taxa.indexed` are all plain objects.

### 2. Minimal model across a turnover, node

As 1, with the page's layer redefined after the proxy is captured, so that the component turns over - the case of a
listener bound once and kept across the later arrival of layers in the browser.

Result: the proxy captured before the turnover still reads `taxa`, `taxa.rowById` and `statusById` as plain objects.

### 3. The real story page, node

`docs/story/index.html` booted with `fluid.loadAndBootDocument`, as `npm run hydrate` does, with every non-`file:` fetch
blocked and nothing written, then read after `fluid.cell.settle()`.

First, through the raw instance, `pathToComponent["story-4"].that`:

```
sp.taxa                isSignal: true
sp.taxa.rowById        undefined
sp.statusById          isSignal: true
sp.pkg                 isSignal: true
sp.curation            isSignal: true
read(read(taxa).rowById)   1750 keys
```

which reproduces the symptom - but this is not what any call site holds. Then through `{storyPage}` exactly as each
call site receives it - `fluid.flattenSignals(fluid.fetchContextReference(...))` for the `{self}` of the atlas panel's
`$bindable`, for the `{storyPage}` of the Lost Plants pane's `$bindable`, and as captured by actually invoking the
list's `download()` `$method`:

```
$bindable {self} (atlasPanel)        taxa: object(9) rowById: object(1750) statusById: object(1099) pkg: object(2)
$bindable {storyPage} (lostPlants)   taxa: object(9) rowById: object(1750) statusById: object(1099) pkg: object(2)
$method {storyPage} (list)           taxa: object(9) rowById: object(1750) statusById: object(1099) pkg: object(2)
```

and with `bioreportr.read` and `bioreportr.list.read` replaced by the identity function:

```
currentRows without read: 1101 rows
currentRows with read:    1101 rows
```

### 4. The built site in a browser

The built Saanich site, `docs/`, served on localhost and driven by Puppeteer's headless Chromium 109, with every
request off localhost blocked. Each check was run as built, and again with `bioreportr.read = v => v` set after load
(which also disables `bioreportr.list.read`, an alias of it):

* **Download list** - a real click on the list's CSV button, with `hortis.downloadCSV` captured
* **iNat card to Atlas** - a real capturing click on a "Most common" card of the Community Science pane, with only
  `bioreportr.inatSpecies.byName`, the iNaturalist lookup, stubbed to name a species of the atlas
* **Lost Plants card** - `bioreportr.lostPlants.open` on a card of the gallery's first plant, as a click on a card's
  front invokes it. The gallery renders no cards of its own with iNaturalist blocked, so a card was constructed with
  its `data-taxon-id`

| Check | As built | Without `bioreportr.read` |
|---|---|---|
| Download list | 1101 rows, 6 columns | 1101 rows, 6 columns |
| iNat card to Atlas | jumps to `#pane:Status&taxon:47359` | the same |
| Lost Plants card | 1230 characters of back face, Viola howellii, no error | identical |

No console error arose from any of these paths - all were failures to fetch the blocked iNaturalist data.

Not covered: a genuine click on a gallery card rendered from iNaturalist's photos, and the Howe Sound site, which does
not yet have these call sites.

## Recommendation

Remove `bioreportr.read` from `story.js` and `bioreportr.list.read` from `bioreportr-list.vue`, and return the call
sites to plain reads - `storyPage.taxa.rowById` in `bioreportr-atlasPanel.vue` and `bioreportr-lostPlantsPane.vue`, and
plain reads of each member in `bioreportr.list.currentRows`. Should a read from an event handler ever seem to yield a
cell, reproduce it through the proxy the handler actually holds before working around it, and if it is real, report
it against Infusion rather than wrapping reads in the framework.

## Removal, built and tested

`bioreportr.read` and `bioreportr.list.read` were then removed and the plain reads restored, the site rebuilt with
`npm run build`, and the browser checks of section 4 repeated against the rebuilt `docs/`, unpatched: Download list
1101 rows, iNat card to Atlas jumps to `#pane:Status&taxon:47359`, Lost Plants card back 1230 characters with no error,
and the list's title, query, area and file name computed without error. The hover bindings of the Protected Areas and
Remembering panes were also bound.
