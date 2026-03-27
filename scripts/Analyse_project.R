library(readr)
library(dplyr)
library(data.table)

## Stanza 1: Reduce incoming GBIF data to one row per taxa

read_GBIF = function (filename) {
  sr_time <- Sys.time()
  # Advice from https://discourse.gbif.org/t/problem-parsing-large-occurrence-downloads/2570
  rawGbif <- readr::read_tsv(filename, quote="", col_types = cols(.default = "c"))
  elapsed <- round(as.numeric(difftime(Sys.time(), sr_time, units = "secs")), 2)
  message(sprintf("Read %d lines in %.2f s", nrow(rawGbif), elapsed))
  rawGbif
}

all <- read_GBIF("big_data/gbif-howe-context-tracheophyta-2026-03-27-raw.tsv")
# Rough and ready, just resolve data at species level
all$scientificName <- all$species

all_reduced <- all[!duplicated(all$scientificName), ] %>% filter(!is.na(scientificName))

write.csv(all_reduced, "big_data/gbif-howe-context-tracheophyta-2026-03-27-reduced.csv", row.names = FALSE, na = "", fileEncoding = "UTF-8")

# node ../bagatelle/src/assignBNames.js big_data/gbif-howe-context-tracheophyta-2026-03-27-reduced.csv --DwCA

## Stanza 3: Reconstitute original "assigned" data by joining with assigned reduced data

assigned <- readr::read_csv("big_data/gbif-howe-context-all-category-2026-03-06-assigned.csv", col_types = cols(.default = "c")) %>% filter(!is.na(species))

joined <- dplyr::left_join(allcat, assigned, by = dplyr::join_by("scientificName"), suffix = c("", ".dup")) |>
  dplyr::select(-dplyr::ends_with(".dup"))

data.table::fwrite(joined, "big_data/gbif-howe-context-all-category-2026-03-06-assigned-full.csv")

## Stanza 3b: Reconstitute original "assigned" all data by joining with assigned reduced data

assignedall <- readr::read_csv("big_data/gbif-howe-context-all-2026-03-06-assigned.csv", col_types = cols(.default = "c")) %>% filter(!is.na(species))

joined <- dplyr::left_join(allall, assignedall, by = dplyr::join_by("scientificName"), suffix = c("", ".dup")) |>
  dplyr::select(-dplyr::ends_with(".dup"))

data.table::fwrite(joined, "big_data/gbif-howe-context-all-2026-03-06-assigned-full.csv")
