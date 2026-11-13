library(dplyr)
library(stringr)

source("scripts/utils.R")

# Apply the annotations of records kept in tabular_data/record-annotations.csv - each naming a taxon, the centre of a
# site and a radius around it, the annotation given to the taxon's records within it, e.g. "planted", and whether they
# are to be suspended from the calculation of the taxon's extirpation probability (EP).
#
# Writes:
#   - tabular_data/Saanich_Tracheophyta_record-annotations_2026-08-20.csv, listing each record annotated, by its
#     occurrenceID - copied into the site by R/build.R, where Find the Plants leaves out of its populations those
#     suspended from the EP calculation, and marks them in its table of records
#   - the taxon's EP, solow_EP, in tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv,
#     recalculated without the suspended records, and its reportingStatus, "unconfirmed" if only they found it again
#     since 2000. Only these values on the taxon's own line are changed, so that the rest of the file, as written by
#     assignBNames.js, is left as it was
#
# The EP is that of Solow's (1993) method as the site computes it for a population - see bioreportr.solowBayesFactor in
# static/bioreportr/js/solow.js - over the period of all the dated records, as saanich.solowParams has it. Run after
# scripts/prepare_obs.R and the preparation of the summary - see scripts/prepare_summary.R

annotations_file <- "tabular_data/record-annotations.csv"
obs_file <- "tabular_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv"
taxa_file <- "tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv"
annotated_file <- "tabular_data/Saanich_Tracheophyta_record-annotations_2026-08-20.csv"

# The distance in metres between points, by the haversine formula
haversine <- function (lat1, lon1, lat2, lon2) {
  to_rad <- pi / 180
  dlat <- (lat2 - lat1) * to_rad
  dlon <- (lon2 - lon1) * to_rad
  a <- sin(dlat / 2) ^ 2 + cos(lat1 * to_rad) * cos(lat2 * to_rad) * sin(dlon / 2) ^ 2
  2 * 6371000 * asin(sqrt(a))
}

# The probability that a taxon is extirpated, from the years of its records, by Solow's (1993) method
solow_ep <- function (years, baseline_year, analysis_year) {
  years <- sort(years)
  T <- analysis_year - baseline_year
  n <- length(years)
  tn <- years[n] - baseline_year
  B <- if (n == 0 || tn <= 0) {
    0
  } else if (n == 1) {
    ln_ratio <- log(T / tn)
    if (ln_ratio <= 0) 0 else 1 / ln_ratio
  } else {
    denominator <- (T / tn) ^ (n - 1) - 1
    if (denominator <= 0) Inf else (n - 1) / denominator
  }
  pp <- if (is.infinite(B)) 1 else B / (1 + B)
  1 - pp
}

annotations <- timedFread(annotations_file)
# Positions are read as text, since many records have none
obs <- timedFread(obs_file) %>%
  mutate(decimalLatitude = suppressWarnings(as.numeric(decimalLatitude)),
         decimalLongitude = suppressWarnings(as.numeric(decimalLongitude)))

years <- suppressWarnings(as.integer(substr(obs$eventDate, 1, 4)))
baseline_year <- min(years, na.rm = TRUE)
analysis_year <- max(years, na.rm = TRUE)

# The records of each annotation - those of its taxon whose position lies within its radius
annotated <- bind_rows(lapply(seq_len(nrow(annotations)), function (i) {
  a <- annotations[i, ]
  obs %>%
    filter(taxon_name == a$taxon_name, !is.na(decimalLatitude), !is.na(decimalLongitude)) %>%
    mutate(distance_m = round(haversine(a$latitude, a$longitude, decimalLatitude, decimalLongitude))) %>%
    filter(distance_m <= a$radius_m) %>%
    transmute(occurrenceID, taxon_name, eventDate, recordedBy, distance_m, annotation = a$annotation,
              excludeFromEP = as.logical(a$exclude_from_ep), note = a$note)
})) %>% distinct(occurrenceID, .keep_all = TRUE)

timedWrite(annotated, annotated_file)

# Recalculate the EP of each taxon with records suspended - and its reporting status, which is "confirmed" for a
# historical taxon found again since 2000, so that one found again only in records now suspended, e.g. of a planted
# population, is "unconfirmed" again. Only these values on its line of the summary are changed
suspended <- annotated %>% filter(excludeFromEP)
taxa <- timedFread(taxa_file)
lines <- readLines(taxa_file, encoding = "UTF-8")

# Replace the value of one field of a line of the CSV file as written, any quoted field before it being taken whole
set_field <- function (line, column, value) {
  pattern <- paste0("^((?:\"(?:[^\"]|\"\")*\"|[^,]*),){", column - 1, "}")
  prefix <- str_extract(line, pattern)
  rest <- substr(line, nchar(prefix) + 1, nchar(line))
  paste0(prefix, sub("^[^,]*", value, rest))
}

ep_column <- which(names(taxa) == "solow_EP")
status_column <- which(names(taxa) == "reportingStatus")

for (taxon in unique(suspended$taxon_name)) {
  kept <- obs %>% filter(taxon_name == taxon, !(occurrenceID %in% suspended$occurrenceID))
  kept_years <- suppressWarnings(as.integer(substr(kept$eventDate, 1, 4)))
  kept_years <- kept_years[!is.na(kept_years)]
  ep <- round(solow_ep(kept_years, baseline_year, analysis_year), 3)
  for (r in which(taxa$scientificName == taxon)) {
    status <- taxa$reportingStatus[r]
    new_status <- if (status == "confirmed" && !any(kept_years >= 2000)) "unconfirmed" else status
    lines[r + 1] <- set_field(lines[r + 1], ep_column, as.character(ep))
    lines[r + 1] <- set_field(lines[r + 1], status_column, new_status)
    message(taxon, ", without ", sum(suspended$taxon_name == taxon), " suspended records: EP ", taxa$solow_EP[r], " -> ", ep,
            ", status ", status, " -> ", new_status)
  }
}

writeLines(lines, taxa_file, useBytes = TRUE)
