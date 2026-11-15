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
files <- c(config$labels, config$regionIndirection, config$summary, config$curationHistory, config$recordAnnotations, config$excludedTaxa)

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

# The JavaScript steps before Hugo - extracting the story's panes from their knitted .html, copying the libraries the
# story page uses into static/vendor, and adopting into static any file GitHub Pages has written into docs, such as
# CNAME, so that Hugo publishes it again
source("R/npm.R")
ensure_node_modules()
run_npm("run", "story")
run_npm("run", "vendor")
run_npm("exec", "--", "node", "src/js/adoptPublished.js", "docs", "static")
