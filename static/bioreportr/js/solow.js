/*
Copyright 2025-2026 Antranig Basman
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

"use strict";

// The extirpation risk analysis of a story page. The observations of a taxon chosen from a table of taxa are clustered into populations, those within a chosen
// radius of each other, and the probability that each population has been extirpated is estimated from the dates of
// its observations by the method of Solow (1993), as shown by a layer of the map.

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

fluid.registerNamespace("bioreportr.solow");
fluid.registerNamespace("bioreportr.solowRadius");
fluid.registerNamespace("bioreportr.solowTaxonInfo");
fluid.registerNamespace("bioreportr.solowMapLayer");

/** Radius **/

// The radii offered by the slider, in metres
bioreportr.solowRadius.SNAP_VALUES = [500, 750, 1000, 2000, 5000, 7500, 10000];

bioreportr.solowRadius.indexToRadius = index => bioreportr.solowRadius.SNAP_VALUES[index];

/**
 * Compute the display of the radius slider.
 * @param {Number} index - The index of the chosen radius
 * @return {Object} Members `value`, the radius as text, `fill`, the width of the track's fill, and `ticks`, the labels of
 * the snap markers
 */
bioreportr.solowRadius.display = function (index) {
    const values = bioreportr.solowRadius.SNAP_VALUES;
    return {
        value: values[index].toLocaleString("en-GB") + " m",
        fill: "width: " + (index / (values.length - 1)) * 100 + "%",
        ticks: values.map(value => ({label: value >= 1000 ? value / 1000 + "k" : String(value)}))
    };
};

bioreportr.solowRadius.input = function (event, that) {
    that.selectedIndex = parseInt(event.target.value, 10);
};

/** Taxon information **/

bioreportr.obsDateComparator = (a, b) => a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0;

/**
 * Find the observations of a taxon, in order of date.
 * @param {Object[]} obsRows - All the observations
 * @param {TaxonRow|null} taxonRow - The taxon, or null if none is chosen
 * @return {Object[]} The taxon's observations
 */
bioreportr.solowObsForTaxon = function (obsRows, taxonRow) {
    return taxonRow ? obsRows.filter(row => row.iNaturalistTaxonId === taxonRow.id).sort(bioreportr.obsDateComparator) : [];
};

/**
 * Load the annotations of records which the project keeps, e.g. those of planted populations - see Saanich's
 * scripts/apply_record_annotations.R. Each row names a record by its occurrenceID, with its `annotation`, whether it is
 * suspended from the calculation of extirpation probability, `excludeFromEP`, and a `note`.
 * @param {String|null} file - The CSV file of annotations, relative to the story page, or null if the project has none
 * @return {Promise<Object<String, Object>>|Object<String, Object>} The annotation of each record, by its occurrenceID
 */
bioreportr.loadRecordAnnotations = function (file) {
    return file ? hortis.csvReader.load(file, {header: true, skipEmptyLines: true}).then(parsed => {
        const togo = {};
        (parsed?.data || []).forEach(row => togo[row.occurrenceID] = {...row, excludeFromEP: /^true$/i.test(row.excludeFromEP)});
        return togo;
    }) : {};
};

/**
 * The records of a taxon which count towards its extirpation probability - all but those suspended by an annotation.
 * @param {Object[]} taxonObsRows - The taxon's records
 * @param {Object<String, Object>} annotations - The annotations of records, by occurrenceID
 * @return {Object[]} The records which count
 */
bioreportr.solowObsForEP = function (taxonObsRows, annotations) {
    return taxonObsRows.filter(row => !annotations?.[row.occurrenceID]?.excludeFromEP);
};

/**
 * Note the records of a taxon suspended from the calculation of its extirpation probability, and why.
 * @param {Object[]} taxonObsRows - The taxon's records
 * @param {Object<String, Object>} annotations - The annotations of records, by occurrenceID
 * @return {String} The markup of the note, or "" if none of its records is suspended
 */
bioreportr.solowAnnotationNote = function (taxonObsRows, annotations) {
    const suspended = taxonObsRows.filter(row => annotations?.[row.occurrenceID]?.excludeFromEP);
    const ids = new Set(suspended.map(row => row.occurrenceID));
    const notes = [...new Set(suspended.map(row => annotations[row.occurrenceID].note).filter(Boolean))];
    return suspended.length ? `<div class="mxcw-solow-annotation-note" title="${hortis.dataTable.encode(notes.join(" "))}">` +
        `${ids.size} ${ids.size === 1 ? "record" : "records"} set aside from EP: ${hortis.dataTable.encode([...new Set(suspended.map(row => annotations[row.occurrenceID].annotation))].join(", "))}</div>` : "";
};

/**
 * Compute the information shown about the chosen taxon.
 * @param {TaxonRow|null} taxon - The taxon, or null if none is chosen
 * @param {Object[]} taxonObsRows - Its observations, in order of date
 * @param {Object<String, Object>} [annotations] - The annotations of records, by occurrenceID, of which any suspending
 * records from the calculation of extirpation probability are noted
 * @return {Object} The information - with member `none` true if no taxon is chosen
 */
bioreportr.solowTaxonInfo.model = function (taxon, taxonObsRows, annotations) {
    return taxon && taxonObsRows.length > 0 ? {
        none: false,
        taxonName: taxon.scientificName + (taxon.commonName ? ` (${taxon.commonName})` : ""),
        dateFirstSeen: bioreportr.eventDay(taxonObsRows[0].eventDate),
        dateLastSeen: bioreportr.eventDay(taxonObsRows[taxonObsRows.length - 1].eventDate),
        numObs: taxonObsRows.length,
        regionalEP: taxon.solow_EP,
        georefNote: bioreportr.georefNote(taxonObsRows) + bioreportr.solowAnnotationNote(taxonObsRows, annotations),
        taxonImage: hortis.renderTaxonImage(taxon.iNaturalistTaxonImage, taxon.id)
    } : {none: true, taxonName: "", dateFirstSeen: "", dateLastSeen: "", numObs: "", regionalEP: "", georefNote: "", taxonImage: ""};
};

/** Clustering and the Solow estimate **/

bioreportr.haversineDistance = function (lat1, lon1, lat2, lon2) {
    const R = 6367445;
    const toRad = deg => deg * Math.PI / 180;
    const sinDLat = Math.sin(toRad(lat2 - lat1) / 2);
    const sinDLon = Math.sin(toRad(lon2 - lon1) / 2);
    const a = sinDLat * sinDLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * The position of an observation, or null if it has none.
 * @param {Object} row - The observation
 * @return {Number[]|null} Its longitude and latitude
 */
bioreportr.obsPoint = function (row) {
    const long = parseFloat(row.decimalLongitude), lat = parseFloat(row.decimalLatitude);
    return bioreportr.hasCoordinates(row) ? [long, lat] : null;
};

/**
 * Determine whether a record has coordinates and so can be mapped.
 * @param {Object} row - The record
 * @return {Boolean} `true` if the record is georeferenced
 */
bioreportr.hasCoordinates = function (row) {
    const lat = parseFloat(row.decimalLatitude), long = parseFloat(row.decimalLongitude);
    return Number.isFinite(lat) && Number.isFinite(long) && lat !== 0 && long !== 0;
};

/**
 * Explain any records of a taxon which lack coordinates, so that what is shown on the map can be read accurately.
 * @param {Object[]} rows - The records of the taxon
 * @return {String} Markup for a note, empty if every record is georeferenced
 */
bioreportr.georefNote = function (rows) {
    const missing = rows.filter(row => !bioreportr.hasCoordinates(row)).length;
    const message = missing === 0 ? "" : missing === rows.length ? "No mapped records: coordinates missing" :
        `${missing} of ${rows.length} records not mapped: coordinates missing`;
    return message && `<div class="mxcw-georef-note">\u26A0 ${message}</div>`;
};

bioreportr.eventDay = eventDate => String(eventDate ?? "").substring(0, 10);

/**
 * Cluster observations into populations - each observation lies within the radius of another of its population.
 * @param {Object[]} points - The observations, each with members `row` and `point`
 * @param {Number} solowRadius - The radius in metres
 * @return {Object[]} The populations, each with a member `obsRows`
 */
bioreportr.clusterObsByRadius = function (points, solowRadius) {
    const n = points.length;
    const parent = fluid.iota(n);
    const find = function (i) {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pi = points[i].point, pj = points[j].point;
            if (bioreportr.haversineDistance(pi[1], pi[0], pj[1], pj[0]) <= solowRadius) {
                parent[find(i)] = find(j);
            }
        }
    }
    const clusters = {};
    points.forEach((point, i) => {
        const root = find(i);
        clusters[root] = clusters[root] || {obsRows: [], points: []};
        clusters[root].obsRows.push(point.row);
        clusters[root].points.push(point);
    });
    return Object.values(clusters);
};

bioreportr.eventDateToYear = eventDate => parseInt(eventDate.slice(0, 4), 10);

/**
 * Compute Solow's Bayes factor for the hypothesis that a population is extirpated, from the dates of its observations.
 * @param {Object[]} sortedCluster - The population's observations, in order of date
 * @param {Object} solowParams - Members `baselineYear`, the start of the period of observation, and `analysisYear`, its end
 * @return {Number} The Bayes factor
 */
bioreportr.solowBayesFactor = function (sortedCluster, solowParams) {
    const T = solowParams.analysisYear - solowParams.baselineYear;
    const n = sortedCluster.length;
    const tn = bioreportr.eventDateToYear(sortedCluster[n - 1].eventDate) - solowParams.baselineYear;
    let B;
    if (tn <= 0) {
        B = 0;
    } else if (n === 1) {
        const lnRatio = Math.log(T / tn);
        B = lnRatio <= 0 ? 0 : 1 / lnRatio;
    } else {
        const denominator = Math.pow(T / tn, n - 1) - 1;
        B = denominator <= 0 ? Number.POSITIVE_INFINITY : (n - 1) / denominator;
    }
    return B;
};

bioreportr.solowBayesFactorToPP = B => B === Number.POSITIVE_INFINITY ? 1 : B / (1 + B);

/**
 * Cluster the observations of a taxon and estimate the probability that each population persists.
 * @param {Object[]} taxonObsRows - The taxon's observations
 * @param {Number} solowRadius - The radius of a population in metres
 * @param {Object} solowParams - The period of observation, as for `bioreportr.solowBayesFactor`
 * @return {Object[]} The populations, each with members `id`, `obsRows`, `points` and `pp`, the posterior probability
 * that it persists
 */
bioreportr.solow.clusters = function (taxonObsRows, solowRadius, solowParams) {
    const points = taxonObsRows.map(row => ({row, point: bioreportr.obsPoint(row)})).filter(point => point.point);
    return bioreportr.clusterObsByRadius(points, solowRadius).map((cluster, id) => {
        const order = cluster.points.map((point, i) => i).sort((a, b) => bioreportr.obsDateComparator(cluster.obsRows[a], cluster.obsRows[b]));
        const obsRows = order.map(i => cluster.obsRows[i]);
        return {id, obsRows, points: order.map(i => cluster.points[i]), pp: bioreportr.solowBayesFactorToPP(bioreportr.solowBayesFactor(obsRows, solowParams))};
    });
};

/** The map layer **/

bioreportr.solowMapLayer.SOURCE_ID = "solow-source";
bioreportr.solowMapLayer.LAYER_ID = "solow-layer";

bioreportr.solowMapLayer.geoJSON = function (clusters) {
    return {
        type: "FeatureCollection",
        // One circle for each distinct place in a population, within about 10m - many records share a place, and their
        // circles, drawn one over another, would add up to a solid fill hiding the land beneath
        features: clusters.flatMap(cluster => {
            const places = new Map(cluster.points.map(point => [point.point.map(coord => (+coord).toFixed(4)).join(","), point.point]));
            return [...places.values()].map(coordinates => ({
                type: "Feature",
                geometry: {type: "Point", coordinates},
                properties: {solowEP: 1 - cluster.pp, clusterId: cluster.id}
            }));
        })
    };
};

bioreportr.solowMapLayer.metresToPixels = function (radiusMetres, zoom, lat) {
    const metresPerPixel = 2 * Math.PI * 6378137 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
    return radiusMetres / metresPerPixel;
};

/**
 * Show the populations of the chosen taxon on the map, as circles of the radius of a population coloured by their
 * probability of extirpation.
 * @param {maplibregl.Map} map - The map, once its style has applied
 * @param {Object[]} clusters - The populations, as computed by `bioreportr.solow.clusters`
 * @param {Number} solowRadius - The radius of a population in metres
 * @param {Boolean} visible - Whether the layer is shown
 * @param {Number} zoom - The map's zoom level
 * @param {Function} sortLayers - The map component's method sorting its layers
 */
// The fill of the populations lets the land beneath show through, while a solid outline of the same colour keeps each legible
bioreportr.solowMapLayer.fillOpacity = 0.55;
bioreportr.solowMapLayer.outlineWidth = 1.5;

bioreportr.solowMapLayer.update = function (map, clusters, solowRadius, visible, zoom, sortLayers) {
    const geoJSON = bioreportr.solowMapLayer.geoJSON(clusters);
    const source = map.getSource(bioreportr.solowMapLayer.SOURCE_ID);
    if (source) {
        source.setData(geoJSON);
    } else {
        map.addSource(bioreportr.solowMapLayer.SOURCE_ID, {type: "geojson", data: geoJSON});
    }
    const lat = geoJSON.features[0]?.geometry.coordinates[1] ?? 49;
    const radius = bioreportr.solowMapLayer.metresToPixels(solowRadius, zoom, lat);
    const opacity = visible ? bioreportr.solowMapLayer.fillOpacity : 0;
    const outlineOpacity = visible ? 1 : 0;
    if (map.getLayer(bioreportr.solowMapLayer.LAYER_ID)) {
        map.setPaintProperty(bioreportr.solowMapLayer.LAYER_ID, "circle-radius", radius);
        map.setPaintProperty(bioreportr.solowMapLayer.LAYER_ID, "circle-opacity", opacity);
        map.setPaintProperty(bioreportr.solowMapLayer.LAYER_ID, "circle-stroke-opacity", outlineOpacity);
    } else {
        map.addLayer({
            id: bioreportr.solowMapLayer.LAYER_ID,
            type: "circle",
            source: bioreportr.solowMapLayer.SOURCE_ID,
            paint: {
                "circle-radius": radius,
                "circle-color": {property: "solowEP", stops: hortis.libreMap.viridisStops},
                "circle-opacity": opacity,
                "circle-stroke-width": bioreportr.solowMapLayer.outlineWidth,
                "circle-stroke-color": {property: "solowEP", stops: hortis.libreMap.viridisStops},
                "circle-stroke-opacity": outlineOpacity
            },
            metadata: {sortKey: 110}
        });
        sortLayers(map);
    }
};

/**
 * Render the legend of the probability of extirpation.
 * @param {Array[]} fillStops - The colour stops
 * @param {Number} legendStops - The number of rows of the legend
 * @return {String} The legend's markup
 */
bioreportr.solowMapLayer.legendMarkup = function (fillStops, legendStops) {
    const memoStops = fluid.colour.memoStops(fillStops, 256);
    const props = fluid.iota(legendStops + 1).map(stop => stop / legendStops);
    const rows = fluid.iota(legendStops).map(stop => hortis.stringTemplate(hortis.libreMap.legendRowTemplate, {
        previewStyle: "background-color: " + fluid.colour.lookupStop(memoStops, (props[stop] + props[stop + 1]) / 2),
        keyLabel: props[stop] + " - " + props[stop + 1],
        rowTitle: "Populations whose probability of extirpation lies between " + props[stop] + " and " + props[stop + 1]
    }));
    return "<div class=\"imerss-legend-title\">Extirpation probability</div>" + rows.join("\n");
};

bioreportr.solowMapLayer.addLegend = function (map, legendPosition, dokkument) {
    const control = hortis.libreMap.addLegend(map, legendPosition, dokkument);
    control.container.classList.add("mxcw-solow-legend");
    return control;
};

/**
 * The colour of a probability of extirpation on the map's scale, that of the stop at or beneath it.
 * @param {Number} ep - The probability
 * @return {String} The colour
 */
bioreportr.solowMapLayer.epColour = function (ep) {
    const stops = hortis.libreMap.viridisStops;
    return (stops.filter(([value]) => value <= ep).pop() || stops[0])[1];
};

/**
 * Render the tooltip of a population - its probability of extirpation, and the figures from which Solow's (1993)
 * method computes it: how many sightings the population holds, the year of the last, and the period of observation.
 * @param {Object[]} clusters - The populations of the chosen taxon
 * @param {String} clusterId - The id of the population hovered over
 * @param {Object} solowParams - The period of observation, with members `baselineYear` and `analysisYear`
 * @return {String|null} The tooltip's markup, or null if there is no such population
 */
bioreportr.solowMapLayer.renderTooltip = function (clusters, clusterId, solowParams) {
    const cluster = clusters[clusterId];
    let togo = null;
    if (cluster) {
        const ep = 1 - cluster.pp;
        const last = bioreportr.eventDateToYear(fluid.peek(cluster.obsRows).eventDate);
        const since = solowParams.analysisYear - last;
        togo = `<div class="mxcw-cell-tip mxcw-population-tip">
            <div class="mxcw-tip-title">Population ${+clusterId + 1} <span>of ${clusters.length}</span></div>
            <div class="mxcw-population-ep"><span class="mxcw-population-swatch" style="background:${bioreportr.solowMapLayer.epColour(ep)}"></span>
                Extirpation probability <b>${ep.toFixed(2)}</b></div>
            <dl class="mxcw-population-stats">
                <dt>Sightings</dt> <dd>${cluster.obsRows.length.toLocaleString()}</dd>
                <dt>Last sighting</dt> <dd>${last} <span>(${since === 0 ? "this year" : since + (since === 1 ? " year ago" : " years ago")})</span></dd>
                <dt>Observation period</dt> <dd>${solowParams.baselineYear}–${solowParams.analysisYear}</dd>
            </dl>
        </div>`;
    }
    return togo;
};

// How far in pixels around the pointer a population is looked for, so that its tooltip shows without the pointer having
// to land exactly within a small circle
bioreportr.solowMapLayer.hoverTolerance = 6;

/**
 * Find the population under or near the pointer.
 * @param {maplibregl.Map} map - The map
 * @param {Object} point - The pointer's position on the map, as {x, y}
 * @return {Number|null} The id of the population, or null if there is none near
 */
bioreportr.solowMapLayer.clusterAt = function (map, point) {
    const tolerance = bioreportr.solowMapLayer.hoverTolerance;
    const features = map.getLayer(bioreportr.solowMapLayer.LAYER_ID) ? map.queryRenderedFeatures(
        [[point.x - tolerance, point.y - tolerance], [point.x + tolerance, point.y + tolerance]],
        {layers: [bioreportr.solowMapLayer.LAYER_ID]}) : [];
    return features[0]?.properties.clusterId ?? null;
};

/**
 * Report the population under the pointer to the layer's tooltip.
 * @param {bioreportr.solowMapLayer} that - The layer
 * @param {maplibregl.Map} map - The map
 * @return {Object} A record of the listeners, to be supplied to `hortis.libreMap.gridSelector.unbindHover`
 */
bioreportr.solowMapLayer.bindHover = function (that, map) {
    // Shown as the map's own popup, beside the population, rather than through the page's tooltips, so that it follows
    // the map wherever it is laid out
    const popup = new maplibregl.Popup({closeButton: false, closeOnClick: false, maxWidth: "none", offset: 14,
        className: "mxcw-population-popup"});
    let shown = null;
    const leave = () => {
        shown = null;
        popup.remove();
        map.getCanvas().style.cursor = "";
    };
    const listener = e => {
        const clusterId = that.visible ? bioreportr.solowMapLayer.clusterAt(map, e.point) : null;
        if (hortis.isValue(clusterId)) {
            // As text, since the first population's id, 0, would otherwise read as no population at all
            const id = String(clusterId);
            if (id !== shown) {
                shown = id;
                popup.setHTML(that.renderTooltip(id) || "");
            }
            popup.setLngLat(e.lngLat).addTo(map);
            map.getCanvas().style.cursor = "pointer";
        } else if (shown !== null) {
            leave();
        }
    };
    map.on("mousemove", listener);
    map.on("mouseout", leave);
    return {map, listener, leave};
};

// The listeners of the populations' tooltips, by map, so that each map is given them once only
bioreportr.solowMapLayer.hoverBound = new WeakMap();

/**
 * Give the map the listeners showing the tooltips of the populations, if it does not have them already.
 * @param {bioreportr.solowMapLayer} that - The layer
 * @param {maplibregl.Map} map - The map, once it is ready
 */
bioreportr.solowMapLayer.ensureHover = function (that, map) {
    if (!bioreportr.solowMapLayer.hoverBound.has(map)) {
        bioreportr.solowMapLayer.hoverBound.set(map, bioreportr.solowMapLayer.bindHover(that, map));
    }
};

bioreportr.summaryTaxaRows = rows => rows.filter(row => row.inSummary);

/** Filter of taxa by their range of extirpation probability **/

fluid.registerNamespace("bioreportr.epFilter");

/**
 * Filter taxa to those whose extirpation probability lies within a range.
 * @param {TaxonRow[]} rows - The taxa
 * @param {Object} state - The range, with members `min` and `max` between 0 and 1
 * @return {TaxonRow[]} The taxa surviving the filter
 */
bioreportr.epFilter.doFilter = function (rows, state) {
    return state.min <= 0 && state.max >= 1 ? rows : rows.filter(row => +row.solow_EP >= state.min && +row.solow_EP <= state.max);
};

/**
 * Respond to the movement of one of the filter's sliders, whose positions are percentages. The slider being moved
 * pushes the other along rather than crossing it.
 * @param {Event} event - The input event
 * @param {bioreportr.epFilter} that - The filter
 */
bioreportr.epFilter.input = function (event, that) {
    const value = +event.target.value / 100;
    const isMin = event.target.classList.contains("mxcw-ep-min");
    const {min, max} = that.filterState;
    if (isMin) {
        that.filterState = {min: value, max: Math.max(max, value)};
    } else {
        that.filterState = {min: Math.min(min, value), max: value};
    }
};

bioreportr.epFilter.summarise = function (state) {
    const active = state.min > 0 || state.max < 1;
    return {count: active ? 1 : 0, title: active ? `EP between ${state.min.toFixed(2)} and ${state.max.toFixed(2)}` : ""};
};

bioreportr.epFilter.display = function (state) {
    return {min: Math.round(state.min * 100), max: Math.round(state.max * 100), minText: state.min.toFixed(2), maxText: state.max.toFixed(2)};
};

bioreportr.epFilter.reset = function (that) {
    that.filterState = {min: 0, max: 1};
};

// The layer of the story's map showing the populations of the taxon chosen for the extirpation risk analysis, with a
// legend and a tooltip for each population. It is shown only whilst the active pane shows the analysis
fluid.def("bioreportr.solowMapLayer", {
    $layers: "hortis.withTooltip",
    // clusters: Object[], solowRadius: Number, visible: Boolean - supplied by the story page
    legendStops: 10,
    legendPosition: "top-right",
    fillStops: "{storyPage}.map.fillStops",
    update: `$effect:bioreportr.solowMapLayer.update({storyPage}.map.readyMap, {self}.clusters, {self}.solowRadius, {self}.visible,
        {storyPage}.map.zoom, {storyPage}.map.sortLayers)`,
    legendMarkup: "$compute:bioreportr.solowMapLayer.legendMarkup({self}.fillStops, {self}.legendStops)",
    legend: {
        $bindable: {
            bind: "bioreportr.solowMapLayer.addLegend({storyPage}.map.readyMap, {self}.legendPosition, {global}.document)",
            unbind: "hortis.libreMap.removeLegend({storyPage}.map.readyMap, {boundValue})",
            onceOnly: true
        }
    },
    renderLegend: "$effect:hortis.libreMap.renderLegend({self}.legend, {self}.legendMarkup, {self}.visible)",
    renderTooltip: "$method:bioreportr.solowMapLayer.renderTooltip({self}.clusters, {0}:clusterId, {storyPage}.solowParams)",
    // Attached by an effect, as the circles are drawn, once the map is ready - see bioreportr.solowMapLayer.ensureHover
    hover: "$effect:bioreportr.solowMapLayer.ensureHover({self}, {storyPage}.map.readyMap)"
});
