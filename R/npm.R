# Runs the JavaScript steps of the site's build from R, so that blogdown's "Build Website" in RStudio builds the same
# site as `npm run build` - see "Building the site" in AGENTS.md. blogdown runs R/build.R before Hugo, and R/build2.R
# after it, each from the project's root, and both source this file.

# Find npm. RStudio, started from the Dock or Start menu rather than a terminal, often has a shorter PATH than the
# shell's, so the places Node.js is usually installed to are tried too. Set the environment variable NPM, e.g. in
# ~/.Renviron, to the full path of npm to choose one explicitly.
find_npm <- function() {
  candidates <- c(
    Sys.getenv("NPM"),
    Sys.which(if (.Platform$OS.type == "windows") "npm.cmd" else "npm"),
    "/opt/homebrew/bin/npm",
    "/usr/local/bin/npm",
    "/usr/bin/npm",
    "C:/Program Files/nodejs/npm.cmd",
    Sys.glob(path.expand("~/.nvm/versions/node/*/bin/npm"))
  )
  found <- candidates[nzchar(candidates) & file.exists(candidates)]
  if (length(found) == 0) {
    stop("npm could not be found. Install Node.js from https://nodejs.org, run `npm install` in the project, ",
         "or set NPM in ~/.Renviron to the full path of npm, and restart RStudio")
  }
  # The newest, should several versions be installed through nvm
  found[[length(found)]]
}

# Run npm with the given arguments, with the directory holding npm on the PATH, so that the node it runs is found
# alongside it. Stops the build if the step fails.
run_npm <- function(...) {
  npm <- find_npm()
  args <- c(...)
  path <- paste(dirname(npm), Sys.getenv("PATH"), sep = .Platform$path.sep)
  cat("Running: npm", args, "\n")
  status <- system2_with_path(npm, args, path)
  if (status != 0) {
    stop("The build step `npm ", paste(args, collapse = " "), "` failed - see its output above")
  }
  invisible(status)
}

system2_with_path <- function(command, args, path) {
  old <- Sys.getenv("PATH")
  on.exit(Sys.setenv(PATH = old))
  Sys.setenv(PATH = path)
  system2(command, args)
}

# Install the project's JavaScript dependencies, if they have not been installed yet
ensure_node_modules <- function() {
  if (!dir.exists("node_modules")) {
    run_npm("install")
  }
}
