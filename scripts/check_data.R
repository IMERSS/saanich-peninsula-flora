library(dplyr)

source("scripts/utils.R")

raw <- timedFread("tabular_data/Howe_Sound_vascular_plant_records_consolidated_2024-11-14.csv")

tib <- raw %>% filter(scientificName == "Linaria dalmatica ssp. dalmatica")

write.csv(tib, "tabular_data/test-ldd-orig.csv", row.names = FALSE)
