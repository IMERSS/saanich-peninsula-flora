"use strict";

// noinspection ES6ConvertVarToLetConst
var reknitr = fluid.registerNamespace("reknitr");
// noinspection ES6ConvertVarToLetConst
var hortis = fluid.registerNamespace("hortis");

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
    that.selectedIndex.value = index;
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

reknitr.solowRadius.indexToRadius = index => reknitr.solowRadius.SNAP_VALUES[index];

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
        radius: "@expand:fluid.computed(reknitr.solowRadius.indexToRadius, {that}.selectedIndex)",
        inputListener: null
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
  <div class="mxcw-taxon-info">
  <div class="mxcw-taxon-name">Taxon: %taxonName</div>
      <dl class="mxcw-taxon-fields">
        <dt>Date first seen:</dt> <dd>%dateFirstSeen</dd>
        <dt>Date last seen:</dt>  <dd>%dateLastSeen</dd>
        <dt>Total sightings:</dt> <dd>%numObs</dd>
        <dt>Regional PP:</dt>     <dd>%regionalPP</dd>
      </dl>
  </div>
</div>
`;

reknitr.obsDateComparator = (a, b) => (a.eventDate < b.eventDate) ? -1 : a.eventDate > b.eventDate ? 1 : 0;

reknitr.solowObsForTaxon = (obsRows, taxonRow) => {
    return taxonRow ?
        obsRows.filter(row => row.iNaturalistTaxonId === taxonRow.id).sort(reknitr.obsDateComparator)
        : [];
};

reknitr.solowTaxonInfo.renderModel = function (taxon, taxonObsRows) {
    if (taxon === null) {
        return undefined;
    } else {
        const model = {
            taxonName: taxon.scientificName,
            dateFirstSeen: taxonObsRows[0].eventDate,
            dateLastSeen: fluid.peek(taxonObsRows).eventDate,
            numObs: taxonObsRows.length,
            regionalPP: taxon.direct_solow_pp,
            taxonImage: hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)
        };
        return model;
    }
};

fluid.defaults("reknitr.solowTaxonInfo", {
    gradeNames: ["fluid.viewComponent", "fluid.stringTemplateRenderingView"],
    markup: {
        container: reknitr.solowTaxonInfo.markup
    },
    members: {
        selectedTaxon: "@expand:signal(null)",
        obsRows: "@expand:signal([])",
        taxonObsRows: "@expand:fluid.computed(reknitr.solowObsForTaxon, {that}.obsRows, {that}.selectedTaxon)",
        renderModel: "@expand:fluid.computed(reknitr.solowTaxonInfo.renderModel, {that}.selectedTaxon, {that}.taxonObsRows)"
    }
});

"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// Geodesic distance helper
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Computes the great-circle distance in metres between two (lat, long) points
 * using the WGS-84 mean radius approximation (Haversine formula).
 *
 * @param {Number} lat1 - Latitude of the first point in decimal degrees.
 * @param {Number} lon1 - Longitude of the first point in decimal degrees.
 * @param {Number} lat2 - Latitude of the second point in decimal degrees.
 * @param {Number} lon2 - Longitude of the second point in decimal degrees.
 * @return {Number} - Distance in metres.
 */
reknitr.haversineDistance = function (lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const a = sinDLat * sinDLat +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ══════════════════════════════════════════════════════════════════════════════
// Clustering
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Partitions an array of observation rows into clusters using single-linkage
 * (any-neighbour) connectivity: two observations belong to the same cluster if
 * the distance between them is ≤ solowRadius metres.  Uses a Union-Find
 * structure for efficiency.
 *
 * @param {Object[]} obsRows - Array of observation rows, each with
 *   decimalLatitude and decimalLongitude fields.
 * @param {Number} solowRadius - Maximum distance in metres that still links two
 *   observations into the same cluster.
 * @return {Object[][]} - Array of clusters, each cluster being an array of
 *   observation rows.
 */
reknitr.clusterObsByRadius = function (obsRows, solowRadius) {
    const n = obsRows.length;
    const parent = fluid.iota(n);
    const rank = new Array(n).fill(0);

    /**
     * Finds the root of the set containing element i in the Union-Find structure.
     * Performs path compression by making each node on the path point directly to its grandparent,
     * flattening the structure for future queries.
     *
     * @param {Number} i - Index of the element to find the root for.
     * @return {Number} - The root index of the set containing i.
     */
    const find = function (i) {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]]; // path compression
            i = parent[i];
        }
        return i;
    };

    const union = function (a, b) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            if (rank[ra] < rank[rb]) {
                parent[ra] = rb;
            } else if (rank[ra] > rank[rb]) {
                parent[rb] = ra;
            } else {
                parent[rb] = ra;
                rank[ra]++;
            }
        }
    };

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pi = obsRows[i][hortis.pointSymbol],
                pj = obsRows[j][hortis.pointSymbol];
            // Order: long, lat
            const dist = reknitr.haversineDistance(pi[1], pi[0], pj[1], pj[0]);
            if (dist <= solowRadius) {
                union(i, j);
            }
        }
    }

    const clusterMap = {};
    for (let i = 0; i < n; i++) {
        const root = find(i);
        if (!clusterMap[root]) {
            clusterMap[root] = [];
        }
        clusterMap[root].push(obsRows[i]);
    }

    return Object.values(clusterMap);
};

// ══════════════════════════════════════════════════════════════════════════════
// Solow prior-probability computation
// ══════════════════════════════════════════════════════════════════════════════

reknitr.SOLOW_BASELINE_YEAR = 1859;
reknitr.SOLOW_ANALYSIS_YEAR = 2025;

/**
 * Extracts the 4-digit year from an eventDate string.
 *
 * @param {String} eventDate - Date string whose first four characters encode
 *   the year (e.g. "2003-07-12").
 * @return {Number} - The year as an integer.
 */
reknitr.eventDateToYear = function (eventDate) {
    return parseInt(eventDate.slice(0, 4), 10);
};

/**
 * Converts a year to a "time" value relative to the Solow baseline year.
 * Time is measured in years elapsed since reknitr.SOLOW_BASELINE_YEAR.
 *
 * @param {Number} year - Calendar year of the observation.
 * @return {Number} - Elapsed years from baseline.
 */
reknitr.yearToSolowTime = function (year) {
    return year - reknitr.SOLOW_BASELINE_YEAR;
};

/**
 * Computes the Solow Bayes factor B(t) for a cluster of observations that
 * have already been sorted into ascending date order.
 *
 * For n ≥ 2:   B = (n−1) / [(T/t_n)^(n−1) − 1]
 * For n = 1:   B = 1 / ln(T / t_1)
 *
 * where T is the total observation window length (analysis year − baseline
 * year) and t_i is the elapsed time of the i-th sighting from the baseline.
 *
 * @param {Object[]} sortedCluster - Observations sorted by eventDate ascending.
 * @return {Number} - Solow Bayes factor B, or 0 if the formula is
 *   ill-defined (e.g. the last sighting is at time 0).
 */
reknitr.solowBayesFactor = function (sortedCluster) {
    const T = reknitr.SOLOW_ANALYSIS_YEAR - reknitr.SOLOW_BASELINE_YEAR;
    const n = sortedCluster.length;
    const lastYear = reknitr.eventDateToYear(sortedCluster[n - 1].eventDate);
    const t_n = reknitr.yearToSolowTime(lastYear);

    if (t_n <= 0) {
        return 0;
    }

    let B;
    if (n === 1) {
        const lnRatio = Math.log(T / t_n);
        if (lnRatio <= 0) {
            B = 0;
        } else {
            B = 1 / lnRatio;
        }
    } else {
        const ratio = Math.pow(T / t_n, n - 1);
        const denominator = ratio - 1;
        if (denominator <= 0) {
            B = 0;
        } else {
            B = (n - 1) / denominator;
        }
    }

    return B;
};

/**
 * Converts a Solow Bayes factor (odds ratio) to a prior probability of
 * presence using the standard formula PP = B / (1 + B).
 *
 * @param {Number} B - Solow Bayes factor.
 * @return {Number} - Prior probability of presence in the range [0, 1].
 */
reknitr.solowBayesFactorToPP = function (B) {
    return B / (1 + B);
};

/**
 * Given a flat array of observation rows for a single taxon, groups them into
 * radius-based clusters and returns, for each observation, its cluster's prior
 * probability of presence (PP).
 *
 * @param {Object[]} taxonObs - Observation rows, each with decimalLatitude,
 *   decimalLongitude and eventDate.
 * @param {Number} solowRadius - Clustering radius in metres.
 * @return {Map} - A Map from each observation row object to its cluster PP
 *   value (Number in [0, 1]).
 */
reknitr.computeClusterPPs = function (taxonObs, solowRadius) {
    const result = new Map();

    if (taxonObs.length === 0) {
        return result;
    }

    const clusters = reknitr.clusterObsByRadius(taxonObs, solowRadius);

    clusters.forEach(function (cluster) {
        const sorted = cluster.slice().sort(reknitr.obsDateComparator);
        const B = reknitr.solowBayesFactor(sorted);
        const pp = reknitr.solowBayesFactorToPP(B);
        cluster.forEach(function (obs) {
            result.set(obs, pp);
        });
    });

    return result;
};

fluid.registerNamespace("reknitr.solowMapLayer");

// ══════════════════════════════════════════════════════════════════════════════
// GeoJSON feature collection builder
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Builds a GeoJSON FeatureCollection of Point features, one per observation,
 * whose solowPP property encodes the cluster PP for use with the viridis
 * colour stops on a MapLibre "circle" layer.
 *
 * @param {Object[]} taxonObs - Flat array of observation rows.
 * @param {Number} solowRadius - Clustering radius in metres (used for PP
 *   computation only; the rendered pixel radius is computed separately).
 * @return {Object} - A GeoJSON FeatureCollection of Point features.
 */
reknitr.solowMapLayer.buildGeoJSON = function (taxonObs, solowRadius) {
    const ppByObs = reknitr.computeClusterPPs(taxonObs, solowRadius);

    const features = Array.from(ppByObs.entries()).map(([obs, pp]) => ({
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: obs[hortis.pointSymbol]
        },
        properties: {
            solowPP: pp
        }
    }));

    return {
        type: "FeatureCollection",
        features: features
    };
};

// ══════════════════════════════════════════════════════════════════════════════
// MapLibre layer management
// ══════════════════════════════════════════════════════════════════════════════

reknitr.solowMapLayer.SOURCE_ID = "solow-source";
reknitr.solowMapLayer.LAYER_ID  = "solow-layer";

/**
 * Converts a ground distance in metres to an approximate screen radius in
 * pixels at the given map zoom level and latitude, using the standard Web
 * Mercator tile-scale formula.
 *
 * The Web Mercator metres-per-pixel at the equator for a 256-px tile is
 * (2π × R_earth) / (256 × 2^zoom); dividing by cos(lat) corrects for
 * latitude.
 *
 * @param {Number} radiusMetres - Ground radius in metres.
 * @param {Number} zoom - Current map zoom level.
 * @param {Number} lat - Centre latitude in decimal degrees (used for the
 *   Mercator latitude correction).
 * @return {Number} - Equivalent radius in screen pixels.
 */
reknitr.solowMapLayer.metresToPixels = function (radiusMetres, zoom, lat) {
    const earthCircumference = 2 * Math.PI * 6378137;
    const metresPerPixel = earthCircumference * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
    return radiusMetres / metresPerPixel;
};

/**
 * Adds or updates the solow MapLibre source and circle layer to reflect the
 * current taxonObs and solowRadius values.  Called reactively via fluid.effect
 * whenever either signal changes, or when the map finishes loading.
 *
 * @param {Object} that - The reknitr.solowMapLayer component instance.
 * @param {Object[]} taxonObs - Current array of observation rows.
 * @param {Number} solowRadius - Current clustering/drawing radius in metres.
 */
reknitr.solowMapLayer.update = function (that, taxonObs, solowRadius) {
    const map = that.map.map;

    const withCoords = taxonObs.filter(obs => obs[hortis.cellIdSymbol] !== "0|0");

    const geojson = reknitr.solowMapLayer.buildGeoJSON(withCoords, solowRadius);

    const existingSource = map.getSource(reknitr.solowMapLayer.SOURCE_ID);
    if (existingSource) {
        existingSource.setData(geojson);
    } else {
        map.addSource(reknitr.solowMapLayer.SOURCE_ID, {
            type: "geojson",
            data: geojson
        });
    }

    // Compute a representative pixel radius from the centre of the obs bounds,
    // falling back to latitude 49 (BC coast) when there are no observations.
    const centreLat = withCoords.length > 0 ? withCoords[0][hortis.pointSymbol][1] : 49;
    const pixelRadius = reknitr.solowMapLayer.metresToPixels(solowRadius, map.getZoom(), centreLat);

    const existingLayer = map.getLayer(reknitr.solowMapLayer.LAYER_ID);
    if (existingLayer) {
        map.setPaintProperty(reknitr.solowMapLayer.LAYER_ID, "circle-radius", pixelRadius);
    } else {
        map.addLayer({
            id: reknitr.solowMapLayer.LAYER_ID,
            type: "circle",
            source: reknitr.solowMapLayer.SOURCE_ID,
            paint: {
                "circle-radius": pixelRadius,
                "circle-color": {
                    property: "solowPP",
                    stops: hortis.libreMap.viridisStops
                },
                "circle-opacity": 1,
                "circle-stroke-width": 0,
            },
            metadata: {
                sortKey: 110
            }
        });
        that.map.sortLayers();
    }
};

/**
 * Removes the solow source and layer from the map if they exist.  Called on
 * component destruction.
 *
 * @param {Object} that - The reknitr.solowMapLayer component instance.
 */
reknitr.solowMapLayer.cleanup = function (that) {
    const map = that.map.map;
    if (map.getLayer(reknitr.solowMapLayer.LAYER_ID)) {
        map.removeLayer(reknitr.solowMapLayer.LAYER_ID);
    }
    if (map.getSource(reknitr.solowMapLayer.SOURCE_ID)) {
        map.removeSource(reknitr.solowMapLayer.SOURCE_ID);
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// fluid.defaults — component registration
// ══════════════════════════════════════════════════════════════════════════════

fluid.defaults("reknitr.solowMapLayer", {
    gradeNames: "fluid.component",
    members: {
        // Injected by reknitr.vizLoader.withSolow
        solowRadius:  "@expand:signal(500)",
        taxonObsRows: "@expand:signal([])",

        updateEffect: "@expand:fluid.effect(reknitr.solowMapLayer.update, {that}, {that}.taxonObsRows, {that}.solowRadius, {that}.map.mapLoaded)"
    },
    listeners: {
        "onDestroy.cleanup": {
            funcName: "reknitr.solowMapLayer.cleanup",
            args: ["{that}"]
        }
    }
});
