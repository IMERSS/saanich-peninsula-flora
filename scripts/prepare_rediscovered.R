library(dplyr)
library(httr)
library(jsonlite)

source("scripts/utils.R")
source("scripts/project.R")

# List the lost plants found again: the taxa of the project's iNaturalist project of lost plants - a collection project
# whose taxa are the plants counted as lost when it began - observed within it since the date given, as
# project$lostPlants names them in scripts/project.R. The Lost Plants pane adds each to its gallery of lost plants,
# marked as found again - see bioreportr.lostPlants.select. Written to the file named as rediscovered in
# bioreportr.yaml, which R/build.R publishes. Run again to bring in later finds - it asks iNaturalist afresh each time.
# Each observation is matched to a taxon of the list - one of the summary's inSummary - by iNaturalist id alone, never
# by name: to the taxon observed, or the nearest of its ancestors which the list holds, e.g. the species of a variety
# observed; or else, where the list holds the taxon observed only as one of its descendants, e.g. a variety of a
# species observed, to that descendant, if the list holds only one of them, as iNaturalist's lineage of each of the
# list's taxa of the genus shows. An observation matching no taxon of the list, or more than one, is reported and left
# out.
#   id               - the iNaturalist id of the taxon of the list
#   scientificName   - its name, as the summary's iNaturalistTaxonName holds it
#   first_found      - the date of its first observation since the date given
#   last_found       - the date of its latest
#   n_observations   - how many observations of it there are since then
#   research_grade   - TRUE if any of them is of research grade, i.e. its identification is confirmed by the community
#   observation_url  - the latest observation, of research grade if any is
#   observed_as      - the taxa observed which were matched to it, with their ids, for checking the match
# This script is shared between the projects by copyFrameworkOut.sh

settings <- project$lostPlants
out_file <- file.path("tabular_data", config$rediscovered)

inat_get <- function (path, query = list()) {
  Sys.sleep(1.1)
  response <- GET(paste0("https://api.inaturalist.org/v1/", path), query = query,
                  user_agent("bioReportR data preparation (IMERSS)"))
  stop_for_status(response)
  fromJSON(content(response, as = "text", encoding = "UTF-8"), simplifyVector = FALSE)
}

# The project's taxa - those counted as lost when it began
project_record <- inat_get(paste0("projects/", settings$inatProject))$results[[1]]
project_taxa <- unlist(lapply(Filter(function (p) p$field == "taxon_id", project_record$search_parameters), `[[`, "value"))
project_taxa <- as.character(project_taxa)
cat("The project", project_record$title, "lists", length(project_taxa), "taxa\n")

# Its observations since the date given
observations <- list()
page <- 1
repeat {
  answer <- inat_get("observations", list(project_id = project_record$id, d1 = settings$foundSince,
                                          quality_grade = "research,needs_id", per_page = 200, page = page))
  observations <- c(observations, answer$results)
  if (length(observations) >= answer$total_results || length(answer$results) == 0) break
  page <- page + 1
}
cat("Found", length(observations), "observations since", settings$foundSince, "\n")

# The list's taxa
summary <- timedFread(project$summaryFile) %>%
  filter(inSummary == 1) %>%
  transmute(id = as.character(id), scientificName = iNaturalistTaxonName)
listed_ids <- summary$id

# The lineage of each of the list's taxa of a genus, as iNaturalist gives it, fetched once for each genus asked for
lineages <- list()
lineages_of_genus <- function (genus) {
  if (is.null(lineages[[genus]])) {
    ids <- summary$id[startsWith(summary$scientificName, paste0(genus, " "))]
    found <- list()
    for (batch in split(ids, ceiling(seq_along(ids) / 30))) {
      for (taxon in inat_get(paste0("taxa/", paste(batch, collapse = ",")), list(per_page = 30))$results) {
        found[[as.character(taxon$id)]] <- as.character(unlist(taxon$ancestor_ids))
      }
    }
    lineages[[genus]] <<- found
  }
  lineages[[genus]]
}

# The taxon of the list which an observation is of - see above
listed_taxon <- function (taxon) {
  lineage <- as.character(c(unlist(taxon$ancestor_ids), taxon$id))
  within <- intersect(rev(lineage), listed_ids)
  if (length(within)) return(within[1])
  genus <- strsplit(taxon$name, " ")[[1]][1]
  beneath <- names(Filter(function (ancestors) as.character(taxon$id) %in% ancestors, lineages_of_genus(genus)))
  if (length(beneath) == 1) beneath else NA_character_
}

finds <- bind_rows(lapply(observations, function (o) {
  tibble(observed = paste0(o$taxon$name, " (", o$taxon$id, ")"), id = listed_taxon(o$taxon),
         observed_on = o$observed_on %||% NA_character_, research = identical(o$quality_grade, "research"), url = o$uri)
}))

unmatched <- finds %>% filter(is.na(id)) %>% distinct(observed)
if (nrow(unmatched)) {
  warning("Observations matching no single taxon of the list, left out: ", paste(unmatched$observed, collapse = ", "))
}

rediscovered <- finds %>%
  filter(!is.na(id), !is.na(observed_on)) %>%
  arrange(desc(research), desc(observed_on)) %>%
  group_by(id) %>%
  summarise(first_found = min(observed_on), last_found = max(observed_on), n_observations = n(),
            research_grade = any(research), observation_url = first(url),
            observed_as = paste(unique(observed), collapse = "; "), .groups = "drop") %>%
  inner_join(summary, by = "id", relationship = "one-to-one") %>%
  select(id, scientificName, first_found, last_found, n_observations, research_grade, observation_url, observed_as) %>%
  arrange(scientificName)

timedWrite(rediscovered, out_file)
