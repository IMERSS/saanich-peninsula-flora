This looks good - speculate about what would be a more reasonable reuse strategy for a project of this kind. It seems to be positioned at a train-wreck faultline of various packaging systems - for example Hugo themes, R packages in CRAN, js modules in npm, none of which are a great fit for its lifecycle. It seems that git repositories as a template are what is typically done but these suffer from problems of their own - brittle trajectories and all-or-nothing updates which essentially force projects to hard-fork before long. Could we do somewhat better than this shell script?


Yes. The shell script is a copy tool, and it has the same weakness as forking a template: once a file is copied it no longer knows where it came from, so every local edit is silent drift. I think most of the fix is already available in the tools you're using.

What's going wrong here

The inventory showed two separate problems that the current setup tangles together:

1. Framework and local files sit in the same directories with nothing to tell them apart. static/js/ holds framework runtime, files produced by copyJobs and saanich.js side by side. layouts/partials/ mixes shared overrides with custom/head-end.html. Working out which is which took a diff against five sibling projects.
2. Local customisation is done by editing framework files rather than through extension points. imerss-viz-reknit.js:110 hardwires saanichTaxaFiltersHolder. head-end.html is "local" only because one <script> line names the project. utils.R has drifted in every project. Each such edit makes the file look local, so the next update has to either overwrite it or skip it. That's how all-or-nothing updates come about.

### Why none of the package systems fits

Each package manager owns only one slice of the project: npm the JS, CRAN the R, Hugo modules the layouts. The project spans all three plus templates, and only the project gives them a shared lifecycle. Two more traits push against packaging:

- The framework is developed in place. The 2026-10-12 resize-bar and Carto work was done inside Saanich and has to flow back upstream. Package managers assume development happens upstream and flows down to consumers.
- The published output should be frozen and self-contained (committed docs/ on GitHub Pages). So vendoring the files into each project is actually the right way to deploy. What's missing is a record of where each vendored file came from.

### A layered alternative

1. Put the framework in one directory and use Hugo theme stacking as the overlay. Hugo already resolves layouts, static files and assets by path across a list of themes:

theme: ["bioreportr", "hextra"]

With themes/bioreportr/ holding layouts/, static/js, static/css, plus src/ and R/, the project's own layouts/ and static/ contain only its overrides. You get per-file override for free. You also get a nice side effect: ls layouts/ in a project lists exactly what that project has diverged on. Nobody has to reconstruct the classification I did here. reknit.js already resolves module-relative paths like %imerss-bioinfo/..., so %bioreportr/src/html/template.html fits the same convention.

2. Carry it with git subtree, not submodules or npm. A subtree vendors the framework into the repo, so R users cloning it need nothing extra and the published site stays self-contained. It keeps history, and it works in both directions:
- git subtree pull --prefix themes/bioreportr brings in upstream changes as a real merge, with real conflicts where needed.
- git subtree push sends Saanich's improvements back to bioReportR.

That bidirectional flow is the part the template-repo approach lacks.

3. Replace edits with configuration, using the tools you already have. Infusion's grade and option merging is designed for exactly this kind of non-forking customisation. The problem is only that it isn't used at these seams:
- The taxa filter holder type becomes an option set in config.json5, alongside vizLoader.gradeNames.
- head-end.html loops over a Hugo param such as params.bioreportr.localScripts: [saanich.js] and localStyles: [howe.css], so it moves back into the framework.
- R/build.R reads its CSV list from config instead of hard-coding it.

Each of these takes a file off the local list for good.

4. For drift you can't avoid, record it instead of hiding it. Some divergence is legitimate, such as the subnav alignment. Put it in a project-level override file under the overlay, or in an explicit patch. Don't edit the vendored copy.

If you'd rather keep copying

You can make the script track history: have it write a manifest of each file's upstream commit hash. On the next run:
- If the target still matches the recorded base, it overwrites safely.
- If the target was edited locally, it runs git merge-file target base new for a three-way merge and reports conflicts.

That's what Copier (with copier update) and cruft do for cookiecutter templates. Either could be used directly, though neither understands the copyJobs or module-path conventions.

My recommendation

Do steps 1 and 3 first. The overlay plus a handful of configuration points removes most of the file-level classification problem. After that the transport (subtree, npm, or this script) becomes a fairly minor choice, and I'd pick subtree because the framework is developed in place.

A reasonable first experiment: move the 35 framework files into themes/bioreportr/ in Saanich, set theme: ["bioreportr", "hextra"], and check that hugo and npm run build produce the same docs/ as before.
