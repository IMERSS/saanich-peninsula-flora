library(sf)
library(stringr)

lat_lon <- function (data) {
  return (st_transform(data, "+proj=longlat +datum=WGS84"))
}

round_geom <- function (geom, digits) {
  if (inherits(geom, "POINT")) {
    st_point(round(as.numeric(geom), digits))
  } else if (inherits(geom, "MULTIPOINT")) {
    st_multipoint(round(as.matrix(geom), digits))
  } else if (inherits(geom, "LINESTRING")) {
    st_linestring(round(as.matrix(geom), digits))
  } else if (inherits(geom, "MULTILINESTRING")) {
    st_multilinestring(lapply(geom, round, digits = digits))
  } else if (inherits(geom, "POLYGON")) {
    st_polygon(lapply(geom, round, digits = digits))
  } else if (inherits(geom, "MULTIPOLYGON")) {
    st_multipolygon(lapply(geom, function(poly) {
      lapply(poly, round, digits = digits)
    }))
  } else if (inherits(geom, "GEOMETRYCOLLECTION")) {
    st_geometrycollection(lapply(geom, round_geom, digits = digits))
  } else {
    warning(paste("Unknown geometry type:", class(geom)[1]))
    geom
  }
}

round_and_simplify_geom <- function (geom, digits = 2) {
  dTolerance = 10^(-digits) / 2
  rounded_geoms <- lapply(geom, round_geom, digits = digits)
  rounded_geoms_sf <- st_sfc(rounded_geoms, crs = st_crs(geom))

  # TODO: If we really want to simplify, should really use https://github.com/ateucher/rmapshaper but
  # this will work better in GeoJSON so let's do it later
  # simple  <- rounded_geoms_sf %>% st_simplify(preserveTopology = TRUE, dTolerance = dTolerance)
  # https://gis.stackexchange.com/questions/329110/removing-empty-polygon-from-sf-object-in-r
  # %>% dplyr::filter(!st_is_empty(.))
}

round_and_simplify_sf <- function (sf_data, digits) {
  rounded_geoms <- lapply(st_geometry(sf_data), round_and_simplify_geom, digits = digits)
  st_geometry(sf_data) <- rounded_geoms

  sf_data
}

mx_read_simplify <- function (filename, digits = 2) {
  st_data <- st_read(filename, quiet=TRUE);
  dropped <- st_zm(st_data, drop = T, what = "ZM")
  trans <- lat_lon(dropped);
  rounded <- round_and_simplify_sf(trans, digits);
}

mx_read <- function (filename) {
  st_data <- st_read(filename, quiet=TRUE);
  dropped <- st_zm(st_data, drop = T, what = "ZM")
  return(lat_lon(dropped));
}

# Read a CSV file fast with the proper encoding - note that read.csv is generally faulty
timedFread <- function (toread) {
  start <- Sys.time()
  frame <- data.table::fread(toread, encoding = "UTF-8")
  end <- Sys.time()
  message("Read ", nrow(frame), " rows from ", toread, " in ", round((end - start), digits = 3), "s")
  # Otherwise traditional R indexing notation fails
  as.data.frame(frame)
}

timedWrite <- function (x, towrite) {
  start <- Sys.time()
  # Approach for selective quoting taken from https://stackoverflow.com/a/25810538/1381443
  commas <- which(sapply(x, function(y) any(grepl(",",y))))
  write.csv(x, towrite, na = "", row.names = FALSE, quote = commas, fileEncoding = "UTF-8")
  end <- Sys.time()
  message("Written ", nrow(x), " rows to ", towrite, " in ", round((end - start), digits = 3), "s")
}

#' Merge Multiple Named Lists
#'
#' Combines multiple named lists by merging values with the same keys.
#' Uses base R's \code{modifyList} recursively to merge all lists provided as arguments.
#' If a key exists in more than one list, values from later lists override earlier ones.
#'
#' @param ... Named lists to merge.
#' @return A single named list containing merged values from all input lists.
#'
#' @examples
#' lst1 <- list(a = 1, b = 2)
#' lst2 <- list(b = 3, c = 4)
#' merge_lists(lst1, lst2)
#' # Returns: list(a = 1, b = 3, c = 4)
merge_lists <- function(...) {
  Reduce(modifyList, list(...))
}

#' Convert Data Frame to List of Lists
#'
#' Converts a data frame into a list where each row becomes a named list.
#'
#' @param df A data frame to convert
#' @return A list of lists, where each element corresponds to a row from the data frame
#'
#' @examples
#' df <- data.frame(a = 1:3, b = letters[1:3])
#' df_to_list(df)
#' # [[1]]
#' # [[1]]$a
#' # [1] 1
#' # [[1]]$b
#' # [1] "a"
#'
# See https://claude.ai/share/079eb2f7-6a58-48be-9675-51174a96a9f1 for weird inner loop implementation
df_to_list <- function(df) {
  lapply(seq_len(nrow(df)), function(i) {
    row <- df[i, , drop = FALSE]
    setNames(lapply(row, `[[`, 1), names(row))
  })
}

#' Find Elements in a List by Field Value
#'
#' Searches a list of named lists or data frames for elements where the specified field matches the given value.
#' Returns a list of all matching elements.
#'
#' @param list A list of named lists or data frames to search.
#' @param field Character. The name of the field to match.
#' @param value The value to match against the specified field.
#' @return The first matching record or NULL if one is not found
#'
find_in_list = function (list, field, value) {
  matches <- Filter(function(element) !is.null(element[[field]]) && element[[field]] == value, list)
  if (length(matches) > 0) matches[[1]] else NULL
}

# Cribbed from https://kevinushey.github.io/blog/2018/02/21/string-encoding-and-r/
write_utf8 <- function(text, f) {
  # step 1: ensure our text is utf8 encoded
  utf8 <- enc2utf8(text)

  # step 2: create a connection with 'native' encoding
  # this signals to R that translation before writing
  # to the connection should be skipped
  con <- file(f, open = "w+", encoding = "native.enc")

  # step 3: write to the connection with 'useBytes = TRUE',
  # telling R to skip translation to the native encoding
  writeLines(utf8, con = con, useBytes = TRUE)

  # close our connection
  close(con)
}

write_json <- function (data, filename) {
  jsonData = jsonlite::toJSON(data, auto_unbox = TRUE, pretty = TRUE)

  write_utf8(jsonData, filename)
}

# Helpful utility to template an arbitrary list of string arguments and then dump them to the console with a terminating newline
wg <- function (...) {
  args <- list(...)
  line <- paste(sapply(args, str_glue, .envir = parent.frame()), collapse = "")

  # Output the result using writeLines
  message(line)
}

#' Execute a JavaScript file using Node.js
#'
#' Looks for the Node.js executable in the directory specified by the
#' environment variable R_NODE_PATH. If not found, assumes "node" is
#' available on the system PATH.
#'
#' @param js_file String. Path to the JavaScript file to execute.
#' @param args Character vector. Additional arguments to pass to the script (optional).
#' @param ... Further arguments passed to system2().
#' @return Integer exit status of the node process.
run_js <- function(js_file, args = character(), ...) {
  node_dir <- Sys.getenv("R_NODE_PATH", unset = "")

  # If R_NODE_PATH is set, construct full path to node
  if (nzchar(node_dir)) {
    node_path <- file.path(node_dir, "node")
  } else {
    node_path <- "node" # assume system path
  }

  if (!file.exists(js_file)) {
    stop("JavaScript file not found: ", js_file)
  }

  status <- system2(node_path, args = c(js_file, args), ...)
  if (status == 127) {
    stop("Unable to complete build - node.js is not installed. Please install from https://nodejs.org/en/download")
  } else if (status != 0) {
    stop(sprintf("Build failed with exit status %d.", status))
  }
  return(status)
}
