# Registon — Performance & Quality Optimization Plan

Read-only audit, 2026-06-15. Measured live on the dev server (`:5173`) via Playwright +
a temporary `window.__renderer` / `window.__composer` hook in `src/main.ts` that was
**reverted with `git checkout src/main.ts`** immediately after measuring (nothing committed).

The scene is genuinely gorgeous and reads correctly from every angle — the problem is
purely cost. Headless rAF fps collapsed to ~1.4 during a heavy probe; the root cause is
**draw-call count**, not triangle count.

---

## 1. Measured numbers (real scene, ortho ¾ overview, pixelRatio 2)

The source was being actively edited by other swarm agents during the audit, so two
snapshots were taken. Both tell the same story; the second is the latest.

| Metric | Snapshot A | Snapshot B (latest) | Notes |
|---|---|---|---|
| **Draw calls / frame** | 3092 | **3460** | THE bottleneck. Mobile GPUs want < ~300–400. |
| Triangles / frame | 169,975 | 202,887 | Includes the shadow pass re-draw. Fine on its own. |
| GPU geometries | 1307 | **1491** | One unique buffer per mesh — **zero geometry reuse**. |
| GPU textures | 75 | 78 | — |
| Scene meshes | 1303 | ~1491 | — |
| Shadow-casting meshes | 1225 | ~1400 | Each one is re-rendered into the shadow map every frame → roughly doubles draw calls. |
| Unique materials | 874 | ~1000 | Most are one-off `MeshLambertMaterial` instances; defeats batching. |
| Distinct texture VRAM | 137.8 MB | **153.8 MB** | At base (1x) LOD. Doubles toward ~400 MB+ when 2x LOD kicks in on zoom. |
| `maxTextureSize` (this GPU) | 8192 | 8192 | Low-end phones report 2048–4096. |

**Mesh distribution (latest):** the three madrasas are **459 + 447 + 361 = 1267 meshes
≈ 85% of the whole scene.** Everything else (trees, gardens, doves, hero, ground,
minarets, motes) is the remaining ~15%.

**Draw-call math:** ~1491 opaque meshes (colour pass) + ~1400 shadow casters (shadow
pass) + bloom/output passes ≈ 3460 calls. The shadow pass is ~40% of the cost.

### Texture VRAM histogram (distinct canvas images, latest)

| Size | Count | Each (≈, RGBA+mips) | Subtotal | Source |
|---|---|---|---|---|
| 2048×1610 | 1 | ~17 MB | 17 MB | ground paving (`scene/ground.ts`, `BASE_W=2048`) |
| 1024×1920 | 2 | ~10 MB | 20 MB | UB + SD portal faces (`portalTexture`) |
| 1024×1664 | 1 | ~9 MB | 9 MB | TK portal face |
| 768×1024 | 3 | ~4 MB | 12 MB | iwan back walls (`iwanTexture`), one per madrasa |
| 1024×1024 | 8 | ~5.5 MB | 44 MB | banna'i / brickWall / pylon / girih fields |
| 1024×256 | 27 | ~1.4 MB | 38 MB | calligraphy + drum bands (cloned per face) |
| 512×1024 | 4 | ~2.7 MB | 11 MB | minaret shafts |
| others | ~12 | — | ~3 MB | arch panels, rope, etc. |

The big VRAM risk is **LOD 2x**: every `priority:true` entry re-rasterizes to **2× canvas
dimensions → 4× the bytes**. The ground alone goes 2048×1610 → 4096×3220 (~68 MB), and
the three 1024×~1800 portals go to 2048×~3600 (~30 MB each). A mid-range phone with a
2048 `maxTextureSize` **cannot even allocate** the 2x ground/portal textures.

> Mitigation already present and correct: `src/main.ts:77-82` gates 2x LOD off when
> `maxTextureSize < 4096` or the screen is small. Keep this. See opt #6 to tighten it.

---

## 2. Ranked optimizations (effort vs. gain)

Ordering is by gain-per-effort. #1–#3 are the ones that move the 60 fps needle on a phone.

### #1 — Merge each madrasa's static set-dressing by material (HIGHEST GAIN)
**Effort: M. Gain: very high (drives draw calls from ~3460 → an estimated ~400–700).**

The 1267 madrasa meshes are almost all static and share a small set of materials
(`C.sand`, `C.cobalt`, `C.marble`, `C.gold`, `C.turquoise`, the banna'i field, the
near-black niche back, the mid-shadow return). Group every static sub-mesh of a madrasa
by material and merge with `BufferGeometryUtils.mergeGeometries`, then emit **one mesh per
material** (after baking each child's local transform into its geometry via
`geometry.clone().applyMatrix4(child.matrixWorld)`).

- Where: wrap the output of `madrasah()` in `src/buildings/madrasah.ts:31-325`. A clean
  approach is a post-process pass that walks `g`, buckets `Mesh`es by
  `material.uuid` (and by whether `castShadow`), bakes transforms, merges, and returns a
  slim group. The dynamic/animated parts (none in a madrasa — it is fully static) stay
  untouched.
- Why it's safe for the look: merging by material produces **pixel-identical output** —
  same geometry, same materials, same positions. Only the draw-call count changes.
- Caveats: (a) multi-material meshes (`patternedBoxMulti`, the arch screens with
  `[frontMat, sideMat]`) need per-group splitting by material index, or keep those as-is
  and merge only the single-material majority — even merging just the single-material
  meshes (pilasters, returns, sills, back walls, niche surrounds, dado, steps, drums,
  collars) removes the bulk of the count. (b) Merged geometry loses per-mesh frustum
  culling, which is irrelevant here (the whole madrasa is almost always on-screen).
- The recessed-hujra arcade is the single biggest contributor. Per
  `recessedHujraFace` (`src/buildings/primitives.ts:894+`) each call emits, per bay:
  2 screen storeys + back wall + 2 returns×2 storeys + sills + (bays+1) pilasters +
  pilaster accents + 2 arch outlines×storeys + cornice + trims. With ~16 hujra faces
  across the three madrasas this is most of the 1267. Merging these per material is the
  win.

### #2 — Instance the repeated niche / pilaster / return geometry
**Effort: M–H. Gain: high (complements #1; best for the per-bay repeats).**

Within a hujra face, every bay repeats the same pilaster box, the same return planes, the
same arch-outline extrusion, the same sill. These are ideal for `THREE.InstancedMesh`
(one geometry, one material, N transforms). Same for the dome **lantern-niche ring**
(`primitives.ts:455-480`, 12–16 identical surround+inner boxes per dome) and the
**minaret corbel rings**.

- Combine with #1: instancing handles the in-face repeats; merging handles cross-face
  unification. Either one alone gets most of the gain; do #1 first (simpler, fully
  transparent), then instance the obvious repeats if still over budget.
- Safe for the look: instances render identically.

### #3 — Halve the shadow cost
**Effort: S. Gain: high (shadow pass is ~40% of draw calls).**

`src/scene/lights.ts:8-13`: single `DirectionalLight`, `shadow.mapSize 1024`,
`shadow.intensity 0.65`, 1225+ casters.
- **Stop most small props from casting shadows.** `shadowed()`
  (`primitives.ts:9-12`) blanket-sets `castShadow=true` on *every* mesh it touches,
  including pilaster accents, arch-outline rings, niche inner faces, finials, crescents,
  bosses, frieze strips — none of which cast a meaningful shadow. Restrict casters to the
  big silhouette pieces (wings, portal block, minaret shafts, domes, drums, plinths).
  Halving casters roughly halves the shadow pass. **This alone could drop ~600–800 draw
  calls.**
- On the mobile tier, drop `shadow.mapSize` to 512 (already small at 1024; combined with
  fewer casters the quality hit is invisible at phone DPI).

### #4 — Reuse geometry across the 3 madrasas and across props
**Effort: S–M. Gain: medium (VRAM + upload + GC, less so raw fps).**

1491 unique geometries with **zero sharing**. The three madrasas are built from the same
primitives at the same sizes for many parts; trees rebuild identical cones/spheres per
instance (`ambience/trees.ts` makes fresh `ConeGeometry`/`SphereGeometry` every call).
- Cache primitive geometries in module-level constants (`const CONE = new ConeGeometry(...)`)
  and reuse. Trees, gardens (`gardens.ts` rebuilds bench/border boxes), doves
  (`makePigeon` rebuilds spheres per bird) are easy wins.
- Pairs naturally with the InstancedMesh work in #2.

### #5 — Cap / share textures, and shrink the banded textures
**Effort: S. Gain: medium (VRAM headroom, fewer GPU uploads, smaller 2x spike).**

- **27× 1024×256 calligraphy/drum band textures** (~38 MB) are clones that should share a
  single GPU upload. They already share a source canvas via `textureRegistry.addTexture`,
  but each clone is a separate `CanvasTexture` → separate GPU texture. Where the repeat
  settings match, reuse one texture object instead of cloning. Even where repeats differ,
  a 1024-wide band is overkill — 512 wide is plenty for a tiling strip (halves that 38 MB).
- **Add a hard texture-size cap by tier.** On the mobile tier, clamp every canvas to
  ≤ 1024 on its long edge before upload (portals 1024×1920 → 1024×1024 or 768×1440). The
  detail is invisible at phone DPI and it keeps you under a 2048 `maxTextureSize`.
- The 2048×1610 ground is fine on desktop; cap to 1024-wide on the mobile tier.

### #6 — Formalize a mobile capability tier
**Effort: S. Gain: medium (correctness/headroom on real phones).**

There is already a good gate (`main.ts:77-82`) and a pixelRatio clamp (`min(dpr, 2.0)`).
Extend it into one explicit tier object resolved at boot:

```
tier = (maxTextureSize < 4096 || small-screen) ? 'mobile' : 'desktop'
mobile ⇒ pixelRatio cap 1.5 (not 2.0), shadow.mapSize 512, fewer casters (#3),
         LOD 2x disabled (already), texture long-edge cap 1024 (#5), bloom optional (#7)
```

`renderer.capabilities.maxTextureSize` and `devicePixelRatio` are the right signals; you
are already reading both. This is mostly wiring, not new logic.

### #7 — Post-processing: make bloom tier-gated
**Effort: S. Gain: low–medium on mobile.**

`src/scene/post.ts`: `RenderPass → UnrealBloomPass → OutputPass`. UnrealBloom is a
multi-pass (bright-pass + 5 blur mip levels + composite) full-screen effect — meaningful
on a phone fragment budget at pixelRatio 2. Bloom strength is already low (0.20).
- On the mobile tier, either drop bloom entirely (the emissive turquoise/gold already
  reads well without it) or run it at half-resolution. Keep it on desktop — it looks great.
- Lower-priority than #1–#3; bloom is fill-rate, and draw calls are the current ceiling.

### #8 — Fog is essentially free — keep it
`scene.fog = FogExp2(..., 0.003)` (`lights.ts:36`) is a cheap shader term, not a pass.
No action; it helps the look. Listed only to close the loop on the brief.

---

## 3. Visual quality bugs / risks found

Screenshots captured to `/tmp/perfshots/` (overview, rear, UB close-up, ground). The
scene is largely clean; issues found:

1. **Floating red sphere over the courtyard** (visible in `v-rear.png` and earlier
   `shot-ov2`). A small red/pink sphere hovers mid-air (~5–7 units up) near plaza centre,
   untethered to any building. Altitude matches the dove flock orbit
   (`ambience/doves.ts:22-24`, ~5–9 units), but doves are buff/grey, not red — so the
   culprit is more likely a stray pink-blossom canopy puff
   (`ambience/trees.ts:112` `pinkMid 0xd0607a`) placed without a trunk, a leaf particle,
   or a misplaced marker. **Action: identify and re-anchor or remove.** File:line
   unconfirmed — start at `ambience/doves.ts` and `ambience/trees.ts`.

2. **Blank/featureless upper-back exterior slabs.** From the rear (`v-rear.png`), the
   tops of the back/side wings above the arcade band read as flat cream slabs with no
   tile or relief, contrasting with the rich front. Cosmetic, not a glitch — but if the
   camera can orbit behind (it can, via the rotate button), consider a brick/banna'i map
   on the upper exterior. Source: the structural boxes in `madrasah.ts:203-211`
   (back wing) and `:162-197` (side wings) leave upper faces plain `C.sand`.

3. **Coplanar-overlay z-fighting risk (mitigated, watch on mobile).** Several surfaces
   sit microscopically above their base and rely on `polygonOffset` or small y-lifts:
   courtyard floor `polygonOffset -2/-2` at y=0.08 (`madrasah.ts:229-237`); hotspot
   markers `polygonOffset` at y=0.08 (`hotspots.ts:15-21`); the proud-arcade `PROUD=0.06`
   layering (`primitives.ts`). These read clean at desktop precision in the screenshots,
   but `polygonOffset` behaves differently across mobile GPUs (lower depth precision).
   **Watch for shimmer on the courtyard floor and ground markers on a real phone;** if it
   appears, increase the physical y-gap rather than leaning on polygonOffset.

4. **Muddy/dark side-wall lattice (minor).** The green diagonal-lattice exterior on the
   side/back walls reads slightly cool/muddy against the warm golden-hour palette in the
   overview. Aesthetic judgement call, not a bug.

> **No z-fighting, gaps, or floating geometry were visible on the building bodies
> themselves** — the portals, domes, minarets, arcades, and plaza inlay all read clean and
> correctly aligned from every captured angle.

---

## 4. Transient build error observed during audit (now resolved — log only)

While other swarm agents were live-editing, a fresh render briefly threw
`ReferenceError: storyH is not defined` from `recessedHujraFace`
(`src/buildings/primitives.ts`, the `// 4. NICHE SIDE WALLS` block). At that moment
`SPRING_FRAC` had become an array `[..]` and `storyH` was referenced outside its `for`-loop
scope. A concurrent agent **fixed it during the audit** — the current disk version declares
`const storyH = storyHs[s]` and `const returnH = SPRING_FRAC[s] * storyH` inside the loop,
and a clean full page load now builds **1491 meshes with zero errors**. No action needed;
recorded only because it would have crashed all three madrasas had it shipped. Re-verify on
the final merged source.

---

## 5. Suggested execution order for the controller

1. **#3 (shadow casters)** — smallest diff, immediately drops ~600–800 draw calls, zero
   visual change. Do first to de-risk.
2. **#1 (merge madrasa static geometry by material)** — the big structural win
   (~3460 → ~400–700 draw calls). This is what makes a phone hit 60 fps.
3. **#6 (mobile tier object)** + **#5 (texture caps)** — protect low-`maxTextureSize`
   phones from the 2x-LOD VRAM blowout.
4. **#2 (instancing)** and **#4 (geometry reuse)** — only if still over budget after #1.
5. **#7 (tier-gated bloom)** — last; fill-rate polish, not the bottleneck.
6. Fix the **floating red sphere** (visual bug #1) whenever convenient — it is the only
   clearly-wrong thing on screen.

**Success criterion:** re-run the same Playwright probe; target `< ~600` draw calls and
`< ~120 MB` base texture VRAM on the desktop measurement, and confirm the mobile tier
allocates under a 2048 `maxTextureSize` with 2x LOD off. The look must remain
pixel-equivalent in the overview/portal/dome screenshots (merge and instancing are
visually lossless; only shadow-caster pruning and mobile-tier texture caps change pixels,
and only subtly).
