<script src="%imerss-bioinfo/src/client/js/i6/imerss-core.js"></script>
<script src="../js/story.js"></script>
<script>
"use strict";

// Renders verbatim the content of a <template> element of the page, e.g. the site navigation which Hugo renders into
// the page around the story, so that it appears within the story page's own template
fluid.def("bioreportr.pageFragment", {
    $layers: "hortis.verbatimSlot",
    // templateId: String - the id of the <template> element
    markup: "$compute:bioreportr.pageFragment.markup({storyPage}.view.container, {self}.templateId)"
});
</script>
