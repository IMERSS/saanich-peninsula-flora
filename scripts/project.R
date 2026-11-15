# The settings, beyond its data files named in bioreportr.yaml and bioreportr-prep.yaml, of the W̱SÁNEĆ/Saanich Peninsula project read by the shared scripts of the bioReportR framework, such as
# scripts/intersectShapes.R and scripts/Protected_map_mapbox.R. This file is the project's own, and is not copied by
# copyFrameworkOut.sh

# The project's data files: those its story page reads, named in bioreportr.yaml, and those which only prepare them,
# named in bioreportr-prep.yaml
config <- c(yaml::read_yaml("bioreportr.yaml")$data, yaml::read_yaml("bioreportr-prep.yaml")$data)

project <- list(
  # The source catalogue, whose records are labelled with the regions they fall in
  obsFile = file.path("tabular_data", config$catalogue),
  # The index of the shapes the records are intersected with - see spatial_data/vectors
  shapeIndexFile = file.path("tabular_data", config$shapeIndex),
  # The summary of the catalogue's taxa
  summaryFile = file.path("tabular_data", config$summary),
  # The settings of the Protected Areas pane's map and summaries, read by scripts/Protected_map_mapbox.R
  protected = list(
    # The categories of protected area, in order of precedence, coloured from the site's own: its blue, sand and
    # purple, softened greens and teal, set on the dark satellite base
    palette = data.frame(
      category = c("National park reserve", "Ecological reserve", "Provincial park", "Migratory bird sanctuary",
                   "Regional park", "Water supply area", "Private conservation land"),
      color = c("#5a96d2", "#decb90", "#8cc084", "#9fd0e0", "#4fae98", "#7c86c9", "#a593d8")
    ),
    # Each category in the plural, as it opens a sentence
    categoryPlural = c("National park reserve" = "The national park reserve", "Ecological reserve" = "Ecological reserves",
      "Provincial park" = "Provincial parks", "Migratory bird sanctuary" = "Migratory bird sanctuaries",
      "Regional park" = "Regional parks", "Water supply area" = "Water supply areas",
      "Private conservation land" = "Private conservation lands"),
    # The peninsula's boundary, framing the study area
    boundary = function () sf::st_read("spatial_data/vectors/Saanich.geojson", quiet = TRUE),
    view = list(lon = -123.4015, lat = 48.510, zoom = 9),
    # The wording of the summaries - see default.text in scripts/Protected_map_mapbox.R for the figures each is given
    text = list(
      overview = function (v) str_glue("Based on our current knowledge, {v$stats$protected.percent} percent of the ",
        "{v$stats$species} native vascular plant species known to the peninsula have been reported within its ",
        "protected and conserved areas, from national park reserve and ecological reserves to regional parks and lands ",
        "held by conservancies. The other {v$stats$unprotected} have so far been recorded only outside them."),
      category = function (v) str_glue("{v$plural(v$category)} {ifelse(v$n == 1, 'holds', 'hold')} {v$percent(length(v$ids))} percent ",
        "of the native plant diversity known to the peninsula: {length(v$ids)} of its {v$stats$species} native ",
        "vascular plant species have been reported within {ifelse(v$n == 1, 'it', 'them')}."),
      # Its rank among the areas of its category, e.g. ", the 3rd richest of its 16 regional parks"
      standing = function (v) `if`(v$peers > 1, str_glue(", the {`if`(v$rank == 1, '', paste0(v$ordinal(v$rank), ' '))}richest of its ",
        "{v$peers} {tolower(v$plural(v$category))}"), ""),
      area = function (v) `if`(length(v$ids) == 0, str_glue("No native species have yet been reported within {v$name}."),
        str_glue("{length(v$ids)} native species, {v$percent(length(v$ids))} percent of the native plant diversity known to ",
          "the peninsula, have been reported within {v$name}{v$standing}.")),
      unprotected = function (v) str_glue("{v$stats$unprotected} native species, {v$percent(v$stats$unprotected)} percent of ",
        "the native plant diversity known to the peninsula, have so far been reported only outside its protected and ",
        "conserved areas. The map's grid shows where their records lie - the places where protection does not yet reach ",
        "this part of the flora, or where it has yet to be looked for within the protected areas."),
      kbas = function (v) str_glue("Key Biodiversity Areas mark the places that matter most for the persistence of species and ",
        "ecosystems. The peninsula's Garry oak meadows, rocky headlands and islets hold {v$published} published Key ",
        "Biodiversity Areas, most of them identified for their threatened plants, and {v$proposed} more are proposed. ",
        "Together the published KBAs hold {v$percent(v$stats$kba)} percent of the native plant diversity known to the ",
        "peninsula: {v$stats$kba} of its {v$stats$species} native vascular plant species have been ",
        "reported within them."),
      kba = function (v) `if`(length(v$ids) == 0, str_glue("No native species have yet been reported within {v$name}."),
        str_glue("{length(v$ids)} native species, {v$percent(length(v$ids))} percent of the native plant diversity known to ",
          "the peninsula, have been reported within {v$name}.")),
      records = "records of native species",
      unique = "species reported in no other category",
      unprotectedKba = "reported within a Key Biodiversity Area"
    )
  )
)
