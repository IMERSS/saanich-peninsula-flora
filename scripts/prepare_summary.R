library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# Merge together the two summaries, reduce columns ready for assignment

rawList <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-ultimate-list_2026-04-08.csv")
reducedList <- rawList %>% select(c("taxonName", "linkName", "linkTaxonID", "taxonRank"))

rawSummary <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-summary_2026-04-08.csv")
reducedSummary <- rawSummary %>% select(c("taxonName", "occurrence_status", "direct_solow_pp", "has_voucher", "introduction_status"))

joinedList <- merge(reducedList, reducedSummary, by="taxonName")
joinedList <- joinedList %>% rename("reportingStatus" = "occurrence_status", "scientificName" = "taxonName")
joinedList$phylum = "Tracheophyta"

timedWrite(joinedList, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-orig.csv")

# Next: node ../bagatelle/src/assignBNames.js tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-orig.csv --DwCA --swaps tabular_data/taxon-swaps.csv
