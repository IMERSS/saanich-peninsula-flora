library(sf)
#library(rmapshaper)
source("scripts/utils.R")

# --- i) Read BEC shapefile ----------------------------------------------------
bec <- st_read("../obp-private/box_data/BCBA/BEC_BIOGEOCLIMATIC_POLY/BEC_POLY_polygon.shp")

# --- ii) Read Saanich boundary ------------------------------------------------
saanich <- st_read("spatial_data/vectors/Saanich.geojson")

# --- iii) Clip BEC to Saanich boundary ----------------------------------------
# Disable S2 spherical geometry to avoid duplicate-vertex errors in GEOS ops
sf_use_s2(FALSE)

# Ensure matching CRS
saanich <- st_transform(saanich, st_crs(bec))

# Repair any invalid geometries before clipping
#bec    <- st_make_valid(bec)
#saanich <- st_make_valid(saanich)

bec_clipped <- st_intersection(bec, st_union(saanich))

# --- iv) Simplify with rmapshaper (100m tolerance) then round coordinates -----
# st_intersection can produce list-columns with values like c(435, 435) that
# break mapshaper's V8-based GeoJSON importer. Drop them before simplifying.
#list_cols <- names(which(vapply(st_drop_geometry(bec_clipped), is.list, logical(1))))
#if (length(list_cols) > 0) {
#  bec_clipped <- bec_clipped[, !names(bec_clipped) %in% list_cols]
#}

# ms_simplify returns a proper sf object; keep_shapes prevents polygon elimination
#bec_simplified <- ms_simplify(bec_clipped, keep = 0.05, keep_shapes = TRUE, snap = TRUE)
#bec_simplified <- st_make_valid(bec_simplified)

#bec_simplified <- bec_simplified[!st_is_empty(bec_simplified), ]

# Round coordinates using patched utility
bec_clipped <- st_make_valid(bec_clipped)
bec_clipped <- bec_clipped[!st_is_empty(bec_clipped), ]
bec_rounded <- round_and_simplify_sf(bec_clipped, digits = 4)

# --- v) Write to shapefile ----------------------------------------------------
dir.create("spatial_data/vectors/BEC", recursive = TRUE, showWarnings = FALSE)
st_write(bec_rounded, "spatial_data/vectors/BEC/BEC.shp",
         delete_dsn = TRUE)

message("Done – BEC shapefile written to spatial_data/vectors/BEC/BEC.shp")