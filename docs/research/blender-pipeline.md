# Blender → glTF asset pipeline

Status: in progress. Procedural three.js geometry (`src/buildings/*`, `src/patterns/*`) stays
the default; the GLB path is opt-in via the `?gltf` URL flag until it reaches visual parity.

## Why

`docs/research/perf-quality-plan.md` measured the procedural scene (ortho ¾ overview, DPR 2):

| Metric | Measured | Target |
|---|---|---|
| Draw calls / frame | **3,460** | < 300–400 (mobile GPUs) |
| Shadow-casting meshes | ~1,400 | re-rendered into the shadow map every frame |
| Unique materials | **~1,000** (one-off `MeshLambertMaterial`s) | a handful, shared |
| Distinct canvas-texture VRAM | **~154 MB** at 1x LOD, ~400 MB+ at 2x | < 40 MB, compressed |

Merging by material inside three.js (perf-plan opt #1) gets draw calls to ~400–700, but it
fights the code every time a building changes, and canvas textures still can't be compressed.
Authoring the buildings in Blender gives us: one exporter pass that joins by material,
real UV-mapped tile atlases instead of per-face canvases, baked AO/lightmaps, and a file we
can compress offline (meshopt + WebP). The runtime becomes a single `GLTFLoader` call.

## Stages

```
tools/blender/build_registan.py   (bpy, parametric)   →  public/models/registan.glb
scripts/optimize-glb.mjs          (@gltf-transform)   →  public/models/registan.opt.glb
src/buildings/gltf.ts             (GLTFLoader, ?gltf) →  scene
```

1. **Parametric build in Blender/bpy.** `build_registan.py` builds the three madrasahs from
   the same dimensions as `docs/research/registan-accuracy-spec.md` (pishtaq, iwan, minarets,
   fluted domes on drums, arcade wings) and assigns a small set of named materials
   (`buff_brick`, `banna_i`, `mosaic_cobalt`, `mosaic_turquoise`, `gold`, `paving`). Tile
   patterns are UV atlases, not per-face images. Export: glTF Binary, +Y up, apply modifiers,
   materials + textures embedded, no animation, no cameras/lights.
2. **Optimize.** `optimize-glb.mjs` runs `dedup → prune → flatten → join → weld → quantize →
   meshopt` (EXT_meshopt_compression, `MeshoptEncoder`) and, if `sharp` is installed,
   `textureCompress` to WebP. It prints before/after byte size and mesh/primitive/material
   counts. `join` is what collapses draw calls: one primitive per material per scene.
3. **Load.** `src/buildings/gltf.ts` registers `DRACOLoader` (for any Draco-encoded asset)
   and `MeshoptDecoder`, loads `registan.opt.glb`, and swaps it in for the procedural
   madrasah groups when the URL contains `?gltf`. Everything else in the scene is unchanged.

## How to run

```bash
pip install bpy                     # or use a full Blender install
npm run model:build                 # python3 tools/blender/build_registan.py
#   alt: blender -b -P tools/blender/build_registan.py
npm run model:optimize              # node scripts/optimize-glb.mjs [in.glb] [out.glb]
npm run model                       # both
npm run dev                         # then open http://localhost:5173/?gltf
```

`model:optimize` exits non-zero with a clear message if `public/models/registan.glb` is
missing. WebP texture compression is skipped with a notice if `sharp` is not installed
(`npm i -D sharp` to enable it).

## Baked lightmap / AO (later)

- In Blender, add a second UV map `Lightmap` (Smart UV Project, no overlap, 2–4 px margin),
  select all madrasah objects, bake **Ambient Occlusion** (or Combined/Diffuse-indirect with
  the sunset sun rig) to one 2048² image per madrasah with Cycles, then save as PNG.
- Plug the baked image into each material via `Ambient Occlusion`/`Emission` sockets using
  the second UV map; the glTF exporter writes it as `occlusionTexture` on `TEXCOORD_1`.
- three.js `MeshStandardMaterial` picks up `aoMap` (uv2) automatically from `GLTFLoader`;
  set `aoMapIntensity` in `gltf.ts`. With AO baked, we can drop real-time shadows on the
  buildings (the ~1,400 shadow casters) and keep only the walker's contact shadow.

## Camera-matching the reference photos

The reference photos live in `docs/refs/` (`panorama.jpg`, `sherdor.jpg`, `tilyakori.jpg`,
`sherdor_ulugbeg.jpg`, plus `multiangle/`). To check proportions inside Blender:

1. Add a camera per photo. In Camera Properties → Background Images, load the photo
   (opacity ~50%, Front, fit to frame). Set the render resolution to the photo's pixels.
2. Set the focal length to match the photo. For commons photos the EXIF usually has it;
   otherwise start at 24–35 mm (35 mm sensor) for the fronts and ~18 mm for the panorama, and
   use the fSpy add-on to solve focal + position from two vanishing lines on the pishtaq frame.
3. Lock the camera to view (N panel → View → Lock Camera to View) and nudge until the pishtaq
   edges, drum base and minaret tops line up with the photo. Adjust model dimensions in
   `build_registan.py`, not the mesh, so the fix survives a rebuild.
4. Keep these cameras in the .blend (they are not exported); their transforms are the
   same views `bench.mjs` renders, so screenshots can be diffed against the photo.

## What does not change

- **LOD**: the GLB is one object per material; `gltf.ts` keeps the existing
  distance-based LOD switch by loading `registan.opt.glb` for near and (later) a
  `registan.lod1.glb` produced with `simplify()` for far. The 1x/2x texture LOD disappears
  because atlases are already mip-mapped compressed textures.
- **Hotspots**: hotspot positions are world-space coordinates in `src/hotspots`, not
  attached to procedural meshes; the Blender build uses the same origin and metre scale.
- **Walker grid / A\***: the tile grid and pathfinding are independent of building geometry;
  the GLB footprints match the existing blocked cells. Ground paving is still procedural.
- Audio, i18n, UI, post-processing: untouched.

## Retirement plan for procedural geometry

1. Reach parity on the eight criteria in `docs/benchmark.md` (palette dominance, daytime
   light, fluted domes on drums, corbelled minaret galleries, ogival iwans with muqarnas,
   two-storey arcade wings, plaza inlay, 60 fps no shimmer) with `?gltf` on, using the same
   `bench.mjs` views diffed against `docs/refs/`.
2. Flip the default so `?gltf` is on and `?procedural` selects the old path for one release.
3. Delete `src/buildings/{madrasah,sherdor,tilyakori,ulughbeg,lanterns,primitives}.ts` and
   `src/patterns/textures.ts`, drop the canvas-texture LOD code, remove the perf-plan
   opts that only existed to batch procedural meshes, and update the README credits
   (geometry is then Blender-authored, still no third-party assets).
