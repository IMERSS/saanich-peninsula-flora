library(dplyr)

source("scripts/utils.R")

raw <- timedFread("big_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-reduced.csv")

tib <- raw %>% filter(taxonName == "Heterocodon rariflorus")

write.csv(tib, "big_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-reduced-one.csv", row.names = FALSE)


summary <- timedFread("big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27.csv")

filtered <- summary %>% filter(taxonName == "Clarkia quadrivulnera") %>% slice(1)

write.csv(filtered, "big_data/Saanich_Tracheophyta_incomplete-summary_2025-08-27-one-orig.csv", row.names = FALSE)