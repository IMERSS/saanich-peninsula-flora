library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")
source("scripts/project.R")

assignedTaxa <-    timedFread(file.path("tabular_data", config$summaryAssignedTaxa))
assignedSummary <- timedFread(file.path("tabular_data", config$summaryAssigned))
assignedSummary$inSummary = 1

assignedSummaryDupes <- assignedSummary %>%
  group_by(iNaturalistTaxonId) %>%
  filter(n() > 1)

if (nrow(assignedSummaryDupes > 0)) {
  cat("Warning, there were ", nrow(assignedSummaryDupes), "duplicate entries found in the summary")
  assignedSummaryDupes$scientificName
  timedWrite(assignedSummaryDupes, file.path("tabular_data", config$summaryAssignedDupes))
  
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

timedWrite(merged, project$summaryFile)
