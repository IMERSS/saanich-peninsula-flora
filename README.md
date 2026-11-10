# Saanich Peninsula Flora

This project hosts a structure for building out and publishing a map-based storymapping
interface for the Flora of the Saanich Peninsula
based on [R Markdown](https://rmarkdown.rstudio.com/).

You can browse the published output of this project at [https://imerss.github.io/saanich-peninsula-flora/story](Flora
of the Saanich Peninsula].

The project's publishing pipeline is based on the [bioReportR](https://IMERSS/bioreportr) publishing system, which
is based on R and R Markdown, using free tools such as git, R and R studio, and published and hosted for free using
[GitHub Pages](https://pages.github.com/). BioReportR is based on the [blogdown](https://pkg.yihui.org/blogdown/)
R package for publishing web sites using the popular [hugo](https://gohugo.io/) framework.

This system grew out of work done in 2023 for the
[Maxwell Creek Watershed Project](https://transitionsaltspring.com/maxwell-creek-watershed-project/) which is being
undertaken by [Transition Salt Spring](https://transitionsaltspring.com/).

To see the potential of storymapping frameworks to use data to tell stories, you can visit two
thoroughly elaborated [data explorations](https://www.data-arc.org/my-front-page/example-data-explorations/) from
the dataARC project which present two stories, "Quantifying an ever-changing landscape" and "Data mining the past"
using two mature storymapping frameworks, [ESRI/ArcGIS Storymaps](https://storymaps.arcgis.com/) and [HTML + Binder/Jupyter](https://mybinder.org/).

Here we operate a homegrown approach showing how readily available and widely understood open source tools can be
orchestrated to produce a basic end-to-end authoring and hosting environment.
Consult [Knitting Data Communities](https://lichen-community-systems/knitting-data-communities/) for some values
underlying this work.

## Installation instructions

If you haven't worked with this kind of project before, you will need the following tools:

* git for your platform, installed according to instructions like [these ones from GitHub](https://github.com/git-guides/install-git).

* R and R studio, installed from [posit's website](https://posit.co/download/rstudio-desktop/)

In order to build the story page from the markup rendered by R and R markdown, you will also need the following tools:

* node and npm for your platform, installed according to [node's instructions](https://nodejs.org/en/download/).

Rather than doing this yourself, you could enlist a friendly developer to do these actions for you and commit to
your repository. Before long, this repository will contain automatic actions to do this using
[GitHub Actions](https://github.com/features/actions).

## Starting your own work based on this repository

To make your own fork of this repository to start filling it with your own content, follow GitHub's instructions on
[forking a repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo#forking-a-repository) - you will want
to choose a new name for the repository as shown in step 4 of these instructions.

For a more simple-minded approach, you can simply copy all the files resulting from cloning this repository into a new
folder on your system (missing out the `.git` directory).

After this, you can switch to Posit's instructions on
[using git with R Studio](https://support.posit.co/hc/en-us/articles/200532077-Version-Control-with-Git-and-SVN) - go to
the section named "Creating a new project based on a remote Git or Subversion repository" and supply the repository URL
for your forked repository at step 4. If you haven't worked with these tools before, you will want to choose the HTTPS
version of the repository URL available from the "Code" dropdown as shown in the following picture:

![Code in GitHub](img/code_img.png)

Another useful guide is at [Connect RStudio to Git and GitHub](https://happygitwithr.com/rstudio-git-github.html).

Before building and publishing the site, you will now need to download JavaScript dependencies for this project by opening
a terminal in its root folder and typing

    npm install

## Knitting your markdown and building the story

The first part of the publishing chain is to use the builtin "knitting" functionality in R studio described in the
[authoring guide](https://rmarkdown.rstudio.com/authoring_quick_tour.html) - open up one of the .Rmd files
in the [story](content/story) directory and press the "Knit" button above it. This will produce an HTML file in the
same directory which can be previewed to see if your maps, content and any widgets look as expected in a standalone
mode.

As you edit your documents in [content/story](content/story), you can build out scripts for further maps in
[scripts](scripts). Please consult the [using Mapbox Layers in R](https://plotly.com/r/mapbox-layers/) guide for how to
add your own map data to your maps.

The type of vignette is customised by a mixture of YAML front matter in the .Rmd files, such as its `title` and its
`weight`, which orders the panes, and entries in the `paneOverrides` member of the story's driver,
[static/local/story/saanich-story.vue](static/local/story/saanich-story.vue), keyed by the basename of the .Rmd file.

Once your vignettes knit properly using the R Studio "Knit" process, build the story and the site as a whole by running

    npm run build

This runs four steps, which can also be run singly:

* `npm run story` runs [src/js/storyBuild.js](src/js/storyBuild.js), which writes the panes knitted from
  [content/story](content/story), and the data of their maps, into `static/story`
* `npm run vendor` runs Infusion 6's `copyOut.js`, which copies Infusion and the IMERSS visualisation framework into
  `static/vendor`
* `hugo` builds the site into `docs`
* `npm run hydrate` runs Infusion 6's `hydrate.js`, which renders the story page into `docs/story/index.html`, so that
  it shows its markup before its data has loaded

Commit and push the output from this stage using R Studio or command-line git as you prefer. For using R Studio
to commit your file, you can follow the steps in
[section 12.4](https://happygitwithr.com/rstudio-git-github.html#make-local-changes-save-commit) of the guide to using
GitHub in R studio.

The markup framing the story is the Hugo layout [layouts/story/baseof.html](layouts/story/baseof.html), which imports
the story's driver and holds the element on which it boots. During development, the story can be viewed without Hugo
from [static/story/index-dev.html](static/story/index-dev.html).

## Setting up GitHub Pages to publish your markup

To publish the markup resulting from both the knitting and the build, set up the configuration on your
repository to publish GitHub Pages from the `docs` folder of the `main` branch. This is available from the `Pages`
tab on your repository's settings, as shown in the image below:

![GitHub Pages configuration](img/gh-pages.png)

You can find our what URL your markup will be published at by looking in the GitHub Pages settings for your
repository. For example, the story at [docs/story/index.html](docs/story/index.html) is published at
[https://imerss.github.io/saanich-peninsula-flora/story/](https://imerss.github.io/saanich-peninsula-flora/story/).

The overall URL of your documents published in GitHub pages will start with `https://<your-account>.github.io/<your-repository>`.

## Get involved

To suggest improvements to these instructions and publishing system, please
[raise an issue](https://github.com/IMERSS/r-scrollytelling-template/issues). For a wider background
surrounding this project and its philosophy, please go to
[Knitting Data Communities](https://lichen-community-systems/knitting-data-communities/).
