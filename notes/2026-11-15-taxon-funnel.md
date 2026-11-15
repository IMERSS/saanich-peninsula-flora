# 2026-11-15 refresh - why the taxon count barely grew

The record count rose by 36% from the 20 August data, but the number of taxa rose by only one, to 1,106. This note
follows the names of the 2026-10-11 GBIF/iNaturalist fusion through checklist-catalogue-alignment-workflow to the
published summary, to see where they go. The stages overlap, so their losses don't add up exactly.

## The funnel

| Stage | Taxa | What removes names |
|---|---|---|
| `reduced-assigned.csv`: names resolved to an iNaturalist taxon at species level or below | 4,128 (3,805 at species level) | |
| Assigned catalogue, by `link_name` (all ranks) | 5,201 | |
| …with any record other than a casual iNaturalist observation | 2,994 | 2,207 link names have **only casual records**: mostly cultivated or captive plants, dropped in 2_curate.R step 2.1 |
| Penultimate catalogue | 2,526 | |
| Catalogue names not yet on the list | 867 | |
| …added to the list (confidence medium-low or better) | 75 | **792 scored "low"**: 441 have a single record, 594 aren't on the BC reference list, 392 have every iNaturalist record still needing ID |
| Updated list | 1,646 rows | |
| Ultimate list, and the published summary | 1,106 | `ultimize_list()` keeps only rows whose `review_status` and `annotation_status` are both "complete": **300 rows wait for review**, and **240 reviewed rows are flagged** doubtful, persisting/waif or planted |

So your suspicion is right for the last stage. A name new to the list arrives with `review_status` "remaining" and
can't reach the site until someone reviews it, unless it scores "high" confidence. `assign_review_priority()` marks a
high-confidence row complete automatically, "Automatic (EM)". High confidence needs all four of these: a voucher or
specimen, presence on the BC reference list, at least 10 records, and under 75% of iNaturalist records needing ID.

Most of the upstream loss is real, though. Casual-only names are mostly garden plants, and single unvouchered
records of names unknown in BC are rightly left out. Those losses happen before the list and its review.

## How the new taxa got in

Two taxa joined the summary and one left:

- ***Myriophyllum verticillatum*** was already on the August list, reviewed by TL but still "remaining" at
  medium-high confidence, with 5 records. It now has 10 records (7 research grade), which reaches the threshold for
  high confidence, so it was **approved automatically**. That's the only route by which this workflow admits a taxon
  without a reviewer.
- ***Plectritis congesta* ssp. *congesta*** came in as a new catalogue name with 15 records (14 research grade) and
  scored high confidence straight away. It sits beside the existing *Plectritis congesta* row.
- ***Aphanes occidentalis*** left. iNaturalist has lumped it into *Aphanes arvensis* (*Alchemilla arvensis*), and our
  assigned list followed that swap. The list then merged it into the existing *Aphanes arvensis* row. Flora of the
  Pacific Northwest still keeps the two separate, so **EM should decide whether to keep this lump**. If not, a key A2
  entry restores the old link.

So the workflow only admits a taxon with no reviewer once it is plentifully recorded and vouchered. The 1,106 taxa
are essentially the reviewed set, not the observed one.

## The 300 rows awaiting review

Each row is in exactly one group. In the tables, "Records (RG)" is the number of catalogue records, with the
number that are research grade in brackets. "BC ref" says whether the name is on the BC flora reference list, and
"New this run" whether the row wasn't on the 20 August list.

| Group | Rows | New this run | Grounds for approval |
|---|---|---|---|
| **A** | 73 | 23 | Review "remaining", annotation complete, not flagged, on the BC reference list, ≥ 2 research-grade records, medium-high confidence - one criterion short of automatic approval |
| **B** | 45 | 18 | As A, but medium-low confidence - two criteria short |
| C | 45 | 22 | Remaining, but not on the BC reference list, with fewer than 2 research-grade records, or annotation incomplete - these need a reviewer |
| In progress | 97 | 0 | A reviewer has started and often left a comment - should be left to them |
| Flagged | 40 | 0 | Already marked doubtful, persisting/waif or planted, so excluded even once reviewed |

The "maybe" group I mentioned before is the 78 medium-high rows still "remaining". Group A is those rows less the
few that fail the other criteria.

**If groups A and B were approved together, the summary would gain about 118 taxa, from 1,106 to about 1,224 (+11%).**
Of these 118, 77 are exotic, 39 native and 2 of unknown status, so the gain would come mostly from introduced
plants, where the main question is whether a record is a garden escape or an established population. Approving group
A alone would add 73.

The approval criteria above are mechanical. They don't replace a reviewer, but each passing name has at least two
research-grade observations and is known from BC. A light-touch option would be for EM to look through group A and B
together, rather than one name at a time, and mark the obvious ones "complete" in the list.

### Group A

| Taxon | Confidence | Records (RG) | Status | BC ref | New this run |
|---|---|---|---|---|---|
| *Papaver cambricum* | medium-high | 71 (70) | exotic | yes |  |
| *Populus nigra* | medium-high | 105 (28) | exotic | yes |  |
| *Euphorbia cyparissias* | medium-high | 19 (11) | exotic | yes |  |
| *Glechoma hederacea* | medium-high | 11 (11) | exotic | yes |  |
| *Cotoneaster dammeri* | medium-high | 9 (9) | exotic | yes |  |
| *Epilobium ciliatum ssp. watsonii* | medium-high | 8 (8) | native | yes | yes |
| *Hordeum vulgare* | medium-high | 11 (8) | exotic | yes |  |
| *Lupinus sulphureus* | medium-high | 8 (8) | native | yes | yes |
| *Centaurea paniculata* | medium-high | 7 (7) | exotic | yes |  |
| *Parthenocissus inserta* | medium-high | 25 (7) | exotic | yes | yes |
| *Cyperus eragrostis* | medium-high | 14 (6) | exotic | yes | yes |
| *Holosteum umbellatum ssp. umbellatum* | medium-high | 6 (6) | exotic | yes |  |
| *Isoetes tenella* | medium-high | 6 (6) | native | yes |  |
| *Juncus breweri* | medium-high | 8 (6) | native | yes | yes |
| *Bromus racemosus* | medium-high | 5 (5) | exotic | yes |  |
| *Eupatorium cannabinum* | medium-high | 10 (5) | exotic | yes |  |
| *Juncus gerardii ssp. gerardii* | medium-high | 9 (5) | exotic | yes |  |
| *Lepidium draba* | medium-high | 6 (5) | exotic | yes |  |
| *Oxalis stricta* | medium-high | 11 (5) | exotic | yes |  |
| *Oxybasis macrosperma* | medium-high | 5 (5) | exotic | yes |  |
| *Rorippa curvipes* | medium-high | 5 (5) | native | yes |  |
| *Rubus vestitus* | medium-high | 7 (5) | exotic | yes | yes |
| *Spiraea douglasii var. douglasii* | medium-high | 5 (5) | native | yes | yes |
| *Agoseris heterophylla ssp. heterophylla* | medium-high | 4 (4) | native | yes | yes |
| *Alnus alnobetula* | medium-high | 12 (4) | native | yes | yes |
| *Ammophila breviligulata ssp. breviligulata* | medium-high | 11 (4) | exotic | yes |  |
| *Camelina sativa* | medium-high | 4 (4) | exotic | yes |  |
| *Deschampsia cespitosa ssp. cespitosa* | medium-high | 4 (4) | native | yes | yes |
| *Descurainia pinnata ssp. brachycarpa* | medium-high | 5 (4) | native | yes |  |
| *Equisetum × ferrissii* | medium-high | 4 (4) | unknown | yes | yes |
| *Genista tinctoria* | medium-high | 6 (4) | exotic | yes |  |
| *Juncus supiniformis* | medium-high | 4 (4) | native | yes |  |
| *Platanthera dilatata var. leucostachys* | medium-high | 4 (4) | native | yes | yes |
| *Poa wheeleri* | medium-high | 4 (4) | native | yes | yes |
| *Polygonum achoreum* | medium-high | 4 (4) | native | yes |  |
| *Polystichum andersonii* | medium-high | 4 (4) | native | yes |  |
| *Puccinellia pumila* | medium-high | 4 (4) | native | yes |  |
| *Ranunculus flammula var. reptans* | medium-high | 4 (4) | native | yes |  |
| *Ulmus pumila* | medium-high | 14 (4) | exotic | yes | yes |
| *Veratrum viride var. eschscholtzianum* | medium-high | 4 (4) | native | yes | yes |
| *Vicia sativa ssp. sativa* | medium-high | 4 (4) | exotic | yes | yes |
| *Anthriscus cerefolium* | medium-high | 4 (3) | exotic | yes | yes |
| *Armeria maritima ssp. maritima* | medium-high | 3 (3) | exotic | yes | yes |
| *Artemisia borealis* | medium-high | 3 (3) | native | yes | yes |
| *Carex arctiformis* | medium-high | 3 (3) | native | yes | yes |
| *Datura innoxia* | medium-high | 3 (3) | exotic | yes |  |
| *Echinocystis lobata* | medium-high | 3 (3) | exotic | yes |  |
| *Elymus canadensis* | medium-high | 4 (3) | native | yes | yes |
| *Euphorbia exigua* | medium-high | 3 (3) | exotic | yes |  |
| *Hordeum murinum ssp. glaucum* | medium-high | 3 (3) | exotic | yes |  |
| *Juncus alpinoarticulatus* | medium-high | 3 (3) | native | yes |  |
| *Juniperus communis var. kelleyi* | medium-high | 3 (3) | native | yes |  |
| *Oxybasis chenopodioides* | medium-high | 3 (3) | native | yes |  |
| *Phalaris canariensis* | medium-high | 7 (3) | exotic | yes |  |
| *Potamogeton berchtoldii* | medium-high | 3 (3) | native | yes |  |
| *Potamogeton friesii* | medium-high | 3 (3) | native | yes |  |
| *Potamogeton obtusifolius* | medium-high | 3 (3) | native | yes |  |
| *Bromus secalinus* | medium-high | 4 (2) | exotic | yes |  |
| *Conringia orientalis* | medium-high | 2 (2) | exotic | yes |  |
| *Cyperus esculentus var. leptostachyus* | medium-high | 2 (2) | exotic | yes |  |
| *Glyceria declinata* | medium-high | 2 (2) | exotic | yes |  |
| *Gypsophila paniculata* | medium-high | 2 (2) | exotic | yes |  |
| *Helianthus pauciflorus ssp. subrhomboideus* | medium-high | 2 (2) | exotic | yes |  |
| *Isolepis setacea* | medium-high | 2 (2) | exotic | yes |  |
| *Juncus hesperius* | medium-high | 3 (2) | native | yes | yes |
| *Koeleria spicata* | medium-high | 3 (2) | native | yes | yes |
| *Lepidium ruderale* | medium-high | 2 (2) | exotic | yes |  |
| *Persicaria hydropiper* | medium-high | 2 (2) | exotic | yes |  |
| *Phyllospadix serrulatus* | medium-high | 2 (2) | native | yes |  |
| *Polypogon interruptus* | medium-high | 2 (2) | exotic | yes |  |
| *Potamogeton gramineus* | medium-high | 2 (2) | native | yes |  |
| *Ranunculus aquatilis var. diffusus* | medium-high | 2 (2) | native | yes |  |
| *Ranunculus gmelinii* | medium-high | 2 (2) | native | yes |  |

### Group B

| Taxon | Confidence | Records (RG) | Status | BC ref | New this run |
|---|---|---|---|---|---|
| *Silene dioica* | medium-low | 8 (8) | exotic | yes |  |
| *Potamogeton crispus* | medium-low | 7 (7) | exotic | yes |  |
| *Securigera varia* | medium-low | 9 (7) | exotic | yes |  |
| *Symphyotrichum novi-belgii var. novi-belgii* | medium-low | 34 (7) | exotic | yes |  |
| *Tussilago farfara* | medium-low | 6 (6) | exotic | yes |  |
| *Typha angustifolia* | medium-low | 35 (6) | exotic | yes |  |
| *Veronica peregrina var. peregrina* | medium-low | 6 (6) | exotic | yes |  |
| *Arundo donax* | medium-low | 5 (5) | exotic | yes | yes |
| *Galeopsis bifida* | medium-low | 5 (5) | exotic | yes |  |
| *Montia chamissoi* | medium-low | 5 (5) | native | yes | yes |
| *Tamarix ramosissima* | medium-low | 27 (5) | exotic | yes |  |
| *Thinopyrum intermedium* | medium-low | 7 (5) | exotic | yes |  |
| *Antennaria howellii* | medium-low | 8 (4) | native | yes | yes |
| *Centaurea macrocephala* | medium-low | 5 (4) | exotic | yes | yes |
| *Elodea nuttallii* | medium-low | 4 (4) | native | yes | yes |
| *Erigeron annuus* | medium-low | 4 (4) | exotic | yes | yes |
| *Galega officinalis* | medium-low | 5 (4) | exotic | yes |  |
| *NA* | medium-low | 4 (4) | native | yes | yes |
| *Robinia hispida var. hispida* | medium-low | 6 (4) | exotic | yes |  |
| *Sorghum bicolor ssp. bicolor* | medium-low | 4 (4) | exotic | yes |  |
| *Verbascum blattaria* | medium-low | 6 (4) | exotic | yes | yes |
| *Verbascum virgatum* | medium-low | 5 (4) | exotic | yes | yes |
| *Viola tricolor var. tricolor* | medium-low | 6 (4) | exotic | yes |  |
| *Cotoneaster lacteus* | medium-low | 52 (3) | exotic | yes |  |
| *Daphne mezereum* | medium-low | 3 (3) | exotic | yes |  |
| *Delphinium elatum* | medium-low | 3 (3) | exotic | yes |  |
| *Digitaria sanguinalis* | medium-low | 30 (3) | exotic | yes |  |
| *Plantago coronopus* | medium-low | 5 (3) | exotic | yes |  |
| *Salix alba* | medium-low | 6 (3) | exotic | yes |  |
| *Thymus pulegioides* | medium-low | 7 (3) | exotic | yes |  |
| *Achillea ptarmica* | medium-low | 3 (2) | exotic | yes | yes |
| *Arrhenatherum elatius ssp. elatius* | medium-low | 2 (2) | exotic | yes |  |
| *Betula glandulosa* | medium-low | 4 (2) | native | yes | yes |
| *Chenopodium betaceum* | medium-low | 3 (2) | exotic | yes | yes |
| *Cornus sanguinea* | medium-low | 11 (2) | exotic | yes | yes |
| *Limosella aquatica* | medium-low | 3 (2) | native | yes | yes |
| *Morus alba* | medium-low | 3 (2) | exotic | yes | yes |
| *Nymphaea × marliacea* | medium-low | 3 (2) | unknown | yes | yes |
| *Nymphoides peltata* | medium-low | 3 (2) | exotic | yes | yes |
| *Prunus serotina var. serotina* | medium-low | 13 (2) | exotic | yes |  |
| *Rorippa amphibia* | medium-low | 2 (2) | exotic | yes |  |
| *Sambucus nigra ssp. canadensis* | medium-low | 12 (2) | exotic | yes | yes |
| *Sedum thartii* | medium-low | 6 (2) | exotic | yes |  |
| *Setaria viridis* | medium-low | 4 (2) | exotic | yes |  |
| *Verbascum phlomoides* | medium-low | 4 (2) | exotic | yes |  |

### Group C

| Taxon | Confidence | Records (RG) | Status | BC ref | New this run |
|---|---|---|---|---|---|
| *Falona echinata* | medium-high | 461 (303) | unknown | no | yes |
| *Oxalis smalliana* | medium-low | 96 (93) | unknown | no | yes |
| *Jasminum nudiflorum* | medium-low | 100 (56) | exotic | no |  |
| *Iris foetidissima* | medium-low | 89 (48) | exotic | no |  |
| *Crocus vernus* | medium-high | 138 (36) | exotic | no |  |
| *Phedimus spurius* | medium-low | 44 (31) | exotic | no |  |
| *Crocus stellaris* | medium-low | 32 (28) | exotic | no |  |
| *Corydalis lutea* | medium-low | 29 (24) | exotic | no |  |
| *Myosotis dubia* | medium-low | 26 (20) | unknown | no | yes |
| *Rubus procerus* | medium-high | 33 (19) | unknown | no | yes |
| *Papaver atlanticum* | medium-low | 19 (18) | unknown | no | yes |
| *Lamium maculatum* | medium-low | 18 (17) | unknown | no | yes |
| *Parthenocissus tricuspidata* | medium-low | 25 (17) | exotic | no |  |
| *Oxalis articulata* | medium-low | 50 (16) | unknown | no | yes |
| *Euonymus europaeus* | medium-low | 31 (15) | exotic | no |  |
| *Papaver orientale* | medium-low | 44 (14) | exotic | no |  |
| *Pseudo-fumaria alba* | medium-low | 20 (14) | unknown | no | yes |
| *Geranium sanguineum* | medium-low | 23 (13) | unknown | no | yes |
| *Hippophae rhamnoides* | medium-low | 17 (13) | unknown | no | yes |
| *Tropaeolum majus* | medium-low | 15 (13) | unknown | no | yes |
| *Convallaria majalis* | medium-low | 19 (12) | unknown | no | yes |
| *Iris × hybrida* | medium-low | 17 (11) | unknown | no | yes |
| *Achlys californica* | medium-low | 21 (10) | unknown | no | yes |
| *Gaillardia pulchella* | medium-low | 12 (10) | unknown | no | yes |
| *Tamarix parviflora* | medium-high | 19 (10) | exotic | no |  |
| *Euonymus alatus* | medium-low | 19 (9) | unknown | no | yes |
| *Cotoneaster × suecicus* | medium-high | 27 (9) | unknown | no | yes |
| *Oxalis incarnata* | medium-low | 15 (6) | unknown | no | yes |
| *Teucrium hircanicum* | medium-low | 16 (5) | exotic | no |  |
| *Cortaderia selloana* | medium-low | 4 (4) | exotic | no |  |
| *Monarda fistulosa* | medium-low | 5 (4) | native | yes | yes |
| *Hemitomes congestum* | medium-low | 3 (3) | native | yes | yes |
| *Quercus cerris* | medium-low | 3 (3) | exotic | no |  |
| *Euphorbia virgata* | medium-low | 3 (2) | exotic | no |  |
| *Geranium ibericum* | medium-low | 2 (2) | exotic | no |  |
| *Phalaris aquatica* | low | 1 (1) | exotic | no |  |
| *Armoracia rusticana* | medium-low | 2 (1) | exotic | yes | yes |
| *Cotoneaster spp.* | medium-low | 1 (1) | exotic | yes |  |
| *Digitaria ischaemum* | medium-low | 1 (1) | exotic | yes |  |
| *Equisetum fluviatile* | medium-low | 2 (1) | native | yes | yes |
| *Hieracium umbellatum ssp. umbellatum* | medium-low | 2 (1) | exotic | yes |  |
| *Humulus lupulus var. neomexicanus* | medium-low | 2 (1) | exotic | yes |  |
| *Isatis tinctoria* | medium-low | 1 (1) | exotic | yes |  |
| *Potamogeton richardsonii* | low | 1 (0) | native | yes |  |
| *Ulmus americana* | medium-low | 27 (0) | exotic | yes |  |

### In progress

| Taxon | Confidence | Records (RG) | Status | BC ref | Reviewed by | Comment |
|---|---|---|---|---|---|---|
| *Aesculus hippocastanum* | medium-high | 583 (329) | exotic | yes | EM | Unsure whether established, waif, or planted (EM). Occasionally colonizes natural woodland… |
| *Calystegia silvatica ssp. silvatica* | medium-high | 552 (152) | exotic | yes | EM | likely established given the number of observations, however possible misidentifications o… |
| *Grindelia integrifolia* | medium-low | 706 (71) | native | no | TL, KM, JM, EM | Note: WS = Washington State University Marion Ownbey Herbarium. Also isotype of Grindelia … |
| *Taxus baccata* | medium-high | 91 (53) | exotic | no | AS | Commonly planted; naturalized in some places? Review |
| *Chelidonium majus* | medium-high | 39 (37) | exotic | yes | EM | Interesting converstation here: https://www.inaturalist.org/observations/59930281. Unclear… |
| *Potentilla anserina ssp. egedii* | medium-high | 28 (26) | unknown | yes | EM, Automatic (EM) | Argentina anserina ssp. groenlandica is a heterotypic synonym of Potentilla anserina ssp. … |
| *Castanea sativa* | medium-high | 40 (19) | exotic | no | EM | Unsure whether planted, waif, or established (EM). |
| *Armeria maritima ssp. californica* | high | 20 (19) | native | yes | TL, Automatic (EM) |  |
| *Myriophyllum aquaticum* | medium-high | 14 (14) | exotic | yes | EM | Likely present, but unsure whether established. (EM) |
| *Cornus occidentalis* | medium-high | 13 (13) | native | yes | TL, EM | Unsure whether enough evidence iNat to differentiate between C. stolonifera (EM) |
| *Allium triquetrum* | medium-low | 24 (12) | exotic | no | EM | Garden escapee? (EM) I've seen it along the side of Interurban Rd near the Pacific Forestr… |
| *Puccinellia nutkaensis* | high | 14 (12) | native | yes | Automatic (EM) |  |
| *Scandix pecten-veneris* | high | 12 (12) | exotic | yes | EM, Automatic (EM) | Unsure whether planted, persisting, or naturalized (EM) |
| *Castilleja miniata* | high | 13 (11) | native | yes | EM, Automatic (EM) | Plausible? (EM) |
| *Myosotis stricta* | high | 14 (10) | exotic | yes | TL, Automatic (EM) | Macoun's specimen date 1908 precedes Calder. Note: F =    Field Museum of Natural History … |
| *Rorippa sylvestris* | high | 15 (10) | exotic | yes | TL, Automatic (EM) |  |
| *Myrrhis odorata* | medium-high | 15 (9) | exotic | yes | EM | Convincing iNat obs, but not entirely certain it is established (EM) |
| *Artemisia absinthium* | medium-high | 17 (8) | exotic | yes | TL |  |
| *Brassica napus* | high | 14 (7) | exotic | yes | Automatic (EM) |  |
| *Vallisneria americana* | high | 12 (7) | exotic | yes | HJ, FL, Automatic (EM) | ""It is unclear to me which species is in BC - americana or spiralis, or both. If you ever… |
| *Alisma triviale* | medium-low | 38 (6) | native | yes | EM | Could easily be mistaken for another A. triviale, but there are many observations. If inde… |
| *Festuca idahoensis* | medium-high | 6 (6) | native | yes | EM, AM | Assign this row as Festuca roemeri var. roemeri or retain? (EM) Assign as Festuca roemeri … |
| *Lupinus polyphyllus var. polyphyllus* | medium-high | 6 (6) | native | yes | EM | Peter Zika observation from San Juans. Seems plausible unless it is a misidentification. P… |
| *Najas flexilis* | medium-high | 6 (6) | native | yes | TL, EM | Complex with Najas canadensis? Should we reassign? Recent iNat obs from last year, potenti… |
| *Aphanes australis* | high | 15 (6) | exotic | yes | EM, Automatic (EM) | only one research grade iNaturalist obs (EM) |
| *Brassica juncea* | high | 11 (6) | exotic | yes | TL, Automatic (EM) | RBCM V009465 E. Cooke Victoria: Burnside area 1934. (TL) |
| *Nasturtium microphyllum* | high | 11 (6) | exotic | yes | TL, EM, Automatic (EM) | Plausible? Though, no convincing iNat obs. (EM) |
| *Solidago elongata* | medium-low | 40 (5) | native | yes | JM | Solidago elongata: likely a misidentification of Solidago lepida, although new map include… |
| *Calendula arvensis* | medium-high | 17 (5) | exotic | no | EM | Potential synonymy with Calendula officianalis but differentiated on iNat (EM) |
| *Epilobium ciliatum ssp. ciliatum* | medium-high | 5 (5) | native | yes | EM | subspecies not recognized by FPNW but is in BC Flora. iNat evidence not convincing. (EM) |
| *Isoetes maritima* | medium-high | 5 (5) | native | yes | JM, KM, EM | Plausible but should probably check vouchers, no iNat records in nearby areas. Might be go… |
| *Panicum capillare* | medium-high | 9 (5) | native | yes | TL, EM | Not super confident in iNat obs, though there are a few research grade. No other records s… |
| *Poa nemoralis* | medium-high | 5 (5) | exotic | yes | TL | Note: NY = The New York Botanical Garden Herbarium TL |
| *Aurinia saxatilis* | low | 26 (4) | exotic | no | TL, EM, JM, KM | UBC V191723 G.B. Straley Vancouver Island, 17 km east of Cowichan Lake, parking lot at res… |
| *Scilla sardensis* | medium-low | 4 (4) | exotic | no |  |  |
| *Agropyron cristatum ssp. pectinatum* | medium-high | 4 (4) | exotic | yes | TL | See Illustrated Flora of B.C. note ""The three Agropyron species occurring in BC  hybridiz… |
| *Arceuthobium americanum* | medium-high | 4 (4) | native | yes | TL, EM | Likely Arceuthobium tsugense misidentification? (EM) |
| *Carex kelloggii var. kelloggii* | medium-high | 4 (4) | native | yes |  | Examine other potential var (KM, JM,AM, EM). |
| *Carex pluriflora* | medium-high | 4 (4) | native | yes | EM, JM | Convincing assessment of single iNat observation by Micheal Stein: https://www.inaturalist… |
| *Chenopodiastrum simplex* | medium-high | 4 (4) | exotic | yes | EM | Plausile introduced species? No convincing iNat records. (EM) |
| *Galium spurium* | medium-high | 19 (4) | exotic | yes | EM, Automatic (EM) | Note: G.  spurium = G. aparine. Source: CPNWH (TL) |
| *Glyceria borealis* | medium-high | 4 (4) | native | yes | TL |  |
| *Hemizonella minima* | medium-high | 4 (4) | native | yes | TL, JM, KM, EM | Hardy = G.A. Hardy, HLR = H.L. Roemer, Empress Mt record = ??? out of range?(TL). Plausibl… |
| *Holcus mollis* | medium-high | 4 (4) | exotic | yes | TL, AM |  |
| *Hordeum jubatum ssp. intermedium* | medium-high | 4 (4) | native | yes | JM, KM, EM | Unsure about varieties/ ssp. Could go check locations and key them iNat observations not h… |
| *Lupinus arcticus ssp. arcticus* | medium-high | 4 (4) | native | yes | EM | not in FPNW but in BC Flora. Unlikely for study area? Likely L. latifolius Do others agree… |
| *Neslia paniculata* | medium-high | 4 (4) | exotic | yes | TL, EM | Jamie Fenneman observation up-island. Plausible? Though potentially exirpated intro (EM) |
| *Solidago lepida var. lepida* | medium-high | 4 (4) | native | yes | TL, AM | NY = The New York Botanical Garden Herbarium *NB Taxonomy with related taxa and subtaxa ar… |
| *Sparganium angustifolium* | medium-high | 4 (4) | native | yes | TL, EM | misidentification of another Sparganium? (EM) |
| *Spiraea douglasii var. menziesii* | medium-high | 4 (4) | native | yes | EM | No iNat obs, but plausible in my opinion (EM). |
| *Amsinckia spectabilis* | medium-low | 4 (3) | native | yes | TL, EM, JM, KM | UBC V115929 J. Davidson Victoria 1913. UBC V63311 W. Taylor Islands south area, Victoria 1… |
| *Myriophyllum sibiricum* | medium-low | 5 (3) | native | yes | EM | Likely present but unsure whether established (EM) |
| *Rhinanthus minor ssp. groenlandicus* | medium-low | 3 (3) | native | yes | EM | Note: WTU = Washington University. Seems to prefer mountainous/ subalpine habitat given cl… |
| *Salix fragilis* | medium-low | 5 (3) | unknown | yes | TL, EM | Note: hybrid white willow (Salix alba × Salix fragilis = Salix fragilis; Source: CPNWH).(T… |
| *Agrostis idahoensis* | medium-high | 3 (3) | native | yes | TL | Note: PMAR = Provincial Museum Annual Report |
| *Calamagrostis nutkaensis* | medium-high | 8 (3) | native | yes | TL | Check location TL. No convincing iNat records, but plausible as found in adjacent regions … |
| *Coreopsis tinctoria* | medium-high | 7 (3) | native | yes | EM | Likely occassional escapee from cultivation. Only one iNat obs that does not look planted.… |
| *Geum aleppicum* | medium-high | 6 (3) | native | yes | TL, KM, JM, EM | Note: FSP = Flora of the Saanich Peninsula A.F. Szczawinski & A.S. Harrison 1972. Will ask… |
| *Helianthus maximiliani* | medium-high | 3 (3) | native | yes | TL | A Preliminary Catalogue of the Flora of Vancouver and Queen Charlotte Islands published in… |
| *Juncus canadensis* | medium-high | 4 (3) | exotic | yes | EM | No convincing iNat records in region, but from adjacent regions (EM).  |
| *Lepidium sativum* | medium-high | 3 (3) | exotic | yes | TL, EM | Plausible, but likely unestablished/ extirpated? (EM) |
| *Antennaria dimorpha* | medium-high | 2 (2) | native | yes | TL, EM | UBC Herbarium V53806. No iNat obs, seems to be an interior species (EM).  |
| *Drosera anglica* | medium-high | 2 (2) | native | yes | TL, KM, JM, EM | Potentially occured in the past but check voucher details (EM). Possible and not that weir… |
| *Eleocharis acicularis* | medium-high | 2 (2) | native | yes | TL, KM, JM, EM | Check voucher. (KM, EM, JM) Could be confused with E. parvula (JM). |
| *Glyceria leptostachya* | medium-high | 2 (2) | native | yes | TL, JM, KM, EM | One of putative parents of occidentalis that JM hasn't seen but may be out there.  |
| *Glyceria striata* | medium-high | 10 (2) | native | yes | TL, KM, JM, EM | Note: CMN = Canadian Museum of Nature, Ottawa. TL |
| *Salix candida* | medium-high | 2 (2) | native | yes | TL | JM will ask Adolf |
| *Cerastium brachypodum* | low | 1 (1) | unknown | no | TL, EM | Note: drawn from synonym C. nutans var. nutans TL. TCB voucher seems to be only sighting, … |
| *Glyceria grandis var. grandis* | low | 5 (1) | native | yes | TL, EM | FSP = Flora of the Saanich Peninsula A.F. Szczawinski and A.S. Harrison 1972 TL. research … |
| *Leontodon crispus* | low | 1 (1) | exotic | no | EM | consider removing. Not in FPNW or BC Flora. Potentially a misidentification or introducted… |
| *Lepidium strictum* | low | 1 (1) | unknown | no | TL, EM | Listed in A Preliminary Catalogue of the Flora of Vancouver and Queen Charlotte Islands ""… |
| *Linum lewisii* | low | 4 (1) | native | no | TL, EM | considered complex with Linum perenne. Review in tandem. (EM) |
| *Antennaria anaphaloides* | medium-low | 1 (1) | native | yes | TL, EM | Note: Out of range but only occurrence in the area. A.&O. Ceska Koksilah River (above Prov… |
| *Boechera stricta* | medium-low | 1 (1) | native | yes | TL, EM | RBCM V081261 E. Cooke Victoria: Esquimalt 1934. (TL). Plausible, although subalpine specie… |
| *Carex flava* | medium-low | 1 (1) | native | yes | TL, EM | Note: CMN = Canadian Museum of Nature Herbarium; Isotype. TL. Part of complex now with Car… |
| *Carex vesicaria* | medium-low | 1 (1) | native | yes | TL, EM | Note: Taxonomic status as synonym  C. exsiccata var. pungens. (TL) Plausible due to observ… |
| *Carex vulpinoidea* | medium-low | 1 (1) | native | yes | TL, EM | No records since 1920? (EM) I've seen it locally where it's been planted but I doubt any w… |
| *Cinna latifolia* | medium-low | 1 (1) | native | yes | TL, EM | Note: J.R. Anderson lived with his wife in a small house in Victoria, so I am assuming he … |
| *Cynodon dactylon var. dactylon* | medium-low | 1 (1) | exotic | yes | TL | Note: See digital photo of specimen label where the collector is J.R. Anderson not Fletche… |
| *Danthonia intermedia ssp. intermedia* | medium-low | 1 (1) | native | yes | TL |  |
| *Eucephalus engelmannii* | medium-low | 1 (1) | native | yes | TL, EM | FSBC = Flora of Southern British Columbia. (TL) Only one sighting from 1915, without speci… |
| *Hordeum jubatum ssp. jubatum* | medium-low | 1 (1) | native | yes | JM, EM, AM | Review this in tandem with Hordeum jubatum ssp. intermedium (EM). Assess later in the year… |
| *Juncus filiformis* | medium-low | 1 (1) | native | yes | TL, EM | No records since 1955? But convincing records from adjacent regions (EM) |
| *Lathyrus palustris* | medium-low | 1 (1) | native | yes | TL, EM, JM, AM | Note: No occurrences found in study area. Consider deletion. TL. confirmed in adjacent reg… |
| *Mentha gracilis* | medium-low | 1 (1) | exotic | yes | TL, AS | Note: Synonym = M. arvensis? TL; if considered synonymous with M. arvensis then this likel… |
| *Potamogeton foliosus* | medium-low | 1 (1) | native | yes | TL, EM | Plausible, found on San Juans, but no records since 1992 for Saanich. (EM) |
| *Potamogeton pusillus* | medium-low | 1 (1) | native | yes | TL, EM | Retain binomial; alternate infrataxon recognized as a species in its own right on this lis… |
| *Potamogeton zosteriformis* | medium-low | 1 (1) | native | yes | TL, EM | Plausible, found on San Juans, but no records since 1988 for Saanich.  (EM) |
| *Puccinellia distans* | medium-low | 3 (1) | exotic | yes | EM | iNat obs not convincing, but I'm not a grass expert (EM) |
| *Pyrola dentata* | medium-low | 1 (1) | native | yes | TL, EM | Note: LEA = University of Lethbridge Herbarium. Possible, given research grade obs on othe… |
| *Solanum triflorum* | medium-low | 1 (1) | exotic | yes | EM | consider removing? No records aside from the original flora. (EM) |
| *Spinulum annotinum* | medium-low | 1 (1) | native | yes | EM | Plausible that it occurred in region at some point. Not appearing since (EM). |
| *Trautvetteria caroliniensis* | medium-low | 2 (1) | native | yes | EM | Seemingly in region, iNat obs not convincing, but distinctive taxon. (EM) |
| *Triglochin scilloides* | medium-low | 1 (1) | native | yes | TL, RAM | Note: FSP = Flora of the Saanich Peninsula.  Under Synonym Lilaea scilloides. Not recollec… |
| *Utricularia minor* | medium-low | 1 (1) | native | yes | TL | Note: SFSBC = Supplement to 'Flora of Southern British Columbia' (J.K. Henry 1915) by J.W.… |
| *Vulpia octoflora* | medium-low | 1 (1) | native | yes | TL, EM | Note: Found under Festuca octoflora, synonym of Vulpia octoflora. TL. Potential sighting i… |
| *Epilobium hornemannii ssp. hornemannii* | low | NA (NA) | native | yes | TL, EM |  |

### Flagged but not yet complete

| Taxon | Confidence | Records (RG) | Status | BC ref | Reviewed by | Comment |
|---|---|---|---|---|---|---|
| *Cotoneaster salicifolius* | medium-low | 94 (21) | exotic | yes | EM | Assign to Cotoneaster spp.? Planted or persisting? (EM) |
| *Luzula multiflora* | high | 24 (21) | native | yes | TL, Automatic (EM), JM | retain binomial (EM); probably misapplied as it used to be a catch-all; probably refers to… |
| *Petasites japonicus* | medium-high | 34 (18) | exotic | yes | EM | Unsure whether planted or established (EM). I've only seen it where planted (JM). |
| *Ulmus procera* | medium-low | 152 (18) | exotic | no | EM |  |
| *Alchemilla mollis* | medium-high | 36 (17) | exotic | yes | EM | Unsure whether established or waif or planted (EM) |
| *Dianthus barbatus ssp. barbatus* | medium-high | 27 (17) | exotic | yes | EM | planted or waif or established? (EM) |
| *Campanula poscharskyana* | medium-low | 57 (16) | exotic | no | EM | consider removing Not in FPNW or BC Flora. Likely planted or misidentified as another Camp… |
| *Elaeagnus umbellata* | medium-high | 19 (12) | exotic | yes | EM | Suspect that observations are all planted? (EM) |
| *Petasites hybridus* | medium-high | 20 (12) | exotic | yes | EM | Unsure whether planted or established (EM) |
| *Anemone apennina* | medium-low | 13 (7) | exotic | no | EM | consider removing. not in FPNW or BC Flora. Planted? (EM) |
| *Butomus umbellatus* | medium-low | 7 (7) | exotic | yes | EM | distinctive taxon, likely in region, but unsure whether established (EM) |
| *Ribes rubrum* | medium-high | 20 (6) | exotic | yes | JM, EM | Unclear whether non-established or established. Some observations maybe indiate escapee: h… |
| *Puccinellia lemmonii* | medium-low | 5 (5) | unknown | no | JM, KM, EM | ? |
| *Abutilon theophrasti* | medium-low | 4 (4) | exotic | yes | EM | Growing on disturbed roadside by Esquimalt Lagoon. Could be waif. Will get Frank to check.… |
| *Clinopodium vulgare* | medium-low | 4 (4) | exotic | yes | EM | Likely planted (EM) |
| *Hordeum pusillum* | medium-low | 4 (4) | native | no | TL, KM, JM, EM | Maybe misidentification of another Hordeum? Spikelets drop off and infloresence can look d… |
| *Anethum graveolens* | medium-high | 8 (4) | exotic | yes | EM | Unsure whether established or waif or planted (EM) |
| *Collomia linearis* | medium-high | 4 (4) | native | yes | TL, EM | Not seen since these records. (EM). Likely misidentified Microsteris gracilis? (EM) |
| *Spiraea japonica var. fortunei* | medium-low | 40 (4) | exotic | yes |  | not in FPNW but in BC Flora. Planted? (EM). |
| *Lupinus nanus* | medium-low | 3 (3) | native | yes | EM | Likely a misidentification of bicolor? (EM) |
| *Prunus hortulana* | medium-low | 3 (3) | unknown | no | EM | Single duplicated observation. Likely misidentification of another Prunus? Or planted (EM) |
| *Lathyrus pratensis* | medium-high | 2 (2) | exotic | yes | EM | Seen by FL, but likely not established as no observations since (EM). |
| *Schedonorus pratensis* | medium-high | 3 (2) | exotic | yes | TL, EM | Note: Found under synonym Festuca pratensis. TL. No convincing iNat obs and only one speci… |
| *Sedum stenopetalum* | medium-high | 2 (2) | native | yes | TL, EM | Only one record in catalogue (preserved specimen record duplicated on GBIF). Likely miside… |
| *Sisymbrium loeselii* | medium-high | 2 (2) | exotic | yes | TL, EM | Three records likely duplicates. Therefore only one record. Likely a misidentification? (E… |
| *Carex acutiformis* | low | 1 (1) | exotic | no | EM | Seems unlikely given distribution on iNat but there are vouchers. Perhaps it was introduce… |
| *Carex buxbaumii* | medium-low | 1 (1) | native | yes | TL, EM | Note: outside Saanich Flora range? TL. Only one iNat observation from Malahat (outside stu… |
| *Carpinus betulus* | medium-low | 1 (1) | exotic | yes | EM | not on FPNW, only BC Flora (EM). Perhaps persiting? Seems planted though (EM) |
| *Castilleja exserta var. exserta* | medium-low | 1 (1) | unknown | yes | EM | Seems unlikely (EM).  |
| *Eriophorum chamissonis* | medium-low | 1 (1) | native | yes | TL, EM | retain binomial. Only observation from 1897, no iNat obs in North America, consider deleti… |
| *Malva parviflora* | medium-low | 2 (1) | exotic | yes | TL, EM | Likely another Malva misidentified? (EM) |
| *Nuphar variegata* | medium-low | 1 (1) | native | yes | TL, EM | Note: FSP = Flora of the Saanich Peninsula A.F. Szczawinski and A.S. Harrison TL |
| *Polemonium micranthum* | medium-low | 1 (1) | native | yes | TL | Note: J.K. Henry's Flora of Southern British Columbia was published in 1915 by W.J. Gage &… |
| *Symphyotrichum lanceolatum var. hesperium* | medium-low | 1 (1) | native | yes | TL, EM | RBCM V177498 D. Calverley Bear Hills 1958. (TL); Symphyotrichum lanceolatum var. hesperium |
| *Symphyotrichum spathulatum* | medium-low | 1 (1) | native | yes | TL, EM | CMN Cat. No. 407469 C.H. Shaw Goldstream 1905. CMN = Carnegie Museum of Natural History, P… |
| *Botrypus virginianus* | medium-high | 1 (1) | native | yes | EM | Distinctive and plausible but only one historical obs without a date (EM) |
| *Corydalis flavula* | low | 1 (1) | exotic | no |  | consider removing. Not in FPNW or BC Flora |
| *Gaillardia aristata* | low | NA (NA) | native | yes | TL, KM, JM, EM | Seems doubtful as a native plant in our area but occurs in outwash prairie in the south Pu… |
| *Geranium purpureum* | low | NA (NA) | exotic | no | EM | No convincing iNat records. Nearest convincing/ research grade record from Seattle, so pos… |
| *Linum perenne* | low | NA (NA) | exotic | yes | TL, EM, JM, AM | Note: Collected by Frank Lomer (#5638 at UBC); originally ID'd L. lewisii.  Also seen Okan… |


## Summary

The suspicion that curation holds taxa back is right for the last stage. Taxa that are new to the list wait for review
and can't reach the site until someone completes it. Most of the earlier loss is real filtering, though.

**Where the ~4,000 names go.** The stages overlap, so the losses don't add up exactly:

| Stage | Taxa left | What removes names |
|---|---|---|
| Fusion, resolved at species level or below | 4,128 (3,805 at species level) | |
| Catalogue | 5,201 link names at all ranks | 2,207 link names have only **casual** iNaturalist records, mostly garden plants, and are dropped in step 2.1 |
| Catalogue names not yet on the list | 867 | 792 of them score "low" confidence and are never added. 441 have a single record, and 594 aren't on the BC reference list |
| Updated list | 1,646 rows | |
| Ultimate list and published summary | **1,106** | `ultimize_list()` passes only rows with both review and annotation "complete". **300 rows are waiting for review**, and 240 reviewed rows are flagged doubtful, persisting/waif or planted |

So 1,106 is essentially the reviewed set, not the observed set. A new name reaches the site without a reviewer only
when it scores "high" confidence. That needs all four of:
- a voucher or specimen;
- a place on the BC reference list;
- at least 10 records;
- under 75% of its iNaturalist records still needing ID.

**How the new taxa got in.** Two taxa joined and one left:
- ***Myriophyllum verticillatum*** was already on the list, reviewed by TL but still "remaining". It went from 5 to 10
  records, crossed the high-confidence threshold, and was **approved automatically** ("Automatic (EM)"). This is the
  only way in without a reviewer.
- ***Plectritis congesta* ssp. *congesta*** arrived with 15 records and scored high confidence straight away.
- ***Aphanes occidentalis*** left. iNaturalist has lumped it into *A. arvensis*, and the list merged it into that row.
  FPNW still keeps them separate, so **EM should decide** whether to accept the lump. If not, a key A2 entry would
  restore the old link.

**Could approval be straightforward?** The "~80" mentioned earlier were the 78 medium-high rows still "remaining".
The 300 rows waiting for review fall into these groups:
- **A (73):** not flagged, on the BC reference list, at least 2 research-grade records, medium-high confidence. These
  are one criterion short of automatic approval.
- **B (45):** the same, but medium-low confidence.
- **C (45):** not on the BC reference list, too few research-grade records, or annotation incomplete. These need a
  real reviewer.
- **In progress (97):** a reviewer has started, often with comments. Best left alone.
- **Flagged (40):** already marked doubtful, persisting/waif or planted, so they're excluded even once complete.

**Approving A and B would add about 118 taxa, taking the count from 1,106 to about 1,224 (+11%).** Group A alone would
add 73. 77 of the 118 are exotic, so the real question for each is whether it's a garden escape or an established
population. EM could go through A and B as one batch rather than one name at a time.

That's a noticeable gain, but much smaller than the 4,000 → 1,100 gap. Most of that gap is cultivated, casual-only
plants and single unvouchered records, which the workflow drops on purpose.

## Group A before the update

Applying the same rules to the 20 August updated list gives **47 taxa in group A**, compared with 73 now.

| Group | 20 Aug | 15 Nov |
|---|---|---|
| **A** | **47** | **73** |
| B | 33 | 45 |
| C | 21 | 45 |
| In progress | 97 | 97 |
| Flagged | 40 | 40 |
| Complete and not flagged, so on the site | 1,105 | 1,106 |

**What happened to the 47 August group-A taxa:**
- 42 are still in group A.
- One was approved: *Myriophyllum verticillatum*, the automatic approval described above.
- 4 have fallen to group B or C, because their research-grade record counts dropped:

| Taxon | Research-grade records, Aug → Nov |
|---|---|
| *Arrhenatherum elatius* ssp. *elatius* | 5 → 2 |
| *Salix alba* | 5 → 3 |
| *Cotoneaster* spp. | 3 → 1 |
| *Humulus lupulus* var. *neomexicanus* | 10 → 1 |

  The likeliest causes are a different deduplication, or records that iNaturalist has since moved to another taxon. The
  *Humulus* drop is big enough to be worth a look.

**Where the 73 November group-A taxa came from:**
- 42 were already in group A in August.
- 8 moved up from group B as they gained records.
- 23 are new names this run.

The review list has stayed exactly where it was: the 97 in-progress and 40 flagged rows are the same counts as in
August. Meanwhile group A has grown by half. On this evidence, the gap between observed and published taxa widens with
every data refresh unless rows get reviewed.

## Correction (2026-11-15): duplicated list records

The figures above were taken before a bug was fixed in checklist-catalogue-alignment-workflow, which duplicated
roughly 1,200 records by adding every first and last record annotated on the list to the catalogue, even where it
already held them - see that repository's notes/first-last-curate-bug.md. After the fix the ultimate catalogue holds
292,634 records and the list 1,105 taxa. **The one automatic approval described above, *Myriophyllum verticillatum*,
was an artefact of the bug**: 2 of its 10 records were duplicates, and at 8 it returns to awaiting review, among the
taxa of group A. So in this refresh no taxon at all was admitted to the site without a reviewer, apart from
*Plectritis congesta* ssp. *congesta*. The group counts above are otherwise little changed.

## The 333 rows that still shared an ID

After the first fix, a specimen should count once, and almost all of the 333 rows sharing an `occurrenceID` broke that
rule. They cover 166 IDs, listed in `333-duplicated-specimens.csv` beside this note, and fall into four kinds of case:

| Case | IDs | Rows | What's going on |
|---|---|---|---|
| **Same taxon, different date** | 135 | 270 | The list cites the specimen with a different date from the catalogue's. RBCM V199171 is 1993-04-23 in GBIF but 2021-05-31 on the list, and ALTA 134690 is 1973-05-10 against 1973-05-13. The rule required the same day, so these escaped |
| **The list cites one ID for several taxa** | 27 | 54 | Two different problems. Some are real double citations: CAN10091202 is the first record of both *Achnatherum nelsonii* and its ssp. *nelsonii*. Others aren't specimens at all: Szczawinski & Harrison records use page references such as `p. 78` as their ID, so unrelated records share it |
| **Species against its own infrataxon** | 3 | 7 | e.g. *Sagina maxima* on the list against ssp. *maxima* in GBIF, which also differ by date (2007-10-13 against 10-19) |
| **Synonyms** | 1 | 2 | *Viola nuttallii* var. *praemorsa* in GBIF against *Viola praemorsa* var. *praemorsa* on the list |

So the problem isn't that determinations differ. It's that the list's dates are often wrong or approximate, and the
matching trusted the date too much.

**A rule that gives one record per specimen:**
1. **Trust a real ID over the date and the name.** A non-iNaturalist record whose `occurrenceID`, or normalised
   catalogue number, is already in the catalogue is the same specimen, whatever the date or name. The list record isn't
   added.
2. **Let the curated determination win.** If the list cites that specimen under a different taxon, re-determine the
   catalogue's record to the list's taxon instead of adding a second record. The specimen then counts once, under the
   name the reviewers chose.
3. **Report conflicts instead of resolving them silently.** These go to a review file in `catalogues/raw/`:
   - the date disagreements, which are often transcription slips on the list;
   - the specimens the list cites for two taxa, such as a species and its infrataxon. One of the two list rows should
     cite something else.
4. **Treat literature citations as not unique.** `p. 78` isn't an ID. Records from the Szczawinski & Harrison flora
   match only on taxon and day.

One consequence: under rule 2, a taxon whose only evidence is a specimen the list also cites for another taxon would
still have that record. But for the double citations in rule 3, only one of the two taxa can keep it. Which one is the
curators' call, and the review file makes that visible.
