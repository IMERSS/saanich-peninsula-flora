library(dplyr)
library(stringr)
library(sf)

source("scripts/utils.R")
source("scripts/project.R")

# Reduce columns in obs data for visualisation

rawObs <- timedFread(file.path("big_data", config$ultimateCatalogue))

# The columns the site reads, as many as the catalogue has - catalogues from different fusions differ in their other
# columns, e.g. commonName, coordinateUncertaintyInMeters, or the grouping columns leaked into those of before 2026-11
# by get_unique_obs() in checklist-catalogue-alignment-workflow
keep <- c("taxon_name", "eventDate", "occurrenceID", "gbifID", "basisOfRecord", "recordedBy", "decimalLatitude",
          "decimalLongitude", "coordinateUncertaintyInMeters", "elevation", "locality", "individualCount", "institutionCode",
          "collectionCode", "catalogNumber", "recordNumber", "identifiedBy", "dateIdentified", "license", "rightsHolder",
          "typeStatus", "establishmentMeans")

filtered <- rawObs %>% select(any_of(c(keep, "coordinates_obscured")))

# Obscured records carry only iNaturalist's randomised point - the fusion uses the true coordinates wherever the export
# gave them, and in the 2026-10 export it gave none for these
filtered$decimalLatitude[filtered$coordinates_obscured == TRUE] <- NA
filtered$decimalLongitude[filtered$coordinates_obscured == TRUE] <- NA

filtered <- filtered %>% select(-c(coordinates_obscured))

rawAssigned <- timedFread(file.path("tabular_data", config$summaryAssigned))

assigned <- rawAssigned %>% select(c(scientificName, iNaturalistTaxonId))

withId <- merge(filtered, assigned, by.x = "taxon_name", by.y = "scientificName")

withId <- withId %>% filter(!is.na(iNaturalistTaxonId) & iNaturalistTaxonId != 0)

timedWrite(withId, project$obsFile)



