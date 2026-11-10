#!/usr/bin/env bash
# Copy the bioReportR "framework" files from this project into another bioReportR project.
#
# Usage: ./copyFramework.sh [-n] <target-project-dir>
#   -n   Dry run - report what would change without copying anything
#
# Deliberately NOT copied:
#  - Project-local content and configuration: hugo.yaml, package.json, mapboxData.json, content/,
#    layouts/partials/custom/head-end.html, layouts/partials/favicons.html, static/local/,
#    R/build.R (lists the project's data files), scripts/*.R map and analysis scripts
#  - Experimental R parsing work: src/js/parseR.mjs, src/js/r-parser/
#  - The story page's driver static/local/story/<project>-story.vue, its development page static/story/index-dev.html,
#    and the material written into static/story by "npm run story" (src/js/storyBuild.js) from content/story
#  - Generated output: static/vendor, written by "npm run vendor", static/bioreportr/hextra, written by "npm run theme",
#    and docs/

set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "-n" ]; then
    DRY_RUN=1
    shift
fi

if [ $# -ne 1 ]; then
    echo "Usage: $0 [-n] <target-project-dir>" >&2
    exit 1
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(cd "$1" && pwd)"

if [ "$SRC" = "$TARGET" ]; then
    echo "Target is the same as the source project" >&2
    exit 1
fi

if [ ! -f "$TARGET/src/js/storyBuild.js" ] || [ ! -f "$TARGET/layouts/story/baseof.html" ]; then
    echo "$TARGET does not look like a bioReportR project (no src/js/storyBuild.js or layouts/story/baseof.html)" >&2
    exit 1
fi

FILES=(
    # Ourselves
    copyFrameworkOut.sh
    # The bioReportR story page - its build step, and its Single File Components, scripts and the
    # htmlwidgets runtime they load. Those it uses of imerss-bioinfo and Infusion 6 are copied into each project's
    # static/vendor by "npm run vendor" (Infusion 6's copyOut.js)
    src/js/storyBuild.js
    # The build's own clean-up of the published site - see "npm run site"
    src/js/adoptPublished.js
    static/bioreportr/sfc/bioreportr-dataPane.vue
    static/bioreportr/sfc/bioreportr-epFilter.vue
    static/bioreportr/sfc/bioreportr-pageFragment.vue
    static/bioreportr/sfc/bioreportr-recordAndTaxaReporter.vue
    static/bioreportr/sfc/bioreportr-sectionTab.vue
    static/bioreportr/sfc/bioreportr-solowRadius.vue
    static/bioreportr/sfc/bioreportr-solowTaxa.vue
    static/bioreportr/sfc/bioreportr-solowTaxonInfo.vue
    static/bioreportr/sfc/bioreportr-statusFilter.vue
    static/bioreportr/sfc/bioreportr-storyMap.vue
    static/bioreportr/sfc/bioreportr-storyPage.vue
    static/bioreportr/sfc/bioreportr-storyPane.vue
    static/bioreportr/js/story.js
    static/bioreportr/js/solow.js
    static/bioreportr/vendor/htmlwidgets.js
    static/bioreportr/vendor/htmlwidgets-plotly.js
    static/bioreportr/vendor/plotly-2.1.1.js

    # Story page styling
    static/bioreportr/css/imerss-inat-panels.css
    static/bioreportr/css/imerss-story.css
    static/bioreportr/css/imerss-viz-story.css
    static/bioreportr/css/imerss-blitzr.css
    static/bioreportr/images/imerss-header-cropped.jpg

    # Overrides of the hextra theme: its scripts and styles are published as static files at stable URLs, rather than
    # through Hugo's asset pipeline. src/js/themeAssets.js writes them into static/bioreportr/hextra from the theme and
    # the override of its menu script - each project runs it, as "npm run theme", since it reads the project's hugo.yaml
    src/js/themeAssets.js
    src/hextra/js/menu.js
    layouts/partials/scripts.html
    layouts/partials/head-css.html
    layouts/_default/baseof.html
    layouts/partials/footer.html
    layouts/partials/language-switch.html
    layouts/partials/navbar.html
    layouts/partials/search.html
    layouts/partials/sidebar.html
    layouts/partials/subnav.html
    layouts/partials/toc.html
    layouts/shortcodes/new-feature.html
    layouts/story/baseof.html
    layouts/story/single.html

    # Shared R: blogdown hooks and map/geometry utilities
    R/build2.R
    R/knit_render.R
    scripts/utils.R
    scripts/geomUtils.R
    scripts/mapbox_map_common.R

    # Lint configuration
    .eslintrc.json
    .fluidlintallrc.json
)

new=0
changed=0
unchanged=0
for f in "${FILES[@]}"; do
    if [ ! -f "$SRC/$f" ]; then
        echo "MISSING in source: $f" >&2
        exit 1
    fi
    if [ ! -f "$TARGET/$f" ]; then
        status="new"
        new=$((new + 1))
    elif cmp -s "$SRC/$f" "$TARGET/$f"; then
        unchanged=$((unchanged + 1))
        continue
    else
        status="changed"
        changed=$((changed + 1))
    fi
    echo "$status: $f"
    if [ $DRY_RUN -eq 0 ]; then
        mkdir -p "$(dirname "$TARGET/$f")"
        cp -p "$SRC/$f" "$TARGET/$f"
    fi
done

echo
echo "$new new, $changed changed, $unchanged unchanged$([ $DRY_RUN -eq 1 ] && echo " (dry run - nothing copied)")"
if [ $DRY_RUN -eq 0 ] && [ $((new + changed)) -gt 0 ]; then
    echo "Now run \"npm run build\" in $TARGET to rebuild its story material, vendored framework and site"
fi
