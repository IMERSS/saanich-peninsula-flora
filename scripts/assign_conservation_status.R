library(dplyr)
library(stringr)

source("scripts/utils.R")
source("scripts/project.R")

# Assign each taxon of the prepared summary its conservation status, as the 2026 synthesis of the Átl’ka7tsem/Howe Sound
# Biosphere assigns it (adfsimon-bioinfo/Howe_Sound/2026_synthesis/scripts/assign_consevation_rankings.R): from the
# BC Conservation Data Centre's table of rankings, named as conservationRanks in bioreportr-prep.yaml, a file of
# big_data (not checked in). Each taxon is matched to its row of the table in passes, each taking only a single, unambiguous
# match among the taxa still unmatched:
#   1. by its iNaturalist id, which the table carries as iNaturalistTaxonId
#   2. by its scientific name
#   3. by its variety, then its subspecies, as the table names them
#   4. for a taxon of species rank, by its genus and species - not for an infrataxon, which would otherwise be given the
#      status of its species
# Its statuses are written as the synthesis's appendix tables write them:
#   provincial_status - the provincial rank with the year of its review, e.g. "S5 (2019)"
#   bc_list           - the BC list, e.g. "Yellow", "Blue", "Red" or "Exotic"
#   national_status   - COSEWIC's status with the year of its assessment, e.g. "Endangered (2008)", "Not at Risk" left out
#   sara_status       - the schedule and status under the Species at Risk Act, e.g. "S1: Endangered (2005)"
# A taxon the table doesn't rank keeps any provincial or national status its checklist gives it, in the columns
# provincial_conservation_status and national_conservation_status, or as project$conservation names them. conservation_source says which was used. Run after
# scripts/prepare_summary_final.R, whose output it extends in place; the output is copied into the site by R/build.R.
# This script is shared between the projects by copyFrameworkOut.sh

ranks_file <- file.path("big_data", config$conservationRanks)
list_file <- file.path("tabular_data", config$list)
status_columns <- c("provincial_status", "bc_list", "national_status", "sara_status", "conservation_source")

# A value, or "" if it has none
clean <- function (x) {
  x <- str_squish(as.character(x))
  ifelse(is.na(x) | x %in% c("NA", "Na", "N/A", "na"), "", x)
}

norm_key <- function (x) str_to_lower(clean(x))

year_of <- function (date) {
  year <- str_extract(clean(date), "(19|20)\\d{2}")
  ifelse(is.na(year), "", year)
}

# A status, with "Not at Risk" left out, as the synthesis leaves it out
without_not_at_risk <- function (status) {
  status <- str_replace_all(clean(status), regex("\\bNot\\s+at\\s+Risk\\b", ignore_case = TRUE), "")
  str_trim(str_replace_all(status, "^[:;,-]+\\s*|\\s*[:;,-]+$", ""))
}

with_year <- function (status, date) {
  status <- without_not_at_risk(status)
  year <- year_of(date)
  ifelse(status != "" & year != "", paste0(status, " (", year, ")"), status)
}

sara_of <- function (schedule, status, date) {
  schedule <- str_extract(clean(schedule), "\\d+")
  prefix <- ifelse(is.na(schedule), "", paste0("S", schedule))
  status <- without_not_at_risk(status)
  body <- case_when(
    prefix != "" & status != "" ~ paste0(prefix, ": ", status),
    prefix != "" ~ prefix,
    TRUE ~ status
  )
  year <- year_of(date)
  ifelse(body != "" & year != "", paste0(body, " (", year, ")"), body)
}

# The table's rows, apart from any whose columns are shifted, its provincial status not a rank - e.g. in the table of
# 10 April 2026, Betula pumila and Spiraea douglasii var. douglasii, whose provincial status reads as a date - which are
# reported and left out, so that their taxa fall back on their checklist's status
raw_ranks <- timedFread(ranks_file)
shifted <- clean(raw_ranks$provincial_status) != "" & !str_detect(clean(raw_ranks$provincial_status), "^S[0-9HXUN?]")
if (any(shifted)) {
  message("Left out ", sum(shifted), " rows of the rankings whose provincial status is not a rank: ",
          paste(raw_ranks$scientificName[shifted], collapse = ", "))
}

ranks <- raw_ranks[!shifted, ] %>%
  mutate(iNaturalistTaxonId = ifelse(clean(iNaturalistTaxonId) == "0", "", iNaturalistTaxonId)) %>%
  transmute(
    id = clean(iNaturalistTaxonId),
    name = norm_key(scientificName),
    variety = norm_key(variety),
    subspecies = norm_key(subspecies),
    genus_species = ifelse(clean(genus) != "" & clean(species) != "", norm_key(paste(genus, species)), ""),
    provincial_status = with_year(provincial_status, `Prov Status Review Date`),
    bc_list = clean(bc_list),
    national_status = with_year(national_status, `COSEWIC Date`),
    sara_status = sara_of(`SARA Schedule`, SARA_status, `SARA Date`)
  )

summary <- timedFread(project$summaryFile) %>%
  select(-any_of(status_columns))

# The match of each taxon of the summary in the table, by the passes above - NA where there is none, or more than one
taxa <- summary %>% filter(inSummary == 1)
match_by <- function (values, keys) {
  counts <- table(keys[keys != ""])
  unique_keys <- names(counts)[counts == 1]
  ifelse(values != "" & values %in% unique_keys, match(values, keys), NA_integer_)
}
matched <- rep(NA_integer_, nrow(taxa))
pass <- rep(NA_character_, nrow(taxa))
apply_pass <- function (label, values, keys, eligible = TRUE) {
  hit <- match_by(values, keys)
  take <- is.na(matched) & !is.na(hit) & eligible
  matched[take] <<- hit[take]
  pass[take] <<- label
  message(label, ": ", sum(take), " matched")
}
apply_pass("iNaturalist id", clean(taxa$id), ranks$id)
apply_pass("scientific name", norm_key(taxa$scientificName), ranks$name)
apply_pass("variety", norm_key(taxa$variety), ranks$variety)
apply_pass("subspecies", norm_key(taxa$subspecies), ranks$subspecies)
apply_pass("genus and species", norm_key(taxa$species), ranks$genus_species, eligible = clean(taxa$taxon_rank) == "species")
message("Unmatched: ", sum(is.na(matched)), " of ", nrow(taxa))

ranked <- taxa %>%
  transmute(id,
            provincial_status = ranks$provincial_status[matched],
            bc_list = ranks$bc_list[matched],
            national_status = ranks$national_status[matched],
            sara_status = ranks$sara_status[matched],
            conservation_source = ifelse(is.na(matched), "", paste0("BC CDC, by ", pass)))

# A taxon the table doesn't rank keeps any status its checklist gives it
# The checklist's columns naming each taxon and giving its statuses, as project$conservation names them in
# scripts/project.R, by default those of checklist-catalogue-alignment-workflow's lists
columns <- modifyList(list(name = "taxon_name", provincial = "provincial_conservation_status",
                           national = "national_conservation_status"), as.list(project$conservation))
# A checklist's COSEWIC status may be a code, e.g. "E", which is spelled out as the table spells its statuses, "Not at
# Risk" being left out as the synthesis leaves it out
cosewic_codes <- c(XX = "Extinct", XT = "Extirpated", E = "Endangered", T = "Threatened", SC = "Special Concern",
                   NAR = "", DD = "Data Deficient")
spell_cosewic <- function (status) {
  status <- clean(status)
  ifelse(status %in% names(cosewic_codes), unname(cosewic_codes[status]), without_not_at_risk(status))
}

listed <- timedFread(list_file)
checklist <- tibble(scientificName = listed[[columns$name]],
                    listProvincial = clean(listed[[columns$provincial]]),
                    listNational = spell_cosewic(listed[[columns$national]])) %>%
  distinct(scientificName, .keep_all = TRUE)

ranked <- ranked %>%
  left_join(taxa %>% select(id, scientificName), by = "id") %>%
  left_join(checklist, by = "scientificName") %>%
  mutate(across(c(provincial_status, bc_list, national_status, sara_status), clean),
         fromList = provincial_status == "" & national_status == "" & (coalesce(listProvincial, "") != "" | coalesce(listNational, "") != ""),
         provincial_status = ifelse(fromList, coalesce(listProvincial, ""), provincial_status),
         national_status = ifelse(fromList, coalesce(listNational, ""), national_status),
         conservation_source = ifelse(fromList, "checklist", conservation_source)) %>%
  select(id, all_of(status_columns))

out <- summary %>%
  left_join(ranked, by = "id") %>%
  mutate(across(all_of(status_columns), ~ coalesce(.x, "")))

timedWrite(out, project$summaryFile)
