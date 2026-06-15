# Registan Accuracy Spec — Implementation-Ready Reference

Research lead deliverable for correcting the procedural 3D model. Calibrated against the reference photos in `.superpowers/refs/` and corroborated by web sources (Wikipedia, Archnet, Advantour, Central Asia Travel, Bayt Al Fann tile research). All hex values are tuned for the **golden-hour** look in `square-goldenhour.jpg` (warm low sun, slightly desaturated highlights).

> Site layout (viewer standing in the plaza, looking with the open square in front):
> - **Ulugh Beg** — WEST side (left), 1417–1420, oldest. Faces east into the square.
> - **Sher-Dor** — EAST side (right), 1619–1636. Mirror-image of Ulugh Beg by design. Faces west.
> - **Tilya-Kori** — NORTH side (back/center), 1646–1660. Faces south into the square. Widest, lowest portal, dominant dome on the LEFT.
>
> In the current model the orientation matches this (`ulughbeg.ts` at x=-13.5 facing +X, `sherdor.ts` at x=+13 facing -X, `tilyakori.ts` at z=-12.5 facing +Z). Good — do not swap them.

---

## 1. Per-Madrasa Facade Composition

### 1.1 Ulugh Beg (West) — the scholarly one

| Property | Real building | Notes for model |
|---|---|---|
| Plan | 56 × 81 m rectangle, 4-iwan, courtyard 30 × 40 m | Footprint should read clearly deeper than wide-of-facade; not a thin slab. |
| Facade storeys | **2 storeys** of arched hujra niches flanking the portal | Two tiers, each tier a row of pointed-arch niches. |
| Hujra bays (front wing, each side of portal) | ~**3–4 bays per side, per storey** (≈7 across the whole front facade counting both sides) | Model's `bayCount(segW)=Math.round(segW/3.0)` gives ~2 per side — **too few**; target 3 per side. |
| Total student cells | 50 hujras around the courtyard | Interior; only matters for courtyard arcades. |
| Portal (pishtaq) | "Twice the height of the rest of the building"; deep recessed pointed-arch iwan | **Portal-to-wing height ratio ≈ 2.0 : 1.** Current model: portal h=15, wingH=7 → ratio 2.14. Close — keep ~2.0. |
| Minarets | **2 visible at the front corners** (4 total at all plan corners, 33 m each); slightly tapering, lean slightly outward, cylindrical lantern + small dome cap at top | 2 front minarets is correct for the square-facing read. They should be **taller than the portal cornice** and clearly taper. |
| Domes | **No prominent turquoise dome over the front portal.** Two low domes over corner darskhanas, barely visible from the square. | **Do NOT give Ulugh Beg a big turquoise onion dome.** It is the flat-fronted one. Current model has no front dome — correct. |
| Distinctive features | Huge **girih star-burst medallions** on the portal spandrels (10- and 16-point stars); restrained, cooler palette; oldest/most weathered; the iwan tympanum is a star constellation, not figural. | Spandrel art = geometric stars, NOT tigers. |

### 1.2 Sher-Dor (East) — the mirror with tigers

| Property | Real building | Notes for model |
|---|---|---|
| Design intent | Deliberate **mirror image** of Ulugh Beg opposite it (built ~200 yrs later) | Same overall massing/scale as Ulugh Beg; facade should match its silhouette. |
| Facade storeys | **2 storeys** of arched hujra niches | Same as Ulugh Beg. |
| Hujra bays | ~3–4 per side per storey | Same fix as Ulugh Beg — current ~2/side is too few. |
| Portal | Tall recessed pointed-arch iwan with a **muqarnas (honeycomb) half-vault** in the arch head | Portal-to-wing ratio ≈ 2.0:1 (model: 15/7 = 2.14, ok). |
| Minarets | **2 front corner minarets**, tapering, lean outward, same family as Ulugh Beg | Correct in model. |
| Domes | **2 large RIBBED turquoise-blue domes** on **tall drums**, sitting directly behind the two portal corners (one each side). This is the signature double-dome read. | Current model: 2 ribbed domes, r=2.2, offset ±6.6, yLift 1.5 — right idea. **Make the drums taller and the domes bigger/more onion-bulbed** so they clearly rise above the portal parapet like in `sherdor-real-dome-behind-portal.jpeg`. Dome color = turquoise-green, ribbed. |
| Distinctive features | **Tiger-and-sun mosaic on BOTH portal spandrels (mirrored pair)** — see §3. Bold cobalt/turquoise banna'i; large girih on flanking panels. | The single most identifying feature. Must be on both spandrels, mirrored. |

### 1.3 Tilya-Kori (North) — the golden mosque

| Property | Real building | Notes for model |
|---|---|---|
| Role | Madrasa **+ congregational mosque**; closes the north side of the square | Widest of the three facades. |
| Facade width | **Widest** facade — long horizontal two-storey arcaded wings stretch well past the portal both ways | Model facadeLen=26 vs 18 for others — correct, keep it the widest. |
| Facade storeys | **2 storeys** of arched niches, long symmetrical run | Many more bays than the other two (it's wide). Target ~7–9 bays per side. |
| Portal | **Lower and wider** than Ulugh Beg / Sher-Dor portals; does NOT tower over the wings as dramatically | **Portal-to-wing ratio ≈ 1.6–1.8 : 1** (lower than the other two's ~2.0). Model: 13/6 = 2.17 — **too tall; lower the portal or raise wing read** to ~1.7. |
| Dome | **One large turquoise dome** on a **high cylindrical drum**, offset to the **viewer's LEFT** (over the mosque on the west end), NOT centered over the portal. Double-shell, ribbed-smooth bright turquoise; drum carries polychrome geometric/calligraphic bands. | Model: single dome r=3.8 at offset -9 (left) — **correct placement and dominance.** Keep it the biggest, brightest dome in the ensemble. Drum should be tall and clearly cylindrical. |
| Corner turrets | Small round **guldasta** towers with little turquoise dome caps at the facade ends (not full minarets) | Model has turrets at ±14.1 — correct. These are short, NOT towering minarets. |
| Distinctive features | **Heaviest GOLD** ("Tilya-Kori" = "gilded"); warm gold-and-turquoise palette; floral arabesque tympanum (no figures, no stars-as-dominant); kundal gold relief inside the mosque. | Warmest, most gold-accented of the three. Tympanum = gold rosette/floral. |

---

## 2. Color Guidance (hex, golden-hour calibrated)

Two columns: a **base/daylight** hex and a **golden-hour** variant (warmer, used when the low sun is lighting the facades as in `square-goldenhour.jpg`). Prefer the golden-hour column for the hero render; use base for tiles seen in shade.

| Material / element | Base hex | Golden-hour hex | Notes |
|---|---|---|---|
| Sandstone / buff brick (field) | `#D8C39A` | `#E6CFA0` | Warm tan, NOT grey. Current `C.sand=#ECDFC4` is too pale/cream — **darken & warm toward `#D8C39A`.** |
| Buff brick, shadowed | `#B49A6E` | `#C2A878` | For recessed niche backs. |
| **Cobalt blue** (deep tile field, calligraphy ground) | `#1B4C8C` | `#24579A` | The dark royal blue. Current `C.cobalt=#1E5FA8` is slightly too bright/cyan — pull toward `#1B4C8C`. |
| **Lapis / ultramarine** (darkest blue accents) | `#16306B` | `#1B3A78` | Deepest blue, calligraphy bands. Model `C.lapis=#16396E` ok. |
| **Turquoise** (wall tile accent, banna'i) | `#2BB6B6` | `#3FC6BE` | Mid turquoise. |
| **Cyan dome glaze** (the bright dome turquoise) | `#2FC4C8` | `#46D0CC` | The domes read **brighter and more cyan/green than the wall turquoise** — almost glowing at golden hour. Sher-Dor domes lean slightly greener (`#37BDB0`); Tilya-Kori dome is the purest bright cyan-turquoise (`#3CCCD0`). Give domes a faint emissive (already done: `emissiveIntensity ~0.14`). |
| Tilya-Kori dome (purest) | `#34C6CC` | `#4CD6D6` | Brightest single element in the ensemble. |
| **Gold** (finials, Tilya-Kori trim, sun rays) | `#C9A227` | `#E0B84A` | Warm metallic gold. Model `C.gold=#D9B545` is fine; for the tiger-sun rays push warmer/more saturated `#E0B84A`. |
| White (glaze highlights, doe, calligraphy text) | `#F2EBDA` | `#F7EFDC` | Slightly creamy white, never pure `#FFFFFF`. |
| **Marble dado / plinth / steps** | `#E3DBC8` | `#EFE4CE` | Warm grey-cream, NOT stark white. Model `C.marble=#E8E3D6` ok; warm very slightly. Dado at building base + entry steps. |
| Manganese/aubergine (rare outline accent) | `#5A3A52` | — | Thin dark purple-brown lines in some mosaics; use sparingly. |
| Yellow ochre (girih in-fill accent) | `#D9A441` | `#E6B45A` | Secondary tile color, esp. Ulugh Beg star medallions and Tilya-Kori. |

**Palette priority per madrasa:**
- Ulugh Beg — cooler: cobalt + turquoise + white + ochre stars on buff. Least gold.
- Sher-Dor — bold: strong cobalt field + turquoise + the gold/ochre tiger-sun. Ribbed turquoise domes brightest after Tilya-Kori.
- Tilya-Kori — warmest: gold + turquoise + cobalt; the gilded one.

---

## 3. The Sher-Dor Tiger-and-Sun Mosaic (faithful stylized render)

This appears **twice**, mirrored, one on each spandrel above the portal arch (the two triangular fields flanking the top of the pointed iwan). Reference: `tiger.jpg` (close-up), `sherdor.jpg`, `sherdor-portal2.jpg`.

**Composition (per spandrel):**
- A **tiger/lion hybrid** ("tigon"): muscular big cat, **orange-gold body (`#D89A3C` → `#E0B84A` highlights)** with **dark brown/black tiger stripes (`#5A3A1E`)** and a lion-like **mane** around the neck/shoulders. Mouth open, in mid-stride, **chasing/pouncing**.
- In front of/beneath the cat, a small **white fallow doe / deer** (`#F2EBDA`), fleeing, much smaller than the cat, legs extended in flight.
- Rising **on/behind the tiger's back**: a **human-faced sun** — a golden disc (`#E0B84A`) with a **round human face** (pale, calm features) at its center and **straight golden rays** radiating outward. The sun reads as "rising over its back."
- **Ground:** deep **cobalt-blue field (`#1B4C8C`)** densely filled with **swirling white/turquoise/gold floral arabesque** (vine scrolls, blossoms).
- **Framing:** the spandrel is bordered by **white Kufic/thuluth calligraphy bands on cobalt** (top and along the arch curve), plus thin turquoise geometric edge strips.

**Mirroring:** left spandrel and right spandrel are mirror images — the two tigers face **inward toward the portal arch** (toward each other across the iwan), suns on their outer/upper sides.

**Stylization tips:** This is flat tile mosaic, not a 3D relief — render as a textured quad on the spandrel, slightly stylized/iconic is fine and historically appropriate (it later became the basis of Uzbekistan's emblem). Keep the cat clearly feline + striped + gold, the doe clearly small + white, the sun clearly a face-in-a-disc with rays. Do NOT render anatomically realistic; keep it mosaic-flat and emblematic.

---

## 4. Girih / Banna'i / Calligraphy Motif Notes

| Technique | What it is | Where it appears | Render note |
|---|---|---|---|
| **Girih (tile mosaic)** | Star-and-polygon geometric line patterns built from a few tile shapes | **Portal spandrels & flanking panels.** Ulugh Beg: large **10- and 16-point star** burst medallions dominate its spandrels. Sher-Dor: girih on the panels flanking the tiger spandrels. | Use a small set of repeating star nodes; 10/16-pt stars for the big medallions, smaller 8-pt fills around them. |
| **Banna'i (brick-into-tile)** | Geometric patterns spelled out by alternating glazed (turquoise/cobalt) brick with plain buff brick — including square-Kufic words | **Minaret shafts, side/back exterior walls, hujra niche surrounds.** See `minarets.jpg`, `tilework.jpg`. | Coarser/blockier than girih — strapwork diamonds, frets, swastika-meander, and **square-Kufic** repeats of "Allah"/"Muhammad". Buff brick must remain visible between the glazed bits (70/30 buff/blue economy). |
| **Square Kufic (banna'i script)** | Angular brick calligraphy reading as geometric blocks | Minaret bands, wall friezes | Reads as a fret/maze motif; do not make it cursive. |
| **Thuluth / cursive Kufic (tile)** | Flowing white-on-cobalt inscription bands | **Horizontal frieze across the top of each portal**, around the iwan arch, and the rectangular calligraphy cartouches. | White (`#F2EBDA`) script on cobalt (`#1B4C8C`) ground, thin turquoise border. |
| **Muqarnas** | 3D honeycomb stalactite vaulting | **Inside the head of each portal iwan**, and minaret cornices/lanterns | Sher-Dor & Ulugh Beg both have muqarnas iwan half-vaults. At least suggest the stepped honeycomb in the arch head. |
| **Floral arabesque** | Vine/blossom scrollwork | Tilya-Kori tympanum (gold rosette), the cobalt ground behind the tigers, dome drums | Tilya-Kori's signature instead of figural/star-dominant art. |

---

## 5. TOP 10 Inaccuracies (prioritized) + Fixes

Ordered by visual impact on recognizability.

1. **Dome silhouette too small / drums too short (Sher-Dor & Tilya-Kori).** The domes are the #1 recognizable feature and in the refs they tower on tall drums. **Fix:** raise drum height (Sher-Dor `yLift` ~3–4, enlarge r to ~2.6–3.0; Tilya-Kori keep r≈3.8 but tall cylindrical drum and bulbed onion profile). Make the dome bulge wider than its drum (onion, not hemisphere).

2. **Too few hujra bays per facade.** `bayCount(len)=round(len/3.0)` yields ~2 bays per front segment → reads as a near-blank wall. Real facades have a dense rhythm of pointed-arch niches in 2 storeys. **Fix:** ~3–4 bays per side for Ulugh Beg/Sher-Dor, ~7–9 per side for Tilya-Kori; ensure **2 visible storeys** of niches (stacked tiers), not one.

3. **Buff/sand color too pale and cool.** `C.sand=#ECDFC4` reads as cream/grey. Real brick is a warm tan that glows amber at golden hour. **Fix:** `#D8C39A` base, `#E6CFA0` golden-hour.

4. **Cobalt too bright/cyan; not enough tonal range in blues.** Single `#1E5FA8` flattens the tilework. **Fix:** deepen field cobalt to `#1B4C8C`, reserve brighter cyan `#2FC4C8`/`#46D0CC` for **domes only**, lapis `#16306B` for darkest accents. The dome must read distinctly brighter/greener than wall tiles.

5. **Tiger-sun mosaic missing, single, or unclear.** If absent or only on one spandrel, Sher-Dor is unidentifiable. **Fix:** textured tiger-and-sun quad on **both** spandrels, mirrored, facing inward — gold striped cat + small white doe + human-faced rayed sun on cobalt floral ground (see §3).

6. **Portal-to-wing height ratios uniform across all three.** All three currently ~2.1:1. Tilya-Kori's portal should be **lower** (~1.7:1) and Tilya-Kori the widest. **Fix:** lower Tilya-Kori portal (h 13→~11 or raise wing read), keep Ulugh Beg/Sher-Dor near 2.0.

7. **Minarets not tapering / not leaning / no lantern cap.** Real minarets visibly taper upward, lean slightly outward, and end in a cylindrical **lantern + small dome cap**. **Fix:** taper the cylinder (top radius ~0.6× base), add a small ringed lantern + cap finial, lean outer minarets ~2–3° outward.

8. **Ulugh Beg wrongly given a prominent dome, or spandrels given figural/wrong art.** Ulugh Beg has **no square-facing onion dome** and its spandrels are **geometric stars**, not tigers. **Fix:** keep it flat-fronted; ensure its tympanum/spandrels are 10/16-pt **girih star** medallions, cooler palette, least gold.

9. **Insufficient gold on Tilya-Kori / not the warmest.** The "gilded" madrasa should be visibly the most gold. **Fix:** gold trim bands on arcades and tympanum (`#E0B84A`), warm overall tone; floral gold rosette tympanum (not stars, not figures).

10. **Marble dado/plinth too white & banna'i missing on shafts/side walls.** Plinths read stark; minaret shafts and side/back walls should carry **banna'i brick patterns** (diamonds, frets, square-Kufic), not plain stone. **Fix:** warm the marble to `#E3DBC8`/`#EFE4CE`; apply banna'i strapwork texture to minaret shafts, turret shafts, and exterior side/back walls (buff brick must show through ~70%).

---

### Source notes
Reference photos: `.superpowers/refs/{square-goldenhour, wide, ulughbeg-portal, sherdor, sherdor-portal2, sherdor-real-dome-behind-portal, sherdor-side-wall, tilyakori-facade, tiger, tilework, minarets}`. Web corroboration: Wikipedia (Ulugh Beg Madrasa, Sher-Dor Madrasa, Tilya Kori Madrasa, Banna'i, Registan), Advantour, Central Asia Travel, Bayt Al Fann tile research, Archnet. Dimensions cross-checked: Ulugh Beg 56×81 m, courtyard 30×40 m, 50 hujras, 33 m minarets, portal ≈2× wing height; Sher-Dor 1619–1636 mirror of Ulugh Beg with ribbed turquoise twin domes; Tilya-Kori 1646–1660, widest facade, single dominant left-offset turquoise dome on high drum, heaviest gold.
