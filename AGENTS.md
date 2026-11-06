# Guidance for agents

## Git

Do not commit or push any code. Leave all changes in the working tree for a human to review, commit and push.

## Rubric for changes

### Navigation

Keep any navigational change in sync between the two bioReportR projects,
[howe-sound-mapping-2026](https://github.com/IMERSS/howe-sound-mapping-2026) and
[saanich-peninsula-flora](https://github.com/IMERSS/saanich-peninsula-flora). This covers the navbar, subnav, sidebar
and mobile menu partials in `layouts/partials/`, the menu in `hugo.yaml`, and the rules for them in
`static/bioreportr/css/imerss-story.css`. Make the change in one project and carry it to the other with
`copyFrameworkOut.sh`, which preserves each project's own settings. Then check that both sites still build.

### Styling

Keep any overall styling change, such as the navigation banner, colours, fonts or page layout, in sync with the
umbrella site [salish-sea-biodiversity](https://github.com/IMERSS/salish-sea-biodiversity), which shares this look.
If a change to these projects can't be made there too, say so rather than letting the sites drift apart.

### Data manipulation

Any code that manipulates data must respect the structure of the existing data pipelines, which are written in R:

* `scripts/prepare_summary.R`, `scripts/prepare_summary_final.R`, `scripts/prepare_obs.R` and
  `scripts/intersectShapes.R` turn the source catalogue and summary into the files under `tabular_data/`.
* The `scripts/*_mapbox.R` scripts prepare each vignette's map, using `scripts/mapbox_map_common.R`.
* `R/build.R` copies the files the published site uses into `static/local/data/tabular/`.
* Shared helpers live in `scripts/utils.R`. Use `timedFread` and `timedWrite` for reading and writing CSV.

Extend these scripts, or add new R scripts in the same style, rather than introducing a separate pipeline.

Python may only be used for proofing and experimentation, for example to check or compare outputs. It must not
become part of how the project's data is produced.
