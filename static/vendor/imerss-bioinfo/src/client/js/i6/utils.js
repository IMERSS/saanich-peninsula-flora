/*
Copyright 2017-2026 Antranig Basman
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

/* global Papa */

"use strict";

// Utilities shared by the IMERSS visualisations ported to Infusion 6 which know nothing of taxa or observations -
// formatting, downloads, DOM listeners and the drawing of simple charts as SVG markup

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");

/** General utilities **/

/**
 * Determine whether a value is neither `null` nor `undefined`.
 * @param {any} value - The value to be tested
 * @return {Boolean} `true` if the value is neither `null` nor `undefined`
 */
hortis.isValue = function (value) {
    return value !== null && value !== undefined;
};

hortis.negate = value => !value;

// Helpful answer: https://stackoverflow.com/a/35759874
hortis.parseFloat = function (str) {
    return isNaN(str) ? NaN : parseFloat(str);
};

/**
 * Interpolate the terms of a template written with %term placeholders, as for Infusion 4's fluid.stringTemplate.
 * Longer terms are substituted first, so that a term which is a prefix of another does not disturb it.
 * @param {String} template - The template
 * @param {Object<String, any>} terms - The terms to be interpolated
 * @return {String} The interpolated template
 */
hortis.stringTemplate = function (template, terms) {
    const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
    return keys.reduce((acc, key) => acc.split("%" + key).join(terms[key]), template);
};

/**
 * Render an integer with thousands separators.
 * @param {Number} value - The integer to be rendered
 * @return {String} The value grouped in threes, e.g. "3,000"
 */
hortis.formatInt = function (value) {
    return Math.round(value).toLocaleString("en-US");
};

/**
 * Pluralise a noun according to a count.
 * @param {Number} count - The count
 * @param {String} noun - The singular form of the noun
 * @param {String} [nouns] - The plural form of the noun, defaulting to the singular with "s" appended
 * @return {String} The count followed by the appropriate form of the noun
 */
hortis.plural = function (count, noun, nouns = noun + "s") {
    return hortis.formatInt(count) + " " + (count === 1 ? noun : nouns);
};

hortis.capitalize = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

hortis.encodeHTML = function (str) {
    return str.replace(/[&<>'"]/g, function (tag) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            "\"": "&quot;"
        }[tag];
    });
};

// Approach taken from https://stackoverflow.com/a/64908345/1381443
hortis.triggerDownload = function (content, mimeType, filename) {
    const a = document.createElement("a");
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    a.setAttribute("href", url);
    a.setAttribute("download", filename);
    a.click(); // Start downloading
};

/** DOM listeners **/

/**
 * A listener to be bound to an element, optionally delegated to its descendants matching a selector.
 * @typedef {Object} DomListenerSpec
 * @property {String} event - The name of the DOM event
 * @property {String} [selector] - If present, the listener is notified only of events whose target lies within a
 * descendant matching the selector, which is supplied to it as `this` and as its second argument
 * @property {Function} listener - The listener, accepting the event and the matched element
 */

/**
 * Bind a set of listeners to an element whose markup is supplied by the page or owned by a widget, for use as the
 * `bind` of a `$bindable` whose `unbind` is `hortis.unbindDomListeners` - this takes the place of Infusion 4's
 * delegated jQuery handlers bound at onCreate, which were never unbound.
 * @param {Element} element - The element to which the listeners are to be bound
 * @param {DomListenerSpec[]} specs - The listeners to be bound
 * @return {Object} A record of the bound listeners to be supplied to `hortis.unbindDomListeners`
 */
hortis.bindDomListeners = function (element, specs) {
    const bound = specs.map(spec => {
        const raw = function (event) {
            if (spec.selector) {
                const matched = event.target.closest?.(spec.selector);
                if (matched && element.contains(matched)) {
                    spec.listener.call(matched, event, matched);
                }
            } else {
                spec.listener.call(element, event, element);
            }
        };
        element.addEventListener(spec.event, raw);
        return {event: spec.event, raw};
    });
    return {element, bound};
};

hortis.unbindDomListeners = function (record) {
    record.bound.forEach(({event, raw}) => record.element.removeEventListener(event, raw));
};

/**
 * Track the content width of an element in a cell, for use as the `bind` of a `$bindable` whose `unbind` is
 * `hortis.unobserveWidth`.
 * @param {Element} node - The element to be observed
 * @param {Object} global - The global object, which may supply ResizeObserver - this is passed whole since a reference
 * {global}.ResizeObserver to a missing global would be unavailable
 * @param {Number} [initial] - The width to be held until the element is first laid out - if absent, the cell is
 * pending until then
 * @return {Cell<Number>} The content width of the element, updated whenever it is laid out with nonzero width - or, if
 * there is no ResizeObserver, its width at the time of binding
 */
hortis.widthCell = function (node, global, initial) {
    const togo = fluid.cell(initial ?? fluid.unavailable({message: "Element not yet laid out", variety: "pending"}), {name: "Element width"});
    if (global.ResizeObserver) {
        togo.observer = new global.ResizeObserver(entries => {
            entries.forEach(entry => {
                if (entry.contentRect.width > 0) {
                    togo.set(entry.contentRect.width);
                }
            });
        });
        togo.observer.observe(node);
    } else {
        togo.set(node.clientWidth || 0);
    }
    return togo;
};

hortis.unobserveWidth = function (widthCell) {
    widthCell.observer?.disconnect();
};

/**
 * Toggles a CSS class on a DOM element based on a boolean value.
 * @param {HTMLElement} container - The DOM element to modify.
 * @param {String} clazz - The CSS class to add or remove.
 * @param {Boolean} value - If true, the class will be added; if false, it will be removed.
 * @param {Boolean} [inverse] - If true, inverts the logic (adds the class when value is false).
 */
hortis.toggleClass = function (container, clazz, value, inverse) {
    container.classList.toggle(clazz, !!(!!value ^ !!inverse));
};

/**
 * Trigger the download of a table as a CSV file.
 * @param {String[]} headers - The column headers
 * @param {Array[]} rows - The rows of the table, each an array of cell values
 * @param {String} filename - The name of the file to be downloaded
 */
hortis.downloadCSV = function (headers, rows, filename) {
    const content = Papa.unparse({fields: headers, data: rows});
    hortis.triggerDownload(content, "text/csv", filename);
};

/** Images and SVG **/

hortis.loadImage = async url => {
    const $img = document.createElement("img");
    $img.src = url;
    return new Promise((resolve) => {
        $img.onload = () => resolve($img);
        $img.onerror = e => {
            console.log("Got error ", e);
        };
        $img.src = url;
    });
};

hortis.getCanvasBlob = async (svgURL, { format, quality, scale }) => {
    const img = await hortis.loadImage(svgURL);

    const $canvas = document.createElement("canvas");
    $canvas.width = img.naturalWidth * scale;
    $canvas.height = img.naturalHeight * scale;
    $canvas.getContext("2d").drawImage(img, 0, 0, img.naturalWidth * scale, img.naturalHeight * scale);

    const blob = await new Promise(resolve => $canvas.toBlob(resolve, `image/${format}`, quality));
    return blob;
};

// Presentational properties copied from the page's stylesheet onto each element of an SVG exported as a standalone file
hortis.svgInlinedProperties = ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight"];

/**
 * Copy the computed values of the presentational properties of each element of a rendered SVG onto the
 * corresponding element of its clone, so that the clone renders identically without the page's stylesheet.
 * @param {SVGElement} source - The SVG element as rendered in the page
 * @param {SVGElement} clone - A deep clone of `source`, which will be modified
 */
hortis.inlineSVGStyles = function (source, clone) {
    const sources = [source, ...source.querySelectorAll("*")];
    const clones = [clone, ...clone.querySelectorAll("*")];
    sources.forEach((node, i) => {
        const computed = getComputedStyle(node);
        clones[i].setAttribute("style", hortis.svgInlinedProperties.map(prop => `${prop}: ${computed.getPropertyValue(prop)}`).join("; "));
    });
};

/** Reducers **/

hortis.maxReducer = function () {
    const togo = {
        value: Number.NEGATIVE_INFINITY,
        reduce: next => {togo.value = Math.max(next, togo.value);}
    };
    return togo;
};

hortis.minReducer = function () {
    const togo = {
        value: Number.POSITIVE_INFINITY,
        reduce: next => {togo.value = Math.min(next, togo.value);}
    };
    return togo;
};

hortis.querySelectorIn = (container, selector) => container.querySelector(selector) || fluid.unavailable({message: "No element for " + selector, variety: "config"});

/** Bar charts drawn as SVG markup **/

/**
 * Choose a round step and upper bound for a count axis with about four intervals.
 * @param {Number} max - The largest value to be plotted
 * @return {Object} Members `step`, a whole number, and `top`, the smallest multiple of `step` at least `max`
 */
hortis.niceScale = function (max) {
    const bounded = Math.max(max, 1);
    const raw = bounded / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normal = raw / magnitude;
    const nice = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
    const step = Math.max(1, nice * magnitude);
    return {step, top: step * Math.ceil(bounded / step)};
};

/**
 * Truncate a label to a maximum length, marking the truncation with an ellipsis.
 * @param {String} label - The label
 * @param {Number} maxLength - The maximum length of the returned label
 * @return {String} The possibly truncated label
 */
hortis.truncateLabel = function (label, maxLength) {
    return label.length > maxLength ? label.substring(0, maxLength - 1) + "…" : label;
};

/**
 * Render a vertical bar chart of counts, one bar per row, as SVG markup.
 * @param {Object[]} rows - Records each with members `label` and `count`, in display order
 * @param {Object} opts - Chart options:
 *     width, height: Number - dimensions in pixels
 *     foot: Number - height in pixels reserved below the plot for bar labels and the x axis label
 *     angle: Number - rotation of bar labels in degrees
 *     title, titleTip: String - the chart heading and its tooltip
 *     xLabel, xTip, yLabel, yTip: String - the axis labels and their tooltips
 *     colourOf: Function - maps a row to its bar colour
 *     rowTip: Function - maps a row to the tooltip for its bar
 * @return {String} The chart's SVG markup
 */
hortis.barChartMarkup = function (rows, opts) {
    const enc = hortis.encodeHTML;
    const left = 58, right = opts.width - 10, top = 34;
    const base = opts.height - opts.foot;
    const {step, top: scaleTop} = hortis.niceScale(rows.reduce((max, row) => Math.max(max, row.count), 0));
    const band = (right - left) / Math.max(rows.length, 1);
    const barWidth = Math.min(30, band * 0.7);
    const yOf = value => base - value / scaleTop * (base - top);
    const parts = [];
    parts.push(`<text x="${left}" y="18" class="imerss-chart-title">${enc(opts.title)}<title>${enc(opts.titleTip)}</title></text>`);
    for (let value = 0; value <= scaleTop; value += step) {
        const y = yOf(value);
        parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="imerss-chart-grid"/>`);
        parts.push(`<text x="${left - 7}" y="${y + 4}" text-anchor="end" class="imerss-chart-tick">${hortis.formatInt(value)}<title>${enc(hortis.formatInt(value) + " " + opts.yLabel.toLowerCase())}</title></text>`);
    }
    rows.forEach((row, i) => {
        const height = base - yOf(row.count);
        const x = left + band * i + (band - barWidth) / 2;
        const tip = enc(opts.rowTip(row));
        parts.push(`<rect x="${x}" y="${base - height}" width="${barWidth}" height="${height}" fill="${opts.colourOf(row)}" class="imerss-chart-bar"><title>${tip}</title></rect>`);
        parts.push(`<text x="0" y="0" text-anchor="end" class="imerss-chart-label" transform="translate(${x + barWidth / 2 + 3} ${base + 9}) rotate(${opts.angle})">` +
            `${enc(hortis.truncateLabel(row.label, 30))}<title>${tip}</title></text>`);
    });
    parts.push(`<line x1="${left}" y1="${base}" x2="${right}" y2="${base}" class="imerss-chart-axis-line"/>`);
    parts.push(`<text x="0" y="0" text-anchor="middle" class="imerss-chart-axis" transform="translate(16 ${(top + base) / 2}) rotate(-90)">${enc(opts.yLabel)}<title>${enc(opts.yTip)}</title></text>`);
    parts.push(`<text x="${(left + right) / 2}" y="${opts.height - 6}" text-anchor="middle" class="imerss-chart-axis">${enc(opts.xLabel)}<title>${enc(opts.xTip)}</title></text>`);
    return `<svg class="imerss-chart" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" role="img" aria-label="${enc(opts.title)}">${parts.join("")}</svg>`;
};
