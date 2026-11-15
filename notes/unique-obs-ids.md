# Unique ids for observation records

The catalogue's `occurrenceID` is not unique: 1,184 ids are shared by 2,380 of its 216,906 rows. Community curation
names a record by this id - a note on a record carries it as `recordId`, and the URL selects a record as
`record:<occurrenceID>` - so for these rows a note or a selection may refer to the wrong record. Figures are from
`Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv`.

## Does GBIF not assign unique ids?

GBIF does assign a unique id to every occurrence, `gbifID`, and the catalogue has that column. But only 9,276 rows,
about 4%, have one, since most records did not come through GBIF. None of the 206,458 iNaturalist rows has a
`gbifID`: they come straight from iNaturalist, keyed by their observation URL. Where `gbifID` is present it is unique.

## Nearly all clashes are duplicate records, not clashing ids

Nearly every shared id is one specimen or observation which reached the catalogue through two sources, often with
some details differing between the copies. For example:

* **The same iNaturalist observation twice.** `https://www.inaturalist.org/observations/276233132` appears once dated
  `2025-04-26` with institution `iNaturalist`, and once dated `2025-04-26T11:25:00-07:00` with no institution. These
  look like two different iNaturalist exports.
* **The same Royal BC Museum specimen twice.** `RBCM:Botany:V188050` appears once from GBIF, with coordinates,
  catalogue number and `gbifID` 1949636303, and once from another source with none of these.
* **A wrong date on one copy.** University of Lethbridge specimen `4049`, *Adiantum aleuticum* var. *aleuticum*
  collected by A.S. Harrison, is dated 1967-05-17 in one copy, with its catalogue number, coordinates and `gbifID`,
  and 2025-04-26 in another with none of these. In 46 groups one copy carries a 2025 date, which looks like an entry
  date written into `eventDate`.
* **Differing determinations, days or spellings.** National Museum of Canada specimen `CAN10091202` appears as
  *Achnatherum nelsonii*, ssp. *dorei* and ssp. *nelsonii*. New York Botanical Garden specimen
  `5f533794-ef78-4895-9b68-4df7d326fc8b` is dated 1893-07-13 in one copy and 1893-07-21 in the other. Recorders are
  spelt differently, e.g. `Ewan, S.;Pugsley, L.` against `Ewan, S.; Pugsley, L.`.

This is a deduplication problem for the R pipeline. A record and its duplicate also both count in the totals.

The only genuine collisions are 6 ids, on 12 rows, of records cited from *Flora of the Saanich Peninsula*
(Szczawinski and Harrison, 1972), whose `occurrenceID` is a page number. `p. 78`, for example, is both *Allotropa
virgata* (J.R. Anderson, 1898) and *Chimaphila menziesii* (G.A. Hardy, 1943). `p. 41`, `p. 79`, `p. 73` and `p. 30`
are likewise each two species. `hortis.libreMap.recordIndex` gives each of these ids to whichever row comes first, so
the other species' record cannot be selected or annotated.

## Suggested fix

1. **Deduplicate in data preparation.** Treat rows sharing an `occurrenceID` as copies of one record, even where their
   date, determination or recorder differ. Keep the richest copy - with coordinates and a `gbifID` - and report the
   differences, which are themselves errors to correct, the 2025 dates especially.
2. **Choose each record's key in this order:**
   * the iNaturalist observation URL, or its number, for iNaturalist records
   * `gbifID` where there is one
   * otherwise a qualified `occurrenceID`: one already namespaced, such as `RBCM:Botany:V…`, as it is, and a bare number
     prefixed with its institution
   * for a record cited from the literature, its source, page and taxon, e.g. `FSP:p.78:Allotropa virgata`
   * as a last resort, a hash of the record's source fields, e.g. by the `digest` package
3. **Report anything still clashing** as an error in the pipeline, rather than letting it reach the site.

Doing this before any curation note refers to one of the clashing ids keeps the existing `recordId`s valid, since a
unique id is left as it is. Whether any note in `static/curation/observations.csv` already refers to one is yet to be
checked.

The key would be the primary key of the observations in the data package proposed in `performance-investigation.md`,
stored with the details rather than in the startup files. The row index serves only within one build: keys in URLs,
curation notes and caches must be `recordId`, since rows' positions change from build to build.
