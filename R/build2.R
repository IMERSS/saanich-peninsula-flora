# Runs after Hugo has built the site into docs, when it is built by blogdown, e.g. with RStudio's "Build Website" -
# see R/build.R. Renders the story page's components into its published markup, as `npm run hydrate` does at the end
# of `npm run build`.
source("R/npm.R")
run_npm("run", "hydrate")
