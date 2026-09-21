# GLB parity checklist (procedural three.js vs Blender GLB)

Compares the two rendering paths for the three madrasahs: the procedural builders
(`src/buildings/*.ts`, `src/patterns/textures.ts`) and the opt-in Blender GLB
(`tools/blender/build_registan.py` -> `public/models/registan.glb`, loaded via `?gltf`
by `src/buildings/gltf.ts`). Evidence: `docs/screenshots/verify-procedural.png` vs
`docs/screenshots/verify-gltf.png` (same camera, produced by `verify-gltf.mjs`).

Cost, headless software GL: procedural 646 draw calls / 126,244 tris; GLB 103 draw calls / 21,302 tris.
The GLB is ~6x cheaper, so parity is worth closing on looks alone. Sky, light, plaza, gardens,
pools and the figure are scene-level and shared by both paths; only the madrasahs differ.

Status key: OK = matches criterion, PART = partially, MISS = absent, n/a = not this path's job.

## A. `docs/benchmark.md` criteria

| # | Criterion | Procedural | GLB | Gap | Blender-side fix |
|---|---|---|---|---|---|
| 1 | Palette (buff-dominant, blue/turq/gold accents) | OK - buff walls, tiled bands/panels | PART - buff dominant but flat, only solid cobalt frieze/back-wall slabs, no tile detail | Reads as an unglazed clay model; accents lack pattern | `material()` + `COLORS`: keep spec hexes; another agent is adding tile textures now. Then UV-map niche surrounds, frieze and portal piers to the banna'i/girih atlas (bake in Blender: tile atlas + UV unwrap per face group) |
| 2 | Sky/light | OK (scene) | OK (scene, shared) | none | n/a - not in the GLB. Only check `material()` roughness (~0.85 buff, ~0.35 glaze) so the shared sun reads the same |
| 3 | Domes (fluted turquoise, tall drum, lapis band, finial) | OK - deep ribs, tall banded drum | PART - ribs shallow (`rib_amp=0.035`), drums short vs dome, profile hemispheric not onion | Silhouette #1 recognisable feature is weak | `dome()`: `rib_amp` 0.035 -> ~0.09, `under` 22deg -> ~35deg for an onion bulge; `MADRASAHS[*].domes[].drumTop` SD 3.0 -> 4.5, TK 4.0 -> 6.0; widen drum band (`cylinder(lapis, ...)` 0.7 -> 1.2) |
| 4 | Minarets (taper, girih bands, corbelled sharafa, flat top) | OK - banded girih, flared gallery | PART - taper OK, two thin cobalt bands, gallery corbel almost invisible, gold disc top | Read as plain buff posts | `build_madrasah()` minaret loop: corbel `cylinder(buff, ..., 0.72, 1.05, 0.6)` -> flare to 1.3 over 1.0 h with 2-3 stepped rings; gallery ring 1.1 -> 1.4; add 3-4 more banded `cylinder(cobalt/turquoise)` rings; height `h` 17 -> 19 so they clear the portal cornice |
| 5 | Portals (tall frame, pointed iwan, mosaic border, muqarnas) | OK - pointed arch, muqarnas, mosaic border | PART - pointed spandrel exists but cobalt spandrel + cobalt iwan back merge into one dark rectangle; no muqarnas; no border mosaic | Iwan arch shape not legible from the square | `spandrel()` colour: use `trim`/turquoise-bordered buff for the spandrel and keep `cobalt` for the back wall so the arch edge shows; add `pointed_arch()` band as a 0.25-wide `prism()` frame; muqarnas: bake in Blender (stepped half-vault array in the arch head, 3-4 rows) |
| 6 | Wings (2-storey niches, banna'i side walls, blue framing) | OK - textured niches, side girih | PART - 2-storey niches and frieze present; side/back walls blank buff | Side walls empty vs `sherdor_ulugbeg.jpg` | Side wings in `build_madrasah()` (`# side + back wings`): add recessed `box_yz` panel grid + turquoise band; large banna'i girih via texture atlas (bake in Blender: UV the side wall to the girih tile) |
| 7 | Plaza (paving, inlay, gardens) | OK (scene) | OK (scene, shared) | none | n/a |
| 8 | Smoothness (no glimmer, AA, 60fps) | PART - 646 calls, thin tile edges can shimmer | OK - 103 calls, flat colours cannot shimmer | GLB wins; risk returns once textures land | Keep single material per colour (`buckets`) after texturing; export with mipmapped textures, `scripts/optimize-glb.mjs` for draco/quantize |

## B. Per-madrasah points (`registan-accuracy-spec.md` section 1)

| Building | Point | Procedural | GLB | Gap | Blender-side fix |
|---|---|---|---|---|---|
| Ulugh Beg | Deep 56x81 plan | OK | OK (`TOTAL_DEPTH`=9, hollow court) | none | - |
| Ulugh Beg | 2 storeys, 3-4 bays/side | OK | OK (`bays=4`) | none | - |
| Ulugh Beg | Portal:wing ~2.0 | OK (15/7) | OK (15/7) | none | - |
| Ulugh Beg | 2 front minarets, taper, clear cornice | OK | PART - h=17 barely above 15 cornice | Not clearly taller | `minarets[].h` 17 -> 19 |
| Ulugh Beg | No front dome | OK | OK (`domes=[]`) | none | - |
| Ulugh Beg | Girih star medallions in spandrels | PART (texture) | MISS - flat cobalt | Spandrel identity lost | UV the `spandrel()` quads to a star-medallion tile (bake in Blender: decal plane per spandrel) |
| Sher-Dor | Mirror of Ulugh Beg massing | OK | OK | none | - |
| Sher-Dor | Muqarnas half-vault | OK | MISS | see A5 | bake in Blender: stepped muqarnas in iwan head |
| Sher-Dor | 2 ribbed domes on tall drums, above parapet | OK | PART - r=2.6 but drums short, hemispheric | Domes do not tower | `domes[].drumTop` 3.0 -> 4.5, `dome()` onion profile (A3) |
| Sher-Dor | Tiger-and-sun on both spandrels, mirrored | OK (texture) | MISS | The single most identifying feature | Decal: `spandrel()` -> two UV'd quads, mirrored U; tiger texture from `src/patterns/textures.ts` baked to PNG (bake in Blender: image texture on spandrel material) |
| Tilya-Kori | Widest facade | OK (26) | OK (`facadeLen=26`) | none | - |
| Tilya-Kori | 2 storeys, 7-9 bays/side | OK | OK (`bays=8`) | none | - |
| Tilya-Kori | Portal:wing ~1.6-1.8 (lower) | MISS (13/6 = 2.17) | OK (10.5/6 = 1.75) | GLB is ahead here | keep; procedural should adopt 1.75 too |
| Tilya-Kori | One big dome, left, tall drum | OK | PART - offset -9 correct, drum short, dome too close to portal cornice | Drum barely reads as cylinder | `domes[0].drumTop` 4.0 -> 6.0, `z` -4.0 -> -4.5 |
| Tilya-Kori | Corner guldasta turrets with caps | OK | OK (`turrets` +-14.1, r=0.9) | tiny caps | `dome(glaze, ..., r*0.95)` -> r*1.1 |
| Tilya-Kori | Heaviest gold, floral tympanum | OK (gold rosettes, glow) | PART - `goldTrim=True` gives gold trim strips only; no rosette; no lantern glow | Gilded read is weak | Gold rosette decal on tympanum (bake in Blender); emissive gold `material()` (`emission_strength` ~0.3) for trim; lantern glows stay in the three.js scene |

## C. Top 6 gaps to close before the GLB becomes the default

1. Tile textures on walls, niches, frieze and minaret bands (A1/A4/A6) - in progress by the texture agent; without them the GLB reads as clay.
2. Sher-Dor tiger-and-sun spandrel decals, mirrored (B Sher-Dor) plus Ulugh Beg star medallions and Tilya-Kori gold rosette.
3. Dome silhouette: onion profile, deeper ribs, taller drums (`dome()` rib_amp/under, `drumTop` on all three dome entries).
4. Portal legibility: separate spandrel colour from iwan back wall, add arch border band, muqarnas half-vault in the iwan head.
5. Minaret detail: taller shafts (h=19), pronounced corbelled sharafa, more banded rings.
6. Side/back walls: recessed panels and banna'i girih instead of blank buff.

Exit criterion: run `node verify-gltf.mjs` and judge the same views
(`docs/screenshots/verify-gltf.png` and the `bench.mjs` views pano/sherdor/tilyakori/sidewall/dome/minaret)
against the reference photos in `docs/refs/` (`panorama.jpg`, `sherdor.jpg`, `tilyakori.jpg`,
`sherdor_ulugbeg.jpg`). The GLB path is ready to become the default when it scores no worse than the
procedural path on every row of section A, wins on criterion 8, and shows no uncaught page error.
