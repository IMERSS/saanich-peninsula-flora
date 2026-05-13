"use strict";

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
