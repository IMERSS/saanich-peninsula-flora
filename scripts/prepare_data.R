library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

assignedTaxa <- timedFread("big_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-assigned-taxa.csv")
assignedSummary <- timedFread("big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27-assigned.csv")
assignedSummary$inSummary = 1

merged <- assignedTaxa %>%
  full_join(assignedSummary %>% select(-c("commonName", "iNaturalistTaxonName")), by = c("id" = "iNaturalistTaxonId"))

merged <- merged %>% select(-c("kingdom", "phylum", "class", "order", "infraorder", "superfamily", "subfamily", "genus", "family",
                               "first_record_date", "first_record_year", "first_record_observer", "first_record_institution_ID", "first_record_location",
                               "last_record_date", "last_record_year"))

timedWrite(merged, "tabular_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-prepared-taxa.csv")
