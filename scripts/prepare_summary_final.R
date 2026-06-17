library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

assignedTaxa <-    timedFread("tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-assigned-taxa.csv")
assignedSummary <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-assigned.csv")
assignedSummary$inSummary = 1

assignedSummaryDupes <- assignedSummary %>%
  group_by(iNaturalistTaxonId) %>%
  filter(n() > 1)

if (nrow(assignedSummaryDupes > 0)) {
  cat("Warning, there were ", nrow(assignedSummaryDupes), "duplicate entries found in the summary")
  assignedSummaryDupes$scientificName
  timedWrite(assignedSummaryDupes, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-assigned-dupes.csv")
  
  toRemove <- assignedSummaryDupes %>%
    filter(linkTaxonID == "")
  
  assignedSummary <- assignedSummary %>%
    anti_join(toRemove %>% select(scientificName, iNaturalistTaxonId), 
              by = c("scientificName", "iNaturalistTaxonId"))
}

merged <- assignedTaxa %>%
  full_join(assignedSummary %>% select(-c("iNaturalistTaxonName")), by = c("id" = "iNaturalistTaxonId"))

merged <- merged %>% select(-c("kingdom", "phylum", "class", "order", "infraorder", "superfamily", "subfamily", "genus", "family",
                               "subphylum", "subclass", "superorder", "linkName", "linkTaxonID", "tribe"))

merged <- merged %>% mutate(has_voucher = if_else(has_voucher == "yes", 1, 0))

# TODO Solow values are pretty corrupt with many missing and negative
merged <- merged %>% mutate(direct_solow_pp = pmax(coalesce(direct_solow_pp, 1), 0))

# Convert to ep for viz
merged <- merged %>% mutate(direct_solow_ep = round(1 - direct_solow_pp, 3))
merged <- merged %>% select(-direct_solow_pp)

timedWrite(merged, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-prepared-taxa.csv")
