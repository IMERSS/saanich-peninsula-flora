"use strict";

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var reknitr = fluid.registerNamespace("reknitr");

fluid.registerNamespace("reknitr.solowRadius");

reknitr.solowRadius.markup = `
<div class="mxcw-solow-radius">
    <div class="mxcw-solow-radius-title">Population radius (m)</div>
    <div class="mxcw-solow-radius-slider-wrap">
        <div class="mxcw-solow-radius-track">
            <div class="mxcw-solow-radius-fill"></div>
            <input
                type="range"
                class="mxcw-solow-radius-input"
                min="0"
                max="6"
                step="1"
                value="4"
                aria-label="Population radius in metres"
            >
        </div>
    </div>
    <!--
    <div class="mxcw-solow-radius-scale-labels">
        <span>10</span>
        <span>10,000</span>
    </div>
    -->
    <div class="mxcw-solow-radius-snap-markers"></div>
    <div class="mxcw-solow-radius-current-value"></div>
    <div class="mxcw-solow-radius-note">
        *Aggregate sightings into populations: default = 1000 m
    </div>
</div>
`;

// ══════════════════════════════════════════════════════════════════════════════
// reknitr.solowRadius — pure functions
// ══════════════════════════════════════════════════════════════════════════════

/** Discrete logarithmic snap values available for selection (metres).
 * @type {Number[]}
 */
reknitr.solowRadius.SNAP_VALUES = [10, 50, 100, 500, 1000, 5000, 10000];

/** Default slider index corresponding to 1000 m.
 * @type {Number}
 */
reknitr.solowRadius.DEFAULT_INDEX = 4;

/**
 * Formats a raw metre value as a localised display string.
 * @param {Number} value - The metre value to format
 * @return {String} - Formatted string e.g. "1,000 m"
 */
reknitr.solowRadius.formatValue = function (value) {
    return value.toLocaleString("en-GB") + " m";
};

/**
 * Computes the track-fill percentage for a given snap index.
 * @param {Number} index - Integer index into SNAP_VALUES (0–6)
 * @return {Number} - Percentage of the track to colour (0–100)
 */
reknitr.solowRadius.indexToFillPercent = function (index) {
    return (index / (reknitr.solowRadius.SNAP_VALUES.length - 1)) * 100;
};

/**
 * Returns the abbreviated label string used beneath each tick mark.
 * @param {Number} value - Raw metre value
 * @return {String} - Abbreviated label e.g. "1k", "500"
 */
reknitr.solowRadius.tickLabel = function (value) {
    let label;
    if (value >= 1000) {
        label = (value / 1000) + "k";
    } else {
        label = String(value);
    }
    return label;
};

// ══════════════════════════════════════════════════════════════════════════════
// reknitr.solowRadius — lifecycle functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Populates the snap-marker row with ticks and abbreviated labels.
 * @param {fluid.viewComponent} that - The solowRadius component instance
 */
reknitr.solowRadius.buildSnapMarkers = function (that) {
    const container = that.locate("snapMarkers")[0];
    reknitr.solowRadius.SNAP_VALUES.forEach(function (val) {
        const marker = document.createElement("div");
        marker.className = "mxcw-solow-radius-snap-marker";

        const tick = document.createElement("div");
        tick.className = "mxcw-solow-radius-snap-tick";

        const label = document.createElement("div");
        label.className = "mxcw-solow-radius-snap-label";
        label.textContent = reknitr.solowRadius.tickLabel(val);

        marker.appendChild(tick);
        marker.appendChild(label);
        container.appendChild(marker);
    });
};

/**
 * Refreshes the fill bar width and the current-value display for a given index.
 * @param {fluid.viewComponent} that - The solowRadius component instance
 * @param {Number} index - Integer index into SNAP_VALUES
 */
reknitr.solowRadius.updateDisplay = function (that, index) {
    const value = reknitr.solowRadius.SNAP_VALUES[index];
    const fill = reknitr.solowRadius.indexToFillPercent(index);

    that.locate("currentValue")[0].textContent = reknitr.solowRadius.formatValue(value);
    that.locate("fill")[0].style.width = fill + "%";
};

/**
 * Handles native input events on the range element, delegating display updates.
 * @param {fluid.viewComponent} that - The solowRadius component instance
 */
reknitr.solowRadius.onInput = function (that) {
    const index = parseInt(that.locate("input")[0].value, 10);
    reknitr.solowRadius.updateDisplay(that, index);
    that.applier.change("selectedIndex", index);
};

/**
 * Wires up the input listener and performs initial render on component creation.
 * @param {fluid.viewComponent} that - The solowRadius component instance
 */
reknitr.solowRadius.onCreate = function (that) {
    const inputEl = that.locate("input")[0];

    reknitr.solowRadius.buildSnapMarkers(that);

    inputEl.value = String(reknitr.solowRadius.DEFAULT_INDEX);
    reknitr.solowRadius.updateDisplay(that, reknitr.solowRadius.DEFAULT_INDEX);

    that.inputListener = function () {
        reknitr.solowRadius.onInput(that);
    };
    inputEl.addEventListener("input", that.inputListener);
};

/**
 * Removes the input event listener attached during onCreate.
 * @param {fluid.viewComponent} that - The solowRadius component instance
 */
reknitr.solowRadius.onDestroy = function (that) {
    const inputEl = that.locate("input")[0];
    if (that.inputListener) {
        inputEl.removeEventListener("input", that.inputListener);
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// fluid.defaults — component registration
// ══════════════════════════════════════════════════════════════════════════════

fluid.defaults("reknitr.solowRadius", {
    gradeNames: ["fluid.viewComponent", "fluid.containerRenderingView"],
    markup: {
        container: reknitr.solowRadius.markup
    },
    members: {
        selectedIndex: "@expand:signal(4)",
        inputListener: null
    },
    model: {
        selectedIndex: reknitr.solowRadius.DEFAULT_INDEX
    },
    selectors: {
        title:         ".mxcw-solow-radius-title",
        track:         ".mxcw-solow-radius-track",
        fill:          ".mxcw-solow-radius-fill",
        input:         ".mxcw-solow-radius-input",
        snapMarkers:   ".mxcw-solow-radius-snap-markers",
        currentValue:  ".mxcw-solow-radius-current-value",
        note:          ".mxcw-solow-radius-note"
    },
    listeners: {
        "onCreate.init": {
            funcName: "reknitr.solowRadius.onCreate",
            args: ["{that}"]
        },
        "onDestroy.cleanup": {
            funcName: "reknitr.solowRadius.onDestroy",
            args: ["{that}"]
        }
    }
});


fluid.registerNamespace("reknitr.solowTaxonInfo");

reknitr.solowTaxonInfo.markup = `
<div class="mxcw-solow-taxon-pane">
  <div class="mxcw-taxon-image">
      %taxonImage
  </div>
  <div class="mxcw-taxon-taxon-info">
  <div class="mxcw-taxon-name">Taxon: %taxonName</div>
      <dl class="mxcw-taxon-fields">
        <dt>Date first seen:</dt> <dd>%dateFirstSeen</dd>
        <dt>Date last seen:</dt>  <dd>%dateLastSeen</dd>
        <dt>Total sightings:</dt> <dd>%numObs</dd>
      </dl>
  </div>
</div>
`;

reknitr.solowTaxonInfo.render = function (that, taxon, obsRows) {
    const container = that.container[0];
    let markup = "";
    if (taxon === null) {
        markup = that.options.markup.container;
    } else {
        const dateComparator = (a, b) => (a.eventDate < b.eventDate) ? -1 : a.eventDate > b.eventDate ? 1 : 0;
        const taxonObs = obsRows.filter(row => row.iNaturalistTaxonId === taxon.id).sort(dateComparator);
        const model = {
            taxonName: taxon.scientificName,
            dateFirstSeen: taxonObs[0].eventDate,
            dateLastSeen: fluid.peek(taxonObs).eventDate,
            numObs: taxonObs.length,
            taxonImage: hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id);
        };
        markup = fluid.stringTemplate(reknitr.solowTaxonInfo.markup, model);
    }
    container.innerHTML = markup;
};

fluid.defaults("reknitr.solowTaxonInfo", {
    gradeNames: ["fluid.viewComponent", "fluid.containerRenderingView"],
    markup: {
        container: "<div></div>"
    },
    members: {
        selectedTaxon: "@expand:signal(null)",
        obsRows: "@expand:signal([])",
        renderEffect: "@expand:fluid.effect(reknitr.solowTaxonInfo.render, {that}, {that}.selectedTaxon, {that}.obsRows)"
    }
});
