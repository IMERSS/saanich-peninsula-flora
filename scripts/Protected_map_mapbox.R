# Map Átl’ka7tsem's vascular plant diversity in relation to protected areas

# Set relative paths (https://stackoverflow.com/questions/13672720/r-command-for-setting-working-directory-to-source-file-location-in-rstudio)
if (!isTRUE(getOption('knitr.in.progress'))) {
  setwd(paste0(dirname(rstudioapi::getActiveDocumentContext()$path), "/.."))
}

# Load libraries

library(dplyr)
library(plotly)
library(sf)
library(stringr)

# Source dependencies

source("scripts/mapbox_map_common.R")

# Load Protected Areas Shape
protected.areas <- mx_read(
  "spatial_data/vectors/AHSBR_vascular_plant_diversity_x_protected_areas_2024"
)

# Create labels
protected.areas$prtct__[is.na(protected.areas$prtct__)] <- 0
protected.areas$label <- paste(
  protected.areas$prtctdA,
  ":",
  protected.areas$prtct__,
  "species",
  sep = " "
)

palette <- data.frame(
  types = unique(protected.areas$prtctAT),
  colors = c(
    "#8b4513", "#008000", "#4682b4", "#4b0082", "#ff0000", "#00ff00", "#00ffff", "#0000ff", "#ffff54", "#ff69b4", "#ffe4c4"
  )[seq_along(unique(protected.areas$prtctAT))]
)

# Layer 1: hillshade raster
hillshade.source <- geotiff_to_mapbox_source("spatial_data/rasters/Hillshade_80m.tif",id = "Hillshade")
hillshade.feature <- list(type = "raster", source = "Hillshade", rasterOpacity = 0.8, paint = spectral_raster_color_paint(), Z_Order = 0.75)


# Layer 2: Protected areas (vector)
protected.sources <- sf_to_mapbox_sources(
  protected.areas,
  idField = "prtctAT"
)

protected.features <- palette %>%
  dplyr::rename(source = types, fillColor = colors) %>%
  dplyr::mutate(
    label = protected.areas$label[match(source, protected.areas$prtctAT)],
    fillOpacity = 0.8,
    outlineOpacity = 0,
    selectable = TRUE,
    type = "vector"
  ) %>%
  df_to_list

# Layer 3: coastline
coastline <- mx_read("spatial_data/vectors/Islands_and_Mainland")
coastline.source <- sf_to_mapbox_sources(coastline, id = "Coastline")
coastline.feature <- list(type = "vector", source = "Coastline", outlineColor = "black", outlineWidth = 1.5, fillOpacity = 0)

# Layer 4: watershed boundary
watershed.boundary <- mx_read("spatial_data/vectors/Howe_Sound")
watershed.source <- sf_to_mapbox_sources(watershed.boundary, id = "Watershed.Boundary")
watershed.feature <- list(type = "vector", source = "Watershed.Boundary", outlineColor = "black", outlineWidth = 4, fillOpacity = 0)

allSources <- merge_lists(protected.sources, hillshade.source, coastline.source, watershed.source)

view.feature <- list(type = "view", lon = -123.2194, lat = 49.66076, zoom = 8.5)

allFeatures = c(list(view.feature, hillshade.feature), protected.features, list(coastline.feature, watershed.feature))

protectedAreaMap <- plot_mapbox_map("Protected", allSources, allFeatures, "Protected")

# Note that this statement is only effective in standalone R
print(protectedAreaMap)

# Create dataframe summarizing plant diversity by protected area type

types <- as.factor(unique(protected.areas$prtctAT))
count <- vector(mode="numeric", length=length(types))

protected.area.summary <- data.frame(types, count)

protected.area.summary$count <- protected.areas$prtctd_r__[match(unlist(protected.area.summary$types), protected.areas$prtctAT)]

protected.area.summary <- protected.area.summary[order(protected.area.summary$types),]

protected.area.summary$types <- factor(protected.area.summary$types, levels = unique(protected.area.summary$types)[order(protected.area.summary$count, decreasing = TRUE)])


# Create Plotly bar plot showing species diversity represented within protected area types

# First add color palette matching with map

protected.area.summary$colors <- palette$colors[match(unlist(protected.area.summary$types), palette$types)]

colormap <- setNames(object = protected.area.summary$colors,
                     nm = protected.area.summary$types)

# Plot

protected.area.plot <- plot_ly(
  data = protected.area.summary,
  y = ~types,
  x = ~count,
  color = ~types,
  colors = colormap,
  opacity = 0.8,
  type = "bar"
) %>% 
  layout(
    showlegend = FALSE,
    xaxis = list(categoryorder = "category ascending", title = "Species Reported by Protected Area"),
    yaxis = list(title = "", width = 1024),
    meta = list(mx_widgetId = "protectedAreas")
  )

protected.area.plot
