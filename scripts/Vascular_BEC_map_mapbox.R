# Visualize vascular plant diversity in Átl’ka7tsem by BEC unit

# Set relative paths (https://stackoverflow.com/questions/13672720/r-command-for-setting-working-directory-to-source-file-location-in-rstudio)
if (!isTRUE(getOption('knitr.in.progress'))) {
  setwd(paste0(dirname(rstudioapi::getActiveDocumentContext()$path), "/.."))
}

# Load libraries

library(dplyr)
library(sf)

# Source dependencies

source("scripts/mapbox_map_common.R")

# Create color palette for BEC Zones

# Following rough elevational gradient:
# CDFmm, CWHxm1, CWHdm, CWHvm1, CWHvm2, CWHds1, CWHms1, MHmm1, MHmm2, ESSFmw2, CMAunp

palette = data.frame(
  cat = c("CWHxm1","CWHdm","CWHvm2","CWHvm1","CWHds1","CWHms1","MHmm1","MHmm2","CMAunp"),
  col = c("#440154", "#472D7B","#3B528B","#2C728E","#21908C","#27AD81","#5DC863","#AADC32", "#FDE725")
)

# Create map labels

becLabels <- list(CMAunp = "Coastal Mountain Heather Alpine Zone",
                  CWHdm  = "Dry Maritime Coastal Western Hemlock Zone",
                  CWHds1 = "Southern Dry Submaritime Coastal Western Hemlock Zone",
                  CWHms1 = "Southern Moist Submaritime Coastal Western Hemlock Zone",
                  CWHvm1 = "Submontane Very Wet Maritime Coastal Western Hemlock Zone",
                  CWHvm2 = "Montane Very Wet Maritime Coastal Western Hemlock Zone",
                  CWHxm1 = "Eastern Very Dry Maritime Coastal Western Hemlock Zone",
                  MHmm1 = "Windward Moist Maritime Mountain Hemlock Zone",
                  MHmm2 = "Leeward Moist Maritime Mountain Hemlock Zone")

# Layer 1: hillshade raster
hillshade.source <- geotiff_to_mapbox_source("spatial_data/rasters/Hillshade_80m.tif", id="Hillshade")
hillshade.feature <- list(type = "raster", source = "Hillshade", rasterOpacity = 0.8, paint = spectral_raster_color_paint(), Z_Order = 0.75)

# Layer 2: BEC zones
BEC <- mx_read("spatial_data/vectors/BEC")
BEC.sources <- sf_to_mapbox_sources(BEC, idField = "MAP_LABEL")
BEC.features <- palette %>%
  dplyr::rename(source = cat, fillColor = col) %>%
  dplyr::mutate(label = becLabels[source],
                fillOpacity = 0.6,
                outlineOpacity = 0,
                selectable = TRUE,
                type = "vector"
  ) %>% df_to_list

# Layer 3: coastline
coastline <- mx_read("spatial_data/vectors/Islands_and_Mainland")
coastline.source <- sf_to_mapbox_sources(coastline, id = "Coastline")
coastline.feature <- list(type = "vector", source = "Coastline", outlineColor = "black", outlineWidth = 1.5, fillOpacity = 0)

# Layer 4: watershed boundary
watershed.boundary <- mx_read("spatial_data/vectors/Howe_Sound")
watershed.source <- sf_to_mapbox_sources(watershed.boundary, id = "Watershed.Boundary")
watershed.feature <- list(type = "vector", source = "Watershed.Boundary", outlineColor = "black", outlineWidth = 4, fillOpacity = 0)

allSources <- merge_lists(BEC.sources, hillshade.source, coastline.source, watershed.source)

view.feature <- list(type = "view", lon = -123.2194, lat = 49.66076, zoom = 8.5)

# Combine features in desired order
allFeatures = c(list(view.feature, hillshade.feature), BEC.features, list(coastline.feature, watershed.feature))

speciesMap <- plot_mapbox_map("Vascular_BEC", allSources, allFeatures, "BEC")

# Note that this statement is only effective in standalone R
print(speciesMap)
