# Map the project areas of Harvey Janszen's regional checklists, each named on hover
# The areas are the "lists" layers of https://github.com/IMERSS/janszen-legacy-storymap

# Set relative paths (https://stackoverflow.com/questions/13672720/r-command-for-setting-working-directory-to-source-file-location-in-rstudio)
if (!isTRUE(getOption('knitr.in.progress'))) {
  setwd(paste0(dirname(rstudioapi::getActiveDocumentContext()$path), "/.."))
}

# Load libraries

library(dplyr)
library(plotly)
library(sf)

# Source dependencies

source("scripts/mapbox_map_common.R")

# This project's area, the Saanich Peninsula, is picked out in gold as an outcome of the broader initiative, whose
# other areas are drawn in a quiet blue-grey
gold <- "#FFD36B"
muted <- "#A8C8D0"

checklists <- data.frame(
  folder = c("Saanich", "Saltspring_Island", "Outer_Gulf_Islands", "San_Juan_Islands"),
  name = c("Saanich Peninsula and surrounding islets", "Salt Spring Island", "Outer Gulf Islands", "San Juan Islands")
)

# Read one checklist area as a single simplified shape, simplified since the shapes are written into the page and are
# only seen at a regional scale
read_checklist_area <- function (folder) {
  mx_read(paste0("spatial_data/vectors/Janszen_checklists/", folder)) %>%
    st_make_valid() %>%
    st_transform(26910) %>%
    st_union() %>%
    st_simplify(dTolerance = 50) %>%
    st_transform(4326)
}

areas <- lapply(checklists$folder, read_checklist_area)

checklists$id <- paste0("Checklist.", checklists$folder)

# The label of each area is the markup of its hover card, which names it
checklists$label <- sprintf("<div class=\"saanich-checklist-name\">%s</div>", checklists$name)

allSources <- do.call(merge_lists, lapply(seq_along(areas), function (i) {
  sf_to_mapbox_sources(st_sf(geometry = areas[[i]]), id = checklists$id[i], digits = 4)
}))

checklist.features <- lapply(seq_len(nrow(checklists)), function (i) {
  thisProject <- checklists$folder[i] == "Saanich"
  list(type = "vector", source = checklists$id[i], label = checklists$label[i],
       fillColor = if (thisProject) gold else muted, fillOpacity = if (thisProject) 0.45 else 0.14,
       outlineColor = if (thisProject) gold else muted, outlineWidth = if (thisProject) 2.5 else 1,
       outlineOpacity = if (thisProject) 1 else 0.7)
})

# Centred on the combined extent of the areas
extent <- st_bbox(do.call(c, areas))
view.feature <- list(type = "view", lon = unname((extent$xmin + extent$xmax) / 2), lat = unname((extent$ymin + extent$ymax) / 2), zoom = 8.9)

janszenChecklistsMap <- plot_mapbox_map("Remembering", allSources, c(list(view.feature), checklist.features))

# Note that this statement is only effective in standalone R
print(janszenChecklistsMap)
