<script src="../../bioreportr/js/story.js"></script>
<script src="../js/saanich.js"></script>
<script>
"use strict";

/* global maplibregl */

// The opening pane of the Saanich story, In Memory of Plants - its section, knitted from content/story/Traces.Rmd, and
// the timeline of plants' key moments which plays across the map beside it. The timeline is configured onto the
// story page by saanich-story.vue as its member traces

// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var saanich = fluid.registerNamespace("saanich");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var hortis = fluid.registerNamespace("hortis");
// noinspection ES6ConvertVarToLetConst // otherwise this is a duplicate on minifying
var bioreportr = fluid.registerNamespace("bioreportr");

// The timeline of the opening pane: its key moments appear across the map as it plays
fluid.def("saanich.traces", {
    $layers: "fluid.component",
    paused: false,
    scrubbing: false,
    active: "$compute:bioreportr.storyPage.isActive({storyPage}.activePaneKey, Traces)",
    events: "$compute:saanich.traces.buildEvents({storyPage}.taxa.allRows, {storyPage}.byTaxon)",
    control: "$effect:saanich.traces.control({self}, {storyPage}, {storyPage}.map.readyMap, {self}.events, {self}.active, {storyPage}.loaded, {global})",
    showPlayback: "$effect:saanich.traces.showPlayback({self}, {self}.paused)"
});

// The pane's section, rendered from the template below
fluid.def("saanich.tracesPane", {
    $layers: "fluid.component"
});

/** The opening timeline, in memory of plants **/

// The opening pane of the story: plants' key moments appear across the landscape as a timeline plays, starting from a
// random year on each visit. Everything is derived from the site's data whenever it loads
fluid.registerNamespace("saanich.traces");

// The map is a dim blue, so orange, its complement, is kept for the plants last seen alone: the others stay cool or neutral.
// Marker icons, recoloured. From https://game-icons.net, CC BY 3.0: Newly noticed, "Dandelion flower" by Delapouite; First noted, "Acorn"
// and Last seen, "Leaf skeleton", by Lorc. Seen again: "Plant" from Phosphor Icons, MIT licence, Copyright (c) 2023 Phosphor Icons.
saanich.traces.kinds = {
    first: {
        label: "First noted",
        significance: "The earliest record of this plant in the atlas.",
        icon: `<path transform="scale(0.046875)" fill="#c3ccd6" d="M422.625 18.28c-24.68.13-51.932 15.455-74.094 36.907 1.868 1.036 3.742 2.07 5.626 3.157 8.05 4.642 15.615 9.363 22.72 14.125 25.19-9.583 55.47-14.465 103.437-2.97-12.036-37.07-33.633-51.345-57.688-51.22zM237.78 40.22l28.97 94.25c12.57 6.443 24.827 13.41 36.813 20.843l-36.625-111.97c-8.476-1.68-16.657-2.662-24.563-3-1.54-.065-3.074-.108-4.594-.124zm-19.218 1.124c-1.602.206-3.202.427-4.78.687-8.815 1.454-17.338 3.755-25.595 6.876l15.688 58.625c13.62 4.75 26.922 10.064 39.906 15.907l-25.218-82.093zm69.875 7.593l40.157 122.876c15.922 11.124 31.32 23.128 46.25 35.906L325.906 64.374c-13.092-6.527-25.568-11.643-37.47-15.438zm-117.5 7.844c-14.657 7.857-28.523 18.348-41.875 31.095 18.42 3.334 36.298 7.632 53.657 12.813L170.937 56.78zm179.25 20.907l53.282 155.97c10.798 10.382 21.322 21.187 31.624 32.374.395-1.174.75-2.332 1.125-3.5L379.843 97.407c-8.84-6.63-18.706-13.185-29.656-19.72zM136.595 108.25c-17.05 11.436-32.43 27.876-45.344 50.22-42.303 73.19-61.83 198.325-24.53 265.717l-.064-.062c.752 23.392-7.597 45.63-17.812 67.594 27.268-12.192 54.897-17.815 82.687-20.783l-.468-.343c87.895 19.01 212.87-49.42 260.688-132.156 13.547-23.44 20.606-46.14 22.28-67.72-77.218-81.572-166.868-139.912-277.436-162.468zm271.469 14L444.188 228c2.638-20.573.96-39.855-5.688-58.25-5.856-16.202-15.717-32.01-30.438-47.5z"/>`
    },
    found: {
        label: "Seen again",
        significance: "The first record since 2000 of a plant known from earlier reports.",
        icon: `<path transform="scale(0.09375)" fill="#35c2a0" d="M247.63,47.89a8,8,0,0,0-7.52-7.52c-51.76-3-93.32,12.74-111.18,42.22-11.8,19.49-11.78,43.16-.16,65.74a71.34,71.34,0,0,0-14.17,27L98.33,159c7.82-16.33,7.52-33.35-1-47.49-13.2-21.79-43.67-33.47-81.5-31.25a8,8,0,0,0-7.52,7.52c-2.23,37.83,9.46,68.3,31.25,81.5A45.82,45.82,0,0,0,63.44,176,54.58,54.58,0,0,0,87,170.33l25,25V224a8,8,0,0,0,16,0V194.51a55.61,55.61,0,0,1,12.27-35,73.91,73.91,0,0,0,33.31,8.4,60.9,60.9,0,0,0,31.83-8.86C234.89,141.21,250.67,99.65,247.63,47.89ZM47.81,155.6C32.47,146.31,23.79,124.32,24,96c28.32-.24,50.31,8.47,59.6,23.81,4.85,8,5.64,17.33,2.46,26.94L61.65,122.34a8,8,0,0,0-11.31,11.31l24.41,24.41C65.14,161.24,55.82,160.45,47.81,155.6Zm149.31-10.22c-13.4,8.11-29.15,8.73-45.15,2l53.69-53.7a8,8,0,0,0-11.31-11.31L140.65,136c-6.76-16-6.15-31.76,2-45.15,13.94-23,47-35.82,89.33-34.83C232.94,98.34,220.14,131.44,197.12,145.38Z"/>`
    },
    last: {
        label: "Last seen",
        significance: "The last known record in this atlas. Is it still out there?",
        icon: `<path transform="scale(0.046875)" fill="#ff9f1c" d="M53.688 23.97c-37.59 15.43-40.433 37.366-28.032 62.5 25.773 4.386 51.188 11.535 76.156 21.343-10.142 21.927-18.285 44.526-25.28 67.468l-.97.064c.047.89.103 1.77.157 2.656-7.916 26.324-14.373 53.068-20.595 79.75L73.313 262c2.89-12.39 5.822-24.726 8.906-36.97 4.453 20.118 10.942 39.045 19.218 56.75-3.136 18.215-6.048 36.444-8.907 54.626l18.47 2.906c1.612-10.254 3.212-20.5 4.875-30.718 6.42 10.422 13.55 20.324 21.28 29.72-3.45 16.922-6.79 33.822-10.06 50.717l18.343 3.564c2.385-12.32 4.784-24.632 7.25-36.938 8.928 9.16 18.487 17.74 28.656 25.72-2.143 11.517-4.194 23.033-6.156 34.562l18.437 3.125c1.445-8.49 2.933-16.973 4.47-25.438 10.66 7.275 21.856 13.95 33.53 20.063-1.88 9.805-3.7 19.61-5.5 29.406l18.375 3.375c1.486-8.085 2.995-16.175 4.53-24.25 10.957 5.008 22.293 9.574 33.94 13.624-1.088 6.006-2.166 12.02-3.283 18l18.375 3.437c.978-5.233 1.925-10.463 2.875-15.686 10.815 3.22 21.88 6.072 33.157 8.5-.696 7.412-1.243 14.862-1.594 22.375l18.656.874c.308-6.588.787-13.157 1.375-19.688 9.484 1.65 19.08 3.05 28.814 4.156-.223 7.96-.224 15.95-.03 23.938l18.686-.438c-.176-7.31-.186-14.563 0-21.75 8.232.635 16.537 1.09 24.906 1.344 2.173 8.67 3.923 17.34 5.25 26l18.47-2.812c-1.57-10.244-3.702-20.484-6.376-30.72 5.348-11.266 10.022-22.69 13.938-34.218 5.188 5.993 9.63 12.537 13.093 19.53l16.75-8.28c-5.953-12.024-14.062-22.73-23.624-31.937 3.078-11.772 5.374-23.624 6.906-35.47 4.16 2.397 8.272 4.996 12.344 7.844l10.688-15.313c-6.972-4.874-14.058-9.078-21.188-12.78.713-13.41.407-26.78-.97-40.03 5.702 1.882 11.422 3.97 17.19 6.217l6.812-17.406c-9.05-3.527-18.038-6.593-27-9.28-2.54-13.382-6.2-26.6-11.032-39.53 4.745.416 9.502.888 14.25 1.436l2.125-18.562c-8.202-.948-16.415-1.716-24.624-2.28-1.745-3.662-3.585-7.304-5.53-10.908-3.654-6.767-7.676-13.404-12.032-19.937 10.805-.828 21.594-1.27 32.375-1.282V172.5c-15.084.016-30.15.835-45.19 2.344-7.082-8.91-14.882-17.548-23.405-25.875 13.413-1.578 26.972-2.55 40.72-2.75l-.283-18.69c-20.013.295-39.536 2.135-58.687 5.032-9.338-7.75-19.393-15.185-30.156-22.25 12.464-1.9 25.048-3.158 37.81-3.593l-.624-18.657c-21.006.717-41.422 3.476-61.406 7.624-8.818-4.88-18.055-9.504-27.688-13.937 11.513-2.03 23.036-3.72 34.563-5.094l-2.22-18.562c-21.036 2.504-42.11 6.034-63.186 10.78-12.616-4.747-25.834-9.15-39.658-13.155 7.034-1.47 14.04-2.595 21-3.314l-1.937-18.593c-18.886 1.95-37.535 6.48-56 12.468-.512-.113-1.018-.23-1.53-.343l-.22.938c-16.2 5.338-32.25 11.774-48.188 18.53-27.93-15.956-55.79-29.693-82.75-41.436zm133.875 41.75c14.853 3.45 29.035 7.32 42.53 11.56C214.07 81.89 198.03 87.278 182 93.5c-8.425-5.602-16.896-10.98-25.375-16.156 10.37-4.202 20.692-8.15 30.938-11.625zm74.062 22.624c.01.003.022-.004.03 0 11.267 4.387 21.996 9.055 32.19 14-23.21 6.29-45.89 14.11-68.314 22.437-8.172-6.34-16.437-12.444-24.75-18.343 20.28-7.33 40.55-13.317 60.845-18.093zm-142.563 26.72c7.12 3.175 14.216 6.57 21.25 10.186-14.62 40.292-24.633 81.18-32.625 122.22-6.923-20.8-11.385-43.227-13.093-67.282 6.837-22.36 14.748-44.17 24.47-65.125zm199.5.374c11.695 6.762 22.554 13.94 32.625 21.437-28.995 5.763-57.234 13.598-85.156 21.906-7.703-6.996-15.52-13.762-23.436-20.31 25.147-9.094 50.344-17.252 75.97-23.032zM156.938 134.25c9.297 5.287 18.503 10.975 27.625 17.03-17.695 54.5-30.927 108.908-42.437 163.157-8.016-11.01-15.162-22.676-21.313-35.062 8.632-49.215 19.214-97.813 36.126-145.125zm213.438 18.156c9.15 8.064 17.508 16.463 25.063 25.125-30.125 4.353-60.155 11.352-90.094 20.157-7.65-8.273-15.492-16.25-23.47-24 29.29-8.518 58.597-16.22 88.5-21.28zm-169.72 9.97c11.142 8.042 22.134 16.678 32.97 25.874-22.08 56.622-36.777 114.317-48.28 172.313C175.26 352.09 165.867 343 157.25 333.28c11.817-57.12 25.252-114.07 43.406-170.905zm208.407 32.218c6.334 8.695 11.96 17.613 16.875 26.72.18.332.353.664.532 1-5.79-.157-11.582-.236-17.376-.19-25.536.208-51.115 2.44-76.688 6.94-4.34-5.4-8.76-10.707-13.25-15.908 30.063-8.46 60.038-14.912 89.906-18.562zm-160.468 6.812c9.638 8.772 19.11 18.027 28.47 27.72-17.9 55.27-30.75 110.418-41.69 165.405-11.767-6.403-22.943-13.457-33.5-21.092 11.23-58.282 25.396-115.842 46.72-172.032zM411.47 240.78c8-.025 16.02.158 24.03.532 4.867 11.61 8.69 23.474 11.5 35.532-26.15-6.084-52.332-8.79-79.438-8.625-2.064.01-4.14.046-6.218.092-5.154-7.66-10.488-15.125-15.938-22.437 22.01-3.362 44.02-5.02 66.063-5.094zm-119.75 4c10.398 11.495 20.623 23.543 30.624 36.19-18.485 44.613-27.665 90.6-35.97 136.186-11.612-4.13-22.858-8.732-33.687-13.844 10.437-52.982 22.532-105.82 39.032-158.53zm81.592 42.157c26.524.234 51.896 3.38 77.438 10.063 1.707 12.324 2.383 24.8 2.094 37.344-20.57-8.23-41.475-12.975-62.063-17-5.547-10.423-11.383-20.543-17.467-30.406zm-37.718 11.344c7.404 9.927 14.69 20.182 21.844 30.75-8.883 33.454-16.7 67.386-21.25 102.314-10.867-2.388-21.495-5.138-31.875-8.28 7.776-42.615 16.013-84.614 31.28-124.783zm65.97 40.376c17.145 3.763 33.866 8.385 50.03 15.438-1.083 10.398-2.832 20.818-5.22 31.22-9.76-6.797-20.437-12.273-31.5-16.377-4.19-10.328-8.608-20.434-13.312-30.28zm-30.283 11.47c7.133 11.214 14.152 22.75 21 34.624-5.405 17.798-8.452 35.95-9.936 54.28-9.388-1.09-18.66-2.45-27.78-4.06 3.665-28.62 9.653-56.796 16.717-84.845zm53.033 43.687c5.906 3.208 11.56 6.874 16.812 11-2.052 6.67-4.393 13.317-6.97 19.937-3.02-10.528-6.305-20.85-9.842-30.938zm-18.72 14.812c1.664 3.074 3.325 6.167 4.97 9.28 3.348 8.024 6.316 16.05 8.906 24.064-6.206-.26-12.354-.65-18.47-1.126.89-10.92 2.386-21.668 4.594-32.22z"/>`
    },
    fresh: {
        label: "Newly noticed",
        significance: "The earliest record in this atlas of a plant newly added to the flora.",
        icon: `<path transform="scale(0.046875)" fill="#b48cff" d="M275.2 26.85c-13.9 57.93-26.5 115.75-34.1 173.25 3.8-.9 7.7-1.3 11.8-1.3 6.8 0 13.4 1.2 19.6 3.5 4.3-57.1 10.9-114.79 25.5-173.25zm-59.7 8.63l-35.4 8.33c3.5 16.38 7.7 32.72 12.5 49.04l38.5 53.05c1.6-9.4 3.4-18.7 5.2-28.1-8-27.07-15.4-54.46-20.8-82.32zM346 44.76c-18.9 24.74-33.8 50.61-47.2 77.04-2 15-3.7 29.9-5.2 45 6.7-5.9 13.3-11.8 19.8-17.7 13-32 28.9-63.92 53.3-95.12zM147.1 61.14l-18.7 15.02 89.2 135.34c1.3-1.1 2.6-2.1 4-3.2 1.6-12.4 3.3-24.8 5.2-37.2zm259.8 22.63c-35.7 37.83-75 73.73-115.6 109.03l-1.5 20c4.3 3.8 8.1 8.3 11.1 13.3 43.5-41 86-81.7 121.3-123.9zM96.74 117.2L75.81 147c20.36 17.2 44.09 32.4 69.39 46.8 15.9 4.9 31.8 9.4 47.8 13.6l-26.2-39.9c-25.2-14.9-49.3-30.9-70.06-50.3zm348.96 14.3l-73.5 51.4c-5.6 5.7-11.4 11.2-17.1 16.9 12.7-.3 25.4-.9 38.2-1.9 20.7-15.5 42.5-30.6 66.8-44.9zm-391.12 49l-5.85 23.1c44.78 20.3 91.67 36.4 139.17 51.5 3.1-2.2 6.2-4.3 9.3-6.4.8-7.2 2.9-13.8 6.1-20-50.7-12.9-100.6-28-148.72-48.2zm421.32 22.7c-47.4 11.4-94.1 14.9-139.9 14.8-9.3 8.9-18.6 17.7-28 26.6l.3 1.5c1.2.8 2.3 1.5 3.5 2.2 57.9-.9 114-7.7 169.2-17.5zm-223 13.7c-21.1 0-38 17-38 38.2 0 21.2 16.9 38.1 38 38.1s37.9-16.9 37.9-38.1c0-21.2-16.8-38.2-37.9-38.2zM35.18 227.4L31 253.7l59.57 8.2c13.03-2.2 25.93-4.5 38.63-7-21.2-7.4-42.24-15.2-62.97-23.9zm363.42 33.7c-18.8 2-37.7 3.5-56.7 4.5 19.1 10.1 39.1 19.5 59.7 28.6l67.8 14.8 3.1-34.8zm-234.8 5.4c-40.3 8.2-81.34 16.1-126.65 21.3l3 34.3 67.25-14.8c20.8-12.7 41.3-25.8 61.3-39.2-1.6-.5-3.3-1.1-4.9-1.6zm144 .4c-2.6 11.4-8.5 21.6-16.7 29.3 53.1 29.4 116.6 49.9 179 72.2l8.6-22.8c-59.1-23.6-118.5-47.2-170.9-78.7zm-109.1 2.6c-47.7 32.7-97 63.9-149.75 91.8l13.23 19.9c48.52-22.8 94.52-47.8 138.42-74.8l10.3-14.1c-5.7-6.5-10-14.2-12.2-22.8zm72.7 38.6c-5.8 2.2-12.1 3.3-18.5 3.3-4.6 0-9-.6-13.1-1.6l21.9 175.3 23.5-4zm-50.1.6l-103 142.4 19.8 13.5 88.7-111.8zm69 7.8l1.8 22.7c23.9 42.7 48.8 85 77 126l29.3-15.9c-30.4-39.2-56.4-79.2-81-119.5-9.2-4.2-18.3-8.6-27.1-13.3zm56.3 26c3.6 5.9 7.4 11.7 11.1 17.6 24.7 23.2 48.7 47.7 70.2 76.1l24.8-22.7c-14.9-17.4-30.8-33.3-47.3-48.7-19.7-7-39.5-14.4-58.8-22.3zm-172.8 1.1c-23.9 13.7-48.4 26.8-73.6 39.4l-26.6 24.5 24.9 22.9 45.5-45.8zm56.2 34.6l-27.1 34.1-10.7 60.6 26.3 7.7 14.1-81.8zm65.5 3.9l.7 8 30.2 89.1 14.6-6-9.1-31.1c-12.7-19.8-24.7-39.9-36.4-60z"/>`
    }
};

saanich.traces.icon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true">${saanich.traces.kinds[kind].icon}</svg>`;

// How many seconds a marker takes to fade away: the last record of a plant lingers
saanich.traces.life = kind => kind === "last" ? 18 : 12;

saanich.traces.playIcons = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>`
};

/**
 * One key moment in the record of a species, shown as a marker on the map.
 * @typedef {Object} TraceEvent
 * @property {TaxonRow} taxon - The species
 * @property {String} kind - The kind of moment, a key of `saanich.traces.kinds`
 * @property {Object} record - The record of the moment
 * @property {Number} year - The year of the record
 */

/**
 * Derive the events of the timeline: each marks a key moment in the record of a species, and is shown only if the record
 * concerned can be mapped. A record which is both the first and last of a lost plant appears once, as its last.
 * @param {TaxonRow[]} taxaRows - All taxa
 * @param {Map<String, Object[]>} byTaxon - Dated records indexed by taxon id
 * @return {TraceEvent[]} The events, in date order
 */
saanich.traces.buildEvents = function (taxaRows, byTaxon) {
    const events = [];
    const add = (taxon, kind, record) => {
        if (record && bioreportr.hasCoordinates(record)) {
            events.push({taxon, kind, record, year: parseInt(record.eventDate, 10)});
        }
    };
    taxaRows.filter(taxon => taxon.inSummary).forEach(taxon => {
        const records = (byTaxon.get(taxon.id) || []).slice().sort(saanich.obsDateComparator);
        if (records.length > 0) {
            const first = records[0], last = fluid.peek(records);
            if (taxon.reportingStatus === "unconfirmed") {
                add(taxon, "last", last);
                add(taxon, "first", first === last ? null : first);
            } else if (taxon.reportingStatus === "confirmed") {
                const found = records.find(record => parseInt(record.eventDate, 10) >= 2000);
                add(taxon, "found", found);
                add(taxon, "first", first === found ? null : first);
            } else if (taxon.reportingStatus === "new") {
                add(taxon, "fresh", first);
            }
        }
    });
    return events.filter(event => Number.isFinite(event.year)).sort((a, b) => saanich.obsDateComparator(a.record, b.record));
};

/**
 * Format the date of a record in full, or as its year alone if it has no day.
 * @param {String} eventDate - The date of the record
 * @return {String} The formatted date
 */
saanich.traces.formatDate = function (eventDate) {
    const [year, month, day] = eventDate.substring(0, 10).split("-").map(Number);
    return day ? new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(saanich.locale, {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"}) :
        String(year);
};

/**
 * Render the card shown on hovering over a marker, with a space for its photo.
 * @param {TraceEvent} event - The event of the marker
 * @return {String} The markup of the card
 */
saanich.traces.renderCard = function (event) {
    const {taxon, kind, record} = event;
    const encode = hortis.dataTable.encode;
    const recorder = (record.recordedBy || "").split(";")[0].trim();
    const common = taxon.commonName ? `<div class="saanich-trace-common">${encode(taxon.commonName)}</div>` : "";
    const place = record.locality ? `<div>${encode(record.locality)}</div>` : "";
    return `<div class="saanich-trace-photo"></div><div class="saanich-trace-kind" data-kind="${kind}">${saanich.traces.icon(kind)}${saanich.traces.kinds[kind].label}</div>
        <div class="saanich-trace-name">${encode(taxon.scientificName)}</div>${common}
        <div>${saanich.traces.formatDate(record.eventDate)}${recorder ? ", " + encode(recorder) : ""}</div>${place}
        <div class="saanich-trace-significance">${saanich.traces.kinds[kind].significance}</div>
        <div class="saanich-trace-action">Find this plant &rarr;</div>`;
};

/**
 * Compute the classes of the story's left pane while the timeline shows: the map takes the whole column, and its
 * markers freeze while the timeline is paused or being dragged.
 * @param {Boolean} active - Whether the timeline's pane is showing
 * @param {Boolean} paused - Whether the timeline is paused
 * @param {Boolean} scrubbing - Whether the timeline's slider is being dragged
 * @param {Boolean} rememberingActive - Whether the pane in memory of Harvey Janszen is shown
 * @return {String} The classes
 */
saanich.traces.leftPaneClass = function (active, paused, scrubbing, rememberingActive) {
    const classes = rememberingActive ? ["saanich-remembering-active"] : [];
    if (active) {
        classes.push("saanich-traces-active");
    }
    if (active && (paused || scrubbing)) {
        classes.push("saanich-traces-still");
    }
    return classes.join(" ");
};

/**
 * The state of the playback of a timeline, which runs outside the framework on timers and on markers of the map.
 * @typedef {Object} TraceState
 * @property {bioreportr.storyPage} storyPage - The story page
 * @property {maplibregl.Map} map - The story's map
 * @property {Window} window - The window holding the story page
 * @property {TraceEvent[]} events - The events, in date order
 * @property {Number} firstYear - The year of the earliest event
 * @property {Number} lastYear - The year of the latest event
 * @property {Number} index - The index of the next event to be shown
 * @property {Set<maplibregl.Marker>} markers - The markers on the map
 * @property {Number} holding - The number of markers, or the card, on which the pointer rests, which holds the timeline while positive
 * @property {Number|null} timer - The timer of the next step
 * @property {TraceEvent|null} cardEvent - The event whose card is shown
 * @property {Number|null} hideTimer - The timer hiding the card once the pointer has left it and its marker
 * @property {HTMLElement|null} heldMarker - The element of the marker whose card is shown
 * @property {Object} overlay - The elements which change during playback - `year`, `play`, `slider` and `card`
 */

// The state of each timeline, by its component
saanich.traces.states = new WeakMap();

/**
 * Create the elements laid over the map: the year, the controls of the timeline, the key and the card shown on hover.
 * @param {HTMLElement} mapElement - The element holding the map
 * @param {Number} firstYear - The year of the earliest event
 * @param {Number} lastYear - The year of the latest event
 * @return {Object} The elements which change during playback
 */
saanich.traces.createOverlay = function (mapElement, firstYear, lastYear) {
    const dokkument = mapElement.ownerDocument;
    const overlay = dokkument.createElement("div");
    overlay.className = "saanich-traces-overlay";
    overlay.innerHTML = `<div class="saanich-traces-year"></div>
        <div class="saanich-traces-controls">
            <button type="button" class="saanich-traces-play"></button>
            <input type="range" class="saanich-traces-slider" min="${firstYear}" max="${lastYear}" step="1" aria-label="Year">
        </div>
        <div class="saanich-traces-key">${["last", "first", "found", "fresh"].map(kind =>
        `<span data-kind="${kind}">${saanich.traces.icon(kind)}${saanich.traces.kinds[kind].label}</span>`).join("")}</div>`;
    mapElement.appendChild(overlay);
    const card = dokkument.createElement("div");
    card.className = "saanich-trace-card";
    card.setAttribute("role", "tooltip");
    dokkument.body.appendChild(card);
    return {year: overlay.querySelector(".saanich-traces-year"), play: overlay.querySelector(".saanich-traces-play"),
        slider: overlay.querySelector(".saanich-traces-slider"), card};
};

/**
 * Show on the play button whether the timeline is paused.
 * @param {fluid.component} that - The timeline
 * @param {Boolean} paused - Whether the timeline is paused
 */
saanich.traces.showPlayback = function (that, paused) {
    const state = saanich.traces.states.get(that);
    if (state) {
        const {play} = state.overlay, action = paused ? "Play" : "Pause";
        play.innerHTML = saanich.traces.playIcons[action.toLowerCase()];
        play.setAttribute("aria-label", action);
        play.title = action;
    }
};

/**
 * Bind the play button and the slider. Playback holds while the slider is dragged, and carries on from the new position
 * when it is let go.
 * @param {fluid.component} that - The timeline, whose `paused` and `scrubbing` are written
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.bindControls = function (that, state) {
    const {play, slider} = state.overlay;
    const release = () => {
        that.scrubbing = false;
    };
    play.addEventListener("click", () => {
        that.paused = !that.paused;
    });
    slider.addEventListener("pointerdown", () => {
        that.scrubbing = true;
    });
    slider.addEventListener("input", () => {
        that.scrubbing = true;
        saanich.traces.seek(state, Number(slider.value));
    });
    slider.addEventListener("change", release);
    // Not on the slider, since the pointer may be let go anywhere and a click which moves nothing fires no change
    state.window.addEventListener("pointerup", release);
    state.window.addEventListener("pointercancel", release);
};

/**
 * Show a year on the timeline's label and slider.
 * @param {TraceState} state - The state of the playback
 * @param {Number} year - The year
 */
saanich.traces.showYear = function (state, year) {
    const {year: label, slider} = state.overlay;
    label.textContent = year;
    slider.value = year;
    slider.style.setProperty("--saanich-progress", ((year - state.firstYear) / Math.max(1, state.lastYear - state.firstYear) * 100) + "%");
};

/**
 * Show the card of a marker beside it, on whichever side it fits.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event of the marker
 * @param {HTMLElement} element - The element of the marker
 */
saanich.traces.showCard = function (state, event, element) {
    const {card} = state.overlay, {innerWidth, innerHeight} = state.window;
    saanich.traces.cancelHide(state);
    saanich.traces.holdMarker(state, element);
    card.innerHTML = saanich.traces.renderCard(event);
    card.classList.add("saanich-trace-card-visible");
    const anchor = element.getBoundingClientRect(), box = card.getBoundingClientRect();
    // Close beside the marker, so that the pointer can cross to the card before it hides
    const gap = saanich.traces.cardGap;
    const fitsRight = anchor.right + gap + box.width <= innerWidth - 8;
    const left = fitsRight ? anchor.right + gap : anchor.left - box.width - gap;
    // Within the screen however narrow - on a phone the card may sit over its marker
    card.style.left = Math.max(8, Math.min(left, innerWidth - box.width - 8)) + "px";
    card.style.top = Math.min(Math.max(8, anchor.top - 16), innerHeight - box.height - 8) + "px";
    saanich.traces.loadPhoto(state, event);
};

// The lookups of each taxon's photo, by taxon id
saanich.traces.photos = new Map();

/**
 * Look up an openly licensed photo of a taxon on iNaturalist, once only for each taxon.
 * @param {String} taxonId - The id of the taxon
 * @param {Function} fetch - The window's `fetch`
 * @return {Promise<Object|undefined>} Resolves to the photo record, or undefined if there is none or it cannot be fetched
 */
saanich.traces.photoFor = function (taxonId, fetch) {
    if (!saanich.traces.photos.has(taxonId)) {
        saanich.traces.photos.set(taxonId, fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`)
            .then(response => response.json())
            .then(body => saanich.lostPlants.licensedPhoto(body.results[0]))
            .catch(() => undefined));
    }
    return saanich.traces.photos.get(taxonId);
};

/**
 * Fill in the photo of the card being shown, unless another card has replaced it in the meantime.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event shown on the card
 */
saanich.traces.loadPhoto = function (state, event) {
    const encode = hortis.dataTable.encode;
    state.cardEvent = event;
    saanich.traces.photoFor(event.taxon.id, state.window.fetch.bind(state.window)).then(photo => {
        const holder = state.overlay.card.querySelector(".saanich-trace-photo");
        if (state.cardEvent === event && holder) {
            if (photo) {
                const credit = photo.attribution.replace(/, uploaded by .*$/, "").replace(", some rights reserved", "");
                holder.innerHTML = `<img src="${encode(photo.medium_url)}" alt=""><span>${encode(credit)}</span>`;
            } else {
                holder.remove();
            }
        }
    });
};

// The distance in pixels between a marker and its card
saanich.traces.cardGap = 4;

// The time in milliseconds for which a card stays once the pointer has left its marker, so that it may be reached
saanich.traces.hideDelay = 350;

saanich.traces.hideCard = function (state) {
    saanich.traces.cancelHide(state);
    saanich.traces.holdMarker(state, null);
    state.overlay.card.classList.remove("saanich-trace-card-visible");
};

saanich.traces.cancelHide = function (state) {
    state.window.clearTimeout(state.hideTimer);
    state.hideTimer = null;
};

/**
 * Hide the card once the pointer has stayed away from both it and its marker for a moment.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.scheduleHide = function (state) {
    saanich.traces.cancelHide(state);
    state.hideTimer = state.window.setTimeout(() => saanich.traces.hideCard(state), saanich.traces.hideDelay);
};

/**
 * Hold the marker whose card is shown, so that it doesn't fade away whilst the pointer is on the card.
 * @param {TraceState} state - The state of the playback
 * @param {HTMLElement|null} element - The marker's element, or null if no card is shown
 */
saanich.traces.holdMarker = function (state, element) {
    if (state.heldMarker && state.heldMarker !== element) {
        state.heldMarker.classList.remove("saanich-trace-held");
    }
    state.heldMarker = element;
    if (element) {
        element.classList.add("saanich-trace-held");
    }
};

/**
 * Whether the last press was a touch, or the screen can't hover at all - when a marker's card is shown by a first tap,
 * and its species opened by a second, as there is no hover to show it.
 * @param {TraceState} state - The state of the playback
 * @return {Boolean} `true` if presses are touches
 */
saanich.traces.isTouch = state => state.pointerType === "touch" || state.window.matchMedia("(hover: none)").matches;

/**
 * Hide a card shown by a tap, releasing the hold it put on the timeline.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.releaseTouch = function (state) {
    if (state.touchHold) {
        state.touchHold = false;
        state.holding = Math.max(0, state.holding - 1);
    }
    saanich.traces.hideCard(state);
};

/**
 * Respond to a click or tap on a marker. A pointer which hovers has already shown the marker's card, so a click opens its
 * species; a tap shows the card first, holding the timeline, and a second tap on the marker or its card opens it.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event of the marker
 * @param {HTMLElement} element - The element of the marker
 */
saanich.traces.markerClick = function (state, event, element) {
    if (saanich.traces.isTouch(state) && !(state.touchHold && state.heldMarker === element)) {
        if (!state.touchHold) {
            state.touchHold = true;
            state.holding++;
        }
        saanich.traces.showCard(state, event, element);
    } else {
        saanich.traces.releaseTouch(state);
        saanich.traces.openTaxon(state.storyPage, event.taxon, state.window);
    }
};

/**
 * Bind the card, which holds the timeline while the pointer rests on it, and opens its species when clicked.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.bindCard = function (state) {
    const {card} = state.overlay;
    card.addEventListener("mouseenter", () => {
        state.holding++;
        saanich.traces.cancelHide(state);
    });
    card.addEventListener("mouseleave", () => {
        state.holding = Math.max(0, state.holding - 1);
        saanich.traces.scheduleHide(state);
    });
    card.addEventListener("click", () => {
        if (state.cardEvent) {
            const taxon = state.cardEvent.taxon;
            saanich.traces.releaseTouch(state);
            saanich.traces.openTaxon(state.storyPage, taxon, state.window);
        }
    });
    // Whether presses are touches, noted before any of the events they lead to
    state.window.addEventListener("pointerdown", pointerEvent => {
        state.pointerType = pointerEvent.pointerType;
    }, true);
    // A tap on the map away from the markers puts away a card shown by a tap
    state.map.on("click", mapEvent => {
        if (state.touchHold && !mapEvent.originalEvent?.target?.closest?.(".saanich-trace")) {
            saanich.traces.releaseTouch(state);
        }
    });
};

/**
 * Open the extirpation risk pane on a species, with its row in view and the map fitted to its records.
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {TaxonRow} taxon - The species
 * @param {Window} window - The window holding the story page
 */
saanich.traces.openTaxon = function (storyPage, taxon, window) {
    saanich.lostPlants.showTaxon(storyPage, taxon.id, "Solow", window.document, window);
    // Once the map has taken up its size in the newly visible pane
    window.requestAnimationFrame(() => {
        const row = storyPage.solowTaxa.taxaTable.selectedRow;
        if (row) {
            storyPage.solowFitTaxon = {taxon: row};
        }
    });
};

/**
 * Place the marker for one event on the map. It fades away by itself, unless held open by the pointer resting on it.
 * @param {TraceState} state - The state of the playback
 * @param {TraceEvent} event - The event to show
 * @param {Number} [age] - How many seconds into its fade the marker should begin
 */
saanich.traces.addMarker = function (state, event, age = 0) {
    const element = state.window.document.createElement("div");
    element.className = "saanich-trace";
    element.dataset.kind = event.kind;
    element.innerHTML = `<div class="saanich-trace-mark" style="animation-duration: ${saanich.traces.life(event.kind)}s; animation-delay: ${-age}s">${saanich.traces.icon(event.kind)}</div>`;
    const marker = new maplibregl.Marker({element}).setLngLat(bioreportr.obsPoint(event.record)).addTo(state.map);
    state.markers.add(marker);
    // A touch also sends these, which would show and then schedule the hiding of the card a tap is about to show
    element.addEventListener("mouseenter", () => {
        if (state.pointerType !== "touch") {
            state.holding++;
            saanich.traces.showCard(state, event, element);
        }
    });
    element.addEventListener("mouseleave", () => {
        if (state.pointerType !== "touch") {
            state.holding = Math.max(0, state.holding - 1);
            if (!state.touchHold) {
                saanich.traces.scheduleHide(state);
            }
        }
    });
    element.addEventListener("click", clickEvent => {
        clickEvent.stopPropagation();
        saanich.traces.markerClick(state, event, element);
    });
    element.firstElementChild.addEventListener("animationend", () => {
        marker.remove();
        state.markers.delete(marker);
    });
};

/**
 * Remove every marker from the map, and the card of any.
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.clearMarkers = function (state) {
    state.markers.forEach(marker => marker.remove());
    state.markers.clear();
    state.holding = 0;
    saanich.traces.hideCard(state);
};

// The time in milliseconds before the next event: the quiet stretches of the record pass more slowly than the busy ones,
// though never for long
saanich.traces.delayAfter = (event, next) => Math.min(1600, 600 + Math.max(0, next.year - event.year) * 200);

// The time in milliseconds before trying again to show an event, while the timeline is held
saanich.traces.retryDelay = 300;

/**
 * Show the next event, unless the timeline is held, and schedule the step after.
 * @param {fluid.component} that - The timeline
 * @param {TraceState} state - The state of the playback
 */
saanich.traces.step = function (that, state) {
    let delay = saanich.traces.retryDelay;
    if (!that.paused && !that.scrubbing && state.holding === 0 && !state.window.document.hidden) {
        const event = state.events[state.index];
        saanich.traces.addMarker(state, event);
        saanich.traces.showYear(state, event.year);
        state.index = (state.index + 1) % state.events.length;
        delay = saanich.traces.delayAfter(event, state.events[state.index]);
    }
    state.timer = state.window.setTimeout(() => saanich.traces.step(that, state), delay);
};

// As many markers as playback could have left on the map, at its quickest and with the longest fade
saanich.traces.trailLength = 30;
// Far enough into its fade that a marker has finished appearing, so that it shows even while the timeline is frozen
saanich.traces.trailStartAge = 1.2;

/**
 * Lay out the markers playback would have left on the map by the time it reached a given event, each as far through its
 * fade as it would then be.
 * @param {TraceState} state - The state of the playback
 * @param {Number} end - The index following the most recent event to show
 */
saanich.traces.placeTrail = function (state, end) {
    const {events} = state;
    let age = saanich.traces.trailStartAge;
    for (let i = end - 1; i >= Math.max(0, end - saanich.traces.trailLength); --i) {
        if (age < saanich.traces.life(events[i].kind)) {
            saanich.traces.addMarker(state, events[i], age);
        }
        if (i > 0) {
            age += saanich.traces.delayAfter(events[i - 1], events[i]) / 1000;
        }
    }
};

/**
 * Move the timeline to the end of a given year, in either direction.
 * @param {TraceState} state - The state of the playback
 * @param {Number} year - The year to move to
 */
saanich.traces.seek = function (state, year) {
    const next = state.events.findIndex(event => event.year > year);
    const end = next === -1 ? state.events.length : next;
    state.index = end % state.events.length;
    saanich.traces.clearMarkers(state);
    saanich.traces.placeTrail(state, end);
    saanich.traces.showYear(state, year);
};

/**
 * Create the state of a timeline once its map and events are ready, starting from a random year.
 * @param {fluid.component} that - The timeline
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {maplibregl.Map} map - The story's map
 * @param {TraceEvent[]} events - The events, in date order
 * @param {Window} window - The window holding the story page
 * @return {TraceState} The state of the playback
 */
saanich.traces.createState = function (that, storyPage, map, events, window) {
    const firstYear = events[0].year, lastYear = fluid.peek(events).year;
    const startYear = firstYear + Math.floor(Math.random() * (lastYear - firstYear + 1));
    const state = {storyPage, map, window, events, firstYear, lastYear, markers: new Set(), holding: 0, timer: null, cardEvent: null,
        hideTimer: null, heldMarker: null,
        index: Math.max(0, events.findIndex(event => event.year >= startYear)),
        overlay: saanich.traces.createOverlay(map.getContainer(), firstYear, lastYear)};
    saanich.traces.states.set(that, state);
    saanich.traces.bindControls(that, state);
    saanich.traces.bindCard(state);
    saanich.traces.showPlayback(that, that.paused);
    return state;
};

/**
 * Start or stop the timeline as its pane is shown or left, once the map and the real data are ready.
 * @param {fluid.component} that - The timeline
 * @param {bioreportr.storyPage} storyPage - The story page
 * @param {maplibregl.Map|undefined} map - The story's map, once its style has applied
 * @param {TraceEvent[]} events - The events, in date order
 * @param {Boolean} active - Whether the timeline's pane is showing
 * @param {Boolean} loaded - `true` once the page's data is real rather than placeholders
 * @param {Window} window - The window holding the story page
 */
saanich.traces.control = function (that, storyPage, map, events, active, loaded, window) {
    const ready = map && loaded && events.length > 0;
    const state = ready ? saanich.traces.states.get(that) ?? saanich.traces.createState(that, storyPage, map, events, window) :
        saanich.traces.states.get(that);
    if (state) {
        window.clearTimeout(state.timer);
        saanich.traces.clearMarkers(state);
        if (active) {
            const camera = bioreportr.storyMap.firstCamera(storyPage.mapData);
            if (camera) {
                map.jumpTo({center: camera.center, zoom: camera.zoom});
            }
            // Begun outside the effect, so that pausing, which is read here and by each step, does not restart the timeline
            state.timer = window.setTimeout(() => {
                // Someone returning to a timeline they paused finds it as they left it
                if (that.paused) {
                    saanich.traces.placeTrail(state, state.index || state.events.length);
                }
                saanich.traces.step(that, state);
            }, 0);
        }
    }
};
</script>

<style>
/* The map takes the whole column, dimmed so that the records stand out against it */
.mxcw-leftPane.saanich-traces-active .mxcw-map {
    height: 100% !important;
}
.mxcw-leftPane.saanich-traces-active > .mxcw-data,
.mxcw-leftPane.saanich-traces-active > .resize-bar {
    display: none !important;
}
.mxcw-leftPane.saanich-traces-active .maplibregl-canvas {
    filter: brightness(0.45) saturate(0.6);
}
.mxcw-leftPane:not(.saanich-traces-active) .saanich-traces-overlay {
    display: none;
}
.saanich-traces-overlay {
    position: absolute;
    left: 20px;
    /* Clear of the map's attribution */
    bottom: 44px;
    z-index: 2;
    pointer-events: none;
    color: #eefaff;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
}
.saanich-traces-year {
    font-size: 56px;
    font-weight: 300;
    line-height: 1;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
}
.saanich-traces-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 10px;
    pointer-events: auto;
}
.saanich-traces-play {
    flex: none;
    width: 28px;
    height: 28px;
    margin-left: -6px;
    padding: 3px;
    color: #FDF2CE;
    cursor: pointer;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.7));
}
.saanich-traces-play:focus-visible,
.saanich-traces-slider:focus-visible {
    outline: 2px solid #FDF2CE;
    outline-offset: 2px;
}
.saanich-traces-slider {
    --saanich-progress: 0%;
    --saanich-track: linear-gradient(to right, #FDF2CE var(--saanich-progress), rgba(238, 250, 255, 0.3) var(--saanich-progress));
    appearance: none;
    -webkit-appearance: none;
    width: min(360px, calc(100vw - 96px));
    height: 24px;
    margin: 0;
    background: transparent;
    cursor: pointer;
}
.saanich-traces-slider::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--saanich-track);
}
.saanich-traces-slider::-moz-range-track {
    height: 2px;
    background: var(--saanich-track);
}
.saanich-traces-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -6px;
    background: #FDF2CE;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.saanich-traces-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #FDF2CE;
    border: 0;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
/* Markers hold still while the timeline is paused or being dragged */
.saanich-traces-still .saanich-trace-mark {
    animation-play-state: paused;
}
.saanich-traces-key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    max-width: 420px;
    font-size: var(--story-small);
}
.saanich-traces-key span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.saanich-traces-key svg,
.saanich-trace-kind svg {
    width: 14px;
    height: 14px;
}
.saanich-trace {

/* Traces: a quicker timeline, with its marks shaped as acorn, plant, leaf skeleton and dandelion */
    cursor: pointer;
    width: 24px;
    height: 24px;
}
.saanich-trace-mark {
    width: 100%;
    height: 100%;
    animation: saanich-trace-life 16s ease-out forwards;
}
.saanich-trace[data-kind="last"] {
    width: 32px;
    height: 32px;
    z-index: 2;
}
.saanich-trace[data-kind="last"] .saanich-trace-mark {
    filter: drop-shadow(0 0 3px rgba(255, 138, 0, 0.5));
}
.saanich-trace:hover .saanich-trace-mark,
.saanich-trace-held .saanich-trace-mark {
    animation-play-state: paused;
    opacity: 1;
}
.saanich-trace-card {
    position: fixed;
    z-index: 1000;
    display: none;
    width: 260px;
    padding: 12px;
    /* The pointer may cross to the card, which opens its species when clicked */
    cursor: pointer;
    color: #eefaff;
    background: #0d3040;
    border: 1px solid #4a9aaa;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    font-size: 12px;
    line-height: 1.4;
}
.saanich-trace-card-visible {
    display: block;
}
.saanich-trace-kind {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #a8c8d0;
    margin-bottom: 4px;
}
.saanich-trace-name {
    font-size: 14px;
    font-style: italic;
    font-weight: 700;
}
.saanich-trace-common {
    color: #a8c8d0;
    margin-bottom: 4px;
}
.saanich-trace-significance {
    margin-top: 6px;
    color: #FDF2CE;
}
.saanich-trace-action {
    margin-top: 6px;
    color: #a8c8d0;
}
@media (min-width: 768px) {
    /* The Infusion 6 story page marks the wrapper of the active pane's section, rather than the section itself */
    .mxcw-activePane .mxcw-paneKey-Traces {
        justify-content: safe center;
    }

    .mxcw-paneKey-Traces .mxcw-sectionInner {
        flex: none;
    }
}
.mxcw-paneKey-Traces h2 {
    color: #a8c8d0;
    font-size: var(--story-small);
    font-weight: 400;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    margin: 2rem 0 clamp(14px, 3vh, 32px);
}
.mxcw-paneKey-Traces p {
    --saanich-traces-text: clamp(16px, min(0.55vw + 11px, 2.3vh), 21px);
    max-width: 31em;
    margin: 0 auto clamp(10px, 2.2vh, 22px);
    padding: 0 1.5rem;
    color: #d6e8ee;
    font-size: var(--saanich-traces-text);
    line-height: 1.5;
    text-align: center;
    text-wrap: balance;
}
/* The acknowledgement leads, set apart from the narrower memory which follows it */
.mxcw-paneKey-Traces p:first-of-type {
    margin-bottom: clamp(16px, 3.6vh, 36px);
    color: #FDF2CE;
    font-size: calc(var(--saanich-traces-text) * 1.2);
    line-height: 1.4;
}
.mxcw-paneKey-Traces .saanich-traces-next {
    color: #FDF2CE;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: rgba(253, 242, 206, 0.45);
    text-underline-offset: 5px;
    transition: text-decoration-color 0.2s;
}
.saanich-traces-next:hover {
    text-decoration-color: currentColor;
}
.saanich-traces-next:focus-visible {
    outline: 2px solid #FDF2CE;
    outline-offset: 4px;
}
@media (prefers-reduced-motion: no-preference) {
    .saanich-trace[data-kind="last"] .saanich-trace-mark {
        animation-name: saanich-trace-drift;
    }

    @keyframes saanich-trace-drift {
        0% {
            opacity: 0;
            transform: scale(0.3);
        }

        6% {
            opacity: 1;
            transform: scale(1);
        }

        65% {
            opacity: 1;
            transform: translate(0, 0);
        }

        100% {
            opacity: 0;
            transform: translate(10px, -26px);
        }
    }
}
.saanich-trace-photo {
    margin: -12px -12px 8px;
    height: 150px;
    background: #184E62;
    border-radius: 7px 7px 0 0;
    overflow: hidden;
    position: relative;
}
.saanich-trace-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.saanich-trace-photo span {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 6px;
    font-size: 11px;
    color: #eefaff;
    background: rgba(13, 48, 64, 0.7);
}
/* The most numerous marks step back, leaving the plants last seen to stand out */
.saanich-trace[data-kind="first"] svg {
    opacity: 0.7;
}
@keyframes saanich-trace-life {
    0% {
        opacity: 0;
        transform: scale(0.3);
    }

    6% {
        opacity: 1;
        transform: scale(1);
    }

    65% {
        opacity: 1;
    }

    100% {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    @keyframes saanich-trace-life {
        0%, 65% {
            opacity: 1;
        }

        100% {
            opacity: 0;
        }
    }
}

/* Phones: the map leaves room for the text beneath it, the timeline's controls and key sit clear of the map's credits,
   and the markers, which are small and brief, take a larger area for a fingertip */
@media (max-width: 767.98px) {
    .mxcw-leftPane.saanich-traces-active {
        height: max(360px, 62vh);
    }

    .saanich-traces-overlay {
        left: 12px;
        right: 12px;
        bottom: 56px;
    }

    .saanich-traces-year {
        font-size: 40px;
    }

    .saanich-traces-key {
        gap: 2px 10px;
    }

    .saanich-trace-card {
        width: min(260px, calc(100vw - 16px));
    }

    .mxcw-paneKey-Traces h2 {
        margin-top: 1.25rem;
    }

    .mxcw-paneKey-Traces p {
        padding: 0 1rem;
    }
}

@media (pointer: coarse) {
    .saanich-trace::after {
        content: "";
        position: absolute;
        inset: -12px;
    }
}
</style>

<!-- The <template> block below is written by src/js/storyBuild.js and must not be edited here: it holds the section
     knitted from content/story/Traces.Rmd, whose front matter names saanich.tracesPane as its paneComponent. Edit the
     R Markdown and knit it, then run "npm run story", which replaces everything between <template> and </template>
     and nothing else in this file. The markup is a template, which may bind members of saanich.tracesPane with
     @{...} - written in the R Markdown as raw HTML, e.g. `<span>@{count}</span>`{=html}, which pandoc leaves as it is -->
<template>
<div id="in-memory-of-plants" class="section level2 mxcw-paneKey-Traces"><h2>In Memory of Plants</h2><div class="mxcw-sectionInner"><div class="mxcw-sectionColumn">

<p>W̱SÁNEĆ peoples have cared for these lands and waters since time
immemorial.</p>
<p>The memory preserved here is much more limited: collected specimens,
names written down on lists, and observations shared through
iNaturalist, reaching back to 1859.</p>
<p>Each record is a moment when someone stopped to take note of a
plant.</p>
<p>Some plants are reported often. Some have appeared only in more
recent years, while <a href="#pane:LostPlants" class="saanich-traces-next">others have quietly disappeared from the
record.</a></p>
</div></div></div>
</template>
