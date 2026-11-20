library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# Prepare the taxa which checklist-catalogue-alignment-workflow kept off the ultimate list, shown by the Lost Plants
# gallery's Excluded and Under review tabs beside the tabs of the list's own taxa - see bioreportr-lostPlantsPane.vue. The curated data shown everywhere
# else on the site is untouched: this only describes what was left out, in two groups:
#   excluded    - the rows of the workflow's working list which didn't reach the ultimate list, which the curators have
#                 flagged doubtful, persisting or waif, or planted, or reviewed without carrying to the list
#   underReview - the other rows of the working list which didn't reach the ultimate list, still awaiting review.
#                 The notes of both are in the curation history, prepared from the same list by
#                 scripts/prepare_curation_history.R
#   unlisted    - the names of the penultimate catalogue, the workflow's last stage before its list is reviewed, which never
#              reached the working list - mostly those scoring low confidence, e.g. from a single unvouchered record.
#              The catalogue holds records alone, so these are described by their records, and not by any reasons
# Each taxon is given the id by which the site knows it - see set_aside_id in scripts/utils.R. The working list and the
# penultimate catalogue, a file of big_data (not checked in), are named in bioreportr-prep.yaml, each optional: a project
# without a working list has only unlisted taxa, and one without the catalogue none. The flags by which curators exclude
# a row are named by project$curation$flags in scripts/project.R. The output, named in bioreportr.yaml, is copied into
# the site by R/build.R
# This script is shared between the projects by copyFrameworkOut.sh, and is written against the columns of the lists
# and catalogues of checklist-catalogue-alignment-workflow

settings <- project$curation
list_file <- file.path("tabular_data", config$list)
excluded_file <- file.path("tabular_data", config$excludedTaxa)

# The species of a name - its first two words, or three for a hybrid written "Genus × epithet"
species_of <- function (name) {
  str_extract(name, "^\\S+ (× )?\\S+")
}

# Every name under which a list knows its taxa - its verbatim names hold the synonyms under which the same plant is
# catalogued, separated by "; ", e.g. "Urtica dioica; Urtica gracilis"
names_of <- function (rows) {
  names <- unique(str_trim(unlist(str_split(c(rows[[settings$nameColumn]], rows$link_name, rows$verbatim_taxon_name), ";"))))
  names[!is.na(names) & names != ""]
}

yes <- function (flag) !is.na(flag) & str_trim(flag) == "yes"

blank_na <- function (text) ifelse(is.na(text) | text == "" | text == "NA", NA, text)

rawList <- timedFread(list_file)
workingList <- if (is.null(config$workingList)) rawList[0, ] else timedFread(file.path("tabular_data", config$workingList))

# The flags each row raises, by the label of each - e.g. "doubtful; planted"
flag_labels <- function (rows) {
  labels <- rep("", nrow(rows))
  for (column in intersect(names(settings$flags), names(rows))) {
    labels <- paste0(labels, ifelse(yes(rows[[column]]), paste0("; ", settings$flags[[column]]), ""))
  }
  str_remove(labels, "^; ")
}

# The curators' decision on each row set aside, the flags first, since a flagged row is excluded even once reviewed -
# a row flagged, or reviewed but not carried to the list, is excluded, and any other is still under review
setAside <- workingList %>%
  filter(!(.data[[settings$nameColumn]] %in% rawList[[settings$nameColumn]])) %>%
  # The taxa restored to the checklist, which are listed - see working_list_restored in scripts/utils.R
  filter(!(.data[[settings$nameColumn]] %in% working_list_restored())) %>%
  mutate(flags = flag_labels(.),
         group = ifelse(flags != "" | review_status == "complete", "excluded", "underReview"),
         reason = case_when(
    flags != "" ~ flags,
    review_status == "complete" ~ "reviewed, not carried to the list",
    TRUE ~ paste("review", review_status)
  )) %>%
  transmute(
    group,
    id = set_aside_id(.data[[settings$idColumn]], .data[[settings$nameColumn]]),
    scientificName = .data[[settings$nameColumn]],
    commonName = blank_na(common_name),
    family = blank_na(family),
    introduction_status = blank_na(str_trim(introduction_status)),
    reason,
    confidence = blank_na(confidence),
    n_records = suppressWarnings(as.integer(n_total)),
    n_research_grade = suppressWarnings(as.integer(n_research_grade)),
    first_record_date = blank_na(as.character(first_record_date)),
    last_record_date = blank_na(as.character(last_record_date))
  )

# The names of the working list, and their species, under which the catalogue may name the same plant more or less
# finely - e.g. the catalogue's "Quercus garryana" is the list's "Quercus garryana var. garryana" - and any taxon the
# site already knows by id, including the parents of the list's infrataxa
listed <- names_of(workingList)
listed_species <- unique(species_of(listed))
# The summary's own taxa - not those which scripts/prepare_set_aside.R adds to it, the taxa kept off the list
summaryTaxa <- timedFread(project$summaryFile)
if ("set_aside_added" %in% names(summaryTaxa)) {
  summaryTaxa <- summaryTaxa %>% filter(!(set_aside_added %in% c(TRUE, "TRUE")))
}
known_ids <- c(as.character(summaryTaxa$id), setAside$id)
listed <- unique(c(listed, names_of(rawList)))

unlisted <- if (is.null(config$penultimateCatalogue)) NULL else timedFread(file.path("big_data", config$penultimateCatalogue)) %>%
  filter(!is.na(linkName) & linkName != "" & taxonRank %in% c("species", "subspecies", "variety", "hybrid", "form")) %>%
  filter(!(linkName %in% listed) & !(originalLinkName %in% listed) & !(species_of(linkName) %in% listed_species) &
           !(as.character(linkTaxonID) %in% known_ids)) %>%
  mutate(date = substr(as.character(eventDate), 1, 10), date = ifelse(is.na(date) | date == "", NA, date)) %>%
  group_by(scientificName = linkName) %>%
  summarise(
    id = as.character(first(na.omit(linkTaxonID))),
    commonName = first(na.omit(commonName[commonName != ""])),
    family = first(na.omit(family[family != ""])),
    n_records = n(),
    n_research_grade = sum(quality_grade == "research", na.rm = TRUE),
    first_record_date = suppressWarnings(min(date, na.rm = TRUE)),
    last_record_date = suppressWarnings(max(date, na.rm = TRUE)),
    .groups = "drop"
  ) %>%
  filter(!is.na(id)) %>%
  mutate(group = "unlisted", reason = "not yet reviewed",
         first_record_date = ifelse(is.infinite(first_record_date), NA, first_record_date),
         last_record_date = ifelse(is.infinite(last_record_date), NA, last_record_date))

excluded <- bind_rows(setAside, unlisted) %>%
  distinct(id, .keep_all = TRUE) %>%
  arrange(group, desc(n_records), scientificName) %>%
  select(group, id, scientificName, commonName, family, introduction_status, reason, confidence, n_records,
         n_research_grade, first_record_date, last_record_date)

timedWrite(excluded, excluded_file)
