library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

assignedTaxa <-    timedFread("tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17-assigned-taxa.csv")
assignedSummary <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17-assigned.csv")
assignedSummary$inSummary = 1

assignedSummaryDupes <- assignedSummary %>%
  group_by(iNaturalistTaxonId) %>%
  filter(n() > 1)

if (nrow(assignedSummaryDupes > 0)) {
  cat("Warning, there were ", nrow(assignedSummaryDupes), "duplicate entries found in the summary")
  assignedSummaryDupes$scientificName
  timedWrite(assignedSummaryDupes, "tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17-assigned-dupes.csv")
  
  toRemove <- assignedSummaryDupes %>%
    filter(link_taxon_id == "")
  
  assignedSummary <- assignedSummary %>%
    anti_join(toRemove %>% select(scientificName, iNaturalistTaxonId), 
              by = c("scientificName", "iNaturalistTaxonId"))
}

merged <- assignedTaxa %>%
  full_join(assignedSummary %>% select(-c("iNaturalistTaxonName")), by = c("id" = "iNaturalistTaxonId"))

merged <- merged %>% select(-c("kingdom", "phylum", "class", "order", "infraorder", "superfamily", "subfamily", "genus", "family",
                               "subphylum", "subclass", "superorder", "link_name", "link_taxon_id", "tribe"))

merged$provenance_status <- ifelse(
  merged$provenance_status %in% c("voucher", "no_voucher"),
  merged$provenance_status,
  "unknown"
)

timedWrite(merged, "tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17-prepared-taxa.csv")
