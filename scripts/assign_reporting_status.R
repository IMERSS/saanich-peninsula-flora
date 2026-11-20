library(dplyr)

source("scripts/utils.R")
source("scripts/project.R")

# Assign each taxon of the checklist its reporting status afresh from its records, so that it follows the data each
# time they are refreshed rather than the ultimate list's status, fixed when that list was built. The status is
# assigned as checklist-catalogue-alignment-workflow's assign_occurrence_status assigns it, from the years of the
# taxon's records on the list - those of the catalogue marked "listed", or not marked at all:
#   confirmed   - recorded both before recentYear and since
#   unconfirmed - recorded only before it
#   new         - recorded only since it
# recentYear is the story's own, given in the settings of bioreportr.yaml, as the story page reads it - see the
# defaults of bioreportr.storyPage. The opening timeline's kinds of moment follow from these statuses - "Last seen" and
# "First noted" of an unconfirmed taxon, "Seen again" of a confirmed one, "Newly noticed" of a new one - see
# bioreportr.traces.buildEvents. A record annotated as excluded from the calculation of extirpation probability, e.g.
# of a planted population, in the file named as recordAnnotations in bioreportr.yaml, is not counted, as the story page
# doesn't count it as a sighting. A taxon none of whose records is dated keeps the status it had.
# Run after scripts/prepare_set_aside.R, which adds the records of the taxa restored to the list, and before
# scripts/intersectShapes.R. This script is shared between the projects by copyFrameworkOut.sh

recent_year <- yaml::read_yaml("bioreportr.yaml")$settings$recentYear %||% 2000

summary <- timedFread(project$summaryFile)
records <- readr::read_csv(project$obsFile, col_types = readr::cols(.default = readr::col_character()), na = character(),
                           progress = FALSE)
if ("checklist" %in% names(records)) {
  records <- records %>% filter(checklist %in% c("", "listed"))
}
annotations_file <- if (is.null(config$recordAnnotations)) NULL else file.path("tabular_data", config$recordAnnotations)
if (!is.null(annotations_file) && file.exists(annotations_file)) {
  excluded <- timedFread(annotations_file) %>% filter(excludeFromEP %in% c(TRUE, "TRUE")) %>% pull(occurrenceID)
  records <- records %>% filter(!(occurrenceID %in% excluded))
}

statuses <- records %>%
  transmute(id = iNaturalistTaxonId, year = suppressWarnings(as.integer(substr(eventDate, 1, 4)))) %>%
  filter(!is.na(year)) %>%
  group_by(id) %>%
  summarise(fresh = case_when(any(year < recent_year) & any(year >= recent_year) ~ "confirmed",
                              any(year < recent_year) ~ "unconfirmed",
                              TRUE ~ "new"), .groups = "drop")

out <- summary %>%
  mutate(id = as.character(id)) %>%
  left_join(statuses, by = "id") %>%
  mutate(listed = !is.na(inSummary) & inSummary == 1,
         changed = listed & !is.na(fresh) & coalesce(reportingStatus, "") != fresh)

changes <- out %>% filter(changed)
message("Reporting status changed for ", nrow(changes), " taxa",
        if (nrow(changes)) paste0(": ", paste0(changes$scientificName, " (", changes$reportingStatus, " → ", changes$fresh, ")",
                                               collapse = ", ")) else "")

out <- out %>%
  mutate(reportingStatus = ifelse(listed & !is.na(fresh), fresh, reportingStatus)) %>%
  select(-fresh, -listed, -changed)

timedWrite(out, project$summaryFile)
