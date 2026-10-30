library(googledrive)

# Fetch large input files which are not checked in (big_data is gitignored) from Google Drive

big_data_files <- list(
  # Ultimate catalogue produced by scripts/3_align.R in checklist-catalogue-alignment-workflow
  "Saanich_Tracheophyta_ultimate-catalogue_2026-08-20.csv" = "1QGucMDQ6JmTI_W7U0aAOBd2BFqV2pb-B"
)

downloadGdrive <- function (id, file_path, overwrite = FALSE) {
  if (overwrite || !file.exists(file_path)) {
    drive_download(as_id(id), path = file_path, overwrite = TRUE)
  } else {
    message("Skipping ", file_path, " which already exists")
  }
}

dir.create("big_data", showWarnings = FALSE)

for (name in names(big_data_files)) {
  downloadGdrive(big_data_files[[name]], file.path("big_data", name))
}
