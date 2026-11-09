# Determines the period covered by the catalogue, so that text describing it follows the data

source("scripts/utils.R")

# Returns the earliest and latest years of the dated records in the catalogue, as named integers `first` and `last`
recordPeriod <- function (catalogue = "tabular_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv") {
  plants <- timedFread(catalogue)
  years <- suppressWarnings(as.integer(substr(as.character(plants$eventDate), 1, 4)))
  list(first = min(years, na.rm = TRUE), last = max(years, na.rm = TRUE))
}
