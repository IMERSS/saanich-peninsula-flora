# Guidance for agents

## Git

Do not commit or push any code. Leave all changes in the working tree for a human to review, commit and push.

## The layers beneath a project

Each of the two bioReportR projects, [saanich-peninsula-flora](https://github.com/IMERSS/saanich-peninsula-flora) and
[howe-sound-mapping-2026](https://github.com/IMERSS/howe-sound-mapping-2026), is the topmost of a stack of layers, each
built on the one beneath it. Decide in which layer a change belongs before making it, and make it in the lowest layer
in which it makes sense - a change made in a project which belongs beneath it is soon duplicated, and the copies then
drift apart.

1. **The project's own definitions** - what is true of one story alone: its content and the settings of the shared
   framework for it.
   * `content/` - the story's R Markdown panes and their knitted output, and its other pages
   * `bioreportr.yaml` - the data files which the story page reads at runtime, named once for every part of the project
     which reads them: `R/build.R`, which publishes them, the R scripts, through `scripts/project.R`, and the story
     page, through the layer `bioreportr.storyData`, which `npm run story` writes from it into
     `static/story/bioreportr-storyData.vue`. Never name such a file anywhere else
   * `bioreportr-prep.yaml` - optionally, the files read and written only by the data preparation scripts on the way to
     those, e.g. the input checklist and catalogue and the intermediate files of `assignBNames.js`. The rule above
     applies only to files consumed by the story page: a preparation script may name its own intermediate files
     itself, though naming them here keeps the scripts free of dated filenames. `scripts/project.R` reads both files
   * `hugo.yaml`, `package.json`, `mapboxData.json`, `static/curation/config.json`
   * `static/local/story/<project>-story.vue` - the story page's driver, which names the shared layers the story is made
     of in its `$layers` and gives their settings, e.g. its data files, the columns of its tables, `recentYear`,
     `isSighting` or `inatSpeciesQuery`
   * `static/local/story/` - Single File Components of panes or widgets which only this story could have, such as
     Saanich's pane in memory of Harvey Janszen, and `static/local/js` and `static/local/css` for the little which
     belongs to no component
   * `scripts/project.R` - the settings read by the shared R scripts beyond the data files, e.g. the categories of the
     project's protected areas - and the R scripts which fetch and prepare this project's own data, e.g.
     `scripts/fetch_protected_areas.R`
2. **The bioReportR framework**, shared between the projects and copied from one to the other by
   `copyFrameworkOut.sh` - everything which more than one story has or could have.
   * `static/bioreportr/sfc/` - the story page, `bioreportr-storyPage.vue`, and the Single File Components of every
     shared pane and widget: the atlas's panel, tiles and summaries (`bioreportr-atlasPanel.vue`), the opening timeline
     (`bioreportr-tracesPane.vue`), the gallery of lost plants (`bioreportr-lostPlantsPane.vue`), the Protected Areas
     pane (`bioreportr-protectedPane.vue`), the extirpation risk analysis and community curation. A pane is laid over
     the story page by a layer of its own, e.g. `bioreportr.storyPageTraces` in `bioreportr-storyPageTraces.vue`,
     which a project names in its `$layers`
   * `static/bioreportr/js`, `static/bioreportr/css` - the shared scripts and styles, chiefly `imerss-story.css`
   * `static/bioreportr/data/placeholder` - the small data files from which every story page is rendered statically by
     `npm run hydrate`, in place of its own data. They serve only to let the page's skeleton render, so are shared by
     every story rather than made for each
   * `src/js/` - the build's steps, e.g. `storyBuild.js`; `layouts/` - the site's templates and partials, among them
     the navigation
   * the shared R: `R/build.R`, `R/build2.R`, `R/npm.R`, `R/knit_render.R`, `scripts/utils.R`, `scripts/geomUtils.R`,
     `scripts/mapbox_map_common.R`, `scripts/intersectShapes.R` and `scripts/Protected_map_mapbox.R`, whose
     project's settings are in `scripts/project.R`
3. **imerss-bioinfo**, the core visualisation framework of IMERSS, used by sites other than these - its `hortis`
   components load the data, filter it, and render the maps, checklists, tables and taxon panels on which the stories
   are built. It is vendored as `static/vendor/imerss-bioinfo`, and changes to it are made upstream in its own
   repository - see "Vendored libraries" below.
4. **Infusion 6**, the `infusion-6` dependency, vendored as `static/vendor/infusion`, in which every layer above is
   written. Read its documentation before changing a component:
   * [The Fluid Integration Language](https://ponder.org.uk/docs/fluid-integration-language/) - how components are
     defined, composed and wired together
   * [Fluid View](https://ponder.org.uk/docs/fluid-view/) - how components render templates and bind to the page

An application is composed of declarative layers, each a `fluid.def` naming the layers it builds on in `$layers`. A
component's layers are merged together in an order fixed by the C3 linearisation algorithm, as in Python's method
resolution, so that a layer's definitions override those of the layers it builds on. Any design can therefore be
adjusted from outside, without editing the code which defines it: by adding extra layer names along the configuration
path to the component, as `paneOverrides` in each project's `<project>-story.vue` does, or, for a truly unanticipated
modification, by a `$linkage`, which adds its output layers to every component bearing all of its input layers, or
matching its selector, wherever that component is in the tree. This is what lets a pane be shared while each story
adjusts it: the shared layer holds the design, with its defaults, and the project's story overrides only its settings.

## Rubric for changes

### Coherence across the projects

The two projects are two stories told with one framework, and are to be kept coherent with each other - not only in
their navigation, but in every pane, widget, style, build step and R script which they have in common. When a change
is asked for in one project, assume by default that it belongs to both:

* **Share whatever more than one story has, or could have.** If the code you are about to write would be the same in
  the other project apart from names, data files, place names or a few values, it belongs in the framework, with those
  differences made settings - members of its layers with defaults, which a project's `<project>-story.vue` overrides,
  or entries of `scripts/project.R` for R. A story's own wording belongs in its R Markdown, not in code.
* **Look before writing.** Before adding anything to `static/local/` or a project's own R scripts, check whether the
  other project already has its equivalent, and if so, move both into the framework rather than writing a third copy.
  A near-copy of a file in the other project, with its namespace renamed, is always a sign that it should be shared.
* **Keep to the framework's names.** Shared code lives in the `bioreportr` namespace, and its CSS classes carry the
  prefix `mxcw-`. A project's own code lives in its namespace, e.g. `saanich` or `howe`, with its own prefix, e.g.
  `saanich-`, and is used only for what no other story could have.
* **Carry it across.** Make the shared change in one project, add any new shared file to the list in
  `copyFrameworkOut.sh`, and carry it to the other project with `copyFrameworkOut.sh <other-project>` - run it with
  `-n` first to see what it will change. It keeps each project's own section in the `<template>` block of a shared
  pane's Single File Component. Then build both projects, and check both sites in a browser.
* **Say when a difference is deliberate.** Where the projects must differ in a shared design - e.g. in which records
  count as sightings - make the difference a setting, with a comment in the project's story explaining it, rather than
  forking the code. If you can't decide whether a difference is deliberate, ask rather than choosing silently.

This covers in particular the navigation - the navbar, subnav, sidebar and mobile menu partials in `layouts/partials/`,
the menu in `hugo.yaml`, and the rules for them in `static/bioreportr/css/imerss-story.css`.

### Styling

Keep any overall styling change, such as the navigation banner, colours, fonts or page layout, in sync with the
umbrella site [salish-sea-biodiversity](https://github.com/IMERSS/salish-sea-biodiversity), which shares this look.
If a change to these projects can't be made there too, say so rather than letting the sites drift apart.

Push any styling relevant across projects into `static/bioreportr`: into the `<style>` block of the shared Single File
Component it styles, or, if it styles no one component, into `imerss-story.css`. Keep material written in
`static/local/css` to the absolute minimum, referring to panes or material that exists in only one project.

Rather than spread material of the same type into shared .css and .js files, instead consolidate code and styling into
.vue files related to a widget or pane.

### Vendored libraries

Never edit the vendored libraries, such as imerss-bioinfo and Infusion, in `static/vendor` or `docs/vendor`, nor in
`node_modules`. `npm run vendor` copies them from `node_modules`, so any edit is lost or reverted by the next copy. A
change one of them needs must be made upstream in its own repository, normally offered as a patch for a human to apply.
It then reaches this project only once its dependency in `package.json` is updated to the release holding it, and
`npm run build` is run. Don't commit vendored files changed by `npm run vendor` unless the dependency's version was
deliberately updated, since a stale local `node_modules` would otherwise revert the libraries.

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

1. Create a Single File Component named after its component - in `static/bioreportr/sfc/`, e.g.
   `bioreportr-lostPlantsPane.vue` for `bioreportr.lostPlantsPane`, unless only this story could have such a pane, in
   which case in `static/local/story/`, e.g. `saanich-rememberingPane.vue` for `saanich.rememberingPane`. It holds:
   * the component's `fluid.def`, and those of any components it brings, together with all the functions only this
     pane uses, written for the settings of any story rather than one
   * a `<style>` block with all the styling only this pane uses - not `static/local/css`
   * a comment above an empty `<template>` block saying that its content is interpolated by `storyBuild.js` from the
     named `.Rmd`, and must not be edited by hand. Copy the comment from an existing pane component.
2. If the pane configures anything onto the story page, e.g. a component of its own as a member of the page, define
   that wiring as a layer of the story page in a Single File Component of its own, named after it, e.g.
   `bioreportr.storyPageLostPlants` in `bioreportr-storyPageLostPlants.vue`. A Single File Component imported by
   `<fluid-import>` is loaded only when the layer named after its file is demanded, so a layer defined in a file named
   after another is not found when the story page demands it.
3. Import it with `<fluid-import>` in the project's `<project>-story.vue`, name its layer in the story's `$layers`, and
   give the story's settings for it there. Add a shared file to the list in `copyFrameworkOut.sh`.
4. Add `paneComponent: <component name>` to the pane's front matter, then knit the pane and run `npm run story`.

The section is a template, so its R Markdown may bind members of the component with `@{...}`. Write such a binding as
raw HTML, e.g. `` `<span class="mxcw-lost-count">@{count}</span>`{=html} ``, since pandoc would otherwise read
`@{count}` as a citation. Since a shared pane's Single File Component is shared, its template holds the section of
whichever project was built last, and each project's `npm run story` rewrites it.

### Community curation

Both projects end their story with a Community Curation pane, `content/story/Curation.Rmd`, rendered by the shared
`bioreportr.curationPane`, through which the community adds notes on taxa - their provenance and taxonomy - and on
individual records, chiefly correcting their positions, as comments on GitHub Discussions. Read
`notes/community-curation-design.md` before changing it. Each project's own settings are in
`static/curation/config.json`. `static/curation/taxa.csv`, `observations.csv` and `claimStatus.json` are written by
the consolidation job, `.github/workflows/curation.yml` - never edit them by hand. Since `bioreportr-curationPane.vue` is
shared, its template holds the section of whichever project was built last, and each project's `npm run story`
rewrites it.

### Building the site

`npm run build` runs every step. RStudio's *Build Website*, through blogdown, builds the same site: blogdown runs
`R/build.R` before Hugo, which runs `npm run story` and `npm run vendor` and adopts published files, and
`R/build2.R` after it, which runs `npm run hydrate`, both through `R/npm.R`. Keep the two routes doing the same steps.
blogdown's Hugo doesn't clean `docs`, so a file the build no longer produces is only removed by `npm run build`.
`npm run site` builds the published site, `docs`, with `hugo --cleanDestinationDir`, which deletes everything in
`docs` that the build does not produce. Never place anything by hand in `docs`: every file
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
  `intersectShapes.R` is shared between the projects, and reads the project's catalogue and index of shapes from
  `scripts/project.R`.
* The `scripts/*_mapbox.R` scripts prepare each vignette's map, using `scripts/mapbox_map_common.R`. Those of the
  shared panes are shared, e.g. `scripts/Protected_map_mapbox.R`, which reads the categories of the project's protected
  areas, its boundary, its view and the wording of its summaries from `scripts/project.R`.
* Make any other script which the projects have in common shared in the same way, its project's settings added to
  `scripts/project.R`.
* `R/build.R` copies the files the published site uses into `static/local/data/tabular/`.
* Shared helpers live in `scripts/utils.R`. Use `timedFread` and `timedWrite` for reading and writing CSV.

Extend these scripts, or add new R scripts in the same style, rather than introducing a separate pipeline.

Python may only be used for proofing and experimentation, for example to check or compare outputs. It must not
become part of how the project's data is produced.
