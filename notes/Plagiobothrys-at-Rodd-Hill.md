# *Plagiobothrys tenellus* at Fort Rodd Hill

## Prompt

> This looks nearly ready to go live, but chlorophilia has requested a further workflow refinement. He has noted that
> the EP values for Plagiobothrys tenella have been corrupted by a colony of this plant being planted in the Fort Rodd
> Hill area without observations of it necessarily being highlighted as so. Our preferred workflow for this is the
> apply the existing captive/cultivated observation marker supplied by iNaturalist and to exclude such obs from any EP
> calculations. Can you check whether this field has been returned as part of our original iNat obs scrape, and
> whether it is preserved in our fused catalogue?

## Response

Yes. The iNaturalist export includes the `captive` (captive/cultivated) field, and the fusion keeps it, but it doesn't
help with Fort Rodd Hill.

**Where the field survives:**

| Stage | `captive` column? |
|---|---|
| Fusion (`Saanich_GBIF_And_iNat_2026_10_11.csv`) | Yes, 54,996 records marked `TRUE` |
| Assigned catalogue | Yes |
| Penultimate catalogue | Yes, but no `TRUE` values are left |
| Ultimate catalogue, and the site | No: `clean_ultimate_cat()` drops the column |

**What the workflow already does with it:**
- iNaturalist makes every captive observation "casual" grade: all 54,996 captive records are casual.
- Step 2.1 of `2_curate.R` drops every casual record.
- So marking an observation captive already removes it from the catalogue completely, not just from the EP
  calculation. It also disappears from the maps and record counts. That's a stronger exclusion than "exclude from EP",
  and it might not be what chlorophilia wants for a planted colony that's still a real population on the ground.

**The Fort Rodd Hill *Plagiobothrys tenellus* records:**
- None of them is marked captive. All 6 iNaturalist observations inside the Fort Rodd Hill polygon have
  `captive = FALSE`. 4 are research grade and 2 need ID, all from 2019–2023.
- So the preferred workflow only works once someone marks those observations on iNaturalist, by voting "No" on
  "Organism is wild?" in the Data Quality Assessment, and the iNaturalist export is then re-fetched. Until then the data
  contains nothing that identifies them as planted.

**Two side findings:**
- **The fusion has a duplicate.** iNaturalist observation 149839640 appears twice, once from the iNaturalist export and
  once through GBIF (date only, `captive` blank). The fusion is meant to exclude GBIF's copies of iNaturalist records,
  so one has slipped through, and there may be others.
- **The current annotation misses some records.** `tabular_data/record-annotations.csv` suspends records within 1 km
  of one point, and only 4 records fall within that. There are 6 Fort Rodd Hill observations, and the 1 km circle
  doesn't cover the whole site. *(Corrected below: the 2 records outside the old circle are needs-ID observations,
  which never reach the site.)*

**Options:**
1. **Use iNaturalist's marker as-is.** Get the observations marked captive on iNaturalist and re-export. The workflow
   then drops them from the whole catalogue. This needs no code change, but it removes them from the map too.
2. **Keep captive records but exclude them from EP only.** That means:
   - keeping captive iNaturalist records past step 2.1, at least those that are otherwise research grade;
   - carrying `captive` into the ultimate catalogue and `prepare_obs.R`;
   - having the EP calculation (`apply_record_annotations.R` and the site's own solow code) skip them.

   That's a modest change across both repos, but captive records are now a large group (55k), mostly garden plants,
   and they'd all come back into the catalogue. So it would need a narrower rule, such as captive records only for
   taxa already on the list.
3. **Meanwhile:** replace the 1 km circle in `record-annotations.csv` with the `Fort Rodd Hill.geojson` polygon. That
   would catch all 6 observations straight away, without waiting on iNaturalist.

## Prompt

> Apply step 3 - could you simplify it by just adjusting the circle's centre and radius so it minimally covers the
> supplied geojson?

## Response

The minimal circle covering the Fort Rodd Hill polygon is centred at **48.434347, −123.443356**, with a radius of
**1,984.5 m** as `apply_record_annotations.R` measures it, by the haversine formula. It's rounded up to **1,990 m** in
`tabular_data/record-annotations.csv`. The centre was found by minimising the largest distance to the polygon's
vertices, in BC Albers (EPSG:3005).

A correction to the response above: the published catalogue holds only research-grade records, so it has just **4
distinct Fort Rodd Hill observations**, plus the GBIF duplicate of 149839640. The old 1 km circle already covered all
of them. The 6 counted before included 2 needs-ID observations, which never reach the site.

So the result is unchanged today: 4 records suspended, and *Plagiobothrys tenellus* at EP 0.545, unconfirmed (0.021
and confirmed without the suspension). The new circle matters for records added later anywhere on the site, and it
catches none of the museum specimens from elsewhere: the nearest, RBCM V041430 from 1916, is 3.4 km from the centre.
`apply_record_annotations.R` was rerun and the site rebuilt.

The longer-term route is still option 1 or 2: marking the planted observations captive on iNaturalist.
