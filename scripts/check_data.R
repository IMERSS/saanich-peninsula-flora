library(dplyr)

source("scripts/utils.R")

raw <- timedFread("tabular_data/Howe_Sound_vascular_plant_records_consolidated_2024-11-14.csv")

emptyCols <- colSums(is.na(raw)) == nrow(raw)

emptyColNames = names(emptyCols[emptyCols])
cat("Removing ", length(emptyColNames), " empty columns ", paste(emptyColNames, collapse = ", "))

tib <- raw %>% filter(scientificName == "Linaria dalmatica ssp. dalmatica")

write.csv(tib, "tabular_data/test-ldd-orig.csv", row.names = FALSE)
