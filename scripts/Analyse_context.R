library(readr)
library(dplyr)

read_GBIF = function (filename) {
  sr_time <- Sys.time()
  # Advice from https://discourse.gbif.org/t/problem-parsing-large-occurrence-downloads/2570
  rawGbif <- readr::read_tsv(filename, quote="", col_types = cols(.default = "c"))
  elapsed <- round(as.numeric(difftime(Sys.time(), sr_time, units = "secs")), 2)
  message(sprintf("Read %d lines in %.2f s", nrow(rawGbif), elapsed))
  rawGbif
}

allcat <- read_GBIF("big_data/gbif-howe-context-all-category-2026-03-06-raw.tsv")

allcat_reduced <- allcat[!duplicated(allcat$species), ]

write.csv(allcat_reduced, "big_data/gbif-howe-context-all-category-2026-03-06-reduced.csv", row.names = FALSE, na = "")



allall <- read_GBIF("big_data/gbif-howe-context-all-2026-03-06-raw.tsv")

allall_reduced <- allall[!duplicated(allall$species), ]

write.csv(allcat_reduced, "big_data/gbif-howe-context-all-2026-03-06-reduced.csv", row.names = FALSE, na = "")

s1 <- dplyr::anti_join(allcat_reduced, allall_reduced, by=c("species"))
s2 <- dplyr::anti_join(allall_reduced, allcat_reduced, by=c("species"))
