# Map reporting status of vascular plants documented in the Átl’ka7tsem/Howe Sound Biosphere

# Set relative paths (https://stackoverflow.com/questions/13672720/r-command-for-setting-working-directory-to-source-file-location-in-rstudio)
if (!isTRUE(getOption('knitr.in.progress'))) {
  setwd(paste0(dirname(rstudioapi::getActiveDocumentContext()$path), "/.."))
}

# Load libraries

library(dplyr)
library(raster)
library(scales)
library(sf)
library(jsonlite)
library(viridis)
library(htmlwidgets)
library(plotly)

# Source dependencies

source("scripts/mapbox_map_common.R")

# Load map layers
# Layer 1: hillshade raster
hillshade.source <- geotiff_to_mapbox_source("spatial_data/rasters/Hillshade_80m.tif", id="Hillshade")
hillshade.feature <- list(type = "raster", source = "Hillshade", rasterOpacity = 0.8, paint = spectral_raster_color_paint(), Z_Order = 0.75)

# Layer 2: coastline
coastline <- mx_read("spatial_data/vectors/Islands_and_Mainland")
coastline.source <- sf_to_mapbox_sources(coastline, id = "Coastline")
coastline.feature <- list(type = "vector", source = "Coastline", outlineColor = "black", outlineWidth = 1.5, fillOpacity = 0)

# Layer 3: choropleth
choropleth.feature <- list(type = "choropleth");

# Layer 4: watershed boundary
watershed.boundary <- mx_read("spatial_data/vectors/Howe_Sound")
watershed.source <- sf_to_mapbox_sources(watershed.boundary, id = "Watershed.Boundary")
watershed.feature <- list(type = "vector", source = "Watershed.Boundary", outlineColor = "black", outlineWidth = 4, fillOpacity = 0)

allSources <- merge_lists(hillshade.source, coastline.source, watershed.source)

view.feature <- list(type = "view", lon = -123.2194, lat = 49.66076, zoom = 8.5)

allFeatures = list(view.feature, hillshade.feature, coastline.feature, choropleth.feature, watershed.feature)

reportingStatusMap <- plot_mapbox_map("Status", allSources, allFeatures)

# Note that this statement is only effective in standalone R
print(reportingStatusMap)



# Stacked bar plot of historic vs confirmed vs new records

summary <- read.csv("tabular_data/vascular_plant_summary_resynthesized_2024-11-14.csv", fileEncoding = "UTF-8")

# Simplify "new" values of reportingStatus
summary <- summary %>%
  mutate(reportingStatus = ifelse(str_detect(reportingStatus, "new"), "new", reportingStatus))

summary <- summary %>%
  mutate(reportingStatus = ifelse(reportingStatus == "reported", "historical", reportingStatus))

new <- summary %>% filter(reportingStatus == "new")
confirmed <- summary %>% filter(reportingStatus == "confirmed")
historical <- summary %>% filter(reportingStatus == "historical")

y <- c('records')
confirmed.no <- c(nrow(confirmed))
historical.no <- c(nrow(historical))
new.no <- c(nrow(new))

reporting.status <- data.frame(y, confirmed.no, historical.no, new.no)

reportingStatusFig <- plot_ly(height = 140, reporting.status, x = ~confirmed.no, y = ~y, type = 'bar', orientation = 'h', name = 'confirmed',
                      marker = list(color = '#5a96d2',
                             line = list(color = '#5a96d2',
                                         width = 1)))

# These names need to agree with those applied as labels to the map regions
reportingStatusFig <- reportingStatusFig %>% add_trace(x = ~historical.no, name = 'historical',
                         marker = list(color = '#decb90',
                                       line = list(color = '#decb90',
                                                   width = 1)))
reportingStatusFig <- reportingStatusFig %>% add_trace(x = ~new.no, name = 'new',
                         marker = list(color = '#7562b4',
                                       line = list(color = '#7562b4',
                                                   width = 1)))
reportingStatusFig <- reportingStatusFig %>% layout(barmode = 'stack', autosize=T, height=140, showlegend=FALSE,
                      xaxis = list(title = "Species Reporting Status"),
                      yaxis = list(title = "Records")) %>%
  layout(meta = list(mx_widgetId = "reportingStatus")) %>%
  layout(yaxis = list(showticklabels = FALSE)) %>%
  layout(yaxis = list(title = "")) %>%
  config(displayModeBar = FALSE, responsive = TRUE)

reportingStatusFig
