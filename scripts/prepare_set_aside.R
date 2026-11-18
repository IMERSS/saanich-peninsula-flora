library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# Bring the taxa which checklist-catalogue-alignment-workflow kept off the list, and their records, into the story's
# data, beside the list's own, so that the Atlas may show them and Living Data curate them once they are chosen through
# its Checklist status filter, which shows the list's own alone until another status is chosen - see
# bioreportr-checklistStatusFilter.vue. Nothing here changes the list's own taxa or records, or anything counted from
# them: the taxa added are never inSummary, and every record is marked by its checklist status.
#   1. The taxa - those assigned to the iNaturalist taxonomy by assignBNames.js from the file written by
#      scripts/prepare_set_aside_taxa.R, and any of their parents not already in the summary - are added to the prepared
#      summary, each marked by its checklist_status, "excluded" or "underReview". A taxon assigned to the id of one of the
#      list's own taxa is the list's already, under that name, and is reported and left out.
#   2. Their records, from the penultimate catalogue, a file of big_data (not checked in), are matched to them by
#      iNaturalist id, or by the names and synonyms under which the working list knows them, and shaped as
#      scripts/prepare_obs.R shapes the list's records. They are added to the prepared catalogue, each with its
#      `checklist`, the status of its taxon, the list's own records being marked "listed". A record which the catalogue
#      already holds under one of the list's taxa is left out, so that no record is counted twice.
# Run after scripts/prepare_summary_final.R and scripts/assign_conservation_status.R, which rewrite the summary, and
# before scripts/intersectShapes.R, which labels the records with their regions. It may be run again, replacing what it
# added before.
# This script is shared between the projects by copyFrameworkOut.sh

clean <- function (x) {
  x <- str_squish(as.character(x))
  ifelse(is.na(x) | x %in% c("NA", "Na", "N/A", "na"), "", x)
}

# ── 1. The taxa ────────────────────────────────────────────

# What an earlier run added is removed - the rows it added, marked set_aside_added, and its marks on the rows which were
# there before - so that the step may be run again
summary <- timedFread(project$summaryFile)
if ("set_aside_added" %in% names(summary)) {
  summary <- summary %>% filter(!(set_aside_added %in% c(TRUE, "TRUE")))
}
summary <- summary %>%
  select(-any_of(c("checklist_status", "set_aside_added"))) %>%
  mutate(id = as.character(id), parentId = as.character(parentId))
listed_ids <- summary$id[!is.na(summary$inSummary) & summary$inSummary == 1]

assigned <- timedFread(file.path("tabular_data", config$setAsideAssigned)) %>%
  mutate(id = clean(iNaturalistTaxonId), scientificName = clean(scientificName)) %>%
  filter(id != "" & id != "0")
assignedTaxa <- timedFread(file.path("tabular_data", config$setAsideAssignedTaxa)) %>%
  mutate(id = as.character(id), parentId = as.character(parentId))

already <- assigned %>% filter(id %in% listed_ids)
if (nrow(already) > 0) {
  message("Left out ", nrow(already), " taxa kept off the list whose id is that of one of the list's own taxa: ",
          paste(already$scientificName, collapse = ", "))
}
setAside <- assigned %>%
  filter(!(id %in% listed_ids)) %>%
  distinct(id, .keep_all = TRUE) %>%
  select(id, scientificName, taxon_rank, introduction_status, checklist_status)

# Every taxon of the assignment not already in the summary - the taxa kept off the list and their parents
newTaxa <- assignedTaxa %>%
  filter(!(id %in% summary$id)) %>%
  select(any_of(names(summary))) %>%
  left_join(setAside %>% rename(sa_name = scientificName, sa_rank = taxon_rank, sa_intro = introduction_status),
            by = "id") %>%
  mutate(scientificName = ifelse(!is.na(sa_name), sa_name, if ("scientificName" %in% names(.)) scientificName else NA),
         taxon_rank = ifelse(!is.na(sa_rank), sa_rank, if ("taxon_rank" %in% names(.)) taxon_rank else NA),
         introduction_status = ifelse(!is.na(sa_intro), sa_intro, if ("introduction_status" %in% names(.)) introduction_status else NA),
         checklist_status = ifelse(is.na(checklist_status), "", checklist_status),
         set_aside_added = TRUE) %>%
  select(-sa_name, -sa_rank, -sa_intro)
# A taxon kept off the list may be a parent already in the summary, e.g. a species whose variety is listed - it is
# marked there, without being counted as in the summary
inSummaryParents <- setAside %>% filter(id %in% summary$id)

summaryOut <- summary %>%
  mutate(checklist_status = ifelse(id %in% inSummaryParents$id & (is.na(inSummary) | inSummary != 1),
                                   setAside$checklist_status[match(id, setAside$id)], ""),
         set_aside_added = FALSE) %>%
  bind_rows(newTaxa)
message("Added ", nrow(newTaxa), " taxa to the summary, of which ", sum(newTaxa$checklist_status != ""),
        " kept off the list and the rest their parents; marked ", sum(summaryOut$checklist_status != "" & summaryOut$id %in% summary$id),
        " taxa already present")
timedWrite(summaryOut, project$summaryFile)

# ── 2. Their records ───────────────────────────────────────

marked <- summaryOut %>% filter(checklist_status != "")
working <- if (is.null(config$workingList)) NULL else timedFread(file.path("tabular_data", config$workingList))

# The names under which each taxon kept off the list may be catalogued: its own, and the working list's link name and
# synonyms, separated by ";" in its verbatim names
names_of <- function (name) {
  row <- if (is.null(working)) NULL else working[working[[project$curation$nameColumn]] == name, ]
  extra <- if (is.null(row) || nrow(row) == 0) character() else
    c(row$link_name[1], str_split(row$verbatim_taxon_name[1], ";")[[1]])
  names <- str_trim(c(name, extra))
  unique(names[!is.na(names) & names != ""])
}
name_index <- bind_rows(lapply(seq_len(nrow(marked)), function (i)
  tibble(name = names_of(marked$scientificName[i]), id = marked$id[i]))) %>%
  group_by(name) %>% filter(n_distinct(id) == 1) %>% ungroup() %>% distinct()

catalogue <- timedFread(file.path("big_data", config$penultimateCatalogue)) %>%
  mutate(linkTaxonID = clean(linkTaxonID))
byId <- match(catalogue$linkTaxonID, marked$id)
byName <- coalesce(match(catalogue$linkName, name_index$name), match(catalogue$originalLinkName, name_index$name))
taxonId <- ifelse(!is.na(byId), marked$id[byId], ifelse(!is.na(byName), name_index$id[byName], NA))

records <- catalogue[!is.na(taxonId), ] %>%
  mutate(iNaturalistTaxonId = taxonId[!is.na(taxonId)])
records <- records %>%
  mutate(taxon_name = marked$scientificName[match(iNaturalistTaxonId, marked$id)],
         checklist = marked$checklist_status[match(iNaturalistTaxonId, marked$id)],
         coordinateUncertaintyInMeters = coalesce(as.numeric(coordinateUncertaintyInMeters), as.numeric(coordinateUncertaintyInMetres)))
# Obscured records carry only iNaturalist's randomised point, as in scripts/prepare_obs.R
obscured <- records$coordinates_obscured %in% c(TRUE, "TRUE")
records$decimalLatitude[obscured] <- NA
records$decimalLongitude[obscured] <- NA

# Read as text by readr, which undoes the doubling of the quotes within a field, so that the list's records are written
# back exactly as they were - data.table's fread keeps the doubled quotes, so that each pass through it and fwrite
# would double them again
obs <- readr::read_csv(project$obsFile, col_types = readr::cols(.default = readr::col_character()), na = character(), trim_ws = FALSE,
                       progress = FALSE)
if ("checklist" %in% names(obs)) {
  obs <- obs %>% filter(is.na(checklist) | checklist == "" | checklist == "listed")
}
obs$checklist <- "listed"

records <- records %>%
  select(any_of(names(obs))) %>%
  filter(!(clean(occurrenceID) != "" & occurrenceID %in% obs$occurrenceID)) %>%
  mutate(across(everything(), ~ ifelse(is.na(.x), "", as.character(.x))))
message("Added ", nrow(records), " records of ", n_distinct(records$iNaturalistTaxonId), " taxa kept off the list: ",
        paste(names(table(records$checklist)), table(records$checklist), collapse = ", "))

timedWrite(bind_rows(obs, records), project$obsFile)
cat("Next: Rscript scripts/intersectShapes.R, then the build - R/build.R packs the records and taxa\n")
