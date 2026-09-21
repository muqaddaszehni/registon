# Blender pipeline: `build_registan.py`

Headless, parametric builder for the three Registan madrasahs. It produces
`public/models/registan.glb`, a Y-up glTF binary that drops into the three.js
scene at the world origin with **no extra transform** (same units and
placements as `src/buildings/*.ts`).

## Running

Either of these works (Blender 4.2):

```bash
# 1. bpy as a pip module  (pip install bpy==4.2.*)
python3 tools/blender/build_registan.py

# 2. Blender application, background mode
blender -b -P tools/blender/build_registan.py

# optional: override the output path
python3 tools/blender/build_registan.py -- /tmp/registan.glb
```

The script resets the scene to factory-empty, builds everything, exports with
`bpy.ops.export_scene.gltf(export_format='GLB', export_apply=True, export_yup=True)`
and prints object / vertex / face counts and the file size. It runs in well
under a second and the GLB is ~0.85 MB.

## What it produces

- Three empties, `UlughBeg`, `SherDor`, `TilyaKori`, carrying the world
  placement (Ulugh Beg x=-13.5 facing +X, Sher-Dor x=+13 facing -X,
  Tilya-Kori z=-12.5 facing +Z, ground y=0).
- Under each empty, **one mesh per material** named `<Madrasah>_<Material>`
  (e.g. `SherDor_Buff`, `SherDor_GlazeSD`). Geometry is accumulated into
  per-material buckets while building, so no join step is needed; the whole
  GLB is 23 meshes (23 draw calls) and ~17k triangles.
- Materials are plain Principled BSDF (base colour, roughness; metallic for
  gold; a faint emission on dome glaze) so they export cleanly to glTF
  `pbrMetallicRoughness`.

Per madrasah the geometry is:

| Part | Construction |
|---|---|
| Plinth | marble box, `facadeLen+1` x `totalDepth+1` x 0.3 |
| Front wing (2 segments) | buff box whose front face is recessed by `NICHE_DEPTH`; pilasters, base / storey / cornice bands and pointed-arch spandrel prisms are added at the true front plane, giving **2 storeys of pointed-arch niche recesses** with shadowed backs and a turquoise tympanum panel (no booleans needed) |
| Side + back wings | boxes at `0.87 * wingH`, leaving the courtyard hollow |
| Pishtaq | body box recessed by `IWAN_DEPTH`, two piers, cobalt pointed-arch spandrel, frieze block, cobalt iwan back wall, cornice cap |
| Minarets | tapered cylinder shaft with two cobalt bands, corbel cone, lapis gallery ring, lantern cylinder, flat gold top |
| Domes | darskhana block, tall tapered drum, lapis inscription band + turquoise band, **ribbed onion dome** (UV-sphere upper part with the centre lifted so the base ring is narrower than the bulge; ribs are a per-vertex radial modulation `1 + a*cos(ribs*theta)`), gold finial |
| Turrets (Tilya-Kori) | cylinder, lapis band, flared cap, small ribbed glaze dome |

## Coordinate handling

Everything is authored in each madrasah's local three.js frame
(x lateral, y up, +z toward the square) and converted to Blender Z-up as
`(x, -z, y)` when it enters a bucket. The root empties get
`location = (x, -z, 0)` and `rotation_euler.z = rotation.y` from the app.
The glTF exporter's `export_yup=True` converts back to Y-up.

## Parameters vs. the accuracy spec (`docs/research/registan-accuracy-spec.md`)

All tunables live in the `PARAMETERS` block at the top of the script.

| Parameter | Value | Spec reference |
|---|---|---|
| `COLORS` | golden-hour hex column of §2 (`Buff #D8C39A`, `BuffShadow #B49A6E`, `Cobalt #1B4C8C`, `Lapis #16306B`, `Turquoise #2BB6B6`, `GlazeSD #37BDB0`, `GlazeTK #34C6CC`, `Gold #C9A227`, `Marble #E3DBC8`) | §2 |
| `facadeLen`, `portal`, `wingH`, `minarets`, `world` | taken from `src/buildings/{ulughbeg,sherdor,tilyakori}.ts` so the GLB overlays the procedural model | app |
| Ulugh Beg / Sher-Dor portal ratio | 15 / 7 = 2.14 (spec wants ~2.0) | §1.1, §1.2 |
| Tilya-Kori portal height | **10.5** (not the app's 13) so 10.5 / 6 = 1.75 sits in the spec's 1.6-1.8 range | §1.3 |
| Ulugh Beg domes | none (flat-fronted, per spec) | §1.1 |
| Sher-Dor domes | 2 ribbed, `r=2.6`, `drumTop=3.0` above the wing roof, `z=-4.5` (behind the portal corners) | §1.2, §5.1 |
| Tilya-Kori dome | 1 ribbed, `r=3.8`, offset `-9` (viewer's left), `drumTop=4.0` tall cylindrical drum | §1.3, §5.1 |
| `bays` | 4 per front segment (UB/SD), 8 (TK), 2 storeys | §5.2 |
| `turrets` | Tilya-Kori corner guldasta at +-14.1, h 7, r 0.9 | §1.3 |
| `goldTrim` | Tilya-Kori uses gold for storey bands, portal strips and frieze; the others use cobalt | §1.3 |
| `TOTAL_DEPTH`, `WING_T` | 9.0 / 2.0 as in `madrasah.ts` | app |
| `NICHE_DEPTH`, `IWAN_DEPTH`, `DRUM_R_FACTOR`, `SEG` | 0.35 / 3.0 / 0.86 / 24 | tuning |

## Loading in the app

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
new GLTFLoader().load('/models/registan.glb', g => scene.add(g.scene));
```
