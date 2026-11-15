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

## Second round: what remains, and what other architectures would give

These were measured after the fix above, on the same scenarios.

### "Everything else" before the reveal

The page's Single File Components load as a chain of fetches, but it finishes long before the catalogue arrives - by
1.8 s on the desktop and 6.9 s on the phone - so it is not on the critical path. After the catalogue arrives, everything
up to the reveal runs as one long task and one short one:

| | Desktop | Phone |
| --- | --- | --- |
| Long task, including the parse | 1.8 s, of which the parse 0.9 s | 6.7 s, of which the parse 3.1 s |
| Short final task, rendering | 0.17 s | 0.77 s |

Within the desktop's long task there is no longer any single large constituent:

| Constituent | Time |
| --- | --- |
| Papa Parse | about 665 ms |
| Garbage collection, from building 217,000 row objects | 521 ms |
| About a dozen separate passes over every row, each 45-100 ms | about 700 ms in all |

The largest of those passes are `saanich.lostPlants.select` (101 ms), the filters' `hortis.filters.evaluate` (77 ms),
the grid's `cellIds` (75 ms) and `indexObs` (69 ms), `saanich.traces.buildEvents` (59 ms) and the map's
`recordIndex` (56 ms). Infusion's reactive framework adds little within the task.

### Slimming the remaining passes without a rewrite

Most of them derive the same few things from every row, or group the rows by taxon:

* `saanich.groupRecords` builds an index of records by taxon, but `saanich.annotateGeoref` and
  `saanich.lostPlants.select` each count the records by taxon again, and `bioreportr.solowObsForTaxon` and
  `saanich.js` filter every record to find one taxon's.
* The Traces pane and three places in `saanich.js` copy and re-sort each taxon's records by date, comparing strings.
* `saanich.recordPeriod` runs separately for the story and for the time period filter, each over every record.
* `hortis.filters.evaluate` runs each active filter as a separate pass.

So, in the pattern of `hortis.rowPoint`:

1. **One pass at load building a shared index by taxon** - each taxon's records sorted by date once, with its count,
   number unmapped, and first and last year. The passes above then read that summary, over about 1,755 taxa rather
   than 216,906 rows, and the record period follows from it.
2. **Per-row values derived once and kept on the row** - a row's year and day number, its record id and its grid cell -
   so that sorts compare numbers.
3. **The filters' predicates fused into one pass**, and the grid's `cellIds`, `indexObs` and the map's `recordIndex`
   brought into one.
4. **The Traces and Lost Plants panes' computations deferred** until their pane is opened.

Together these should save roughly 0.4-0.5 s on the desktop and 1.5-2 s from the phone's frozen task. The garbage
collection from building row objects would remain.

### Column JSON, in place

A copy of the published site was made with each of Saanich's data CSVs replaced by column JSON under the same name -
string columns of few distinct values dictionary-encoded - and its CSV loader patched to decode either into exactly the
row objects Papa Parse produces, so that the rest of the code ran unchanged. It gave the same 216,906 records and 1,755
taxa, an identical sample record, and the same cell tooltip and selection. The catalogue became 4.6 MB gzipped, from
6.5 MB.

| | CSV, after the fix | Column JSON |
| --- | --- | --- |
| Desktop, cold | 4.7 s | 3.7 s |
| Desktop, return visit | 2.7 s | 1.9 s |
| Desktop, reload | 2.5 s | 1.8 s |
| Phone, cold | 18.2 s | 14.3 s |
| Phone, return visit | 8.5 s | 7.1 s |
| Phone, reload | 8.8 s | 6.4 s |

So column JSON alone, with the same rows and code, saves about a second on the desktop and about 4 s on a cold phone
load. The column site's return visits took about 2.0 s to `DOMContentLoaded` against about 1.3 s for the others -
probably an artefact of the experiment, whose patched page was a real file amongst links, in which case its return
visit would be about 0.7 s faster still.

### Caching in IndexedDB: string or structured?

* **A string for `JSON.parse` gains little**: the HTTP cache already holds those bytes, so the parse and the building of
  rows would still be paid on every visit.
* **Structured row objects are slower than parsing JSON**: restoring the 216,906 rows from IndexedDB took 0.75 s, where
  `JSON.parse` of the same rows took 0.34 s.
* **Typed arrays are the fast structured form**: a `Float64Array` or `Int32Array` is restored as one block of memory.
  Columns of many distinct strings - `occurrenceID`, `eventDate`, `recordedBy` - are best kept as one JSON string each,
  parsed only when a record is shown.

Caching pays only once the page stops building a row object for every record at startup, which leads to the next
question.

### A query-based architecture

Two forms of it were measured, each answering the queries a first view needs - the grid's counts and species per cell,
counts per taxon with their unmapped records and first and last years, the bounds and record period, and the grid under
a year filter - with identical results from both: 626 cells, 1,105 taxa, and 277 cells under the filter.

* **SQLite, through sql.js**: a startup database of each observation as typed columns and integer codes - taxon,
  recorder, basis of record, BEC zone - with its free text in a separate details database, fetched only when a record is
  shown.
* **Typed-array columns**, queried by plain loops in JavaScript: coordinates as 32-bit floats - changing no position by
  more than 0.28 m - the date as a day number, and the codes as small integers.

| | SQLite (sql.js) | Typed-array columns |
| --- | --- | --- |
| Startup data, gzipped | 5.1 MB, and details 3.9 MB | 1.63 MB, and about 0.12 MB of dictionaries and taxa |
| Engine | 314 KB, starting in 9 ms / 27 ms | none |
| Opening or decoding | 4 ms / 14 ms | about 20 ms / 90 ms from JSON - nearly nothing as binary |
| Startup queries | 267 ms / 1.1 s | 14 ms / 43 ms |
| With species by status per cell | 465 ms / 1.9 s | could be computed per cell on demand |

Times are desktop / 4× slower CPU. SQLite is slow at aggregation, processing one row at a time in WebAssembly, and its
file compresses poorly, with each coordinate an 8-byte float. Storing each row's cell id would cut its grid query, but it
would remain far behind typed arrays.

Projected times to reveal, combining these with the page's time before it requests its data, transfer at the emulated
bandwidths, and the final render as now:

| | CSV now | Column JSON, rows unchanged | Query-based, SQLite | Query-based, typed arrays |
| --- | --- | --- | --- | --- |
| Desktop, cold | 4.7 s | 3.7 s | about 2.3 s | about 1.3 s |
| Desktop, return visit | 2.7 s | 1.9 s | about 1.0 s | about 0.6 s |
| Phone, cold | 18.2 s | 14.3 s | about 11 s | about 6 s |
| Phone, return visit | 8.5 s | 7.1 s | about 4 s | about 2.3 s |

The first two columns are measured, the last two projected. Typed-array columns, with a small query layer over them -
filtering, grouping, and ordered ids - give nearly all the gain without an engine, and with a quarter of the transfer.
DuckDB-wasm aggregates far faster than SQLite, but its engine of several megabytes would cost more than it saves on a
phone's cold load.

Once the data's cost is gone, the phone's 3.4 s before the page requests its data would be over half of a cold load -
the boot of Infusion and the loading of the page's scripts, the largest of which are Plotly (3.6 MB) and MapLibre
(2.2 MB). Loading those only when their panes open would be the next thing to try.

### Scrolling the tables with a query per block

`hortis.dataTable` renders a window of its rows in blocks of at least 20, re-rendering as scrolling crosses a block, and
sorts a full copy of its rows on any change of sort. In a query-based architecture each block crossed would be a query:

| | Desktop | 4× slower CPU |
| --- | --- | --- |
| One block of 80 rows fetched by id, with its displayed text from the details database | about 1 ms | about 3 ms |
| A whole fast drag through the table, 60 blocks | 38 ms | 156 ms |
| One block 200,000 rows deep by `OFFSET`, no index | 191 ms | 850 ms |
| The same, with an index on the column sorted by | 5 ms | 20 ms |
| Ordered ids for a new sort of all rows, by date or by recorder | 96 / 169 ms | 381 / 701 ms |
| Ordered ids for a filter or one taxon | 6-8 ms | 25-33 ms |

Scrolling would not suffer if each change of filter or sort ran one query for the ordered ids of the rows matching,
kept as an `Int32Array`, and each block fetched its rows by id - far cheaper than rendering those rows. The cost moves to
the sort, about what the current code spends on its own sort of every row. A query per block by `OFFSET` with no index
would be noticeably slow, at up to 850 ms a block on the phone. The details database's text could be fetched after the
reveal, or read a page at a time through HTTP range requests, as `sql.js-httpvfs` does - GitHub Pages serves ranges.

### Binary columns: a hand-rolled blob against Arrow IPC

Since bulky libraries such as Plotly are to be dropped or slimmed, the size of anything added counts. Two binary
encodings of the catalogue were built and measured, both split as the SQLite experiment was: a startup file of every
column but the free text, and a details file of `eventDate` and `occurrenceID` as text.

* **A hand-rolled blob**: a 4-byte length, a JSON header giving each column's type, offset and length, and its
  dictionary if it has one, then each column's buffer, aligned to 8 bytes. The reader takes typed-array views of the
  buffers, copying nothing, in about 50 lines and with no library. Text is one UTF-8 buffer with an `Int32Array` of
  offsets, decoded by `TextDecoder` a value at a time.
* **Apache Arrow's IPC file**, written and read by Arrow JS 18.1.0, whose metadata is FlatBuffers and whose buffers
  are likewise viewed in place.

Coordinates are written to at most 7 decimal places, so they are stored exactly as `Int32` multiples of 10⁻⁷, the
same size as the 32-bit floats measured earlier, which moved positions by up to 0.28 m. The uncertainty and the day
number are `Int32`, the year `Int16`. Every other field, down to `locality` with its 3,009 values, is a dictionary of
`Uint8` codes, or of `Uint16` codes for the 7,508 recorders, 7,411 catalogue numbers and 1,105 taxa. The catalogue
holds one record whose latitude and longitude are `outside_boundary`. The blob reads it as missing, assuming data
preparation will filter out such records.

| | Raw | gzip | brotli |
| --- | --- | --- | --- |
| CSV, all fields | 39.8 MB | 6.67 MB | |
| Column JSON, all fields | 45.4 MB | 5.17 MB | |
| SQLite startup / details | 9.8 / 21.9 MB | 4.99 / 3.93 MB | |
| Blob startup / details | 10.8 / 17.5 MB | 2.45 / 3.59 MB | 2.25 / 2.71 MB |
| Arrow startup / details | 10.9 / 17.5 MB | 2.56 / 3.59 MB | 2.33 / 2.71 MB |

The startup file is larger than the 1.63 MB measured earlier for typed arrays, because it holds codes for all 22
fields. The startup queries read only four of the observations' fields - latitude, longitude, taxon and year - which
alone are 1.35 MB gzipped; the rest could move into the details file, or a third file of filterable codes. Every
byte is still kept: the startup and details files together are smaller gzipped than the CSV, and either half alone is
smaller than column JSON.

Times are desktop / 4× slower CPU, with no network emulation, so the fetch times only reflect the local server:

| | Blob, by HTTP gzip | Blob, by `DecompressionStream` | Arrow, by HTTP gzip | Arrow, by `DecompressionStream` |
| --- | --- | --- | --- | --- |
| Library, loaded and run | none | none | 3-11 ms / 5-20 ms | 1-4 ms / 6-7 ms |
| Fetch and decompress | 120 ms / 170 ms | 30 ms / 115 ms | 117 ms / 166 ms | 30 ms / 117 ms |
| Decode to views | 4 ms / 12-18 ms | 3 ms / 12-37 ms | 17-27 ms / 76-142 ms | 18-22 ms / 75-83 ms |
| Coordinates to Float64 | 3 ms / 9-13 ms | 3 ms / 10-13 ms | 3 ms / 9-16 ms | 6 ms / 15-18 ms |
| Startup queries | 16-30 ms / 45-65 ms | the same | the same | the same |

The typed-array case decoded from column JSON took 656-714 ms / 1.5-1.67 s to fetch and parse, then 20 ms / 85-94 ms
to build its columns. The binary files remove nearly all of that.

* **No decompression library is needed.** GitHub Pages gzips `application/octet-stream` as it does text, as a
  request to flatgeobuf.org, a Pages site, showed for a 7.9 MB `.fgb` file. A `.bin` or `.arrow` file is therefore
  decompressed by the browser's network stack. `DecompressionStream("gzip")`, native in current browsers, does the
  same for a pre-gzipped file on hosts which don't compress. The local server gzips each response as it sends it,
  which accounts for the HTTP cases' longer fetch here. GitHub Pages sent only gzip, never brotli, although brotli
  would save a further 8-25%.
* **Arrow costs 173 KB minified, 46 KB gzipped**, and a decode of 20 ms / 80 ms, mostly in turning its dictionaries
  into arrays. It handles nulls, nested types and record batches, which this data doesn't need, and can be written
  from R by the `arrow` package (`write_ipc_file(df, compression = "uncompressed")`, which writes factors as
  dictionaries). Its output would need no code of the project's own to define its format.
* **The blob costs nothing to load** and decodes in 4 ms / 15 ms. Its format is the project's own, and R could write
  it with `writeBin`, a step beside `timedWrite` in `scripts/utils.R`.
* **Either fits a Frictionless Data Package** as a resource with a `mediatype` (`application/vnd.apache.arrow.file`
  for Arrow), a `bytes` size and a `hash`, with a Table Schema describing its fields and foreign keys. The standard's
  tabular profile and its validators read only delimited text and JSON, so neither encoding's contents would be
  validated by generic tools. Arrow, as a recognised format, leaves the way open for them.
* **Protocol Buffers would not serve.** They encode messages field by field, with variable-length integers, and must
  be decoded in full into objects - the cost Papa Parse imposes now. Their zero-copy relatives are FlatBuffers and
  Cap'n Proto. Arrow combines FlatBuffers metadata with columnar buffers, and the blob is the same design reduced to
  what this data needs.

The earlier note that Arrow's strings "must still be decoded into JavaScript values" holds only where code works with
row objects. In a query-based architecture only the dictionaries and the text of the records shown are decoded.

On the phone's 9 Mbit/s link the startup file would take about 2.2 s to transfer, against 5.9 s for the CSV, or about
1.2 s if the fields the startup queries don't use moved into the details file. The details file would take a further
3.2 s, fetched after the reveal. Projected reveal times are therefore as in the typed-array column above, at a cost of
no library for the blob, or 46 KB for Arrow. The blob is the better fit while the data stays flat and the bundle is
being slimmed. Arrow is the better fit if the data is to be read by other tools, or comes to need nulls and nested
values.

## Reproducing

The plans and scripts of the study were left in the session's scratchpad, not in the project. The browser tool's
extensions it used - `--allow-origin`, the GitHub Pages server mode, network and CPU emulation, the timing script, and
the `reload`, `clearCache` and `emulate` steps - remain in `~/.claude/tools/browser-check.js`.
