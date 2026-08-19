library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")

# Reduce columns in obs data for visualisation

rawObs <- timedFread("big_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-17.csv")

filtered <- rawObs %>% select(-c(day, month, year, quality_grade, phylum, kingdom, class, order, family, verbatimScientificName,
                              verbatimScientificNameAuthorship, commonName, elevationAccuracy, image_url, taxonRank, taxonKey,
                              publishingOrgKey, iNatObsID, link_taxon_id, link_name, coordinatePrecision, scientificNameAuthority,
                              countryCode, stateProvince, occurrenceStatus, speciesKey, lastInterpreted, mediaType, issue))

filtered$decimalLatitude[filtered$coordinates_obscured == TRUE] <- NA
filtered$decimalLongitude[filtered$coordinates_obscured == TRUE] <- NA

filtered <- filtered %>% select(-c(coordinates_obscured))

rawAssigned <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-assigned.csv")

assigned <- rawAssigned %>% select(c(scientificName, iNaturalistTaxonId))

withId <- merge(filtered, assigned, by.x = "taxon_name", by.y = "scientificName")

withId <- withId %>% filter(!is.na(iNaturalistTaxonId) & iNaturalistTaxonId != 0)

timedWrite(withId, "tabular_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-17-selected-orig.csv")



