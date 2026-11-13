library(dplyr)
library(stringr)

source("scripts/utils.R")

# Prepare the history of the curatorial notes on each taxon, shown by the History tab of the curation pane - from the
# master checklist's accounts and comments, oldest first:
#   original_comment       - the account of Szczawinski & Harrison's checklist
#   revised_comment        - Harvey Janszen's own inscription of the account, based on the original - or, where he
#                            made none, his account as transcribed in HJ_comment
#   FPNW_comment           - remarks against the Flora of the Pacific Northwest
#   critical_comments      - the critical notes of reviewers, each signed with their initials, which are spelled out
#   reviewed_by            - who has reviewed the taxon
# Each taxon is given the id by which the site knows it, matched on its scientific name in the prepared summary, which
# must be prepared first - see scripts/prepare_summary.R. The output is copied into the site by R/build.R

list_file <- "tabular_data/Saanich_Tracheophyta_ultimate-list_2026-08-20.csv"
taxa_file <- "tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv"
history_file <- "tabular_data/Saanich_Tracheophyta_curation-history_2026-08-20.csv"

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

history <- rawList %>%
  transmute(
    scientificName = taxon_name,
    original = clean(original_comment),
    harvey = clean(revised_comment),
    harveyTranscribed = clean(HJ_comment),
    fpnw = clean(FPNW_comment),
    critical = expand_initials(clean(critical_comments)),
    reviewedBy = name_reviewers(clean(reviewed_by))
  ) %>%
  # Harvey's transcribed account where his inscription is missing
  mutate(harvey = ifelse(harvey == "", harveyTranscribed, harvey)) %>%
  inner_join(taxa, by = "scientificName") %>%
  filter(original != "" | harvey != "" | fpnw != "" | critical != "") %>%
  select(id, scientificName, original, harvey, fpnw, critical, reviewedBy)

timedWrite(history, history_file)
