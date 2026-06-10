# Phase C1 — Pishtaq Geometry, Proportions & Minaret Crowns

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the pishtaq portal with anatomically-correct deep iwan, twin mirrored Sher-Dor tiger spandrels, corbel-crown minarets, correct proportions, and verify no collision regressions.

**Architecture:** Extend `primitives.ts` with a new `pishtaq()` that constructs the portal from explicit parts (pylons, lintel, iwan bay, arch trim, spandrel panels, calligraphy top band); update `madrasah.ts` opts to carry `decals:'tigers'`; update the three building configs; upgrade `minaret()` with cornice-ring stack + gallery + buff dome cap; fix camera lookAt to recenter taller buildings.

**Tech Stack:** TypeScript, Three.js geometry (BoxGeometry, CylinderGeometry, ExtrudeGeometry, PlaneGeometry, Shape), canvas-painted textures from `src/patterns/textures.ts`, Vitest, Vite.

---

## Collision Analysis (must be done before any positioning change)

Current safe front planes (from building files):
- **Ulugh Beg**: rotation y = +π/2, position x = −13.5 → **front face at x = −11.5** (half-depth 2 from portal d=4). Walkable tiles start at col 3 → world x ≈ −9. Margin = 2.5 units. ✓
- **Sher-Dor**: rotation y = −π/2, position x = +13.0 → **front face at x = +11.0** (half-depth 2). Walkable tiles end at col 24 → world x ≈ +9. Margin = 2. ✓
- **Tilya-Kori**: no rotation, position z = −12.5 → **front face at z = −10.5** (half-depth 2). Walkable tiles start at row 3 → world z ≈ −7. Margin = 3.5. ✓

Rule: increasing portal depth from d=4 to d=5 pushes the iwan recess INWARD (away from plaza). The outer face stays at the same place IF we keep `position.x/z` unchanged. We do not move building positions. Iwan recess is carved inward (−Z in portal's local space).

---

## File Map

| File | Change |
|------|--------|
| `src/buildings/primitives.ts` | Rebuild `pishtaq()` with anatomical parts; upgrade `minaret()` with corbel crown |
| `src/buildings/madrasah.ts` | Add `decals?: 'tigers'` to `MadrasahOpts`; pass twin tiger planes in spandrels when set |
| `src/buildings/ulughbeg.ts` | Portal h 12→15, w 7→8, d 4→5; minaret h 14→17 |
| `src/buildings/sherdor.ts` | Portal h 12→15, w 7→8, d 4→5; minaret h 12→17; add `decals:'tigers'`; remove old `decal:tigerDecal()` |
| `src/buildings/tilyakori.ts` | Portal h 11→13; no minaret change |
| `src/scene/camera.ts` | Change `cam.lookAt(0, 0, 0)` → `cam.lookAt(0, 3, 0)` in `placeCamera()` to recentre composition for taller buildings |
| `src/patterns/textures.ts` | Add `tigerSpandrel()` — a mirrored variant of `tigerDecal()` (just the tiger+sun, no border) cropped for spandrel aspect ratio |

---

## Task 1: Camera lookAt recentre

**Files:**
- Modify: `src/scene/camera.ts:18-21`

- [ ] **Step 1: Edit placeCamera to look at y=3**

In `src/scene/camera.ts`, change line 20:
```typescript
export function placeCamera(cam: THREE.OrthographicCamera, azimuth: number) {
  cam.position.set(Math.sin(azimuth) * DIST, DIST * ELEV, Math.cos(azimuth) * DIST);
  cam.lookAt(0, 3, 0);  // was (0,0,0) — raise target 3 units to recentre taller buildings
}
```

- [ ] **Step 2: Verify tsc still compiles**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scene/camera.ts
git commit -m "fix(camera): raise lookAt target to y=3 to recentre taller portals"
```

---

## Task 2: Add `tigerSpandrel()` texture to textures.ts

**Files:**
- Modify: `src/patterns/textures.ts` (append at bottom)

- [ ] **Step 1: Append `tigerSpandrel` function**

Add after the existing `tigerDecal()` function (before the last closing brace):

```typescript
/**
 * Spandrel tiger panel — same tiger+sun motif as tigerDecal but
 * cropped to a square spandrel aspect, no outer border frame.
 * Used as left and right spandrel plane textures on Sher-Dor portal.
 * The caller mirrors the right-side copy (scale.x = -1) to get the symmetric pair.
 */
export function tigerSpandrel(): THREE.CanvasTexture {
  // 512×512 square panel: centred sun top-right, tiger body facing right
  const S = 512;
  const [cv, g] = canvas(S, S, 0x1c5d99);

  // --- SUN (upper right) ---
  const sx = 390, sy = 110, sr = 72;
  g.fillStyle = px(0xffd740);
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = px(0xffd740); g.lineWidth = 7;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.beginPath();
    g.moveTo(sx + Math.cos(a) * (sr + 10), sy + Math.sin(a) * (sr + 10));
    g.lineTo(sx + Math.cos(a) * (sr + 30), sy + Math.sin(a) * (sr + 30));
    g.stroke();
  }
  // Sun face
  g.fillStyle = px(0xfffbe0);
  g.beginPath(); g.arc(sx - 20, sy - 12, 12, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 20, sy - 12, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x2a1a00);
  g.beginPath(); g.arc(sx - 18, sy - 10, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 22, sy - 10, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0xaa6030);
  g.beginPath(); g.moveTo(sx, sy + 6); g.lineTo(sx - 10, sy + 22); g.lineTo(sx + 10, sy + 22); g.closePath(); g.fill();
  g.strokeStyle = px(0x7a3a00); g.lineWidth = 4;
  g.beginPath(); g.arc(sx, sy + 14, 20, 0.15, Math.PI - 0.15); g.stroke();

  // --- TIGER body centred at y=290, x=240 ---
  const tigerColor = 0xe8943a;
  const stripeColor = 0x8a4a1a;
  const tby = 290;
  const tbx = 240;

  // Body ellipse
  g.fillStyle = px(tigerColor);
  g.beginPath(); g.ellipse(tbx, tby, 170, 65, 0, 0, Math.PI * 2); g.fill();

  // Head facing right
  const thx = 420, thy = tby - 16;
  g.beginPath(); g.arc(thx, thy, 58, 0, Math.PI * 2); g.fill();

  // Ears
  g.beginPath(); g.moveTo(thx - 28, thy - 44); g.lineTo(thx - 40, thy - 82); g.lineTo(thx - 8, thy - 52); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 8, thy - 46); g.lineTo(thx + 28, thy - 82); g.lineTo(thx + 38, thy - 46); g.closePath(); g.fill();

  // Eyes
  g.fillStyle = px(0xffee88);
  g.beginPath(); g.arc(thx - 22, thy - 6, 13, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 12, thy - 6, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x1a1a00);
  g.beginPath(); g.arc(thx - 20, thy - 4, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 14, thy - 4, 6, 0, Math.PI * 2); g.fill();

  // Nose + mouth
  g.fillStyle = px(0xcc6633);
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx - 11, thy + 4); g.lineTo(thx + 11, thy + 4); g.closePath(); g.fill();
  g.strokeStyle = px(0x8a3a10); g.lineWidth = 3;
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx - 11, thy + 28); g.stroke();
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx + 11, thy + 28); g.stroke();

  // Body stripes
  g.fillStyle = px(stripeColor);
  for (const [bx, bw, bh, rot] of [
    [tbx - 80, 18, 68, -0.15],
    [tbx - 30, 18, 72, -0.05],
    [tbx + 20, 18, 72,  0.05],
    [tbx + 72, 18, 66,  0.15],
  ] as [number, number, number, number][]) {
    g.save(); g.translate(bx, tby); g.rotate(rot);
    g.fillRect(-bw / 2, -bh / 2, bw, bh);
    g.restore();
  }

  // Tail curling up from back
  g.strokeStyle = px(tigerColor); g.lineWidth = 20;
  g.beginPath(); g.moveTo(tbx - 160, tby + 12); g.quadraticCurveTo(tbx - 190, tby - 12, tbx - 200, tby - 60); g.stroke();
  g.strokeStyle = px(stripeColor); g.lineWidth = 8;
  g.beginPath(); g.moveTo(tbx - 160, tby + 12); g.quadraticCurveTo(tbx - 190, tby - 12, tbx - 200, tby - 60); g.stroke();
  g.fillStyle = px(0x3a1a00);
  g.beginPath(); g.arc(tbx - 200, tby - 64, 14, 0, Math.PI * 2); g.fill();

  // Legs
  g.fillStyle = px(tigerColor);
  for (const lx of [tbx - 110, tbx - 60, tbx + 40, tbx + 90]) {
    g.beginPath(); g.roundRect(lx, tby + 50, 28, 85, 10); g.fill();
    g.fillStyle = px(0xd0783a);
    g.beginPath(); g.ellipse(lx + 14, tby + 136, 20, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(tigerColor);
  }

  // Gold inner border only (no outer black frame)
  g.strokeStyle = px(0xd4af37); g.lineWidth = 8;
  g.strokeRect(10, 10, S - 20, S - 20);

  const t = toTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
```

- [ ] **Step 2: Verify tsc compiles**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/patterns/textures.ts
git commit -m "feat(textures): add tigerSpandrel() for Sher-Dor spandrel panels"
```

---

## Task 3: Rebuild `pishtaq()` in primitives.ts

**Files:**
- Modify: `src/buildings/primitives.ts` — replace the entire `pishtaq()` function (lines 82–122)

**Architecture of the new pishtaq:**
```
  ┌──────────────────────────────────────┐  ← calligraphy band (top of lintel)
  │  LINTEL (kufic-border top band box)  │
  ├──────┬────────────────────┬──────────┤
  │      │                    │          │
  │ LEFT │   IWAN OPENING    │  RIGHT   │  ← pylons flank the iwan
  │PYLON │  (dark recessed   │  PYLON   │
  │      │   bay w/ arch     │          │
  │      │   face texture)   │          │
  └──────┴────────────────────┴──────────┘

  Iwan bay: floor + back wall (dark) + two side walls (patterned)
  Arch face: a flat plane at front of iwan with arch texture
  Spandrel panels: planes in the upper corners above arch, flanking
  Arch trim: thin extruded arch outline (cream/gold edge)
```

- [ ] **Step 1: Replace the pishtaq function**

In `src/buildings/primitives.ts`, replace lines 82–122 (the full `pishtaq` function) with:

```typescript
/**
 * Monumental portal rebuilt with anatomically-correct parts:
 * - Two flanking PYLON boxes (bannai-patterned)
 * - LINTEL box bridging them at top (kufic/calligraphy)
 * - IWAN recess: floor + back wall + two side walls + arch face (shadowed interior)
 * - ARCH TRIM: thin extruded cream edge following the pointed arch outline
 * - SPANDREL panels: girih or tiger decals in the upper zone beside the arch
 * - CALLIGRAPHY BAND: proud plane across the top of the lintel
 *
 * opts.decals = 'tigers': place two mirrored tigerSpandrel planes in the spandrels
 */
export function pishtaq(
  w: number, h: number, d: number,
  opts: { decals?: 'tigers' } = {},
): THREE.Group {
  const g = new THREE.Group();

  // Derived geometry constants
  const borderFrac = 0.12;                // frame border as fraction of width
  const pylonW = w * borderFrac;          // each pylon width
  const iwanW = w - pylonW * 2;           // clear opening width
  const iwanH = h * 0.78;                 // iwan opening height (arch top sits here)
  const iwanDepth = Math.min(d * 0.85, 5.0); // iwan recess depth — goes backward

  const bannaiTex = bannai(C.sand, C.cream, C.cobalt);
  const kufiTex   = kuficBorder(C.lapis, C.cream);   // helper defined below

  // ── PYLONS (left & right flanks) ────────────────────────────────
  for (const sx of [-1, 1]) {
    const pylon = patternedBoxMulti(pylonW, h, d, C.sand, {
      pz: bannaiTex,
      nz: bannaiTex,
      px: bannaiTex,
      nx: bannaiTex,
    });
    pylon.position.x = sx * (iwanW / 2 + pylonW / 2);
    g.add(pylon);
  }

  // ── LINTEL (horizontal top bridge) ──────────────────────────────
  const lintelH = h - iwanH;
  const lintelY  = iwanH; // base of lintel starts at iwan top
  const lintelBox = patternedBoxMulti(iwanW, lintelH, d, C.sand, {
    pz: girih(C.sand, C.cobalt, C.turquoise, 2),
    nz: bannaiTex,
  });
  lintelBox.position.set(0, lintelY, 0);
  // patternedBoxMulti auto-sets y = h/2 inside; override:
  lintelBox.position.y = lintelY + lintelH / 2;
  g.add(lintelBox);

  // ── IWAN BAY ────────────────────────────────────────────────────
  // The iwan is recessed INWARD (−Z in portal local space).
  // Front face of portal = z = d/2.
  // Front of iwan opening = z = d/2 (flush with portal face — open).
  // Back wall of iwan = z = d/2 − iwanDepth.
  const iwanFrontZ  = d / 2;
  const iwanBackZ   = iwanFrontZ - iwanDepth;

  // Floor of iwan (horizontal)
  const iwanFloor = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, 0.15, iwanDepth),
    mat(C.sandDark),
  );
  iwanFloor.position.set(0, 0.075, iwanFrontZ - iwanDepth / 2);
  g.add(iwanFloor);

  // Side walls of iwan (left & right interior)
  const sideWallTex = bannai(C.lapis, C.cobalt, C.turquoise); // darker inside
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, iwanH, iwanDepth),
      new THREE.MeshLambertMaterial({
        map: (() => { const t = sideWallTex.clone(); t.needsUpdate = true; return t; })(),
        color: 0x7090c0,  // blue tint for shadow
      }),
    );
    sw.position.set(sx * (iwanW / 2 - 0.075), iwanH / 2, iwanFrontZ - iwanDepth / 2);
    g.add(sw);
  }

  // Back wall of iwan (girih pattern, darker)
  const backWallGeo = new THREE.BoxGeometry(iwanW, iwanH, 0.15);
  const backWallMat = new THREE.MeshLambertMaterial({
    map: (() => {
      const t = girih(C.lapis, C.cobalt, C.turquoise, 2).clone();
      t.needsUpdate = true;
      return t;
    })(),
    color: 0x6080b0,
  });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, iwanH / 2, iwanBackZ + 0.075);
  g.add(backWall);

  // Small door rectangle on back wall
  const doorW = iwanW * 0.32, doorH = iwanH * 0.38;
  const doorPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    mat(C.lapis),
  );
  doorPanel.position.set(0, doorH / 2 + 0.01, iwanBackZ + 0.22);
  g.add(doorPanel);

  // ── ARCH FACE (front opening of iwan) ──────────────────────────
  // A solid dark plane filling the pointed arch shape, placed at z = iwanFrontZ - 0.01
  // (just inside) to give the appearance of a deeply shadowed arch opening.
  const archFaceMat = new THREE.MeshLambertMaterial({
    color: C.lapis,
    emissive: new THREE.Color(0x000820),
    emissiveIntensity: 0.5,
  });
  const archFaceGeo = new THREE.ExtrudeGeometry(archShape(iwanW, iwanH), { depth: 0.18, bevelEnabled: false });
  const archFace = new THREE.Mesh(archFaceGeo, archFaceMat);
  archFace.position.set(-iwanW / 2, 0, iwanFrontZ - 0.20);
  g.add(archFace);

  // ── ARCH TRIM (cream outline following arch edge) ──────────────
  // Two thin extruded strips following the arch outline
  const trimMat = new THREE.MeshLambertMaterial({ color: C.cream, emissive: new THREE.Color(C.gold), emissiveIntensity: 0.05 });
  const trimShape = archTrimShape(iwanW, iwanH, 0.18); // helper below
  const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.22, bevelEnabled: false });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(-iwanW / 2, 0, iwanFrontZ - 0.01);
  g.add(trim);

  // ── SPANDRELS ────────────────────────────────────────────────────
  // Zone above the arch and beside it, up to lintel base
  const spandrelW = pylonW * 1.0;
  const spandrelH = (lintelH + (h - iwanH) * 0.4);
  const spandrelY = iwanH * 0.82; // baseline of spandrel panels

  if (opts.decals === 'tigers') {
    // Import at call site — function is in same file, import tigerSpandrel from textures
    const { tigerSpandrel } = require('../patterns/textures') as typeof import('../patterns/textures');
    const tex = tigerSpandrel();

    for (const sx of [-1, 1]) {
      const panelW = iwanW * 0.44;
      const panelH = panelW; // square spandrel
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshLambertMaterial({ map: tex, transparent: false }),
      );
      // Mirror right side: scale.x = -1 flips the UV horizontally
      if (sx === 1) panel.scale.x = -1;
      panel.position.set(
        sx * (iwanW / 2 - panelW / 2 - pylonW * 0.05),
        spandrelY + panelH / 2,
        iwanFrontZ + 0.04,
      );
      g.add(panel);
    }
  } else {
    // Default: girih spandrel panels (subtle, matching pishtaq field)
    const spGirih = girih(C.sand, C.cobalt, C.turquoise, 1);
    for (const sx of [-1, 1]) {
      const panelW = pylonW * 0.84;
      const panelH = lintelH * 0.82;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshLambertMaterial({ map: spGirih }),
      );
      panel.position.set(
        sx * (iwanW / 2 + pylonW / 2),
        spandrelY + panelH / 2,
        d / 2 + 0.03,
      );
      g.add(panel);
    }
  }

  // ── CALLIGRAPHY BAND (top of lintel) ────────────────────────────
  const bandH = h * 0.09;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }),
  );
  strip.position.set(0, h - bandH / 2 - h * 0.015, d / 2 + 0.03);
  g.add(strip);

  return g;
}

/** Arch outline shape for trim ring (annular shape = outer arch minus inner arch). */
function archTrimShape(w: number, h: number, trimW: number): THREE.Shape {
  const outer = archShape(w, h);
  const inner = archShape(w - trimW * 2, h - trimW);
  // Hole: Three.js Shape holes carve out of the solid
  outer.holes.push(inner);
  return outer;
}

/** Kufic-border texture (meander strip colorway for pylon faces). */
function kuficBorder(bg: number, fg: number): THREE.CanvasTexture {
  return meander(bg, fg); // reuse existing meander — good enough for pylon border
}
```

**IMPORTANT: Remove the `require()` call** — TypeScript/Vite uses ES modules. Instead, import at the top of the file. Also `archShape` is already defined in the file (lines 66–73) so it's available. The `archTrimShape` helper is new and must be added.

The actual implementation needs careful handling: `tigerSpandrel` must be imported at file top. Here's the corrected plan — do it as two steps:

- [ ] **Step 1a: Add import for tigerSpandrel at top of primitives.ts**

In `src/buildings/primitives.ts`, change line 3 (the patterns import):
```typescript
import { girih, bannai, meander, calligraphyBand, archPanel, tigerSpandrel } from '../patterns/textures';
```

- [ ] **Step 1b: Write the new pishtaq and helpers**

Replace the entire `pishtaq` function (lines 82–122 in the original) with the version below. Note:
- `archShape` (lines 66–73) is already in file — do NOT rewrite it, just refer to it.
- Add `archTrimShape` helper BEFORE the new `pishtaq` function (after `archShape`).
- Remove `kuficBorder` local helper — it's unused dead code, use `meander` directly.

Full replacement region (from `/** Monumental portal...` through the closing `}`):

```typescript
/** Arch trim ring shape: outer arch path minus inner arch (creates a 'frame' annulus). */
function archTrimShape(w: number, h: number, trimW: number): THREE.Shape {
  const outer = archShape(w, h);
  // Inner cutout — slightly smaller arch
  const iw = w - trimW * 2;
  const ih = h - trimW * 1.2;
  const inner = new THREE.Path();
  const ir = iw / 2;
  inner.moveTo(-ir, 0);
  inner.lineTo(-ir, ih - ir);
  inner.quadraticCurveTo(-ir, ih - ir * 0.1, 0, ih);
  inner.quadraticCurveTo(ir, ih - ir * 0.1, ir, ih - ir);
  inner.lineTo(ir, 0);
  inner.closePath();
  outer.holes.push(inner);
  return outer;
}

/**
 * Monumental portal with anatomically-correct parts:
 *   - Two flanking PYLON boxes (bannai-patterned)
 *   - LINTEL box bridging top (girih + calligraphy)
 *   - IWAN: floor + back wall (girih dark) + side walls + arch face (shadow)
 *   - ARCH TRIM: cream/gold extruded annular ring following the arch edge
 *   - SPANDREL panels: 'tigers' → twin mirrored tigerSpandrel planes; else girih
 *   - CALLIGRAPHY BAND: proud strip at very top
 *
 * opts.decals = 'tigers' → Sher-Dor twin mirrored tiger spandrels
 */
export function pishtaq(
  w: number, h: number, d: number,
  opts: { decals?: 'tigers' } = {},
): THREE.Group {
  const g = new THREE.Group();

  // Proportions
  const pylonW   = w * 0.13;        // border frame width
  const iwanW    = w - pylonW * 2;  // clear arch opening width
  const iwanH    = h * 0.78;        // height of arch opening
  const iwanDepth = Math.min(d * 0.85, 4.5); // recess depth (inward)

  const frontZ = d / 2;             // portal front face z (local)
  const backZ  = frontZ - iwanDepth; // iwan back wall z (local)

  const bannaiTex = bannai(C.sand, C.cream, C.cobalt);

  // ── LEFT & RIGHT PYLONS ─────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const pylon = patternedBoxMulti(pylonW, h, d, C.sand, {
      pz: bannai(C.sand, C.cream, C.cobalt),
      nz: bannaiTex,
      px: bannaiTex,
      nx: bannaiTex,
    });
    pylon.position.x = sx * (iwanW / 2 + pylonW / 2);
    // patternedBoxMulti sets y = h/2 internally; position y=0 → correct
    g.add(pylon);
  }

  // ── LINTEL ──────────────────────────────────────────────────────
  const lintelH = h - iwanH;
  const lintel = patternedBoxMulti(iwanW, lintelH, d, C.sand, {
    pz: girih(C.sand, C.cobalt, C.turquoise, 2),
    nz: bannaiTex,
    px: bannaiTex,
    nx: bannaiTex,
  });
  lintel.position.set(0, iwanH + lintelH / 2, 0);
  g.add(lintel);

  // ── IWAN FLOOR ──────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, 0.12, iwanDepth),
    mat(C.sandDark),
  );
  floor.position.set(0, 0.06, frontZ - iwanDepth / 2);
  g.add(floor);

  // ── IWAN SIDE WALLS ─────────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, iwanH, iwanDepth),
      new THREE.MeshLambertMaterial({
        color: 0x4a6898,  // shadowed blue interior
      }),
    );
    sw.position.set(sx * (iwanW / 2 - 0.07), iwanH / 2, frontZ - iwanDepth / 2);
    g.add(sw);
  }

  // ── IWAN BACK WALL ──────────────────────────────────────────────
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, iwanH, 0.14),
    new THREE.MeshLambertMaterial({
      map: (() => { const t = girih(C.lapis, C.cobalt, C.turquoise, 2); t.repeat.set(0.5, 0.5); return t; })(),
      color: 0x3a587e,
    }),
  );
  backWall.position.set(0, iwanH / 2, backZ + 0.07);
  g.add(backWall);

  // Small door on back wall
  const doorW = iwanW * 0.30, doorH = iwanH * 0.35;
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    mat(0x0f1f35),
  );
  door.position.set(0, doorH / 2 + 0.01, backZ + 0.22);
  g.add(door);

  // ── ARCH FACE (deep shadow at front of iwan) ────────────────────
  const archFace = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape(iwanW, iwanH), { depth: 0.22, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({
      color: 0x050e1e,
      emissive: new THREE.Color(0x000208),
      emissiveIntensity: 0.8,
    }),
  );
  archFace.position.set(-iwanW / 2, 0, frontZ - 0.22);
  g.add(archFace);

  // ── ARCH TRIM (cream/gold extruded ring) ─────────────────────────
  const trimW = Math.max(0.18, pylonW * 0.22);
  const trim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archTrimShape(iwanW, iwanH, trimW), { depth: 0.24, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({
      color: C.cream,
      emissive: new THREE.Color(C.gold),
      emissiveIntensity: 0.06,
    }),
  );
  trim.position.set(-iwanW / 2, 0, frontZ - 0.01);
  g.add(trim);

  // ── SPANDREL PANELS ─────────────────────────────────────────────
  // Zone between top of arch and base of lintel, flanking the arch
  const spandrelBaseY = iwanH * 0.80;
  const spandrelH2    = (h - spandrelBaseY) * 0.70;
  const spandrelW2    = iwanW * 0.42;

  if (opts.decals === 'tigers') {
    const tex = tigerSpandrel();
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelW2, spandrelH2),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      if (sx === 1) panel.scale.x = -1;  // mirror right tiger
      panel.position.set(
        sx * (spandrelW2 / 2 + 0.04),
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.04,
      );
      g.add(panel);
    }
  } else {
    const spTex = girih(C.sand, C.cobalt, C.turquoise, 1);
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelW2, spandrelH2),
        new THREE.MeshLambertMaterial({ map: spTex }),
      );
      panel.position.set(
        sx * (spandrelW2 / 2 + 0.04),
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.03,
      );
      g.add(panel);
    }
  }

  // ── CALLIGRAPHY BAND ─────────────────────────────────────────────
  const bandH = h * 0.085;
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }),
  );
  band.position.set(0, h - bandH / 2 - h * 0.01, frontZ + 0.03);
  g.add(band);

  return g;
}
```

- [ ] **Step 2: Run tsc**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 3: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test
```
Expected: 25 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/buildings/primitives.ts src/patterns/textures.ts
git commit -m "feat(primitives): rebuild pishtaq with anatomical iwan, arch trim, spandrels"
```

---

## Task 4: Update madrasah.ts to support `decals: 'tigers'`

**Files:**
- Modify: `src/buildings/madrasah.ts`

The `MadrasahOpts.decal` (old single texture) and the new `decals?: 'tigers'` string need coexistence. We add the new field and pass it through to `pishtaq()`.

- [ ] **Step 1: Update MadrasahOpts interface and madrasah function**

Replace the full contents of `src/buildings/madrasah.ts` with:

```typescript
import * as THREE from 'three';
import { pishtaq, arcadeWall, minaret, dome, shadowed } from './primitives';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];
  domes?: { offset: number; r: number; ribbed?: boolean }[];
  /** Pass 'tigers' to render twin mirrored Sher-Dor tiger spandrel panels */
  decals?: 'tigers';
}

export function madrasah(o: MadrasahOpts): THREE.Group {
  const g = new THREE.Group();
  const wingLen = (o.facadeLen - o.portal.w) / 2;

  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d, {
    decals: o.decals,
  });
  g.add(portal);

  for (const side of [-1, 1]) {
    const wing = arcadeWall(wingLen, o.wingH, o.portal.d * 0.8);
    wing.position.x = side * (o.portal.w / 2 + wingLen / 2);
    g.add(wing);
  }
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.x = m.offset;
    g.add(t);
  }
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed);
    dd.position.set(d.offset, o.wingH, -o.portal.d * 0.1);
    g.add(dd);
  }
  return shadowed(g);
}
```

Note: removed the old `decal?: THREE.Texture` field and its implementation (which placed a single decal plane above the arch). The new system uses `decals: 'tigers'` handled inside `pishtaq()`.

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/buildings/madrasah.ts
git commit -m "feat(madrasah): replace decal texture with decals:'tigers' string option"
```

---

## Task 5: Upgrade minaret crowns in primitives.ts

**Files:**
- Modify: `src/buildings/primitives.ts` — replace `minaret()` function (lines 161–185 approx)

**Real anatomy (ulughbeg-portal.jpg):**
- Shaft: tapered cylinder (bannai pattern)
- Cornice: stack of 2 widening rings (cream cylinders)
- Gallery: short open cylinder with arch-texture band (dark with arch motif)
- Dome cap: small buff/sand sphere (NOT turquoise — refs show buff/sand color)
- Finial: tiny gold sphere

- [ ] **Step 1: Replace minaret function**

Replace the `minaret()` function with:

```typescript
/** Tapered minaret with bannai shaft, corbel cornice rings, gallery, and buff dome cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // ── SHAFT ────────────────────────────────────────────────────────
  const shaftTex = bannai(C.sand, C.cream, C.cobalt);
  shaftTex.repeat.set(1, Math.max(1, Math.round(h / 8)));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const rBase = h * 0.095;   // base radius (slightly fatter — real ones are stout)
  const rTop  = h * 0.058;   // top of shaft just before cornice
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBase, h * 0.88, 16), shaftMat);
  shaft.position.y = h * 0.88 / 2;
  g.add(shaft);

  // ── CORBEL CORNICE (3 stacking rings, widening outward) ──────────
  const corniceBase = h * 0.88;
  const ringData: [number, number, number][] = [
    // [yOffset from corniceBase, radius, height]
    [0.00, rTop * 1.10, h * 0.018],
    [0.02, rTop * 1.22, h * 0.022],
    [0.05, rTop * 1.38, h * 0.026],
  ];
  for (const [yOff, r, rh] of ringData) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.96, rh, 16),
      mat(C.cream),
    );
    ring.position.y = corniceBase + yOff * h + rh / 2;
    g.add(ring);
  }

  // ── GALLERY (short cylinder with dark arch-texture band) ──────────
  const galleryBase = corniceBase + ringData[2][0] * h + ringData[2][2];
  const galleryR    = rTop * 1.32;
  const galleryH    = h * 0.065;
  const galleryTex  = archPanel(256, 128);
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(galleryR, galleryR, galleryH, 16),
    new THREE.MeshLambertMaterial({ map: galleryTex }),
  );
  gallery.position.y = galleryBase + galleryH / 2;
  g.add(gallery);

  // ── DOME CAP (small buff sphere — sand color, NOT turquoise) ─────
  const capBase = galleryBase + galleryH;
  const capR    = galleryR * 0.80;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 12, 10), mat(C.sand));
  cap.position.y = capBase + capR * 0.85;
  g.add(cap);

  // ── FINIAL ────────────────────────────────────────────────────────
  const finial = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.22, 8, 8), mat(C.gold));
  finial.position.y = capBase + capR * 1.75;
  g.add(finial);

  return g;
}
```

- [ ] **Step 2: Verify tsc**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test
```
Expected: 25 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/buildings/primitives.ts
git commit -m "feat(primitives): corbel cornice + gallery + buff dome cap on minarets"
```

---

## Task 6: Update building configs (proportions)

**Files:**
- Modify: `src/buildings/ulughbeg.ts`
- Modify: `src/buildings/sherdor.ts`
- Modify: `src/buildings/tilyakori.ts`

### ulughbeg.ts — portal h 12→15, w 7→8, d 4→5; minaret h 14→17

```typescript
import { madrasah } from './madrasah';

export function ulughBeg() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 8, h: 15, d: 5 },
    wingH: 7,
    minarets: [{ offset: -10, h: 17 }, { offset: 10, h: 17 }],
  });
  g.rotation.y = Math.PI / 2;
  g.position.set(-13.5, 0, 0);  // front face at x = -13.5 + 5/2 = -11.0 — still > margin -9
  return g;
}
```

**Collision check UB:** position x = -13.5, portal d = 5, rotation π/2 → depth goes along X axis. Front face = -13.5 + 5/2 = **-11.0**. Walkable cols 3–24 → world x ≈ -9 at col 3. Margin = 2 units. OK.

### sherdor.ts — portal h 12→15, w 7→8, d 4→5; minaret h 12→17; decals:'tigers'; remove old tigerDecal import

```typescript
import { madrasah } from './madrasah';

export function sherDor() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 8, h: 15, d: 5 },
    wingH: 7,
    minarets: [{ offset: -10, h: 17 }, { offset: 10, h: 17 }],
    domes: [{ offset: -6, r: 2.2, ribbed: true }, { offset: 6, r: 2.2, ribbed: true }],
    decals: 'tigers',
  });
  g.rotation.y = -Math.PI / 2;
  g.position.set(13.0, 0, 0);   // front face at 13.0 - 5/2 = +10.5 — still > margin +9
  return g;
}
```

**Collision check SD:** position x = +13.0, portal d = 5, rotation -π/2 → depth along -X. Front face = 13.0 - 5/2 = **+10.5**. Walkable ends at col 24 → world x ≈ +9. Margin = 1.5 units. Tight but OK — character paths to hotspot 3 which is at col ~22, world x ≈ +7.

### tilyakori.ts — portal h 11→13; no minaret

```typescript
import { madrasah } from './madrasah';

export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 8, h: 13, d: 5 },
    wingH: 6,
    domes: [{ offset: -7, r: 3 }],
  });
  g.position.set(0, 0, -12.5);  // front face at z = -12.5 + 5/2 = -10.0 — margin vs -7 = 3 units
  return g;
}
```

**Collision check TK:** position z = -12.5, portal d = 5, no rotation → front face at z = -12.5 + 5/2 = **-10.0**. Walkable starts at row 3 → world z ≈ -7. Margin = 3 units. OK.

- [ ] **Step 1: Update ulughbeg.ts** (replace file with above)

- [ ] **Step 2: Update sherdor.ts** (replace file with above)

- [ ] **Step 3: Update tilyakori.ts** (replace file with above)

- [ ] **Step 4: Verify tsc**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test
```
Expected: 25 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/buildings/ulughbeg.ts src/buildings/sherdor.ts src/buildings/tilyakori.ts
git commit -m "feat(buildings): update proportions — portal h+3, w+1, d+1; minarets h+3"
```

---

## Task 7: Screenshot verification loop (4 rotations + UB portal zoom)

Use the `verify` skill or the manual Puppeteer approach from earlier phases.

- [ ] **Step 1: Start vite dev server in background**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx vite --port 5173 &
sleep 3
```

- [ ] **Step 2: Take 4-rotation screenshots + UB portal zoom**

Using the existing screenshot mechanism (Puppeteer script from prior phases at `.superpowers/screenshot.js` or equivalent):

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && node .superpowers/screenshot.js phaseC1-iter1 --rotations=4 --zoom=ulughbeg
```

If no screenshot script exists, create a minimal one:
```javascript
// .superpowers/screenshot.js
const puppeteer = require('puppeteer');
// ... (see prior phase scripts for pattern)
```

- [ ] **Step 3: Compare vs refs — check list**
  - [ ] UB portal: deep dark iwan recess visible
  - [ ] UB portal: cream arch trim ring visible
  - [ ] UB portal: spandrel girih panels (NOT tigers) in upper corners
  - [ ] SD portal: two tiger panels in spandrels, mirrored (left tiger faces right, right tiger faces left)
  - [ ] Minaret crowns: 3 corbel rings + gallery band + BUFF cap (not turquoise)
  - [ ] Portals clearly taller than wings (h=15 vs wingH=7 → ratio 2.14)
  - [ ] No clipping of minarets or portals at any rotation

- [ ] **Step 4: Iterate if needed** — fix issues and retake screenshots (up to 8 rounds)

- [ ] **Step 5: Kill vite server**

```bash
pkill -f "vite --port 5173" || true
```

---

## Task 8: Final verification + save best screenshot + commit

- [ ] **Step 1: Run tests (25 green)**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test
```
Expected: 25 tests passing, 0 failing.

- [ ] **Step 2: Run tsc**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run build**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm run build
```
Expected: build succeeds, no warnings about undefined symbols.

- [ ] **Step 4: Copy best screenshot to phaseC1-final.png**

```bash
cp /Users/kijon/Documents/Claude/Projects/Registon/.superpowers/phaseC1-iter{N}-default.png \
   /Users/kijon/Documents/Claude/Projects/Registon/.superpowers/phaseC1-final.png
```

- [ ] **Step 5: Final commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon
git add -A
git commit -m "feat(visual): phase C1 — true pishtaqs with deep iwans, twin tigers, proportions, minaret crowns"
```

---

## Self-Review Against Spec

**Spec requirements → Task coverage:**

| Spec item | Task |
|-----------|------|
| Pishtaq pylons + lintel frame | Task 3 |
| Iwan recess: floor, side walls, back wall, door | Task 3 |
| Pointed arch face at iwan front (deep shadow) | Task 3 |
| Arch trim: cream/gold extruded outline | Task 3 |
| Spandrels: girih default | Task 3 |
| Sher-Dor spandrels: twin mirrored tigers | Tasks 2, 3, 4 |
| Calligraphy band at top | Task 3 |
| Portal h 12→15, w 7→8 (UB, SD); TK h 11→13 | Task 6 |
| Minaret h 14→17, radius +20% | Task 5 + 6 |
| Corbel cornice (3 rings) + gallery + buff cap | Task 5 |
| No turquoise cap on minarets | Task 5 |
| Camera lookAt recentre to y=3 | Task 1 |
| Collision discipline: UB -11.0, SD +10.5, TK -10.0 | Task 6 (verified above) |
| 25 tests green | Task 8 |
| tsc clean | Task 8 |
| build ok | Task 8 |
| phaseC1-final.png saved | Task 8 |
| commit with specified message | Task 8 |

**No gaps found.** Placeholder scan: all steps have concrete code. Type consistency: `pishtaq()` signature gains `opts` parameter; `madrasah.ts` passes `{ decals: o.decals }` — types match. `tigerSpandrel` imported at primitives.ts line 3.
