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

# TODO Solow values are pretty corrupt with many missing and negative
merged <- merged %>% mutate(direct_solow_pp = round(pmax(coalesce(direct_solow_pp, 1), 0), 3))

timedWrite(merged, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-prepared-taxa.csv")
