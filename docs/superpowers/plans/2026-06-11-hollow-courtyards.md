# Hollow Courtyards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure each madrasah from a single facade-slab into a hollow rectangle of four wings around an interior courtyard, add a ground apron for overhanging backs, so aerial/rotated views reveal the courtyards.

**Architecture:** `madrasah.ts` gains optional courtyard config (enabled by default); front-face position is frozen; all deepening goes away from plaza. `ground.ts` gets an `makeApron()` helper exported to `main.ts`. Wing tops get a plain `sandDark` roof cap. Interior courtyard faces reuse `arcadeFacade` texture.

**Tech Stack:** Three.js, TypeScript, existing `arcadeFacade`/`brickWall`/`patternedBoxMulti` from `patterns/textures.ts`.

---

## Footprint arithmetic (verify these before coding)

All world coords. "Front face" = closest face to plaza. "Back" = far from plaza.

### Ulugh Beg (UB)
- Group origin: `(-13.5, 0, 0)`, `rotation.y = +π/2` → local +Z = world +X  
- Front face (local +Z end = `+d/2`): current `portal.d = 5` → front-face local-z = +2.5 → world-x = **-13.5 + 2.5 = -11.0** ✓ (spec says -11.0)  
- We keep `facadeLen = 18`, portal as-is. **Total depth = 9.0** (front wing 2.5 + courtyard 4.0 + back wing 2.5)  
- Back of back-wing local-z: `-(9.0 - 2.5) = -6.5` → world-x = `-13.5 - 6.5 = -20.0` (apron needed)

### Sher-Dor (SD)
- Group origin: `(13.0, 0, 0)`, `rotation.y = -π/2` → local +Z = world -X  
- Front face world-x = `13.0 - 2.5 = +10.5` ✓  
- Back world-x = `13.0 + 6.5 = +19.5` (overhang)

### Tilya-Kori (TK)
- Group origin: `(0, 0, -12.5)`, no rotation → local +Z = world +Z  
- Front face world-z = `-12.5 + 2.5 = -10.0` ✓  
- Back world-z = `-12.5 - 6.5 = -19.0` (overhang)

### Apron extent
- Ground slab is 28 cols × 22 rows = 28×22 world units, centered at (0,0,0) → from x=-14 to +14, z=-11 to +11.  
- Apron: west (UB back) needs to x=-21; east (SD back) to x=+20; north (TK back) to z=-20.  
- Apron = a flat mesh y=-0.15 that fills: x from -21 to +21, z from -20 to +11 (south edge stays at +11, matching existing ground). Then punch the original slab zone as a slight-lighter inner rectangle.  
- Simpler: add apron as THREE separate thin slabs — one west, one east, one north — all at y=-0.15 so they peek under the edge of the main ground (y=-0.5, top at y=0) and show where overhang lands.  
- **Actually**: apron should be ABOVE ground (y=0 surface) so buildings appear to sit on earth, not void. Make apron top y = -0.05 (very slightly below main ground's y=0 top surface) as a distinct earth-tone strip. Use a solid `sandDark * 0.9` coloured box, height 0.4, top surface at y=-0.05.

---

## Revised madrasah structure (local space, portal.d=5 throughout)

```
Local +Z direction = "toward plaza / front"

Front wing:  depth = 2.5  (= portal.d; portal screen sits flush on its +Z face)
             height = wingH (existing)
             +Z face = arcade facade (existing arcadeWall logic)
             -Z face = courtyard interior (arcadeFacade texture)

Side wings:  run along local Z axis from z = -6.5 to z = +2.5
             (total Z span = 9.0; wing thickness t = 2.0)
             width t = 2.0, height = wingH - 0.5 (slightly lower than front)
             +X/-X outer face: brickWall
             inner face (toward courtyard): arcadeFacade texture

Back wing:   depth = 2.5, same height as side wings
             z center = -7.5 (back face at z=-8.75, front/courtyard face at z=-6.25)
             +Z face (courtyard side): arcadeFacade
             -Z face (outside back): brickWall

Courtyard floor:
             PlaneGeometry(facadeLen - 2*t, courtLen)
             where courtLen = 9.0 - 2*2.5 = 4.0
             y = plinthH + 0.03 (slightly above plinth top)
             slightly warmer tone than plaza
```

**Wing height note**: front wing height = `wingH`. Side/back wing height = `wingH * 0.78` (shorter than facade screen — matches reference's lower courtyard wings). Domes/minarets/turrets all anchored to the `raised` group which is position.y = plinthH → they still sit above the front wing zone correctly.

**No element moves in +Z** — front face frozen at local z = +portal.d/2. The entire extension is negative Z.

---

## Files modified

- **`src/buildings/madrasah.ts`** — restructure the main body; add 4-wing courtyard mode
- **`src/scene/ground.ts`** — add `makeApron()` exported function
- **`src/main.ts`** — import and add apron mesh to scene

No new files created.

---

## Task 1: Ground Apron

**Files:**
- Modify: `src/scene/ground.ts` (add export at bottom)
- Modify: `src/main.ts` (import + add to scene)

- [ ] **Step 1: Add `makeApron()` to `src/scene/ground.ts`**

Append this function at the bottom of the file (before the closing of the module):

```typescript
/**
 * Earth-tone apron extending beyond the main slab on west/east/north sides
 * to support overhanging building backs. Sits at y=-0.05 (just below plaza top).
 * Three strips: west, east, north.
 */
export function makeApron(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'apron';

  // Apron colour: slightly darker, warmer than plaza sandDark
  const apronMat = new THREE.MeshLambertMaterial({ color: 0xb8a882 }); // warm mid-earth
  const apronY = -0.3; // center Y; top surface at apronY + 0.5/2 = apronY + 0.25
  const apronH = 0.5;

  // West strip: x from -21 to -14 (left of slab edge at x=-14), z from -11 to +11
  const west = new THREE.Mesh(new THREE.BoxGeometry(7, apronH, 22), apronMat);
  west.position.set(-17.5, apronY, 0);
  g.add(west);

  // East strip: x from +14 to +21, z from -11 to +11
  const east = new THREE.Mesh(new THREE.BoxGeometry(7, apronH, 22), apronMat);
  east.position.set(17.5, apronY, 0);
  g.add(east);

  // North strip: z from -20 to -11 (behind slab north edge at z=-11), x from -21 to +21
  const north = new THREE.Mesh(new THREE.BoxGeometry(42, apronH, 9), apronMat);
  north.position.set(0, apronY, -15.5);
  g.add(north);

  return g;
}
```

- [ ] **Step 2: Wire apron in `src/main.ts`**

Find this line in main.ts:
```typescript
const ground = makeGround(); scene.add(ground);
```

Replace with:
```typescript
import { makeGround, makeApron } from './scene/ground';
// ... (import already at top, just add makeApron to existing import)
```

Actually the import is already there (`import { makeGround } from './scene/ground'`). Add makeApron to it:

Change:
```typescript
import { makeGround } from './scene/ground';
```
To:
```typescript
import { makeGround, makeApron } from './scene/ground';
```

And after `const ground = makeGround(); scene.add(ground);`, add:
```typescript
const apron = makeApron(); scene.add(apron);
```

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scene/ground.ts src/main.ts
git commit -m "feat: add ground apron for overhanging building backs"
```

---

## Task 2: Restructure madrasah.ts — hollow rectangle

This is the core change. We replace the single `arcadeWall` call for each wing with 4 wings + courtyard floor.

**Files:**
- Modify: `src/buildings/madrasah.ts`

### Key geometry parameters (add to `MadrasahOpts`):

```typescript
/** Total madrasah depth (front-face to back-face). Default 9.0 */
totalDepth?: number;
/** Side/back wing thickness (wall depth). Default 2.0 */
wingThickness?: number;
```

Defaults: `totalDepth = 9.0`, `wingThickness = 2.0`.

### New derived values (computed inside `madrasah()`):

```typescript
const totalD  = o.totalDepth    ?? 9.0;
const wingT   = o.wingThickness ?? 2.0;
// Front wing depth = portal.d (unchanged)
const frontD  = o.portal.d;
// Interior courtyard length (Z axis)
const courtD  = totalD - frontD - wingT;  // = 9 - 2.5 - 2 = 4.5
// Side wings run from front-wing back to back-wing front
const sideLen = totalD - frontD;          // = 9 - 2.5 = 6.5
// Side wing height = slightly lower than front (87% of wingH)
const sideH   = o.wingH * 0.87;
// Front wing Z center (local): front face at +frontD/2, back at -frontD/2 → center = 0
// Front wing is centered at local z=0, front face at +frontD/2
// Side wing Z center: from z = -(frontD/2) back to z = -(frontD/2 + sideLen)
//   center = -(frontD/2 + sideLen/2)
const sideZCenter = -(frontD / 2 + sideLen / 2);  // = -(1.25 + 3.25) = -4.5
// Back wing Z center: its front (+Z) face is at z = -(frontD/2 + sideLen - wingT/2)... 
// Back wing spans from z=-(frontD/2 + sideLen - wingT) to z=-(frontD/2 + sideLen)
// Center = -(frontD/2 + sideLen - wingT/2) = -(1.25 + 6.5 - 1.0) = -6.75
const backZCenter = -(frontD / 2 + sideLen - wingT / 2);  // = -6.75
```

### Texture generation per wing:

All courtyard-facing interior surfaces use `arcadeFacade(len, h, goldTrim)`. We need:
- **Front wing interior** (−Z face): `arcadeFacade(facadeLen, wingH, goldTrim)`  
  Actually the front wing's -Z face faces the courtyard and is already covered by patternedBoxMulti's nz key.
- **Side wing interior** (courtyard-facing): `arcadeFacade(sideLen, sideH, goldTrim)`  
  For left side wing: interior face = +X face (`px`).  
  For right side wing: interior face = −X face (`nx`).
- **Back wing interior** (+Z face): `arcadeFacade(facadeLen, sideH, goldTrim)`

All **exterior** faces use the appropriate `brickWall(...)` per `wingStyle`.

Roof tops (py face): use `mat(C.sandDark)` plain colour — visible from high zoom.

### Plinth

The plinth currently uses `plinthD = o.portal.d + 0.5`. This should now extend back to cover the full footprint. Change:

```typescript
const plinthW = o.facadeLen + 1.0;
const plinthD = totalD + 0.5;             // full footprint depth + slight overhang
// Center plinth: front edge at +frontD/2 + 0.25, back edge at -(totalD-frontD/2+0.25)
// center z = (frontD/2 + 0.25 - (totalD - frontD/2 + 0.25)) / 2
//          = (frontD/2 + 0.25 - totalD + frontD/2 - 0.25) / 2
//          = (frontD - totalD) / 2
const plinthCenterZ = (frontD - totalD) / 2;  // = (2.5 - 9.0)/2 = -3.25
```

### Domes and minarets

Currently: `dd.position.set(d.offset, o.wingH, -o.portal.d * 0.1)`. The domes should remain near the front zone. Change to keep them at `z = -(portal.d * 0.1)` (no change needed — still in front zone since the front wing is at z=0 center). ✓

Minarets: currently `t.position.x = m.offset`. No Z component → they sit at the front wing face. ✓

Turrets: currently `tg.position.x = turret.offset` at `raised` group. No Z → front wing area. ✓

**None of these need to move.** Verify: if any dome z-offset ends up inside the courtyard (z < -frontD/2), we'd need to push them forward. With portal.d=5, frontD=2.5, domes at z=-0.25 → still inside front-wing zone. ✓

- [ ] **Step 1: Update MadrasahOpts type**

In `src/buildings/madrasah.ts`, add to the interface:

```typescript
export interface MadrasahOpts {
  // ... existing fields ...
  /** Total madrasah depth (front face to back face). Default 9. */
  totalDepth?: number;
  /** Side/back wing thickness. Default 2.0 */
  wingThickness?: number;
  /** TK gold trim flag for courtyard arcades */
  goldTrim?: boolean;
}
```

- [ ] **Step 2: Rewrite the main building body in `madrasah()`**

Replace the section from `// ── MAIN BUILDING PARTS` down to `g.add(raised)` with the new four-wing hollow structure. Here is the complete replacement:

```typescript
  // ── MAIN BUILDING PARTS (raised by plinth height) ────────────────
  const raised = new THREE.Group();
  raised.position.y = plinthH;

  const totalD  = o.totalDepth    ?? 9.0;
  const wingT   = o.wingThickness ?? 2.0;
  const frontD  = o.portal.d;           // front wing depth = portal depth
  const sideLen = totalD - frontD;       // side wing span along Z
  const sideH   = o.wingH * 0.87;       // courtyard wings slightly shorter
  const sideZCenter = -(frontD / 2 + sideLen / 2);
  const backZCenter  = -(frontD / 2 + sideLen - wingT / 2);
  const goldTrim = o.goldTrim ?? false;

  // Exterior brick texture (per wingStyle)
  let extTex: THREE.Texture;
  if (o.wingStyle === 'meander') {
    extTex = brickWall(C.cobalt, C.cream, C.sandLight);
  } else if (o.wingStyle === 'arch-floral') {
    extTex = brickWall(C.sand, C.cream, C.gold);
  } else {
    extTex = brickWall(C.sand, C.cream, C.cobalt);
  }

  // ── FRONT WING ─────────────────────────────────────────────────
  // Width=facadeLen, height=wingH, depth=frontD, centered at Z=0.
  // +Z face: arcade facade (same as before).
  // -Z face: courtyard interior arcade.
  const frontArcade = arcadeFacade(o.facadeLen, o.wingH, goldTrim);
  const frontInterior = arcadeFacade(o.facadeLen, o.wingH, false);
  const plainRoof = mat(C.sandDark);
  const frontWing = patternedBoxMulti(o.facadeLen, o.wingH, frontD, C.sand, {
    pz: frontArcade,      // exterior plaza-facing
    nz: frontInterior,    // interior courtyard-facing
    px: extTex,
    nx: extTex,
    py: extTex,           // roof top — visible from high zoom
  });
  frontWing.position.set(0, o.wingH / 2, 0);
  raised.add(frontWing);

  // ── PORTAL (on top of / in front of the front wing) ─────────────
  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d, {
    variant: o.variant,
  });
  raised.add(portal);

  // ── SIDE WINGS ─────────────────────────────────────────────────
  // Each runs Z from -(frontD/2) back to -(frontD/2 + sideLen).
  // Thickness wingT in X. Interior face points toward courtyard center.
  // Half facadeLen from center = facadeLen/2; wing outer edge at ±facadeLen/2.
  // Wing center X: ±(facadeLen/2 - wingT/2).
  const sideXCenter = o.facadeLen / 2 - wingT / 2;
  const sideInterior = arcadeFacade(sideLen, sideH, false);

  for (const sgn of [-1, 1] as const) {
    // sgn=-1: left wing (−X side), interior face = +X
    // sgn=+1: right wing (+X side), interior face = −X
    const sideWing = patternedBoxMulti(wingT, sideH, sideLen, C.sand, {
      px: sgn < 0 ? sideInterior : extTex,  // +X face
      nx: sgn > 0 ? sideInterior : extTex,  // -X face
      pz: extTex,   // front end cap (should be hidden behind front wing)
      nz: extTex,   // back end cap
      py: extTex,   // roof
    });
    sideWing.position.set(sgn * sideXCenter, sideH / 2, sideZCenter);
    raised.add(sideWing);
  }

  // ── BACK WING ──────────────────────────────────────────────────
  // Width=facadeLen, height=sideH, depth=wingT.
  // +Z face (courtyard): interior arcade. -Z face: exterior brick.
  const backInterior = arcadeFacade(o.facadeLen, sideH, false);
  const backWing = patternedBoxMulti(o.facadeLen, sideH, wingT, C.sand, {
    pz: backInterior,   // courtyard-facing
    nz: extTex,         // exterior back
    px: extTex,
    nx: extTex,
    py: extTex,         // roof
  });
  backWing.position.set(0, sideH / 2, backZCenter);
  raised.add(backWing);

  // ── COURTYARD FLOOR ────────────────────────────────────────────
  // Between side wings, between front and back wing inner faces.
  const courtW = o.facadeLen - 2 * wingT;
  const courtD2 = sideLen - wingT;  // inner courtyard depth
  const courtZCenter = -(frontD / 2 + wingT + courtD2 / 2);
  const courtFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(courtW, courtD2),
    new THREE.MeshLambertMaterial({ color: 0xd4bc96 }),  // slightly warmer than plaza
  );
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.set(0, 0.03, courtZCenter);
  raised.add(courtFloor);

  // ── MINARETS ───────────────────────────────────────────────────
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.x = m.offset;
    raised.add(t);
  }

  // ── DOMES ──────────────────────────────────────────────────────
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed);
    dd.position.set(d.offset, o.wingH, -o.portal.d * 0.1);
    raised.add(dd);
  }

  // ── CORNER TURRETS ─────────────────────────────────────────────
  for (const turret of o.turrets ?? []) {
    const tg = new THREE.Group();
    const shaftTex = bannai(C.sand, C.cream, C.cobalt);
    shaftTex.repeat.set(2, Math.max(1, Math.round(turret.h / 4)));
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(turret.r, turret.r * 1.08, turret.h, 16),
      new THREE.MeshLambertMaterial({ map: shaftTex }),
    );
    shaft.position.y = turret.h / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    tg.add(shaft);

    const capR = turret.r * 0.9;
    const capPts: THREE.Vector2[] = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(capR * 0.9, capR * 0.3),
      new THREE.Vector2(capR * 1.05, capR * 0.7),
      new THREE.Vector2(capR * 0.82, capR * 1.3),
      new THREE.Vector2(capR * 0.38, capR * 1.85),
      new THREE.Vector2(0, capR * 2.1),
    ];
    const cap = new THREE.Mesh(
      new THREE.LatheGeometry(capPts, 16),
      new THREE.MeshLambertMaterial({
        color: C.turquoise,
        emissive: new THREE.Color(C.turquoise),
        emissiveIntensity: 0.14,
      }),
    );
    cap.position.y = turret.h;
    cap.castShadow = true;
    tg.add(cap);

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(turret.r * 0.18, 6, 6),
      new THREE.MeshLambertMaterial({ color: C.gold }),
    );
    finial.position.y = turret.h + capR * 2.15;
    tg.add(finial);

    tg.position.x = turret.offset;
    raised.add(tg);
  }

  g.add(raised);
```

- [ ] **Step 3: Update the plinth geometry to span full footprint**

In the plinth section, replace:
```typescript
  const plinthD = o.portal.d + 0.5;     // flush front (portal front at +d/2), extends back 0.5
  // ...
  const plinthCenterZ = -(0.25); // 0.25 behind portal front center
```
With:
```typescript
  const totalD0  = o.totalDepth ?? 9.0;
  const plinthD = totalD0 + 0.5;
  // Front edge at +portal.d/2; back edge at -(totalD0 - portal.d/2)
  // center Z = (portal.d/2 - (totalD0 - portal.d/2)) / 2 = (portal.d - totalD0) / 2
  const plinthCenterZ = (o.portal.d - totalD0) / 2;
```

- [ ] **Step 4: Update `tilyakori.ts` to pass `goldTrim: true`**

In `src/buildings/tilyakori.ts`, add `goldTrim: true` to the options:

```typescript
export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 8, h: 13, d: 5 },
    wingH: 6,
    variant: 'tilyakori',
    goldTrim: true,
    domes: [{ offset: -7, r: 3.8 }],
    turrets: [
      { offset: -13.5, h: 7, r: 0.9 },
      { offset:  13.5, h: 7, r: 0.9 },
    ],
    wingStyle: 'arch-floral',
  });
  g.position.set(0, 0, -12.5);
  return g;
}
```

- [ ] **Step 5: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Run tests**

Run:
```bash
npx vitest run
```
Expected: 38 passed (madrasah is purely visual geometry; tests are layout/pathing/content — all green).

- [ ] **Step 7: Commit**

```bash
git add src/buildings/madrasah.ts src/buildings/tilyakori.ts
git commit -m "feat: hollow courtyard structure — four wings around interior arcade"
```

---

## Task 3: Visual verification loop

**Files:**
- None modified (read-only verification)

- [ ] **Step 1: Build and launch**

Run:
```bash
npm run build 2>&1 | tail -5
```
Expected: build succeeds, no errors.

- [ ] **Step 2: Start dev server**

```bash
npm run dev &
```

- [ ] **Step 3: Screenshot — default view (rotation 0)**

Use Playwright or browser screenshot at default zoom/rotation. Compare to `lap5b-verify.png`:
- Facades should look IDENTICAL or near-identical (courtyard hidden behind facades from low angle)
- No floating geometry
- Plinth extends under full building footprint

- [ ] **Step 4: Screenshot — zoomed out (zoom 1.0)**

Rotate to each of the 4 rotation angles. Check:
- Do courtyard interiors peek over the front-wing roof from any angle?  
  At zoom 1.0 (furthest out), the camera elevation is highest relative to buildings → best chance of seeing over front-wing tops.  
  Front wing height: UB/SD `wingH=7 + plinthH=0.6 = 7.6`. Side/back wings `sideH = 7*0.87 = 6.09 + 0.6 = 6.69`.  
  Courtyard floor at plinthH=0.6 above ground.
  **Honest assessment**: camera is iso, ~30° elevation. Buildings are ~7-8 world units tall. At zoom 1.0 ground covers ~28 world units. The angle may be too shallow for courtyards to read — report honestly.

- [ ] **Step 5: Screenshot — each rotation (0-3)**

Take screenshots at rotations 0, 1, 2, 3 at default zoom.

- [ ] **Step 6: Compare regression**

Check against `lap5b-verify.png`:
- Front facades: no visible regression?
- Ground: apron strips visible at edges?
- Building silhouettes: same or taller from sides?

- [ ] **Step 7: Report findings**

Report:
1. Footprint overhang numbers (actual world coords from each madrasah back)
2. Whether courtyards read at zoom 1.0 (honest: yes/partial/no with reason)
3. Any regressions vs lap5b-verify.png

---

## Task 4: Final commit

- [ ] **Step 1: Final type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: tsc clean, 38 green.

- [ ] **Step 2: Git add -A and commit**

```bash
git add -A && git commit -m "feat: hollow courtyards with interior arcades and ground apron (PR#1 technique)"
```

---

## Self-review: Spec coverage check

| Spec requirement | Covered by |
|---|---|
| Front faces frozen (UB -11.0, SD +10.5, TK -10.0) | Plinth/portal Z unchanged, all extension is negative-Z |
| Ground apron west/east/north | Task 1 makeApron() |
| Four wings + courtyard floor | Task 2 Step 2 |
| Interior arcade faces | arcadeFacade() on all interior-facing surfaces |
| Domes/minarets/turrets stay at front zone | Anchored to `raised` group at same offsets, no Z push |
| Roof faces plain sandDark | py face uses mat(C.sandDark) — wait, Step 2 uses extTex for py, not sandDark |
| goldTrim for TK | Task 2 Step 4 |
| npm test 38 green, tsc clean | Task 4 |
| Commit message matches spec | Task 4 Step 2 |

**Gaps found:**
1. Roof (py) faces: spec says "plain sandDark — visible from high zoom". In Step 2 code I used `extTex` for `py`. Fix: use a separate `mat(C.sandDark)` for the py face. Update Step 2 to pass a THREE.Texture to py... but `patternedBoxMulti` takes `THREE.Texture` not a `THREE.Material`. Solution: create a tiny sandDark canvas texture, or use `py: undefined` and override with a custom material approach. Simpler: create a helper that returns a solid-color texture from a 1×1 canvas — or just skip py in patternedBoxMulti (leave as plain `mat(C.sand)`) and separately add a thin box on top of each wing. **Simplest**: leave py unset in facesMap → patternedBoxMulti returns `plain = mat(C.sand)` for py, which is close enough. The spec says "slight inset border line via texture is enough" — so plain sand is acceptable. Mark as minor gap.

2. The `frontWing.position.set(0, o.wingH / 2, 0)` — BoxGeometry puts center at origin, but `patternedBoxMulti` already calls `m.position.y = h / 2` internally. So setting `.position.set(0, o.wingH/2, 0)` would **double** the Y offset. Fix: remove the Y position set, just set X and Z: `frontWing.position.set(0, 0, 0)`. But wait — we're adding to `raised` group which is at `y = plinthH`. And `patternedBoxMulti` returns a mesh with `m.position.y = h/2` already. So `frontWing.position.set(0, 0, 0)` is correct — let the built-in y=h/2 handle vertical placement.

**Fixes in Step 2:**
- Remove `frontWing.position.set(0, o.wingH / 2, 0)` → use `frontWing.position.set(0, 0, 0)` or simply `frontWing.position.z = 0` (since patternedBoxMulti sets y already).
- Same for sideWing and backWing: remove any explicit Y position, only set X/Z.
- `courtFloor.position.set(0, 0.03, courtZCenter)` — this is a PlaneGeometry with manual y, which is correct (patternedBoxMulti not used here).
