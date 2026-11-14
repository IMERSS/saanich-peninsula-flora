# Map the vascular plant diversity of the W̱SÁNEĆ/Saanich Peninsula in relation to its protected and conserved areas
# and its Key Biodiversity Areas. The shapes are written by scripts/fetch_protected_areas.R, and each record is
# labelled with the protected area and the KBA it falls in by scripts/intersectShapes.R

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

sf::sf_use_s2(FALSE)

# ── Species recorded in each category of protected area, and in the KBAs ──

plants <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-labels.csv")
regions <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-catalogue_2026-08-20-selected-regionIndirection.csv")
# The assessment is of the native flora, whose conservation the protected areas and KBAs serve
plant.summary <- timedFread("tabular_data/Saanich_Tracheophyta_ultimate-summary_2026-08-20-prepared-taxa.csv") %>%
  filter(inSummary == 1, introduction_status == "native")

# A record's region label, from its index in the region indirection file - the first row of the field for that index,
# the region's own label, rather than those of any groups it belongs to, which follow it
region_label <- function (field, index) {
  labels <- regions %>% filter(regionField == field) %>% distinct(id, .keep_all = TRUE)
  labels$label[match(index, labels$id)]
}

protected.areas <- mx_read("spatial_data/vectors/Protected_Areas/Protected_Areas.geojson")

# Each record's area and KBA, and its area's category of protected area
records <- plants %>%
  filter(iNaturalistTaxonId %in% plant.summary$id) %>%
  mutate(area = region_label("ProtectedArea", ProtectedArea), kba = region_label("KBA", KBA),
         category = protected.areas$category[match(area, protected.areas$name)])

species.count <- function (ids) length(unique(ids))

protected.ids <- unique(records$iNaturalistTaxonId[!is.na(records$category)])
kba.ids <- unique(records$iNaturalistTaxonId[!is.na(records$kba)])
concern.ids <- plant.summary$id[plant.summary$provincial_concern == "concern"]

protected.stats <- list(
  species = nrow(plant.summary),
  protected = length(protected.ids),
  protected.percent = round(length(protected.ids) / nrow(plant.summary) * 100),
  unprotected = nrow(plant.summary) - length(protected.ids),
  kba = length(kba.ids),
  concern = length(concern.ids),
  concern.protected = sum(concern.ids %in% protected.ids),
  concern.kba = sum(concern.ids %in% kba.ids)
)

# ── Map ───────────────────────────────────────────────────────────────────

# Colours drawn from the site's own: its blue, sand and purple, softened greens and teal, set on the dark satellite base
palette <- data.frame(
  category = c("National park reserve", "Ecological reserve", "Provincial park", "Migratory bird sanctuary",
               "Regional park", "Water supply area", "Private conservation land"),
  color = c("#5a96d2", "#decb90", "#8cc084", "#9fd0e0", "#4fae98", "#7c86c9", "#a593d8")
) %>% filter(category %in% protected.areas$category)

category.counts <- records %>% filter(!is.na(category)) %>%
  group_by(category) %>% summarise(count = n_distinct(iNaturalistTaxonId), areas = NA_integer_)
category.counts$areas <- as.integer(table(protected.areas$category)[category.counts$category])

palette <- palette %>% left_join(category.counts, by = "category") %>%
  mutate(count = coalesce(count, 0L))

# The species reported in each individual area, shown when it is hovered or tapped
area.counts <- records %>% filter(!is.na(area)) %>%
  group_by(area) %>% summarise(count = n_distinct(iNaturalistTaxonId))
protected.areas <- protected.areas %>%
  mutate(count = coalesce(area.counts$count[match(name, area.counts$area)], 0L),
         color = palette$color[match(category, palette$category)])

# Each shape is held once, in one source for each kind - the areas, the KBAs and the proposed KBAs - with the
# properties "region", the label of its region in the records, by which it is selected; "group", the label of its
# category, or of all the published KBAs, by which it is outlined with them; and "card", the markup of the card
# describing it as it is hovered or tapped - see saanich-protectedPane.vue. The layers coloured by category are drawn
# from the one source by filters. The shapes are drawn accurately, to about a metre: only points lying within 2 m of the
# line through their neighbours are dropped, and coordinates keep 5 decimal places. The records are in any case placed
# within the areas by intersectShapes.R from the shapes as fetched
regions_to_mapbox_source <- function (sf_data, id, tolerance = 2, digits = 5) {
  shapes <- sf_data %>% select(region, group, card) %>%
    st_transform(3005) %>% st_simplify(preserveTopology = TRUE, dTolerance = tolerance) %>% st_transform(4326)
  shapes <- round_and_simplify_sf(shapes[!st_is_empty(shapes), ], digits)
  togo <- list()
  togo[[id]] <- list(type = "geojson", data = rjson::fromJSON(geojsonio::geojson_json(shapes, type = "skip")))
  togo
}

# Layer 1: the protected and conserved areas, a layer for each category, coloured as it is - clicking one selects the
# area clicked, and its category is selected by its row in the legend, the chart or the tabs
area.card <- function (area) {
  owner <- `if`(str_detect(area$category, "Private"), str_glue("<span class=\"saanich-pa-card-owner\">{area$owner}</span>"), "")
  as.character(str_glue("<span class=\"saanich-pa-card-name\">{area$name}</span>",
                        "<span class=\"saanich-pa-card-category\" style=\"--pa-colour: {area$color}\">{area$category}</span>{owner}",
                        "<span class=\"saanich-pa-card-count\"><b>{area$count}</b> native species reported</span>"))
}
area.shapes <- protected.areas %>% mutate(region = name, group = category,
  card = vapply(seq_len(n()), function (i) area.card(protected.areas[i, ]), character(1)))
area.source <- regions_to_mapbox_source(area.shapes, "Protected areas.cards")
protected.features <- lapply(seq_len(nrow(palette)), function (i) {
  list(type = "vector", id = palette$category[i], source = "Protected areas.cards",
       filter = list("==", list("get", "group"), palette$category[i]),
       fillColor = palette$color[i], fillOpacity = 0.5, outlineColor = palette$color[i], outlineWidth = 1,
       outlineOpacity = 0.9, selectable = TRUE, Z_Order = 10)
})

# The significance of a KBA and the groups of species for which it was identified, from KBA Canada's summary of its
# criteria, e.g. "GLOBAL: A1 - Threatened species (vascular plants); B1 - ..."
kba.significance <- function (criteria) {
  level <- `if`(str_detect(criteria, "GLOBAL"), "Globally significant", "Nationally significant")
  groups <- unique(unlist(str_split(str_match_all(criteria, "\\(([^)]*)\\)")[[1]][, 2], ", ")))
  str_glue("{level} for {paste(groups, collapse = ', ')}")
}

kbas <- mx_read("spatial_data/vectors/KBA/KBA.geojson")
kba.all <- "Published Key Biodiversity Areas"
kba.counts <- records %>% filter(!is.na(kba)) %>% group_by(kba) %>% summarise(count = n_distinct(iNaturalistTaxonId))

# Layer 2: the published KBAs, outlined in cream over the protected areas - clicking one selects it, and all of them
# are selected together by their row in the chart or their tab
kba.shapes <- kbas %>% mutate(
  region = name,
  group = kba.all,
  count = coalesce(kba.counts$count[match(name, kba.counts$kba)], 0L),
  card = as.character(str_glue("<span class=\"saanich-pa-card-name\">{name}</span>",
    "<span class=\"saanich-pa-card-category saanich-pa-card-kba\">Key Biodiversity Area</span>",
    "<span class=\"saanich-pa-card-owner\">{vapply(criteria, kba.significance, character(1))}</span>",
    "<span class=\"saanich-pa-card-count\"><b>{count}</b> native species reported</span>")))
kba.source <- regions_to_mapbox_source(kba.shapes, "KBA.cards")
kba.feature <- list(type = "vector", id = kba.all, source = "KBA.cards", outlineColor = "#FDF2CE", outlineWidth = 1.5,
                    outlineOpacity = 0.95, fillColor = "#FDF2CE", fillOpacity = 0.06, selectable = TRUE, Z_Order = 20)

# Layer 3: proposed Key Biodiversity Areas, whose boundaries are not yet public, as small rings around their points,
# each described by a card but not selectable, since no records are labelled with them
proposed <- mx_read("spatial_data/vectors/KBA/KBA_proposed.geojson")
proposed.rings <- st_transform(st_buffer(st_transform(proposed, 3005), 180), 4326) %>% mutate(
  region = paste("Proposed KBA:", name),
  group = "Proposed Key Biodiversity Areas",
  card = as.character(str_glue("<span class=\"saanich-pa-card-name\">{name}</span>",
    "<span class=\"saanich-pa-card-category saanich-pa-card-kba\">Proposed Key Biodiversity Area</span>",
    "<span class=\"saanich-pa-card-owner\">{stage} - its boundary is not yet public</span>")))
proposed.source <- regions_to_mapbox_source(proposed.rings, "Proposed KBA.cards")
proposed.feature <- list(type = "vector", source = "Proposed KBA.cards", outlineColor = "#FDF2CE", outlineWidth = 1.5,
                         outlineOpacity = 0.95, fillColor = "#FDF2CE", fillOpacity = 0.25, selectable = FALSE, Z_Order = 23)

# Layer 4: the peninsula's boundary, a faint line which frames the study area without competing with it
watershed.boundary <- sf::st_read("spatial_data/vectors/Saanich.geojson", quiet = TRUE)
watershed.source <- sf_to_mapbox_sources(watershed.boundary, id = "Watershed.Boundary")
watershed.feature <- list(type = "vector", source = "Watershed.Boundary", outlineColor = "#eefaff", outlineWidth = 1,
                          outlineOpacity = 0.3, fillOpacity = 0, Z_Order = 5)

allSources <- merge_lists(area.source, kba.source, proposed.source, watershed.source)

view.feature <- list(type = "view", lon = -123.4015, lat = 48.510, zoom = 9)

allFeatures <- c(list(view.feature), protected.features, list(kba.feature, proposed.feature, watershed.feature))

protectedAreaMap <- plot_mapbox_map("Protected", allSources, allFeatures, "Protected")

# Note that this statement is only effective in standalone R
print(protectedAreaMap)

# ── Species reported by category of protected area, as a bar chart written into the pane's text ───

# Rows from most to fewest species, each bar's length its share of the largest, with the KBAs as a final row
# A category's row is a button selecting its category, as its row in the map's legend does
bar_row <- function (name, count, max, color, areas, extra = "", selects = TRUE) {
  htmltools::tags$li(class = paste("saanich-pa-row", extra), style = str_glue("--pa-colour: {color}"),
    `data-region` = if (selects) name, role = if (selects) "button", tabindex = if (selects) "0",
    htmltools::tags$span(class = "saanich-pa-name", name,
      if (!is.na(areas)) htmltools::tags$small(str_glue(" · {areas} {ifelse(areas == 1, 'area', 'areas')}"))),
    htmltools::tags$span(class = "saanich-pa-track",
      htmltools::tags$span(class = "saanich-pa-bar", style = str_glue("width: {round(count / max * 100, 1)}%"))),
    htmltools::tags$span(class = "saanich-pa-count", count)
  )
}

# The selection of the native species reported in no protected area - see saanich.protectedAreas.unprotected
unprotected.key <- "Unprotected native plant diversity"

plotted <- palette %>% filter(count > 0) %>% arrange(desc(count))
bar.max <- max(plotted$count, protected.stats$kba)

# The overview of the categories, shown while none is selected
overview.chart <- htmltools::tags$figure(class = "saanich-pa-chart", `data-key` = "",
  htmltools::tags$figcaption("Native species reported in each category of protected area"),
  htmltools::tags$ul(class = "saanich-pa-rows",
    lapply(seq_len(nrow(plotted)), function (i) {
      bar_row(plotted$category[i], plotted$count[i], bar.max, plotted$color[i], plotted$areas[i])
    }),
    bar_row(kba.all, protected.stats$kba, bar.max, "#FDF2CE", nrow(kbas), "saanich-pa-kba"),
    # The native species reported in no protected area, whose records the grid of the map then shows
    bar_row(unprotected.key, protected.stats$unprotected, bar.max, "#e07a5f", NA, "saanich-pa-unprotected")
  )
)

# The chart of the areas of a category, or of the KBAs, shown while it or one of its areas is selected - each area's
# row selects that area, and the first returns to the overview
group_chart <- function (group, caption, areas, color, extra = "") {
  areas <- areas %>% arrange(desc(count), name)
  max <- max(areas$count, 1)
  htmltools::tags$figure(class = "saanich-pa-chart", `data-key` = group, hidden = NA,
    `data-members` = jsonlite::toJSON(areas$name),
    htmltools::tags$figcaption(
      htmltools::tags$span(class = "saanich-pa-link saanich-pa-back", `data-select` = "", role = "button", tabindex = "0",
                           "\u2190 All categories"),
      caption),
    htmltools::tags$ul(class = "saanich-pa-rows",
      lapply(seq_len(nrow(areas)), function (i) {
        bar_row(areas$name[i], areas$count[i], max, color, NA, extra)
      })
    )
  )
}

group.charts <- c(
  lapply(plotted$category, function (category) {
    group_chart(category, str_glue("Native species reported in each {tolower(category)}"),
                st_drop_geometry(protected.areas) %>% filter(category == !!category) %>% transmute(name, count),
                plotted$color[plotted$category == category])
  }),
  list(group_chart(kba.all, "Native species reported in each Key Biodiversity Area",
                   st_drop_geometry(kba.shapes) %>% transmute(name, count), "#FDF2CE", "saanich-pa-kba"))
)

# All the charts, shown beneath the map, one at a time as the selection picks it - see saanich-protectedPane.vue
protected.area.bars <- htmltools::tags$div(class = "saanich-pa-charts saanich-pa-views mxcw-data-pane-html",
                                           overview.chart, group.charts)

# ── A summary of the selection, at the head of the pane's text ─────────────────────────────────────────────────

# One card for each selection - all the protected areas, a category, an area, all the KBAs or a KBA - of which the one
# for the selection on the map is shown, as the charts beneath the map are, by saanich.protectedAreas.showSelection.
# Each card but the overview leads back to it, and an area's or a KBA's to its group; a category's richest areas
# select them

area.ha <- as.numeric(st_area(st_transform(protected.areas, 3005))) / 10000
kba.ha <- as.numeric(st_area(st_transform(kbas, 3005))) / 10000
ids_in <- function (keep) unique(records$iNaturalistTaxonId[keep])
category.ids <- lapply(setNames(palette$category, palette$category), function (category) ids_in(records$category %in% category))
percent <- function (n) round(n / protected.stats$species * 100)
format_n <- function (n) format(round(n), big.mark = ",")
category.plural <- c("National park reserve" = "The national park reserve", "Ecological reserve" = "Ecological reserves",
  "Provincial park" = "Provincial parks", "Migratory bird sanctuary" = "Migratory bird sanctuaries",
  "Regional park" = "Regional parks", "Water supply area" = "Water supply areas",
  "Private conservation land" = "Private conservation lands")
ordinal <- function (n) paste0(n, `if`(n %% 100 %in% 11:13, "th", c("th", "st", "nd", "rd", rep("th", 6))[(n %% 10) + 1]))

# The selection of some of the species of a region - its native species, those of conservation concern, or for the
# unprotected diversity those within a KBA - e.g. "Regional park · species of conservation concern", narrowing its
# records and checklist to them, as parsed by saanich.protectedAreas.parseSelection. The overview's region is all the
# protected areas together
subset <- function (region, which) paste(region, "\u00b7", which)
native.subset <- "native species"
concern.subset <- "species of conservation concern"
all.areas <- "Protected areas"

# A figure, which may select the species it counts
stat <- function (value, label, select = NULL) {
  htmltools::tags$div(class = "saanich-pa-stat", `data-select` = select, role = if (!is.null(select)) "button",
    tabindex = if (!is.null(select)) "0", htmltools::tags$b(value), htmltools::tags$span(label))
}
link <- function (region, text) {
  htmltools::tags$span(class = "saanich-pa-link", `data-select` = region, role = "button", tabindex = "0", text)
}
richest <- function (title, counts, n = 3) {
  top <- counts %>% filter(count > 0) %>% arrange(desc(count)) %>% head(n)
  htmltools::tags$div(class = "saanich-pa-richest-holder",
    htmltools::tags$span(class = "saanich-pa-richest-title", title),
    htmltools::tags$ol(class = "saanich-pa-richest", lapply(seq_len(nrow(top)), function (i) {
      htmltools::tags$li(link(top$name[i], top$name[i]), htmltools::tags$b(top$count[i]))
    })))
}
# A card: its swatch and title, a line beneath, links leading back, a summary, its figures and any list of its areas
card <- function (key, color, title, subtitle = NULL, back = list(), summary, stats, list = NULL, hidden = TRUE) {
  htmltools::tags$section(class = "saanich-pa-card-summary", `data-key` = key, hidden = if (hidden) NA,
    style = str_glue("--pa-colour: {color}"),
    if (length(back)) htmltools::tags$nav(class = "saanich-pa-crumbs", back),
    htmltools::tags$h3(class = "saanich-pa-summary-title", title),
    if (!is.null(subtitle)) htmltools::tags$p(class = "saanich-pa-summary-subtitle", subtitle),
    htmltools::tags$p(class = "saanich-pa-summary-text", summary),
    htmltools::tags$div(class = "saanich-pa-stats", stats),
    list)
}
# The two tabs at the head of the summaries, which stay in view whatever is selected: all the protected areas, and the
# native plant diversity outside them - the one selected is marked by saanich.protectedAreas.showSelection, the first
# for any selection but the second
tab <- function (region, text) {
  htmltools::tags$span(class = "saanich-pa-tab", `data-select` = region, role = "button", tabindex = "0", text)
}

overview.card <- card("", "#eefaff", "All protected and conserved areas",
  summary = str_glue("Based on our current knowledge, {protected.stats$protected.percent} percent of the ",
    "{protected.stats$species} native vascular plant species known to the peninsula have been reported within its ",
    "protected and conserved areas, from national park reserve and ecological reserves to regional parks and lands ",
    "held by conservancies. The other {protected.stats$unprotected} have so far been recorded only outside them."),
  stats = list(
    stat(nrow(protected.areas), str_glue("areas in {nrow(palette)} categories")),
    stat(format_n(sum(area.ha)), "hectares"),
    stat(protected.stats$protected, str_glue("native species · {protected.stats$protected.percent}% of the native flora"),
         subset(all.areas, native.subset)),
    stat(protected.stats$concern.protected, str_glue("of the {protected.stats$concern} species of conservation concern"),
         subset(all.areas, concern.subset))
  ), hidden = FALSE)

category.cards <- lapply(palette$category[palette$count > 0], function (category) {
  ids <- category.ids[[category]]
  others <- unique(unlist(category.ids[names(category.ids) != category]))
  in.category <- protected.areas$category == category
  n <- sum(in.category)
  card(category, palette$color[palette$category == category], category.plural[[category]] %>% str_remove("^The ") %>% str_to_sentence(),
    subtitle = str_glue("{n} {ifelse(n == 1, 'area', 'areas')} · {format_n(sum(area.ha[in.category]))} hectares"),
    summary = str_glue("{category.plural[[category]]} {ifelse(n == 1, 'holds', 'hold')} {percent(length(ids))} percent ",
      "of the native plant diversity known to the peninsula: {length(ids)} of its {protected.stats$species} native ",
      "vascular plant species have been reported within {ifelse(n == 1, 'it', 'them')}."),
    stats = list(
      stat(length(ids), str_glue("native species · {percent(length(ids))}% of the native flora"), subset(category, native.subset)),
      stat(sum(ids %in% concern.ids), "species of conservation concern", subset(category, concern.subset)),
      stat(sum(!ids %in% others), "species reported in no other category", subset(category, "found in no other category")),
      stat(format_n(sum(records$category %in% category)), "records of native species")
    ),
    list = `if`(n > 1, richest("Richest in native species",
      st_drop_geometry(protected.areas)[in.category, ] %>% transmute(name, count))))
})

area.cards <- lapply(seq_len(nrow(protected.areas)), function (i) {
  area <- protected.areas[i, ]
  ids <- ids_in(records$area %in% area$name)
  peers <- protected.areas %>% st_drop_geometry() %>% filter(category == area$category)
  rank <- sum(peers$count > area$count) + 1
  owner <- `if`(str_detect(area$category, "Private"), str_glue(" · {area$owner}"), "")
  # Its rank among the areas of its category, e.g. ", the 3rd richest of its 16 regional parks"
  standing <- `if`(nrow(peers) > 1, str_glue(", the {`if`(rank == 1, '', paste0(ordinal(rank), ' '))}richest of its ",
    "{nrow(peers)} {tolower(category.plural[[area$category]])}"), "")
  card(area$name, area$color, area$name,
    subtitle = str_glue("{area$category}{owner} · {format_n(area.ha[i])} hectares"),
    back = list(link(area$category, str_glue("↑ {category.plural[[area$category]] %>% str_remove('^The ') %>% str_to_sentence()}"))),
    summary = `if`(length(ids) == 0, str_glue("No native species have yet been reported within {area$name}."),
      str_glue("{length(ids)} native species, {percent(length(ids))} percent of the native plant diversity known to ",
        "the peninsula, have been reported within {area$name}{standing}.")),
    stats = list(
      stat(length(ids), str_glue("native species · {percent(length(ids))}% of the native flora"), subset(area$name, native.subset)),
      stat(sum(ids %in% concern.ids), "species of conservation concern", subset(area$name, concern.subset)),
      stat(format_n(sum(records$area %in% area$name)), "records of native species")
    ))
})

kba.card <- card(kba.all, "#FDF2CE", "Key Biodiversity Areas",
  subtitle = str_glue("{nrow(kbas)} published, {sum(str_detect(kbas$criteria, 'GLOBAL'))} of them globally significant · ",
    "{nrow(proposed)} proposed · {format_n(sum(kba.ha))} hectares"),
  summary = str_glue("Key Biodiversity Areas mark the places that matter most for the persistence of species and ",
    "ecosystems. The peninsula's Garry oak meadows, rocky headlands and islets hold {nrow(kbas)} published Key ",
    "Biodiversity Areas, most of them identified for their threatened plants, and {nrow(proposed)} more are proposed. ",
    "Together the published KBAs hold {percent(protected.stats$kba)} percent of the native plant diversity known to the ",
    "peninsula: {protected.stats$kba} of its {protected.stats$species} native vascular plant species have been ",
    "reported within them."),
  stats = list(
    stat(protected.stats$kba, str_glue("native species · {percent(protected.stats$kba)}% of the native flora"),
         subset(kba.all, native.subset)),
    stat(protected.stats$concern.kba, "species of conservation concern", subset(kba.all, concern.subset)),
    stat(format_n(sum(!is.na(records$kba))), "records of native species")
  ),
  list = richest("Richest in native species", st_drop_geometry(kba.shapes) %>% transmute(name, count)))

kba.cards <- lapply(seq_len(nrow(kba.shapes)), function (i) {
  kba <- kba.shapes[i, ]
  ids <- ids_in(records$kba %in% kba$name)
  card(kba$name, "#FDF2CE", kba$name,
    subtitle = str_glue("Key Biodiversity Area · {kba.significance(kba$criteria)} · {format_n(kba.ha[i])} hectares"),
    back = list(link(kba.all, "↑ Key Biodiversity Areas")),
    summary = `if`(length(ids) == 0, str_glue("No native species have yet been reported within {kba$name}."),
      str_glue("{length(ids)} native species, {percent(length(ids))} percent of the native plant diversity known to ",
        "the peninsula, have been reported within {kba$name}.")),
    stats = list(
      stat(length(ids), str_glue("native species · {percent(length(ids))}% of the native flora"), subset(kba$name, native.subset)),
      stat(sum(ids %in% concern.ids), "species of conservation concern", subset(kba$name, concern.subset)),
      stat(format_n(sum(records$kba %in% kba$name)), "records of native species")
    ))
})

# The native species reported in no protected area: how many, how many of them the KBAs hold, and those of conservation
# concern by name, while the map's grid shows where their records lie
unprotected.ids <- setdiff(plant.summary$id, protected.ids)
unprotected.records <- records %>% filter(iNaturalistTaxonId %in% unprotected.ids)
unprotected.concern <- sum(unprotected.ids %in% concern.ids)
# The card's figures select those species - all of them, those of conservation concern, and those within a KBA
unprotected.concern.key <- subset(unprotected.key, concern.subset)
unprotected.kba.key <- subset(unprotected.key, "within Key Biodiversity Areas")
unprotected.card <- card(unprotected.key, "#e07a5f", "Unprotected native plant diversity",
  subtitle = str_glue("{protected.stats$unprotected} species · {format_n(nrow(unprotected.records))} records"),
  summary = str_glue("{protected.stats$unprotected} native species, {percent(protected.stats$unprotected)} percent of ",
    "the native plant diversity known to the peninsula, have so far been reported only outside its protected and ",
    "conserved areas. The map's grid shows where their records lie - the places where protection does not yet reach ",
    "this part of the flora, or where it has yet to be looked for within the protected areas."),
  stats = list(
    stat(protected.stats$unprotected, str_glue("native species · {percent(protected.stats$unprotected)}% of the native flora"),
         unprotected.key),
    stat(unprotected.concern, "species of conservation concern", unprotected.concern.key),
    stat(sum(unprotected.ids %in% kba.ids), "reported within a Key Biodiversity Area", unprotected.kba.key)
  ))

protected.area.summaries <- htmltools::tags$div(class = "saanich-pa-summaries saanich-pa-views",
  htmltools::tags$nav(class = "saanich-pa-tabs", tab("", "All protected areas"), tab(unprotected.key, unprotected.key)),
  overview.card, unprotected.card, category.cards, area.cards, kba.card, kba.cards)
