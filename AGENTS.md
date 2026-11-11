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

Ensure that any styling changes you make to the project are pushed into imerss-story.css if they are relevant across
projects. Keep material written in static/local/css to the absolute minimum, referring to panes or material that exists
in only one project.

Rather than spread material of the same type into shared .css and .js files,
instead consolidate code and styling into .vue files related to a widget or pane.

### Panes of a story

Each pane of the story page is knitted from an R Markdown file, `content/story/<PaneKey>.Rmd`, by the RStudio user.
Agents may knit a pane with a local R to check it, but R must never become a step of the build: `npm run build` works
from the knitted `.html` files as they are checked in. `src/js/storyBuild.js` (`npm run story`) extracts each pane's
section from its knitted `.html`. A pane is then rendered in one of two ways:

* By default, its section is written to `static/story/<PaneKey>.html` and rendered verbatim by
  `bioreportr.verbatimSection`. Use this for a pane which needs nothing of its own beyond the shared framework.
* A pane with script, styling or bindings of its own names a component in its front matter, e.g.
  `paneComponent: saanich.lostPlantsPane`. `storyBuild.js` then writes its section into the `<template>` block of the
  Single File Component defining that component, replacing only what lies between `<template>` and `</template>`, and
  writes no `.html` file for it. `bioreportr.storyPane` renders the section with that component.

To allocate a new pane type of this kind:

1. Create a Single File Component in `static/local/story/` (or `static/bioreportr/sfc/` if it is shared between
   projects), named after its component, e.g. `saanich-lostPlantsPane.vue` for `saanich.lostPlantsPane`. It holds:
   * the component's `fluid.def`, and those of any components it brings, e.g. one configured onto the story page in
     the project's `<project>-story.vue`, together with all the functions only this pane uses
   * a `<style>` block with all the styling only this pane uses - not `static/local/css`
   * a comment above an empty `<template>` block saying that its content is interpolated by `storyBuild.js` from the
     named `.Rmd`, and must not be edited by hand. Copy the comment from an existing pane component.
2. Import it with `<fluid-import>` in the project's `<project>-story.vue`.
3. Add `paneComponent: <component name>` to the pane's front matter, then knit the pane and run `npm run story`.

The section is a template, so its R Markdown may bind members of the component with `@{...}`. Write such a binding as
raw HTML, e.g. `` `<span class="saanich-lost-count">@{count}</span>`{=html} ``, since pandoc would otherwise read
`@{count}` as a citation.

### Community curation

Both projects end their story with a Community Consensus pane, `content/story/Curation.Rmd`, rendered by the shared
`bioreportr.curationPane`, through which the community adds notes on taxa as comments on GitHub Discussions. Read
`notes/community-curation-design.md` before changing it. Each project's own settings are in
`static/curation/config.json`. `static/curation/curations.csv` and `claimStatus.json` are written by the
consolidation job, `.github/workflows/curation.yml` - never edit them by hand. Since `bioreportr-curationPane.vue` is
shared, its template holds the section of whichever project was built last, and each project's `npm run story`
rewrites it.

### Building the site

`npm run build` runs every step. RStudio's *Build Website*, through blogdown, builds the same site: blogdown runs
`R/build.R` before Hugo, which runs `npm run story` and `npm run vendor` and adopts published files, and
`R/build2.R` after it, which runs `npm run hydrate`, both through `R/npm.R`. Keep the two routes doing the same steps.
blogdown's Hugo doesn't clean `docs`, so a file the build no longer produces is only removed by `npm run build`. `npm run site` builds the published site, `docs`, with `hugo --cleanDestinationDir`,
which deletes everything in `docs` that the build does not produce. Never place anything by hand in `docs`: every file
published must have a source from which the build produces it, usually in `static`. The one exception is a file which
GitHub Pages itself writes into `docs`, such as `CNAME`. `src/js/adoptPublished.js` adopts any such file into `static`
before the build, so that it is published again; commit the adopted file there.

The hextra theme's scripts and styles are published as static files at stable URLs from `static/bioreportr/hextra`,
not through Hugo's asset pipeline. Run `npm run theme` (`src/js/themeAssets.js`) to regenerate them after updating the
theme in `themes/hextra` or changing its menu override, `src/hextra/js/menu.js`. Do not add `assets/` resources or
fingerprinted pipeline output to the site.

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
