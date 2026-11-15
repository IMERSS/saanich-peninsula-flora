library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# Prepare the history of the curatorial notes on each taxon, shown by the History tab of the curation pane - from the
# master checklist's accounts and comments, oldest first:
#   original_comment       - the account of Szczawinski & Harrison's checklist
#   revised_comment        - Harvey Janszen's own inscription of the account, based on the original - or, where he
#                            made none, his account as transcribed in HJ_comment
#   FPNW_comment           - remarks against the Flora of the Pacific Northwest
#   critical_comments      - the critical notes of reviewers, each signed with their initials, which are spelled out
#   reviewed_by            - who has reviewed the taxon
# Each taxon is given the id by which the site knows it, matched on its scientific name in the prepared summary, which
# must be prepared first - see scripts/prepare_summary.R. The taxa which the workflow's working list holds but which
# didn't reach the ultimate list - flagged doubtful, persisting or planted, or still under review - are given their
# history from the same columns of the working list, keyed by their iNaturalist id, or by "name:" and their name where
# they have none, so that the Lost Plants gallery's "Set aside" tab shows their notes from this one file - see
# scripts/prepare_excluded_taxa.R. The output is copied into the site by R/build.R

list_file <- file.path("tabular_data", config$list)
working_list_file <- file.path("tabular_data", config$workingList)
taxa_file <- project$summaryFile
history_file <- file.path("tabular_data", config$curationHistory)

# The reviewers who sign the notes with their initials. Other signatures, e.g. of a collection, are kept as written
reviewers <- c(
  TL = "Terry Ludwar",
  EM = "Emma Menchions",
  JM = "James Miskelly",
  AS = "Andrew Simon",
  MF = "Matt Fairbarns",
  DG = "David Giblin",
  FL = "Frank Lomer",
  KM = "Kristen Miskelly",
  AJW = "Alexander J. Wright"
)

# Spell out the initials of reviewers wherever they stand as a word, e.g. "(TL)" or "TL, EM" - but not where the same
# letters are an abbreviation being defined, e.g. "FL = Flora ..."
expand_initials <- function (text) {
  for (initials in names(reviewers)) {
    text <- str_replace_all(text, paste0("\\b", initials, "\\b(?!\\s*=)"), reviewers[[initials]])
  }
  text
}

# Name the reviewers of a taxon - a review recorded as "Automatic (EM)" is credited to Emma Menchions by name, as her
# own reviews are, and each reviewer is named once, e.g. "EM, Automatic (EM)" being simply "Emma Menchions"
name_reviewers <- function (text) {
  named <- expand_initials(str_replace_all(text, "Automatic \\(EM\\)", "EM"))
  vapply(str_split(named, ",\\s*"), function (names) paste(unique(names[names != ""]), collapse = ", "), character(1))
}

# A note's text, or "" if it has none
clean <- function (text) {
  text <- ifelse(is.na(text) | text == "NA", "", text)
  str_trim(text)
}

rawList <- timedFread(list_file)
taxa <- timedFread(taxa_file) %>%
  filter(!is.na(scientificName) & scientificName != "") %>%
  select(id, scientificName) %>%
  distinct(scientificName, .keep_all = TRUE)

# The notes of a list's rows, each with its scientificName
notes_of <- function (rows) {
  rows %>% transmute(
    scientificName = taxon_name,
    original = clean(original_comment),
    harvey = clean(revised_comment),
    harveyTranscribed = clean(HJ_comment),
    fpnw = clean(FPNW_comment),
    critical = expand_initials(clean(critical_comments)),
    reviewedBy = name_reviewers(clean(reviewed_by))
  ) %>%
  # Harvey's transcribed account where his inscription is missing
  mutate(harvey = ifelse(harvey == "", harveyTranscribed, harvey))
}

has_notes <- function (history) {
  history %>% filter(original != "" | harvey != "" | fpnw != "" | critical != "")
}

listed <- notes_of(rawList) %>%
  inner_join(taxa, by = "scientificName") %>%
  mutate(id = as.character(id)) %>%
  has_notes()

# The rows of the working list which didn't reach the ultimate list
workingList <- timedFread(working_list_file)
setAside <- workingList %>%
  filter(!(taxon_name %in% rawList$taxon_name))
setAsideHistory <- notes_of(setAside) %>%
  mutate(id = set_aside_id(setAside$link_taxon_id, setAside$taxon_name)) %>%
  has_notes()

history <- bind_rows(listed, setAsideHistory) %>%
  distinct(id, .keep_all = TRUE) %>%
  select(id, scientificName, original, harvey, fpnw, critical, reviewedBy)

timedWrite(history, history_file)
