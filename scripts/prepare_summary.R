library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")

raw <- timedFread("big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27-edited.csv")

normalised <- raw %>% mutate(scientificName = sub(";.*", "", iNatTaxon)) %>% select(-iNatTaxon) %>%
  mutate(reportingStatus = replace_na(occurrence_status, "reported")) %>% select(-occurrence_status) %>%
  mutate(phylum = "Tracheophyta")

timedWrite(normalised, "big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27-normalised.csv")

# Next: node ../bagatelle/src/assignBNames.js big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27-normalised.csv --DwCA
