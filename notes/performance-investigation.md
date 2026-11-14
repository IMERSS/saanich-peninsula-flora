# Startup performance of the story page

An investigation, in November 2026, of where the Saanich story page spends its time before it can show anything, and
what might be done about it. It covers how the time divides between transferring, parsing and processing the data,
how much caching would help, whether another format for the data would, and a first fix, to imerss-bioinfo.

## How it was measured

In headless Chrome, driven by the browser tool `~/.claude/tools/browser-check.js`:

* Against the live site, `https://imerss.github.io/saanich-peninsula-flora/`, from this machine's own connection,
  unthrottled - the tool permitting that origin alone, by `--allow-origin`.
* Against a local server imitating GitHub Pages - serving gzip, an `ETag`, `Last-Modified` and
  `Cache-Control: max-age=600`, and answering revalidation with `304`, as `curl` showed the live server to do. Chrome's
  own emulation then gave:
  * a desktop: 50 Mbit/s, 30 ms latency;
  * a phone: 9 Mbit/s, 150 ms latency, and a CPU slowed fourfold.
* Each scenario was loaded cold (cache emptied), as a return visit within `max-age`, and by the reload button.
* A timing script, run before the page's own, recorded when each data file's fetch began, when its headers arrived,
  when its body had been read, the time of each CSV parse, long tasks on the main thread, the first paint, and the
  moment the story page was revealed - when `imerss-loading` leaves `.imerss-main`.
* CPU profiles and call counts showed where the main thread's time went.

Scenarios were run once each. Desktop timings varied by about ±0.5 s between runs.

## Where the time goes

Nearly all the cost is one file, the observation catalogue,
`Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv`: 216,906 rows by 24 columns, 39.8 MB of CSV
and 6.5 MB gzipped. The page's other data adds about 0.2 MB gzipped.

| | Desktop, 50 Mbit/s | Phone: 9 Mbit/s, 150 ms latency, 4× slower CPU |
| --- | --- | --- |
| Page and scripts load, data requested | about 0.75 s | about 3.4 s |
| Catalogue transfer | about 1.5 s | about 6.3 s |
| CSV parse (`Papa.parse`) | about 0.9 s | 3.3 s |
| Everything else until reveal | about 1.8 s | about 6 s |
| **Revealed, cold** | **5.0 s** | **19.5 s** |
| **Revealed, return visit** | **3.0 s** | **9.9 s** |

The live site, from this machine's connection, revealed in 3.2-3.7 s, consistent with these.

On the phone, the parse and most of what follows run as one task of 8.1 s, during which the page is frozen. A profile of
a desktop load shows what fills it besides the parse:

* The map's query of the observations within its viewport, `hortis.libreMap.viewportObs`, ran 10 times during one load,
  as the map moved into place - calling `hortis.libreMap.hasCoords` 1.95 million times, nine times for each row, each
  call converting the row's coordinate strings to numbers afresh.
* `bioreportr.hasCoordinates` and `hortis.updateBounds` each passed over every row twice.
* Garbage collection took about 0.65 s, mostly from the churn of building 217,000 row objects.

Those repeated passes cost about 0.8 s on the desktop, and probably 2-3 s on the phone. Infusion's own reactive
framework took only about 0.3-0.4 s. Before the first data arrives, the page shows only its banner - at about 0.4 s on
the phone - since the main area is hidden until the reveal.

## Would an ETag, and caching in local storage, help?

* **The ETag is already there.** GitHub Pages sends one, with `Cache-Control: max-age=600` and gzip, and answers
  revalidation with `304` and no body. So the browser's HTTP cache already removes the transfer on a return visit - on
  the phone, 19.5 s becomes 9.9 s. What remains is CPU work, which no cache of the file itself can avoid.
* **Local storage can't hold the catalogue**: it is limited to about 5 MB of strings, and the CSV is 40 MB.
* **Caching the parsed rows in IndexedDB** is the realistic form. Restoring them took 0.75 s on the desktop and about
  1.8 s on the phone, against about 1.3 s and 4.1 s to read the cached file and parse it - saving about 0.5 s and 2-3 s,
  on return visits only. Writing the cache takes 1-2.7 s, which could be done once the page is revealed.

## Would a format "ready to go" help?

Each format below was measured producing the same 216,906 row objects which the code works with, from its gzipped file:

| Format | gzip | Turned into rows, desktop | Turned into rows, 4× slower CPU |
| --- | --- | --- | --- |
| CSV (now) | 6.5 MB | 0.85 s | 3.1 s |
| JSON, one object per row | 7.8 MB | 0.34 s | 1.1 s |
| JSON by column | 5.1 MB | 0.50 s | 1.6 s |
| SQLite via sql.js | 8.4 MB | 2.6 s | 11.5 s |

The times are medians of three runs, and leave out reading the body as text - cheaper for column JSON (0.5 s) than for
row JSON (0.9 s).

* **JSON by column** is the best of these: on a cold phone load it would save about 1.3 s of transfer and 1.5 s of CPU,
  roughly 2.8 s of 19.5 s.
* **SQLite is worse on both counts** - a bigger file, and slow conversion of its rows to JavaScript objects.
* **DuckDB-wasm** would add a multi-megabyte engine download - its package unpacks to 147 MB - to the same conversion
  cost. A database format pays only if the filtering and counting move into SQL queries, which would mean rewriting the
  atlas.

### What "JSON by column" means

Rather than an object for each row, repeating every field's name, the file holds one array for each field, the values
of row *i* at position *i* of each. Numbers can be written as numbers, and a field with few distinct values can be
written as small integers indexing a dictionary of them. For example, with values gathered from several records:

```json
{
    "rows": 3,
    "fields": {
        "occurrenceID": ["QFA0212927", "https://www.inaturalist.org/observations/266955914",
            "https://www.inaturalist.org/observations/231133475"],
        "eventDate": ["1967-06-14", "2025-03-25", "2024-07-14"],
        "decimalLatitude": [48.566667, 48.49592, 48.502147],
        "decimalLongitude": [-123.4, -123.416282, -123.398891],
        "BEC": {"dictionary": ["CDFmm", "CWHxm1"], "codes": [0, 0, 1]}
    }
}
```

The benchmark's version held only strings, as the CSV does, so the numbers and dictionaries would gain a little more.

## Bigger wins than any change of format

1. **Stop the repeated per-row passes** - done for the coordinates, see below.
2. **Slim the catalogue.** Five columns make up 90% of its compressed size: `occurrenceID` (24%), `eventDate` (24%),
   `recordedBy` (15%) and the two coordinates (27%). Most of the rest are 96-100% empty.
   * 95% of the dates carry a time of day. If only the day is used, the column compresses from 1.16 MB to 0.28 MB.
   * Coordinates to 5 decimal places, about a metre, would compress about 0.2 MB smaller.
   * Fields only needed to show a single record could load after the page is revealed.
   * Shortening the iNaturalist URLs of `occurrenceID` gains little, since gzip already compresses their common prefix.
3. **Parse in a Web Worker**, so that the phone is not frozen for seconds - the total time is the same, but the page
   could respond meanwhile.

## The first fix: each row's position parsed once

Six places parsed an observation's position from its coordinate strings, each on every pass: `hasCoords` and
`viewportObs`, the bounds of the observations, the grid's `cellIds` and `indexObs`, the polygon filter's point cache in
`polygonDraw.js`, and `bioreportr.hasCoordinates` and `bioreportr.obsPoint` in the story's `solow.js`.

A single accessor in imerss-bioinfo, `hortis.rowPoint(row)`, now parses a row's `[longitude, latitude]` once and keeps
it on the row under `hortis.pointSymbol` - the key at which `geoJSON.js`'s `hortis.intersectsAnyFeature` already read a
point, and which the polygon filter previously filled in a `Map` of its own, now gone. It is kept on the bare row, since
a write through a component's proxy would be taken as one to the component's state. Each caller keeps its own rule of
what counts as a position: `bioreportr.hasCoordinates` still rejects a zero in either coordinate.

It also fixes a latent bug: `hortis.obsBounds` passed the coordinate strings to `Math.min`, which reads an empty string as
0, so that the bounds of all observations stretched to latitude 0 if any lacked a position. These bounds are used only
when nothing is gridded.

| | Before | After |
| --- | --- | --- |
| Per-row work in a warm desktop load, from a profile | about 1.0 s | about 0.25 s |
| Phone, cold | 19.5 s | 18.1 s |
| Phone, return visit | 9.9 s | 8.7 s |
| Phone, reload | 9.6 s | 8.7 s |
| Phone, the frozen task | 8.1 s | 6.7 s |
| Desktop, cold | 5.0 s | 4.7 s |
| Desktop, return visit | 3.0 s | 2.7 s |

`viewportObs` still runs 10 times during startup, now over parsed numbers, at about 0.1 s in all on the desktop. A
polygon drawn over the Saanich Peninsula keeps 21,552 of the 216,906 records both before and after the change.

## Next steps: a principled form for the data

### Column JSON against Parquet or Arrow

Column JSON's advantage is that the browser parses it natively: `JSON.parse` is C++ inside the browser, needing no
library and no WebAssembly, and gives numbers as numbers. Parquet compresses better, but must be decoded by a
WebAssembly library of a megabyte or more, in more CPU time than the bytes saved would take to transfer. Apache Arrow's
IPC format is close in spirit to column JSON, with dictionary encoding built in and numeric columns readable without
copying - but it needs the `apache-arrow` library, of a few hundred kilobytes, and its strings must still be decoded
into JavaScript values before code which works with row objects can use them. Column JSON keeps the cost to the
browser's own parser, and the shape of its values close to what the code uses.

### Uniform data preparation, with hashes for caching

It is reasonable to move towards one R helper, beside `timedWrite` in `scripts/utils.R`, which every pipeline calls to
write its tables in column JSON together with a small descriptor listing each file with a hash of its contents - e.g.
by the `digest` package. The page would fetch the descriptor alone afresh, and restore any table whose hash matches one
already cached in IndexedDB, rather than fetching and parsing it. Columns of numbers restore from IndexedDB far more
cheaply than 217,000 row objects, which took 0.75 s on the desktop here - that is yet to be measured.

### A relational description: Frictionless Data Packages

The regionIndirection file is a dimension table: `intersectShapes.R` writes each observation's BEC zone as a small
integer, and `regionIndirection.csv` maps (`regionField`, `id`) to the zone's label - a foreign key, kept by hand. The
well-attested scheme for describing such packages of tables is the [Frictionless Data
Package](https://datapackage.org/): a `datapackage.json` listing each resource with its path, size and hash, and a Table
Schema giving its fields' types, its primary key and its foreign keys - e.g. that `obs.BEC` refers to `regions.id`. It is
maintained by the Open Knowledge Foundation, and written from R by rOpenSci's `frictionless` package. A descriptor of
this kind would serve as the descriptor of hashes above, and make the indirection a declared relation which a generic
loader in imerss-bioinfo could resolve, rather than code of its own. Its tables would be written in column JSON - the
standard allows any format for a resource - with dictionary-encoded columns where a field has few values.

## Reproducing

The plans and scripts of the study were left in the session's scratchpad, not in the project. The browser tool's
extensions it used - `--allow-origin`, the GitHub Pages server mode, network and CPU emulation, the timing script, and
the `reload`, `clearCache` and `emulate` steps - remain in `~/.claude/tools/browser-check.js`.
