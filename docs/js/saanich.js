"use strict";

// noinspection ES6ConvertVarToLetConst
var reknitr = fluid.registerNamespace("reknitr");

// Mixin grade to apply Weibull distribution scaling for gridded obs counts as per https://claude.ai/chat/3c2ca1c6-452f-47e8-b19e-5ce1045ef26f
fluid.defaults("reknitr.storyPage.withSaanichWeibull", {
    countTransform: (x, maxCount) =>        maxCount < 200 ? x : 1 - Math.exp(-Math.pow(x / 0.012, 0.5)),
    inverseCountTransform: (x, maxCount) => maxCount < 200 ? x : 0.012 * Math.pow(-Math.log(1 - x), 1 / 0.5),
    distributeOptions: {
        countTransform: {
            source: "{that}.options.countTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.countTransform"
        },
        inverseCountTransform: {
            source: "{that}.options.inverseCountTransform",
            target: "{that hortis.libreMap.withObsGrid}.options.members.inverseCountTransform"
        }
    }
});

fluid.registerNamespace("reknitr.saanichTaxaFiltersHolder");

reknitr.saanichTaxaFiltersHolder.markup = `
<div class="mxcw-taxa-filters-holder">
    <div class="imerss-filter-controls">
        <svg width="24" height="24" class="imerss-reset-filter">
            <use href="#filter-reset" />
        </svg>
        <div>Reset filters</div>
    </div>
    <div class="imerss-filters imerss-taxa-filters">
    </div>
</div>`;


// Contains bits of "hortis.standardVizLoader" from imerss-viz.js in core
fluid.defaults("reknitr.saanichTaxaFiltersHolder", {
    gradeNames: ["fluid.viewComponent", "fluid.containerRenderingView"],

    markup: {
        container: reknitr.saanichTaxaFiltersHolder.markup
    },
    selectors: {
        filterControls: ".imerss-filter-controls",
        filters: ".imerss-taxa-filters"
    },
    components: {
        filterControls: {
            type: "hortis.filterControls",
            container: "{that}.dom.filterControls"
        },
        filters: {
            type: "reknitr.saanichFilters",
            container: "{that}.dom.filters",
            options: {
                members: {
                    allInput: "@expand:fluid.computed(reknitr.summaryTaxaRows, {vizLoader}.taxa.rows)"
                }
            }
        }
    }
});


reknitr.saanichFiltersTemplate = `
    <div class="imerss-filters">
        <div class="imerss-filter"></div>
        <div class="imerss-rank-filter imerss-filter"></div>
        <div class="imerss-introduction-filter imerss-filter"></div>
        <div class="imerss-provenance-filter imerss-filter"></div>
        <div class="imerss-graminoid-filter imerss-filter"></div>
    </div>
`;

fluid.defaults("reknitr.saanichFilters", {
    gradeNames: ["hortis.taxaFilters", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.saanichFiltersTemplate,
        fallbackContainer: reknitr.saanichFiltersTemplate
    },
    selectors: {
        rankFilter: ".imerss-rank-filter",
        introductionFilter: ".imerss-introduction-filter",
        provenanceFilter: ".imerss-provenance-filter",
        graminoidFilter: ".imerss-graminoid-filter"
    },
    components: {
        filterRoot: "{vizLoader}",
        rankFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.rankFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Taxon rank",
                fieldName: "taxonRank",
                fieldValues: ["species", "variety", "subspecies"]
            }
        },
        introductionFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.introductionFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Introduction Status",
                fieldName: "introduction_status",
                fieldValues: ["native", "exotic", "unknown"]
            }
        },
        provenanceFilter: {
            type: "hortis.valueFilter",
            container: "{that}.dom.provenanceFilter",
            options: {
                gradeNames: "hortis.taxaFilter",
                filterName: "Provenance Status",
                fieldName: "has_voucher",
                fieldValues: ["1", "0"],
                fieldLabels: ["voucher", "no voucher"]
            }
        },
        graminoidFilter: {
            type: "hortis.graminoidFilter",
            container: "{that}.dom.graminoidFilter"
        }
    }
});
