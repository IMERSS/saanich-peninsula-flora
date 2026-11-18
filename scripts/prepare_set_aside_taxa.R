library(dplyr)
library(stringr)
library(httr)
library(jsonlite)

source("scripts/utils.R")
source("scripts/project.R")

# Prepare the taxa which checklist-catalogue-alignment-workflow kept off the list - those the curators excluded, those
# under review, and those never reviewed, as scripts/prepare_excluded_taxa.R groups them - for assignment to the
# iNaturalist taxonomy, so that the story page may hold them beside the list's own taxa, with their records, for the
# Atlas to show and Living Data to curate when they are chosen through its Checklist status filter. Written in the form of
# the summary prepared by scripts/prepare_summary.R, each with its checklist_status:
#   excluded    - excluded by the curators
#   underReview - under review, or never reviewed
# They are then assigned to the iNaturalist taxonomy, which gives each its parents, as assignBNames.js assigns the
# summary's taxa, writing the same two files: each taxon with its iNaturalist id, and every taxon of the assignment with
# its parent. A taxon with an iNaturalist id is looked up by it, with its ancestors, through iNaturalist's API; one
# without by its name, which must match exactly, the words marking its rank, e.g. "ssp.", left out as iNaturalist leaves
# them out. The API is asked about once a second, as iNaturalist asks, and each answer is kept in big_data/inat-taxa, so
# that a run again asks only what it has not asked before. Then run scripts/prepare_set_aside.R. The files are named in
# bioreportr-prep.yaml.
# This script is shared between the projects by copyFrameworkOut.sh

excluded <- timedFread(file.path("tabular_data", config$excludedTaxa))
working <- if (is.null(config$workingList)) NULL else timedFread(file.path("tabular_data", config$workingList))

clean <- function (x) {
  x <- str_squish(as.character(x))
  ifelse(is.na(x) | x %in% c("NA", "Na", "N/A", "na"), "", x)
}

rank_of <- function (name) {
  case_when(
    str_detect(name, " ssp\\. | subsp\\. ") ~ "subspecies",
    str_detect(name, " var\\. ") ~ "variety",
    str_detect(name, " × |^× ") ~ "hybrid",
    TRUE ~ "species"
  )
}

# The working list's link name of each taxon, by which the assignment may find a taxon without an iNaturalist id
link_names <- if (is.null(working)) tibble(scientificName = character(), link_name = character()) else
  tibble(scientificName = working[[project$curation$nameColumn]], link_name = clean(working$link_name)) %>%
    distinct(scientificName, .keep_all = TRUE)

setAside <- excluded %>%
  transmute(
    scientificName,
    link_taxon_id = ifelse(str_detect(id, "^\\d+$"), id, ""),
    taxon_rank = rank_of(scientificName),
    introduction_status = clean(introduction_status),
    checklist_status = ifelse(group == "excluded", "excluded", "underReview"),
    phylum = "Tracheophyta"
  ) %>%
  left_join(link_names, by = "scientificName") %>%
  mutate(link_name = ifelse(is.na(link_name) | link_name == "", scientificName, link_name)) %>%
  distinct(scientificName, .keep_all = TRUE) %>%
  select(scientificName, link_name, link_taxon_id, taxon_rank, introduction_status, checklist_status, phylum)

timedWrite(setAside, file.path("tabular_data", config$setAsideOrig))

# ── Assignment to the iNaturalist taxonomy ─────────────────

cache_dir <- file.path("big_data", "inat-taxa")
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# The parsed answer of iNaturalist's API to a request, from the cache if it has been asked before
inat_get <- function (path, query = list(), key) {
  cache_file <- file.path(cache_dir, paste0(key, ".json"))
  if (!file.exists(cache_file)) {
    Sys.sleep(1.1)
    response <- GET(paste0("https://api.inaturalist.org/v1/", path), query = query,
                    user_agent("bioReportR data preparation (IMERSS)"))
    stop_for_status(response)
    writeLines(content(response, as = "text", encoding = "UTF-8"), cache_file, useBytes = TRUE)
  }
  fromJSON(cache_file, simplifyVector = FALSE)$results
}

photo_of <- function (taxon) {
  url <- taxon$default_photo$medium_url
  if (is.null(url)) "" else url
}

taxon_row <- function (taxon) {
  tibble(id = as.character(taxon$id), parentId = as.character(if (is.null(taxon$parent_id)) NA else taxon$parent_id),
         iNaturalistTaxonName = taxon$name, commonName = if (is.null(taxon$preferred_common_name)) "" else taxon$preferred_common_name,
         rank = taxon$rank, iNaturalistTaxonImage = photo_of(taxon))
}

# The taxa with an iNaturalist id, thirty at a time, each with its ancestors
ids <- unique(setAside$link_taxon_id[setAside$link_taxon_id != ""])
batches <- split(ids, ceiling(seq_along(ids) / 30))
found <- list()
taxa_rows <- list()
for (batch in batches) {
  results <- inat_get(paste0("taxa/", paste(batch, collapse = ",")), key = paste0("ids-", digest_key <- paste(batch, collapse = "_")))
  for (taxon in results) {
    found[[as.character(taxon$id)]] <- taxon
    taxa_rows[[length(taxa_rows) + 1]] <- taxon_row(taxon)
    for (ancestor in taxon$ancestors) {
      taxa_rows[[length(taxa_rows) + 1]] <- taxon_row(ancestor)
    }
  }
}

# The taxa without one, by name
name_key <- function (name) str_squish(str_replace_all(name, " (ssp\\.|subsp\\.|var\\.|f\\.) ", " "))
by_name <- setAside %>% filter(link_taxon_id == "")
named_ids <- character(nrow(by_name))
for (i in seq_len(nrow(by_name))) {
  sought <- name_key(by_name$link_name[i])
  results <- inat_get("taxa", list(q = sought, is_active = "true", per_page = 10), key = paste0("name-", str_replace_all(sought, "[^A-Za-z0-9]+", "_")))
  exact <- Filter(function (taxon) identical(taxon$name, sought), results)
  if (length(exact) == 1) {
    named_ids[i] <- as.character(exact[[1]]$id)
    if (is.null(found[[named_ids[i]]])) {
      # The search gives the taxon's ancestors only by id, so it is asked for again by id
      full <- inat_get(paste0("taxa/", named_ids[i]), key = paste0("ids-", named_ids[i]))[[1]]
      found[[named_ids[i]]] <- full
      taxa_rows[[length(taxa_rows) + 1]] <- taxon_row(full)
      for (ancestor in full$ancestors) {
        taxa_rows[[length(taxa_rows) + 1]] <- taxon_row(ancestor)
      }
    }
  }
}
message("Assigned ", sum(named_ids != ""), " of the ", nrow(by_name), " taxa without an iNaturalist id by their names")

assigned <- setAside %>%
  mutate(iNaturalistTaxonId = ifelse(link_taxon_id != "", link_taxon_id, named_ids[match(scientificName, by_name$scientificName)])) %>%
  mutate(iNaturalistTaxonId = ifelse(!is.na(iNaturalistTaxonId) & iNaturalistTaxonId %in% names(found), iNaturalistTaxonId, ""))
message("Assigned ", sum(assigned$iNaturalistTaxonId != ""), " of ", nrow(assigned), " taxa kept off the list")
timedWrite(assigned, file.path("tabular_data", config$setAsideAssigned))
timedWrite(bind_rows(taxa_rows) %>% distinct(id, .keep_all = TRUE), file.path("tabular_data", config$setAsideAssignedTaxa))
cat("Next: Rscript scripts/prepare_set_aside.R\n")
