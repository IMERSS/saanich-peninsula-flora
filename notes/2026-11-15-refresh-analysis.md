# 2026-11-15 data refresh - analysis

The 20 August published data compared with the 15 November rebuild, after the fix for duplicated list records (see
checklist-catalogue-alignment-workflow's notes/first-last-curate-bug.md):

| | 20 Aug | 15 Nov | Change |
|---|---|---|---|
| **Records** | 216,906 | 292,392 | **+75,486 (+35%)** |
| **Taxa** | 1,105 | 1,102 | −3 |
| Confirmed (recorded before 2000 and since) | 796 | 825 | **+29** |
| Historical (not recorded since 2000) | 138 | 112 | **−26** |
| Newly reported (first recorded since 2000) | 168 | 162 | −6 |
| Unknown status | 3 | 3 | 0 |

The August record count includes roughly 1,200 duplicates from the same bug. Without them, the real growth in
records is a little larger than the table shows.

## What's behind the status changes

- **28 historical taxa were confirmed.** They had recent records in this data. This is the main change, and it's why
  the historical count fell.
- **7 "newly reported" taxa became confirmed.** Older records turned up for them, so they're no longer new.
- **5 confirmed taxa became historical.** Their only recent records were removed or reclassified, for example by record
  annotations, the research-grade filter, or the removal of duplicates. One of them is *Plagiobothrys tenellus*, whose
  planted Fort Rodd Hill records are suspended from its EP.
- One confirmed taxon became newly reported, and one newly reported taxon's status became unknown.

## Taxa that joined and left

- **Joined:** *Plectritis congesta* ssp. *congesta*, newly reported, the only taxon admitted in this refresh without a
  reviewer, by scoring high confidence.
- **Left:**
  - *Aphanes occidentalis*, which iNaturalist has lumped into *A. arvensis* - EM should decide whether to keep the lump.
  - *Achnatherum nelsonii* ssp. *nelsonii*, *Platanthera dilatata* and *Veratrum viride* var. *eschscholzianum*, all
    historical. Their only record was a specimen which the list also cites for another of its taxa, and which now
    counts once, under the catalogue's determination. They're listed as "cited by the list for more than one taxon" in
    the workflow's `catalogues/raw/Saanich_Tracheophyta_list-record-conflicts.csv`, for EM to decide which taxon each
    specimen belongs to.

The record count rose by more than a third, but the number of taxa barely changed, so the new records mostly add to
taxa already on the list. Why so few taxa are new is traced in 2026-11-15-taxon-funnel.md.
