library(sf)

source("scripts/utils.R")
source("scripts/project.R")

# Write the project's study area - the boundary which frames its maps, project$protected$boundary in scripts/project.R -
# as KML, for anyone to open in Google Earth or a GPS app, to the file named as studyArea in bioreportr.yaml. R/build.R
# publishes it beside the story's other data, and the Atlas pane links to it.
# This script is shared between the projects by copyFrameworkOut.sh

study_area_file <- file.path("tabular_data", config$studyArea)

boundary <- project$protected$boundary() %>%
  st_transform(4326) %>%
  st_union() %>%
  st_sf(Name = "Study area", geometry = .)

if (file.exists(study_area_file)) {
  file.remove(study_area_file)
}
st_write(boundary, study_area_file, driver = "KML", quiet = TRUE)
cat("Written study area to", study_area_file, "\n")
