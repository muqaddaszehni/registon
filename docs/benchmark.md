# Registan render benchmark (target = Wikipedia photos)

Goal: a smooth, glimmer-free 3D render as close as possible to the real Registan
photographs. Each loop renders the benchmark views (`bench.mjs`) and compares
them to the reference photos in `docs/refs/`; fix the biggest gap, repeat until
converged.

## Reference photos (`docs/refs/`)
- `panorama.jpg` — the U-shaped plaza: Ulugh Beg (left), Tilya-Kori (centre-back, ribbed dome), Sher-Dor (right). Source: commons `Registan square Samarkand.jpg`.
- `sherdor.jpg` — Sher-Dor front: tiger+sun spandrels, tall pointed iwan, 2 minarets, 2 ribbed domes. Source: `Sher-Dor Madrasa 02.jpg`.
- `tilyakori.jpg` — Tilya-Kori front: symmetric 2-storey arcades, gold rosettes, ribbed dome, corner cupolas. Source: `Tilya-Kori Madrasa 01.jpg`.
- `sherdor_ulugbeg.jpg` — side wall: giant banna'i girih, round corner tower, dome. Source: `…Sher-Dor … Ulugh Beg, left side….jpg`.

## Benchmark criteria (the goal)
1. **Palette** — warm BUFF/sand brick is the DOMINANT colour (~50–60% of pixels);
   cobalt + turquoise + white + gold are mosaic ACCENTS (not the majority). The
   render must not read as predominantly blue/purple.
2. **Sky/light** — bright, clear-ish DAYTIME: pale-to-clear blue sky, warm-neutral
   sunlight, soft shadows. Not a purple/amber sunset.
3. **Domes** — all melon-FLUTED (ribbed) turquoise on TALL cylindrical drums with a
   dark-blue kufic band at the drum base; small gold finial.
4. **Minarets** — tall, slender, gently tapering; banded girih tilework; a flared
   CORBELLED gallery (sharafa) near the top, then a flat lantern top (no cone/dome).
5. **Portals (pishtaq)** — tall rectangular frame; deep, tall POINTED (ogival) iwan;
   geometric+floral mosaic border; muqarnas half-vault; Sher-Dor tiger+sun in the
   spandrels; Tilya-Kori gold rosettes.
6. **Wings** — long two-storey arcades of pointed-arch niches; side walls carry a
   large-scale banna'i girih pattern; buff-dominant with blue tile framing.
7. **Plaza** — warm grey-tan stone paving with radial/geometric inlay; gardens.
8. **Smoothness** — no glimmer/shimmer on rotation, clean AA, solid 60fps.

## Benchmark views (`bench.mjs`) ↔ reference
- `pano` ↔ panorama.jpg · `sherdor` ↔ sherdor.jpg · `tilyakori` ↔ tilyakori.jpg
- `sidewall` ↔ sherdor_ulugbeg.jpg · `dome`, `minaret` ↔ close detail
