library(dplyr)
library(tidyr)
library(stringr)
library(sf)

source("scripts/utils.R")
source("scripts/project.R")

# Merge together the two summaries, reduce columns ready for assignment

rawList <- timedFread(file.path("tabular_data", config$list))
reducedList <- rawList %>% select(c("taxon_name", "link_name", "link_taxon_id", "taxon_rank", "infrataxon_status",
                                    "provenance_status", "provincial_concern", "introduction_status", "occurrence_status", "solow_EP"))

reducedList <- reducedList %>% rename("reportingStatus" = "occurrence_status", "scientificName" = "taxon_name")
reducedList$phylum = "Tracheophyta"

timedWrite(reducedList, file.path("tabular_data", config$summaryOrig))

# Next: node node_modules/imerss-bioinfo/src/assignBNames.js tabular_data/<summaryOrig of bioreportr.yaml> --DwCA --swaps tabular_data/taxon-swaps.csv
cat("Next: node node_modules/imerss-bioinfo/src/assignBNames.js", shQuote(file.path("tabular_data", config$summaryOrig)), "--DwCA --swaps tabular_data/taxon-swaps.csv\n")
