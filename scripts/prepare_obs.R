library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# Reduce columns in obs data for visualisation

rawObs <- timedFread("big_data/Saanich_Tracheophyta_incomplete-ultimate-catalogue_2026-04-08.csv")

filtered <- rawObs %>% select(-c(day, month, year, quality_grade, phylum, kingdom, class, order, family, verbatimScientificName,
                              verbatimScientificNameAuthorship, commonName, elevationAccuracy, image_url, taxonRank,
                              publishingOrgKey, iNatObsID,
                              countryCode, stateProvince, occurrenceStatus, speciesKey, lastInterpreted, mediaType, issue))

filtered <- filtered %>% rename(iNaturalistTaxonName = linkName, iNaturalistTaxonId = linkTaxonID)

timedWrite(filtered, "big_data/Saanich_Tracheophyta_incomplete-ultimate-catalogue-reduced_2026-04-08.csv")

# Merge together the two summaries, reduce columns ready for assignment

rawList <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-ultimate-list_2026-04-08.csv")
reducedList <- rawList %>% select(c("taxonName", "linkName", "linkTaxonID", "taxonRank"))

rawSummary <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-summary_2026-04-08.csv")
reducedSummary <- rawSummary %>% select(c("taxonName", "occurrence_status", "direct_solow_pp"))

joinedList <- merge(reducedList, reducedSummary, by="taxonName")
joinedList <- joinedList %>% rename("reportingStatus" = "occurrence_status", "scientificName" = "taxonName")
joinedList$phylum = "Tracheophyta"

timedWrite(joinedList, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-catalogue-reduced_2026-04-08.csv")

