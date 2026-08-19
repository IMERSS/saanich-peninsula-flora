# Content preparation in R and JS before executing Hugo

# Copy files from tabular_data to static/data/tabular

src_dir <- "tabular_data"
dst_dir <- "static/data/tabular"

# Create destination directory if it doesn't exist
dir.create(dst_dir, recursive = TRUE, showWarnings = FALSE)

files <- c(
  "Saanich_Tracheophyta_ultimate-catalogue_2026-08-17-selected-labels.csv",
  "Saanich_Tracheophyta_ultimate-catalogue_2026-08-17-selected-regionIndirection.csv",
  "Saanich_Tracheophyta_ultimate-summary_2026-08-17-prepared-taxa.csv"
)

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

