library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")

raw <- timedFread("big_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-assigned.csv");

reduced <- raw %>% select(-c("iNaturalistTaxonName", "taxonRank", "iNaturalistTaxonImage", "publishingOrgKey",
                             "scientificNameAuthority", "kingdom", "phylum", "class", "order", "infraorder", "superfamily", "family",
                             "subfamily", "genus", "nameStatus"))

timedWrite(reduced, "tabular_data/Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-reduced-assigned.csv")

