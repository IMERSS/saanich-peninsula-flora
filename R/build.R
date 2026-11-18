# Content preparation in R and JS before executing Hugo. blogdown runs this before Hugo builds the site, and
# R/build2.R after - together they do what `npm run build` does, see R/npm.R

# Copy files from tabular_data to static/local/data/tabular

src_dir <- "tabular_data"
dst_dir <- "static/local/data/tabular"

# Create destination directory if it doesn't exist
dir.create(dst_dir, recursive = TRUE, showWarnings = FALSE)

# The files the published site uses, as bioreportr.yaml names them - see src/js/storyBuild.js, which names them to the
# story page
config <- yaml::read_yaml("bioreportr.yaml")$data
files <- c(config$labels, config$regionIndirection, config$summary, config$curationHistory, config$recordAnnotations, config$excludedTaxa,
           config$studyArea, config$rediscovered)

for (f in files) {
  src <- file.path(src_dir, f)
  dst <- file.path(dst_dir, f)
  if (!file.exists(src)) {
    warning("Source file not found: ", src)
  } else if (file.copy(src, dst, overwrite = TRUE)) {
    cat("Copied:", f, "\n")
  } else {
    warning("Failed to copy: ", src)
  }
}

source("R/npm.R")
ensure_node_modules()

# The final stage of data preparation - packing the tables which the story page reads at startup, its observations,
# taxa and region indirection, into one columnar data package, named as `viz` in bioreportr.yaml, together with its
# details, the columns held in full only once the page is shown, beside it as "-details.viz". Written by imerss-bioinfo's
# src/vizPack.js - see its notes/columnar-data-package.md
viz_packer <- "node_modules/imerss-bioinfo/src/vizPack.js"
if (is.null(config$viz)) {
  cat("No columnar data package is named as `viz` in bioreportr.yaml - not packing one\n")
} else if (!file.exists(viz_packer)) {
  warning("The columnar data package ", config$viz, " was not packed, since the installed imerss-bioinfo has no ",
          viz_packer, " - update its version in package.json and run `npm install`")
} else {
  table_args <- c("--table", paste0("obs=", file.path(dst_dir, config$labels)),
                  "--table", paste0("taxa=", file.path(dst_dir, config$summary)),
                  "--table", paste0("regionIndirection=", file.path(dst_dir, config$regionIndirection)))
  run_npm("exec", "--", "node", viz_packer, "--out", file.path(dst_dir, config$viz), table_args)
}

# The JavaScript steps before Hugo - extracting the story's panes from their knitted .html, copying the libraries the
# story page uses into static/vendor, and adopting into static any file GitHub Pages has written into docs, such as
# CNAME, so that Hugo publishes it again
run_npm("run", "story")
run_npm("run", "vendor")
run_npm("exec", "--", "node", "src/js/adoptPublished.js", "docs", "static")
