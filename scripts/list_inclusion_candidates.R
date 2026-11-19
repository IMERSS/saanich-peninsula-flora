library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# List the taxa of the working list - the penultimate list, authoritative as to what is in the flora - which curators
# have reviewed but which are not on the checklist, for the curators to validate - a report, not a step of the site's
# data. A taxon is reviewed if a curator's initials are in its reviewed_by, "Automatic (EM)" not counting as a curator,
# and none of its flags - doubtful, persisting or waif, planted - marks it for exclusion. Each is placed in one of:
#   A - accepted but dropped: its review_status is "complete", and yet it was not carried to the list
#   B - reviewed, not yet marked so: its review_status is still "in progress" or "remaining", and only needs marking
#       "complete" to be carried to the list - its TO_REVIEW is given, since it may still ask for another look
# A taxon is counted as on the list if the list holds its name, or its iNaturalist id. Any taxon of the list which shares
# its species - its first two words, of its name or its iNaturalist name - is given as related_on_list, so that one held
# on the list at another rank or under another name may be told apart from one truly missing.
# Written to tabular_data/<project>_inclusion-candidates_<date>.csv

working <- timedFread(file.path("tabular_data", config$workingList))
listed <- timedFread(file.path("tabular_data", config$list))

species_of <- function (name) word(str_remove_all(coalesce(name, ""), "\\b(ssp|subsp|var|f)\\. "), 1, 2)
listed_species <- listed %>%
  transmute(listed_name = taxon_name, key1 = species_of(taxon_name), key2 = species_of(link_name))

related <- function (name, link) {
  keys <- setdiff(c(species_of(name), species_of(link)), NA)
  hits <- listed_species$listed_name[listed_species$key1 %in% keys | listed_species$key2 %in% keys]
  paste(setdiff(hits, name), collapse = "; ")
}

on_list <- working$taxon_name %in% listed$taxon_name |
  (!is.na(working$link_taxon_id) & working$link_taxon_id %in% listed$link_taxon_id)
flagged <- working$is_doubtful == "yes" | working$is_persisting_or_waif == "yes" | working$is_planted == "yes"

candidates <- working %>%
  mutate(on_list = on_list, flagged = flagged) %>%
  mutate(curators = sapply(str_split(coalesce(reviewed_by, ""), ",\\s*"),
                           function (x) paste(setdiff(str_trim(x), c("", "Automatic (EM)")), collapse = ", "))) %>%
  filter(!on_list, !flagged, curators != "") %>%
  mutate(tier = ifelse(review_status == "complete", "A: accepted but dropped", "B: reviewed, not yet marked so")) %>%
  rowwise() %>%
  mutate(related_on_list = related(taxon_name, link_name)) %>%
  ungroup() %>%
  select(tier, taxon_name, link_name, link_taxon_id, family, review_status, TO_REVIEW, curators, reviewed_by, confidence, regionally_confirmed,
         introduction_status, n_total, n_research_grade, n_preserved_specimen, first_record_date, last_record_date,
         last_record_location, related_on_list, critical_comments) %>%
  arrange(tier, review_status, taxon_name)

out_file <- file.path("tabular_data", paste0("Saanich_Tracheophyta_inclusion-candidates_", Sys.Date(), ".csv"))
timedWrite(candidates, out_file)
print(table(candidates$tier))
