library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# Merge together the two summaries, reduce columns ready for assignment

rawList <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-list_2026-08-17.csv")
reducedList <- rawList %>% select(c("taxon_name", "link_name", "link_taxon_id", "taxon_rank", "infrataxon_status",
                                    "provenance_status", "provincial_concern", "introduction_status", "occurrence_status", "solow_EP"))

reducedList <- reducedList %>% rename("reportingStatus" = "occurrence_status", "scientificName" = "taxon_name")
reducedList$phylum = "Tracheophyta"

timedWrite(reducedList, "tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17.csv")

# Next: node ../bagatelle/src/assignBNames.js tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-17.csv --DwCA --swaps tabular_data/taxon-swaps.csv
