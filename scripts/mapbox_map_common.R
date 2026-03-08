library(rlang)
library(sf)
library(dplyr)
library(plotly)
library(glue)
library(geojsonio)
library(rjson)
library(rlist)
library(terra)
library(rmapshaper)

source("scripts/utils.R")

#' Convert a GeoTIFF to JPG and return a Mapbox GL JS image source definition
geotiff_to_mapbox_source <- function(tiff_path, id) {

  if (!file.exists(tiff_path)) {
    stop("File not found: ", tiff_path)
  }

  # Output to img/<original_filename>.jpg
  # - relative to the Rmd directory if knitting
  # - under static/img/ otherwise
  jpg_filename <- paste0(tools::file_path_sans_ext(basename(tiff_path)), ".jpg")

  rmd_input <- knitr::current_input(dir = TRUE)
  if (!is.null(rmd_input)) {
    img_dir <- file.path(dirname(rmd_input), "img")
  } else {
    img_dir <- file.path("static", "img")
  }
  dir.create(img_dir, showWarnings = FALSE, recursive = TRUE)
  jpg_path <- file.path(img_dir, jpg_filename)

  r <- terra::rast(tiff_path)

  if (!terra::is.lonlat(r)) {
    message("Reprojecting from ", terra::crs(r, describe = TRUE)$name, " to WGS84...")
    r <- terra::project(r, "EPSG:4326")
  }

  e <- terra::ext(r)

  if (terra::nlyr(r) != 1) {
    message("Using first band only.")
    r <- r[[1]]
  }

  # Rescale to 0-255 greyscale
  vals <- terra::values(r, mat = FALSE, na.rm = FALSE)
  vmin <- min(vals, na.rm = TRUE)
  vmax <- max(vals, na.rm = TRUE)
  message("Value range: ", vmin, " to ", vmax)

  scaled <- round((vals - vmin) / (vmax - vmin) * 255)
  scaled[is.na(scaled)] <- 255

  out <- terra::rast(r)
  terra::values(out) <- scaled

  terra::writeRaster(out, jpg_path, filetype = "JPEG", overwrite = TRUE,
                     datatype = "INT1U")

  message("Wrote greyscale JPG to: ", jpg_path)

  # URL: relative to the Rmd/HTML when knitting, filesystem path otherwise.
  # When knitting, img/<filename>.jpg resolves from the HTML's directory.
  # When running standalone, the caller may need to adjust the URL.
  if (!is.null(rmd_input)) {
    jpg_url <- file.path("img", jpg_filename)
  } else {
    jpg_url <- jpg_path
  }
  sources <- list()
  # Coordinates: top-left, top-right, bottom-right, bottom-left
  source <- list(
    type = "image",
    url  = jpg_url,
    coordinates = list(
      c(e$xmin, e$ymax),
      c(e$xmax, e$ymax),
      c(e$xmax, e$ymin),
      c(e$xmin, e$ymin)
    )
  )
  if (!is.null(knitr::current_input(dir = TRUE))) {
    abs_jpg <- normalizePath(jpg_path, mustWork = FALSE)
    abs_html_dir <- normalizePath(dirname(knitr::current_input(dir = TRUE)))
    source$url <- xfun::relative_path(abs_jpg, abs_html_dir)
  }
  sources[[id]] = source
  sources
}

spectral_raster_color_paint <- function() {
  list(
    "raster-color" = list(
      "interpolate",
      list("linear"),
      list("raster-value"),
      0.0, "#9E0142",
      0.1, "#D53E4F",
      0.2, "#F46D43",
      0.3, "#FDAE61",
      0.4, "#FEE08B",
      0.5, "#FFFFBF",
      0.6, "#E6F598",
      0.7, "#ABDDA4",
      0.8, "#66C2A5",
      0.9, "#3288BD",
      1.0, "#5E4FA2"
    ),
    "raster-color-mix" = list(1, 0, 0, 0),
    "raster-color-range" = list(0, 1)
  )
}

# cribbed from https://github.com/dkahle/ggmap/blob/master/R/calc_zoom.r
calc_zoom <- function (bbox) {
  lonlength <- bbox$xmax - bbox$xmin
  latlength <- bbox$ymax - bbox$ymin
  zoomlon <- ceiling(log2(360 * 2/lonlength))
  zoomlat <- ceiling(log2(180 * 2/latlength))
  zoom <- min(zoomlon, zoomlat)
}

# TODO derive this from a "feature" definition
stylesNonMapbox <- rjson::fromJSON(file = "src/json/stylesNonMapbox.json", simplify = FALSE)
baseStyle <- stylesNonMapbox[["carto-positron"]]
# Ensure this slots in above the builtin in imerss-new
baseStyle$layers[[1]]$metadata = list(sortKey = 0.5)

read_vectors <- function (layerNames) {
  fileNames <- glue('spatial_data/vectors/{layerNames}');
  lapply(fileNames, FUN=mx_read);
}

feature_to_geojson <- function (rawFeature, digits = 3) {
  start <- Sys.time()
  feature <- round_and_simplify_geom(rawFeature, digits);
  end <- Sys.time()
  message("Rounded in ", round((end - start), digits = digits), "s")

  # Convert feature to GeoJSON list
  start <- Sys.time()
  feature.geojson.list <- geojson_list(feature)
  end <- Sys.time()
  message("geojson_list in ", round((end - start), digits = digits), "s")

  # Convert feature to GeoJSON string
  start <- Sys.time()
  feature.geojson.json <- geojson_json(feature, type="skip")
  end <- Sys.time()
  message("geojson_json in ", round((end - start), digits = digits), "s")
  # Count number of points in geometry (if possible)
  n_points <- tryCatch({
    coords <- sf::st_coordinates(feature)
    nrow(coords)
  }, error = function(e) NA_integer_)
  # Get size of GeoJSON string
  geojson_size <- nchar(feature.geojson.json)
  # Log diagnostics
  message(sprintf("Converted geometry with %d points to geojson string of size %d", n_points, geojson_size))
  # Parse JSON to R object
  start <- Sys.time()
  feature.geojson <- rjson::fromJSON(feature.geojson.json)
  end <- Sys.time()
  message("Parsed JSON in ", round((end - start), digits = digits), "s")

  feature.geojson
}

#' Converts an sf object into a named list of Mapbox GeoJSON sources.
#'
#' For each row in the sf object, extracts the id from the specified field and converts the geometry to GeoJSON.
#' Returns a named list of Mapbox source objects, each with type "geojson" and the converted geometry.
#'
#' @param sf_data An sf object containing spatial features.
#' @param idField Character. Name of the column to use as the id for each source.
#' @param id Character. A literal id to be given to this (single) feature.
#' @param digits Numeric. Number of digits of precision to round latitude/longitude in coordinate to.
#' @return A named list of Mapbox source objects, keyed by id.
sf_to_mapbox_sources <- function (sf_data, idField, id, digits = 3) {
  sources <- list()
  if (missing(idField) && missing(id)) {
    wg("Error in sf_to_mapbox_sources - must supply either idField or id")
    stop()
  }
  if (!missing(idField)) {
    # Group by idField and union geometries that share the same id
    ids <- sf_data[[idField]]
    unique_ids <- unique(ids)
    use_sf_data <- st_sf(
      geometry = do.call(c, lapply(unique_ids, function(uid) {
        st_union(sf_data$geometry[ids == uid])
      }))
    )
    n <- nrow(use_sf_data)
    id_vec <- unique_ids
  } else {
    # Single id supplied - flatten all data into one geometry
    use_sf_data <- st_sf(geometry = st_union(sf_data))
    n <- 1
    id_vec <- c(id)
  }
  for (i in seq_len(n)) {
    wg("Converting geometry element {i}")
    geom <- use_sf_data$geometry[i]
    geojson <- feature_to_geojson(geom, digits)
    sources[[as.character(id_vec[i])]] <- list(type = "geojson", data = geojson)
  }
  sources
}

load_and_convert_geojson <- function (feature) {
  feature$data <- read_vectors(feature$Layer);

  start <- Sys.time()
  feature$geojson <- lapply(feature$data, feature_to_geojson)
  end <- Sys.time()
  message("Converted ", nrow(styling), " rows to GeoJSON in ", round(end - start, 3), "s")
  feature
}

#' Converts a data frame of features into a named list of Mapbox GeoJSON sources.
#'
#' Iterates over each row in the input data frame, creating a Mapbox source object for each feature.
#' The resulting list is keyed by the value of the \code{Layer} column, with each value being a list
#' containing the type ("geojson") and the GeoJSON data for that feature.
#'
#' @param features A data frame where each row describes a spatial feature. Expected columns:
#'   \describe{
#'     \item{Layer}{Character. Unique name for the feature/layer.}
#'     \item{geojson}{List. GeoJSON feature collection for the feature (as a list of length 1).}
#'   }
#' @return A named list of Mapbox source objects, each with \code{type = "geojson"} and \code{data} set to the feature's GeoJSON.
features_to_sources <- function (features) {
  sources <- list()
  for(i in 1:nrow(features)) {
    row <- features[i,]
    # Again God only knows why it ends up wrapped up back in a 1-element list again
    sources[[feature$Layer]] = list(type = "geojson", data = feature$geojson[[1]])
  }
  sources
}

defaultVectorFeature <- list(fillOpacity = 0, outlineOpacity = 1)

#' Converts a data frame of layer styling information into a list of Mapbox layer definitions.
#'
#' Iterates over each row in the input data frame, generating one or more Mapbox layer objects per row.
#' For each row:
#'   - If the fill opacity is nonzero, creates a "fill" layer with the specified styling.
#'   - Always creates an "outline" (line) layer, using a highlight style if the layer is in highlightedLayers.
#' The resulting list contains all fill and outline layers, suitable for use in a Mapbox style object.
#'
#' @param features A data frame with one row per spatial layer. Expected columns:
#'   \describe{
#`     \item{type}{Character. Type of the features - supported are polygon, raster, bbox.}
#'     \item{Layer}{Character. Unique name for the layer.}
#'     \item{Z_Order}{Numeric. Controls rendering order of layers.}
#'     \item{fillPattern}{Character. Name of the fill pattern to use.}
#'     \item{Label}{Character. Label for the layer.}
#'     \item{fillColor}{Character. Fill color (hex or named).}
#'     \item{fillOpacity}{Numeric. Opacity for fill (0-1).}
#'     \item{outlineColor}{Character. Outline color (hex or named).}
#'     \item{outlineWidth}{Numeric. Width of the outline line.}
#'     \item{outlineOpacity}{Numeric. Opacity for outline (0-1).}
#'     \item{geojson}{List. GeoJSON feature collection for the layer.}
#'   }
#' @param highlightedSources A character vector of source names to be highlighted.
#' @return A list of Mapbox layer objects (as lists), including fill and outline layers for each input row.
features_to_layers <- function (features, highlightedSources) {
  layers <- list()

  for (index in seq_along(features)) {
    oneFeature <- features[[index]]
    Z_Order = oneFeature$Z_Order %||% index
    if (oneFeature$type == "vector") {
      feature <- merge_lists(defaultVectorFeature, oneFeature)
      message("Layer ", feature, " opacity ", feature$fillOpacity, " outlineOpacity", feature$outlineOpacity)
      # Due to a limitation in WebGL we need to add separate layers for outline and fill

      if (feature$fillOpacity != 0) {
        message("fillLayer ", feature$Layer)
        fillLayer <- list(type="fill", id=feature$source, source=feature$source,
                          label=feature$label,
                          paint=list("fill-color"=feature$fillColor, "fill-opacity"=feature$fillOpacity),
                          metadata=list(sortKey=Z_Order, selectable=feature$selectable))
        if (!is.null(feature$FillPattern)) {
            fillLayer$paint["fill-pattern"] = feature$fillPattern
        }
        # Nutty syntax explained in https://stackoverflow.com/questions/14054120/adding-elements-to-a-list-in-r-in-nested-lists
        layers <- c(layers, list(fillLayer))
      }
      if (feature$outlineOpacity != 0) {
        if (feature$source %in% highlightedSources) {
          # ref: https://plotly.com/python/reference/layout/mapbox/
          outlineLayer <- list(type="line", id=glue("{feature$source}-highlight"), source=feature$source,
                               paint=list("line-color"="yellow", "line-width"=feature$outlineWidth+2, "line-opacity"=feature$outlineOpacity),
                               metadata=list(sortKey=5))
        } else {
          outlineLayer <- list(type="line", id=glue("{feature$source}-outline"), source=feature$source,
                               paint=list("line-color"=feature$outlineColor, "line-width"=feature$outlineWidth, "line-opacity"=feature$outlineOpacity),
                               metadata=list(sortKey=Z_Order + 0.5))
        }
        layers <- c(layers, list(outlineLayer))
      }
    } else if (oneFeature$type == "raster") {
        feature <- oneFeature
        rasterLayer <- list(type="raster", id=feature$source, source = feature$source, paint=list("raster-opacity" = feature$rasterOpacity),
            metadata=list(sortKey=Z_Order))
        layers <- c(layers, list(rasterLayer))
    }
  }
  layers
}

#' Plots a Mapbox map using Plotly with custom sources, styling, and highlighted layers.
#'
#' Combines a base Mapbox style with user-provided sources and layer styling to render a map.
#' Filters sources to include only those referenced by layers. Sets up the map layout, including
#' bounding box, zoom, and legend. Returns a Plotly map object ready for display.
#'
#' @param id Character. Unique identifier for the map style.
#' @param sources Named list. Mapbox source objects, keyed by source name.
#' @param features Unnamed list of named lists. Features with styling information; see \code{featuresToLayers} for expected columns.
#' @param regionField Name of any region field in the region indirection file (column "Label" in Shapefile Index) that
#' regions plotted in this map are drawn from
#' @param highlightedSources Character vector. Names of layers to highlight.
#' @return A Plotly map object with the specified Mapbox style and layers.
plot_mapbox_map = function (id, sources, features, regionField = NULL, highlightedSources = c()) {

  allSources <- c(baseStyle$sources, sources);
  allLayers <- c(baseStyle$layers, features_to_layers(features, highlightedSources));

  usedSourceNames <- sapply(allLayers, function (layer) {layer$source});
  usedSourcesIndex = sapply(names(allSources), function (name) {name %in% usedSourceNames})
  usedSources <- allSources[usedSourcesIndex]

  view <- find_in_list(features, "type", "view");
  bbox <- find_in_list(features, "type", "bbox");
  if (!is.null(bbox)) {
      view <- list(lon = ((bbox[1] + bbox[3]) / 2), lat = ((bbox[2] + bbox[4]) / 2), zoom = calc_zoom(bbox) - 1.2)
  }
  if (is.null(view)) {
     stop("Can't render map without view or bbox");
  }

  mapData = list(id = id,
                 view = view,
                 layers = allLayers,
                 highlightedSources = highlightedSources);
  if (!is.null(regionField)) {
    mapData$regionField = regionField
  }

  write_json(mapData, str_glue("viz_data/{id}-mapData.json"))

  style <- list(id=id, version=8, sources=usedSources, layers=allLayers, glyphs=baseStyle$glyphs);

  map <- plot_ly(height = 600, width = 800)

  map <- map %>% add_trace(
    type = "choroplethmapbox"
  )

  map <- map %>% layout(
    # TODO: This title doesn't display
    legend = list(title = "Regions"),
    mapbox=list(
      style=style,
      center = list(lon = view$lon, lat = view$lat),
      zoom = view$zoom,
      # Put this on to avoid blowing up the plotly driver
      "_fitBounds" = list(bounds = bbox)
    )
  )
  map
}
