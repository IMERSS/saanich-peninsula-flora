library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# Prepare the history of the curatorial notes on each taxon, shown by the History tab of the curation pane, the Notes
# tab of the atlas's panel and the back of each card of the Lost Plants gallery. The notes are read from the columns of
# the project's checklist named by project$curation$history, in scripts/project.R - each field of the output, named as
# the story's curationHistorySources name it, from the first of its columns which holds a note. A field may be one of
# project$curation$expandInitials, whose reviewers' initials are spelled out, or project$curation$reviewedBy, naming
# who has reviewed the taxon.
# Each taxon is given the id by which the site knows it, matched on its scientific name in the prepared summary, which
# must be prepared first - see scripts/prepare_summary.R. If the project names a working list in bioreportr-prep.yaml,
# the taxa it holds which didn't reach the checklist - excluded by the curators, or still under review - are given
# their history from the same columns of the working list, keyed by their iNaturalist id, or by "name:" and their name
# where they have none, so that the Lost Plants gallery's Excluded and Under review tabs show their notes from this one
# file - see scripts/prepare_excluded_taxa.R. The output is copied into the site by R/build.R
# This script is shared between the projects by copyFrameworkOut.sh

settings <- project$curation
list_file <- file.path("tabular_data", config$list)
history_file <- file.path("tabular_data", config$curationHistory)
name_column <- settings$nameColumn

# Spell out the initials of each reviewer, as a list of names
spell_out <- function (text) {
  for (initials in names(settings$reviewers)) {
    text <- str_replace_all(text, paste0("\\b", initials, "\\b"), settings$reviewers[[initials]])
  }
  text
}

# The pattern of a reviewer's signature - parentheses holding nothing but reviewers' initials, e.g. "(TL)" or "(AS, PD)";
# or reviewers' initials alone to the end of a clause - before ";", "." or the end of the note - led by a dash, e.g.
# "-QC" or "- AS, HJ", or following the end of a sentence or quotation, e.g. 'naturalized." QC' or "escape? QC"
reviewer_initials <- paste0("(?:", paste(names(settings$reviewers), collapse = "|"), ")\\b")
initials_list <- paste0(reviewer_initials, "(?:\\s*[,&/]\\s*", reviewer_initials, ")*(?=\\s*(?:[;.]|$))")
signature <- paste0("\\(\\s*(?:", reviewer_initials, "[\\s,;&/]*)+\\)",
                    "|[\u2013\u2014-]\\s*", initials_list,
                    "|(?<=[?!.\"\u201d] )", initials_list)

# Spell out the initials of the reviewers who signed a note, in their signatures alone - initials anywhere else, e.g. those
# by which Harvey Janszen names the collectors of specimens, "FL Finnerty Cove 1993", are left as written
expand_initials <- function (text) {
  str_replace_all(text, signature, spell_out)
}

# Name the reviewers of a taxon, each once, crediting any automatic review to its reviewer as project$curation$automatic
# says - e.g. "EM, Automatic (EM)" being simply "Emma Menchions"
name_reviewers <- function (text) {
  for (pattern in names(settings$automatic)) {
    text <- str_replace_all(text, fixed(pattern), settings$automatic[[pattern]])
  }
  named <- spell_out(text)
  vapply(str_split(named, ",\\s*"), function (names) paste(unique(names[names != ""]), collapse = ", "), character(1))
}

# A note's text, or "" if it has none
clean <- function (text) {
  text <- ifelse(is.na(text) | text == "NA", "", as.character(text))
  str_trim(text)
}

# The first note among the given columns of each row
first_note <- function (rows, columns) {
  notes <- rep("", nrow(rows))
  for (column in intersect(columns, names(rows))) {
    notes <- ifelse(notes == "", clean(rows[[column]]), notes)
  }
  notes
}

# The notes of a list's rows, each with its scientificName
notes_of <- function (rows) {
  fields <- lapply(names(settings$history), function (field) {
    notes <- first_note(rows, settings$history[[field]])
    if (field %in% settings$expandInitials) expand_initials(notes) else
      # identical(), since a project whose notes name no reviewer has no reviewedBy field
      if (identical(field, settings$reviewedBy)) name_reviewers(notes) else notes
  })
  names(fields) <- names(settings$history)
  bind_cols(tibble(scientificName = rows[[name_column]]), as_tibble(fields))
}

# The fields which hold notes, as distinct from who reviewed them - a taxon with none of them has no history
note_fields <- setdiff(names(settings$history), settings$reviewedBy)

has_notes <- function (history) {
  history %>% filter(if_any(all_of(note_fields), ~ .x != ""))
}

rawList <- timedFread(list_file)
taxa <- timedFread(project$summaryFile) %>%
  filter(!is.na(scientificName) & scientificName != "") %>%
  select(id, scientificName) %>%
  distinct(scientificName, .keep_all = TRUE)

listed <- notes_of(rawList) %>%
  inner_join(taxa, by = "scientificName") %>%
  mutate(id = as.character(id)) %>%
  has_notes()

# The rows of the working list which didn't reach the checklist, if the project has one
setAsideHistory <- if (is.null(config$workingList)) NULL else {
  workingList <- timedFread(file.path("tabular_data", config$workingList))
  setAside <- workingList[!(workingList[[name_column]] %in% rawList[[name_column]]), ]
  notes_of(setAside) %>%
    mutate(id = set_aside_id(setAside[[settings$idColumn]], setAside[[name_column]])) %>%
    has_notes()
}

history <- bind_rows(listed, setAsideHistory) %>%
  distinct(id, .keep_all = TRUE) %>%
  select(id, scientificName, all_of(names(settings$history)))

timedWrite(history, history_file)
