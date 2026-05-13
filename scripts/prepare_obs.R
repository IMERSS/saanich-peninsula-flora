library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# Reduce columns in obs data for visualisation

rawObs <- timedFread("big_data/Saanich_Tracheophyta_incomplete-ultimate-catalogue_2026-04-08.csv")

filtered <- rawObs %>% select(-c(day, month, year, quality_grade, phylum, kingdom, class, order, family, verbatimScientificName,
                              verbatimScientificNameAuthorship, commonName, elevationAccuracy, image_url, taxonRank, taxonKey,
                              publishingOrgKey, iNatObsID, linkTaxonID, linkName, coordinatePrecision, scientificNameAuthority,
                              countryCode, stateProvince, occurrenceStatus, speciesKey, lastInterpreted, mediaType, issue))

filtered$decimalLatitude[filtered$coordinates_obscured == TRUE] <- NA
filtered$decimalLongitude[filtered$coordinates_obscured == TRUE] <- NA

filtered <- filtered %>% select(-c(coordinates_obscured))

rawAssigned <- timedFread("tabular_data/Saanich_Tracheophyta_incomplete-ultimate-merged-summary_2026-04-08-assigned.csv")

assigned <- assigned %>% select(c(scientificName, iNaturalistTaxonId))

withId <- merge(filtered, assigned, by.x = "taxonName", by.y = "scientificName")

withId <- withId %>% filter(!is.na(iNaturalistTaxonId) & iNaturalistTaxonId != 0)

timedWrite(withId, "tabular_data/Saanich_Tracheophyta_incomplete-ultimate-catalogue_2026-04-08-selected-orig.csv")



