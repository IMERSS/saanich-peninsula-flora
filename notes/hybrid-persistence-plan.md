# A hybrid plan for loading and querying a story's data

A plan, from November 2026, for letting the same visualisation code either download a story's whole dataset to the
client, as now, or send its queries to a server, chosen by configuration. It follows from
`notes/performance-investigation.md`, which found binary typed-array columns the best form for the downloaded data.
Two of the projects now approach 300,000 records. Columnar data on the client should serve up to about a million, but
not much further.

## Why SQLite was slow at aggregation

The study found SQLite, through sql.js, about twenty times slower than plain loops over typed arrays at the startup
queries: 267 ms against 14 ms on the desktop. The cause is not query planning. The queries are as simple as queries
get: one scan of a single table of observations, a conjunction of predicates, a `GROUP BY` on the grid cell or the
taxon, and `COUNT`, `COUNT(DISTINCT taxon)`, `MIN` and `MAX`. There is nothing for a planner to choose between, so all
the cost is in the scan, and SQLite is close to the worst design for that:

* it stores rows, not columns, decoding every record from its pages even to read four of its fields;
* it works one row at a time, each through its bytecode virtual machine, itself interpreted in WebAssembly;
* it groups by sorting, through its sorter or a temporary B-tree.

DuckDB, being columnar and processing values in batches, comes close to the loops' speed. What a mature engine really
offers is general joins, window functions, nulls and string functions, which a story's first view barely needs.

## Queries as data, not SQL strings

Rather than have filters emit snippets of SQL, have them emit a small structured description of their query, in the
declarative manner of the rest of Infusion:

```js
{
    from: "obs",
    where: [
        {field: "year", op: "between", value: [1990, 2026]},
        {field: "BEC", op: "in", value: [3, 5]}
    ],
    groupBy: ["cell"],
    measures: {records: "count", species: {countDistinct: "taxon"}}
}
```

A filter contributes predicates to `where`, and a view - the grid, the checklist, a table - contributes `groupBy` and
`measures`. Several backends can answer the same description:

1. **A local columnar executor**, compiling the predicates into one fused loop over the typed arrays - the general form
   of the fused filter pass proposed in the investigation. It serves up to about a million records.
2. **A SQL compiler for a server**, turning the description into SQL for DuckDB or Postgres behind a thin HTTP or
   GraphQL endpoint. This is the path beyond a million.
3. **A cache**, answering a query from stored results without executing it - see below.

The two strategies then differ only in configuration naming the backend - a layer in the project's
`<project>-story.vue` - and the filter, map, grid and table components never see the difference.

`fluid.microsql` in Infusion 6 (`src/framework/core/js/FluidMicroSQL.js`) is not the starting point for this. It parses
SQL text and runs it over arrays of row objects, the wrong direction on both counts: SQL should be something produced
for a server, not parsed, and row objects are what the columnar design stops building.

## A persistent query cache: hydrating data as well as markup

Since the data is read-only, each build of the data package gives each table a hash. A cached result keyed by the hash
of the data together with the hash of the query in a canonical form can never go stale and needs no invalidation. This
is what makes an engine of our own reasonable rather than reckless.

It extends the existing hydration, which caches the page's rendered markup, to its data:

* **At build time**, `npm run hydrate`, already running in Node, also runs the local executor over the startup queries
  and the queries of the commonest filter states, publishing their results as small files of the data package.
* **On first load**, the page renders the grid, the counts per taxon and the bounds from those results, before any of
  the core columns have arrived.
* **Interactive queries** run on the local executor, or the server, once its data is there, and their results can be
  kept in IndexedDB under the same keys.

This is the materialised view, or "pre-aggregation", of OLAP systems, e.g. Cube.js. Its limit is well known: not every
combination of filters can be computed in advance, since their number multiplies. So the cache covers the startup view
and common states, and anything else is executed - which is cheap at these sizes.

## Our own engine, or a mature platform?

Split by side:

* **On the client, our own, kept small and closed.** The executor needs to handle only what the description can
  express: one table of facts, foreign keys resolved through dictionaries, a conjunction of predicates, grouping by up
  to two keys, and five aggregate functions. That is a few hundred lines, with no SQL parser or planner. The risk is
  creep - nulls, string matching, real joins - so the rule is that whatever the description cannot express is a
  request for the server backend, not a feature of the executor.
* **On the server, a mature engine, probably DuckDB.** It reads Parquet and Arrow directly, so that the R pipeline can
  publish one data package for both client and server. This shifts the investigation's preference a little: with a
  server in view, Arrow IPC, or Parquet beside the hand-rolled blob, is worth more than its 46 KB. A compromise is for R
  to write Parquet for servers and the blob for clients, from the same tables.

### Prior art

The Mosaic project of the University of Washington's Interactive Data Lab appears to do nearly what is described here:
charts and filter widgets publish structured queries, which a coordinator sends to DuckDB - in the browser through
WebAssembly, or on a server, by configuring a connector - caching their results and building pre-aggregated indexes to
keep cross-filtering interactive. Falcon, from the same group, does the same for brushing. This account is from memory
and is yet to be checked. Even if Mosaic is not adopted, its design is the closest precedent and worth studying first.

## Order of work

1. Define the query description, and port the existing filters to emit it, run first by a local executor over the
   current row objects, so that behaviour is unchanged.
2. Move the executor onto the columnar data package of `notes/performance-investigation.md`.
3. Add the build-time query cache to `npm run hydrate`.
4. Add the SQL compiler and a DuckDB endpoint, and try them on one of the projects of 300,000 records.

Each step is useful on its own, and only the last needs a server. The deduplication and unique record keys of
`notes/unique-obs-ids.md` are a precondition for the server, as for the columnar files.

## Spatial queries: the grid as a computed key

The most unusual query a story makes is the grid of counts drawn on the atlas map. In PostGIS's terms it is only a
computed grouping key - each point snapped to a grid, then a `GROUP BY` on the snapped value - so it needs not grid
machinery of its own, but a small family of spatial expressions usable wherever a field is.

### What PostGIS offers to borrow from

* **`ST_SnapToGrid(geom, size)` with `GROUP BY`**, the classic idiom for gridded counts, and what
  `hortis.obsQuantiser.coordToCellId` in imerss-bioinfo's `libreMap.js` does now:
  `floor(lat / latRes) + "|" + floor(long / longRes)`.
* **`ST_SquareGrid(size, bounds)` and `ST_HexagonGrid`**, which treat the grid as a table generating cells, each with
  integer indices `(i, j)`, for finding empty cells or joining cells to anything else. The current `"latIndex|longIndex"`
  strings are those indices, encoded as text.
* **`ST_Extent(geom)`**, an aggregate returning a bounding box - `hortis.obsBounds`, and the bounds kept in `indexObs`.
* **`&&` and `ST_MakeEnvelope`**, a test of overlapping bounding boxes served by a spatial index - what
  `hortis.libreMap.viewportObs` does, ten times during startup.
* **H3, in the `h3-pg` extension: `h3_lat_lng_to_cell(point, res)` and `h3_cell_to_parent`**, whose useful idea is a
  hierarchy of cells, a coarse cell's counts being the sum of its children's.
* **`ST_TileEnvelope` and `ST_AsMVT`**, aggregating per map tile at each zoom level - how a server would deliver the grid
  beyond a million records.

From standard SQL rather than PostGIS, the `FILTER` clause on an aggregate, e.g.
`count(*) FILTER (WHERE status = 'native')`, covers "species by status per cell" without any further grouping.

### A sketch of the syntax

```js
{
    from: "obs",
    // Named computed expressions, usable in where, groupBy and measures alike
    let: {
        point: {point: ["decimalLongitude", "decimalLatitude"]},
        cell: {snapToGrid: "point", size: {metres: 100, baseLatitude: 49}}
    },
    where: [
        {field: "year", op: "between", value: [1990, 2026]},
        {field: "point", op: "within", value: {bbox: [[-123.6, 48.4], [-123.3, 48.75]]}} // like &&
    ],
    groupBy: ["cell"],
    measures: {
        records: "count",
        species: {countDistinct: "taxon"},
        nativeSpecies: {countDistinct: "taxon", filter: [{field: "taxon.status", op: "=", value: "native"}]},
        bounds: {extent: "point"}
    }
}
```

* **A cell's value is a pair of integers `[i, j]`, not a string.** Selecting a cell becomes an ordinary predicate,
  `{field: "cell", op: "=", value: [i, j]}`, the same expression as in `groupBy`, so that the executor reuses the cell
  column it already computed, where `hortis.libreMap.gridSelector.doFilter` now scans every row itself.
* **`taxon.status` follows the foreign key** into the taxa table, as the data package declares it.
* **The SQL compiler needs nothing exotic**: `snapToGrid` becomes
  `floor(lat / :latRes)::int AS ci, floor(lng / :lngRes)::int AS cj`, which runs on DuckDB, Postgres or SQLite alike. A
  PostGIS backend could use `ST_SnapToGrid` and its index instead, but nothing depends on that.
* **Resolutions that nest allow rolling up.** If each resolution is a power-of-two multiple of the finest, a coarse
  grid's counts are the sums of its children's, as in H3. `countDistinct` does not roll up so, and needs the index of
  cells to taxa below.

### What the client's executor needs

1. **Point columns** - the blob's `Int32` coordinates at 10⁻⁷ degrees, already in the columnar design.
2. **A cell column for each resolution** - an `Int32Array` of a dense cell number for each row,
   `(i − iMin) × width + (j − jMin)`, computed once for each resolution, or at build time for the default one. It
   replaces the `Map` of row to string in `cellIds`. Over Saanich a grid of 100 m has on the order of a hundred thousand
   cells, so the number is small and dense.
3. **A selection** - the fused loop of the `where` predicates writes a bitset, a `Uint32Array` with a bit for each row,
   or an `Int32Array` of row ids when few rows pass. A measure's `filter` is a second bitset combined with the first.
4. **Accumulators indexed by dense cell number** - a count is `counts[cell[r]]++` into a `Uint32Array` of
   `width × height` entries, with no `Map` and no strings. For a grid too sparse for that, an open-addressing hash of
   `Int32` keys would serve instead.
5. **A static index of cells to taxa to rows, for `countDistinct`**, laid out as a compressed sparse row matrix: the
   rows sorted at build time by cell and taxon, with arrays of offsets from each cell to its run of taxa, and from each
   taxon to its run of rows. Under a filter, a cell's distinct species are the taxa of its run with at least one
   selected row. This is the typed-array form of the current `bucket.byTaxonId`, built once rather than at every
   gridding, and it also serves the taxon panel's records within a cell. For a key not indexed, the fallback is to pack
   group and value into one `Uint32`, sort, and count the runs.
6. **Rows ordered in space at build time.** If R sorts the observations by a Hilbert or Morton key of their cell, a
   cell's rows, and roughly a viewport's, are contiguous ranges, making `within` a few scans of ranges - the trick of
   FlatGeobuf's packed Hilbert R-tree. Since a row's position holds only within one build, the order is ours to choose.
7. **Results as columns** - a grid's result is
   `{i: Int32Array, j: Int32Array, records: Uint32Array, species: Uint16Array, ...}`, already in the blob's format, so
   that the build-time cache of the startup grid is one more blob of the data package, keyed by the hashes of its query
   and its data.

Beyond about a million records, the server's equivalent of 6 and 7 is to aggregate the grid in advance into tiles for
each zoom level, as `ST_AsMVT` does, which could even be hosted statically as PMTiles. That is the point at which
gridding leaves the client.
