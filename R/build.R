# Content preparation in R and JS before executing Hugo

# Copy files from data/tabular_data to docs/data/tabular

src_dir <- "tabular_data"
dst_dir <- "docs/data/tabular"

# Create destination directory if it doesn't exist
dir.create(dst_dir, recursive = TRUE, showWarnings = FALSE)

files <- c(
  "Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-reduced-labels.csv",
  "Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-prepared-taxa.csv",
  "Saanich_Tracheophyta_incomplete-aligned-catalogue_2025-08-26-reduced-regionIndirection.csv"
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