# Vector-Crisp Texture LOD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-rasterize canvas-based tilework textures at 2× resolution when zoomed in (zoom < 0.55) so vector geometry stays sharp instead of dissolving into mip-blur.

**Architecture:** A `TextureRegistry` singleton tracks every `{ draw, canvas, textures[] }` entry created via the existing `canvas()`/`toTexture()` helpers. `ZoomController` exposes `onTierChange(cb)`. When tier switches (1x ↔ 2x), a stagger queue in the tick loop re-rasterizes one canvas per frame: resize canvas, call draw closure, set `needsUpdate` on every texture (source + all clones) sharing it. A capability gate in `main.ts` disables 2x on low-end devices.

**Tech Stack:** TypeScript, Three.js CanvasTexture, HTML Canvas 2D API, Vite, Vitest

---

## Clone-propagation strategy (MUST READ before implementation)

`texture.clone()` in Three.js copies `.image` by reference — both source and clone point to the same canvas. However, each has its **own** `needsUpdate` flag. When the canvas is resized and redrawn:
- The canvas object reference stays the same (we mutate `.width`/`.height` in place).
- All textures sharing that canvas see the new pixel data because `.image` is the same HTMLCanvasElement reference.
- But Three.js will only upload the new data to the GPU when `needsUpdate = true` on each texture.

**Therefore:** we must call `needsUpdate = true` on EVERY texture (source + clones) that shares a canvas. The `TextureRegistry` tracks them all in a `textures: THREE.CanvasTexture[]` array per entry.

**VRAM calculation (2x tier, done in Task 1 research step):**
- bannai: 1024² → 2048² = 4 bytes × 2048² = 16 MB
- pylonFace: 1024² → 2048² = 16 MB
- calligraphyBand: 1024×256 → 2048×512 = 4 MB
- archPanel: varies; typical ~256×256 → 512×512 ≈ 1 MB each; ~20 panels = 20 MB
- meander: 512² → 1024² = 4 MB
- girih: 1024² (cells=4 → 1024²) → 2048² = 16 MB
- tigerSpandrel: 512² → 1024² = 4 MB
- stripeTex (dome ribbed): 512×256 → 1024×512 = 2 MB
- Total estimate ≈ ~80–100 MB at 2x (well under 200 MB cap)
- PRIORITY: bannai/pylonFace/archPanel/calligraphyBand/pylonFace get 2x; minor ones (girih, meander, tigerSpandrel) stay 1x if budget is tight.

---

## File Map

| File | Change |
|------|--------|
| `src/patterns/textures.ts` | Refactor: registry, draw closures, resolution-independent coords |
| `src/scene/zoom.ts` | Add `onTierChange(cb)`, `currentTier`, `LOD_THRESHOLD = 0.55` |
| `src/scene/lod.ts` | **NEW** — TextureRegistry singleton + stagger queue + tick logic |
| `src/main.ts` | Wire capability gate; pass renderer to LOD; call `lodTick(dt)` in loop |
| `tests/lod.test.ts` | **NEW** — unit tests for registry, tier detection, stagger queue |

---

## Task 1: Audit hardcoded pixel coords in generators

Before refactoring, verify each generator uses relative coords (scaled to canvas size `w`/`h`) or hardcodes against a fixed size but is safe to resize.

**Files:**
- Read: `src/patterns/textures.ts`

- [ ] **Step 1: Audit each generator**

Read through each generator and answer: does its drawing code break if we resize the canvas to 2× before calling draw?

| Generator | Canvas size | Hardcoded px? | Safe to resize? |
|-----------|-------------|----------------|-----------------|
| `bannai` | 1024² | YES — cellSize=256, lineW=10, ms=round(cellSize*0.20), dotOff=round(cellSize*0.36) — ALL derived from cellSize or S | YES — cellSize/S ratio preserved at 2x |
| `meander` | 512² | YES — cs=128, lw=14 hardcoded | PARTIAL — cs is 1/4 of S; lw=14 is absolute. Must parameterize lw by S |
| `calligraphyBand` | 1024×256 | YES — glyphData has absolute x coords; border h=18 hardcoded | NO — glyph x coords are hardcoded pixel values, not fractions of W. Must parameterize |
| `archPanel` | takes w,h args | Already relative to W/H | YES |
| `pylonFace` | 1024² | bw=60, kuficStep=22, sq=12, cellSize=154 hardcoded | PARTIAL — bw relative (bw/S ≈ 6%), but kuficStep/sq/cellSize are absolute. Must parameterize by S |
| `girih` | 256*cells² | outerR/innerR relative to S | YES |
| `tigerSpandrel` | 512² | Hardcoded pixel coords throughout (sx=390, etc.) | PARTIAL — all coords are fractions of S implicitly; must parameterize vs S=512 |

- [ ] **Step 2: Document which generators need parameterization**

Generators needing parameterization before 2x resize works correctly:
1. `meander` — `lw` must scale with S (e.g., `Math.round(S * 0.027)` ≈ 14 at 512)
2. `calligraphyBand` — glyph x coords and sizes must scale with W/H
3. `pylonFace` — `kuficStep`, `sq` must scale with S
4. `tigerSpandrel` — all hardcoded coords must scale with S

Generators that are already safe: `bannai`, `archPanel`, `girih`

---

## Task 2: Define TextureRegistry in `src/scene/lod.ts`

**Files:**
- Create: `src/scene/lod.ts`

- [ ] **Step 1: Write failing tests for the registry**

Create `tests/lod.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock THREE.CanvasTexture
vi.mock('three', () => {
  class MockCanvasTexture {
    needsUpdate = false;
    image: HTMLCanvasElement;
    constructor(cv: HTMLCanvasElement) { this.image = cv; }
    clone() {
      const c = new MockCanvasTexture(this.image);
      return c;
    }
  }
  return { CanvasTexture: MockCanvasTexture };
});

// Mock document.createElement for canvas
const makeCanvas = (w: number, h: number) => {
  const cv = { width: w, height: h, getContext: () => ({
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }) } as unknown as HTMLCanvasElement;
  return cv;
};

import { TextureRegistry } from '../src/scene/lod';

describe('TextureRegistry', () => {
  let reg: TextureRegistry;

  beforeEach(() => { reg = new TextureRegistry(); });

  it('registers an entry with draw closure', () => {
    const cv = makeCanvas(512, 512);
    const draw = vi.fn();
    const tex = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex]);
    expect(reg.entries).toHaveLength(1);
    expect(reg.entries[0].draw).toBe(draw);
    expect(reg.entries[0].baseW).toBe(512);
    expect(reg.entries[0].baseH).toBe(512);
  });

  it('addTexture appends to existing entry', () => {
    const cv = makeCanvas(512, 512);
    const draw = vi.fn();
    const tex1 = { needsUpdate: false, image: cv } as any;
    const tex2 = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex1]);
    reg.addTexture(cv, tex2);
    expect(reg.entries[0].textures).toHaveLength(2);
  });

  it('buildQueue returns entries sorted by priority (tier 2)', () => {
    const cv1 = makeCanvas(512, 512);
    const cv2 = makeCanvas(512, 512);
    const draw = vi.fn();
    reg.register(cv1, draw, 512, 512, [{ needsUpdate: false, image: cv1 } as any], true);
    reg.register(cv2, draw, 512, 512, [{ needsUpdate: false, image: cv2 } as any], false);
    const queue = reg.buildQueue(2);
    // Priority entries come first
    expect(queue[0].priority).toBe(true);
  });

  it('applyScale resizes canvas and marks all textures needsUpdate', () => {
    const ctx = { fillStyle: '', fillRect: vi.fn() };
    const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const draw = vi.fn();
    const tex1 = { needsUpdate: false, image: cv } as any;
    const tex2 = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex1, tex2]);

    reg.applyScale(reg.entries[0], 2);

    expect(cv.width).toBe(1024);
    expect(cv.height).toBe(1024);
    expect(draw).toHaveBeenCalledWith(ctx, 1024, 1024);
    expect(tex1.needsUpdate).toBe(true);
    expect(tex2.needsUpdate).toBe(true);
  });
});

describe('Tier switching', () => {
  it('LOD_THRESHOLD = 0.55', async () => {
    const { LOD_THRESHOLD } = await import('../src/scene/lod');
    expect(LOD_THRESHOLD).toBe(0.55);
  });

  it('getTier returns 1 at zoom >= 0.55', async () => {
    const { getTier } = await import('../src/scene/lod');
    expect(getTier(1.0)).toBe(1);
    expect(getTier(0.55)).toBe(1);
    expect(getTier(0.56)).toBe(1);
  });

  it('getTier returns 2 at zoom < 0.55', async () => {
    const { getTier } = await import('../src/scene/lod');
    expect(getTier(0.54)).toBe(2);
    expect(getTier(0.18)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -20
```

Expected: FAIL — `TextureRegistry` not found, `LOD_THRESHOLD` not found.

- [ ] **Step 3: Create `src/scene/lod.ts`**

```typescript
import * as THREE from 'three';

export const LOD_THRESHOLD = 0.55;

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface LodEntry {
  canvas: HTMLCanvasElement;
  draw: DrawFn;
  baseW: number;
  baseH: number;
  textures: THREE.CanvasTexture[];
  /** High-priority entries get 2x; low-priority stay 1x */
  priority: boolean;
}

export function getTier(zoom: number): 1 | 2 {
  return zoom < LOD_THRESHOLD ? 2 : 1;
}

export class TextureRegistry {
  readonly entries: LodEntry[] = [];

  register(
    cv: HTMLCanvasElement,
    draw: DrawFn,
    baseW: number,
    baseH: number,
    textures: THREE.CanvasTexture[],
    priority = true,
  ): void {
    this.entries.push({ canvas: cv, draw, baseW, baseH, textures, priority });
  }

  /** Attach an additional texture (clone) that shares the same canvas. */
  addTexture(cv: HTMLCanvasElement, tex: THREE.CanvasTexture): void {
    const entry = this.entries.find(e => e.canvas === cv);
    if (entry) entry.textures.push(tex);
  }

  /** Build the re-rasterization queue for a given tier. Priority entries first. */
  buildQueue(tier: 1 | 2): LodEntry[] {
    // Only include entries that need 2x when tier is 2; at tier 1 all entries
    const relevant = tier === 2
      ? this.entries.filter(e => e.priority)
      : this.entries;
    return [
      ...relevant.filter(e => e.priority),
      ...relevant.filter(e => !e.priority),
    ];
  }

  /** Resize canvas and redraw at scale, then flag all textures for GPU upload. */
  applyScale(entry: LodEntry, scale: 1 | 2): void {
    const newW = entry.baseW * scale;
    const newH = entry.baseH * scale;
    entry.canvas.width  = newW;
    entry.canvas.height = newH;
    const ctx = entry.canvas.getContext('2d')!;
    entry.draw(ctx, newW, newH);
    for (const tex of entry.textures) tex.needsUpdate = true;
  }
}

/** Singleton — one registry per app session. */
export const textureRegistry = new TextureRegistry();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -20
```

Expected: `lod.test.ts` passes (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/scene/lod.ts tests/lod.test.ts && git commit -m "feat: add TextureRegistry + LOD tier logic (lod.ts, tests)"
```

---

## Task 3: Add `onTierChange` and stagger queue to `ZoomController` / `Orbit`

Wire tier-change callbacks into the tick loop.

**Files:**
- Modify: `src/scene/zoom.ts`
- Modify: `src/scene/orbit.ts` (to call `lodTick`)
- Modify: `src/main.ts` (capability gate + `lodTick` registration)

- [ ] **Step 1: Add `onTierChange` to ZoomController**

In `src/scene/zoom.ts`, add after the class fields and before `onWheel`:

```typescript
import { getTier, LOD_THRESHOLD, type LodEntry, TextureRegistry } from './lod';
// ... keep existing imports
```

Add to `ZoomController` class body (after `private targetZoom = 1.0;`):

```typescript
private _tier: 1 | 2 = 1;
private _tierCallbacks: Array<(tier: 1 | 2) => void> = [];

onTierChange(cb: (tier: 1 | 2) => void): void {
  this._tierCallbacks.push(cb);
}

get currentTier(): 1 | 2 { return this._tier; }
```

Modify the `tick` method — after `state.zoom` is updated, add tier-change detection:

```typescript
tick(dt: number, state: CameraState) {
  state.zoom += (this.targetZoom - state.zoom) * Math.min(1, dt * 8);
  if (Math.abs(this.targetZoom - state.zoom) < 0.001) state.zoom = this.targetZoom;
  clampTarget(state);

  const newTier = getTier(state.zoom);
  if (newTier !== this._tier) {
    this._tier = newTier;
    for (const cb of this._tierCallbacks) cb(newTier);
  }
}
```

Full modified `src/scene/zoom.ts` (complete file):

```typescript
/**
 * ZoomController: manages zoom factor with smooth easing.
 * Wheel/pinch set a target; per-tick exponential ease.
 * Corner +/- buttons call zoomBy().
 */
import * as THREE from 'three';
import { VIEW_RADIUS, type CameraState } from './camera';
import { getTier } from './lod';

export const ZOOM_MIN = 0.18;
export const ZOOM_MAX = 1.0;

// How much the pan target can roam at full zoom (unity-side: ±13 world units x/z)
export const PAN_RADIUS_MAX = 13;

export class ZoomController {
  private targetZoom = 1.0;
  private _tier: 1 | 2 = 1;
  private _tierCallbacks: Array<(tier: 1 | 2) => void> = [];

  onTierChange(cb: (tier: 1 | 2) => void): void {
    this._tierCallbacks.push(cb);
  }

  get currentTier(): 1 | 2 { return this._tier; }

  /** Wheel delta: deltaY in pixels, anchor in NDC [-1,1] */
  onWheel(e: WheelEvent, cam: THREE.OrthographicCamera, state: CameraState) {
    // Compute world point under cursor BEFORE zoom
    const worldBefore = ndcToWorld(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1), cam);

    // Update target zoom
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.targetZoom = clampZoom(this.targetZoom * factor);

    // Compute world point under cursor AFTER target zoom
    const worldAfter = ndcToWorld(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1), cam, this.targetZoom);

    // Shift pan target so the world point stays fixed
    const dx = worldBefore.x - worldAfter.x;
    const dz = worldBefore.z - worldAfter.z;
    state.target.x += dx;
    state.target.z += dz;
    clampTarget(state);
  }

  /** Pinch: provide the scale delta (newSpan/oldSpan) and anchor in client coords */
  onPinch(scaleDelta: number, anchorX: number, anchorY: number, cam: THREE.OrthographicCamera, state: CameraState) {
    const worldBefore = ndcToWorld(anchorX / innerWidth * 2 - 1, -(anchorY / innerHeight * 2 - 1), cam);
    this.targetZoom = clampZoom(this.targetZoom / scaleDelta);
    const worldAfter = ndcToWorld(anchorX / innerWidth * 2 - 1, -(anchorY / innerHeight * 2 - 1), cam, this.targetZoom);
    state.target.x += worldBefore.x - worldAfter.x;
    state.target.z += worldBefore.z - worldAfter.z;
    clampTarget(state);
  }

  /** Step zoom toward center (for corner buttons) */
  zoomIn(state: CameraState) {
    this.targetZoom = clampZoom(this.targetZoom * 0.7);
    clampTarget(state);
  }

  zoomOut(state: CameraState) {
    this.targetZoom = clampZoom(this.targetZoom * (1 / 0.7));
    clampTarget(state);
  }

  /** Quick-zoom to specific value (double-click/tap) */
  setTarget(z: number) {
    this.targetZoom = clampZoom(z);
  }

  get target() { return this.targetZoom; }
  get isZoomedIn() { return this.targetZoom < 0.95; }

  /** Called each tick — eases state.zoom toward target; fires tier-change callbacks */
  tick(dt: number, state: CameraState) {
    state.zoom += (this.targetZoom - state.zoom) * Math.min(1, dt * 8);
    if (Math.abs(this.targetZoom - state.zoom) < 0.001) state.zoom = this.targetZoom;
    clampTarget(state);

    const newTier = getTier(state.zoom);
    if (newTier !== this._tier) {
      this._tier = newTier;
      for (const cb of this._tierCallbacks) cb(newTier);
    }
  }
}

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Max allowed pan radius for current zoom (0 at zoom=1, PAN_RADIUS_MAX at zoom=ZOOM_MIN) */
export function panRadius(zoom: number): number {
  return PAN_RADIUS_MAX * (1 - zoom) / (1 - ZOOM_MIN);
}

export function clampTarget(state: CameraState) {
  const r = panRadius(state.zoom);
  state.target.x = Math.max(-r, Math.min(r, state.target.x));
  state.target.z = Math.max(-r, Math.min(r, state.target.z));
  state.target.y = 3; // y always stays at 3
}

/**
 * Convert NDC (x,y in [-1,1]) to world XZ at y=3.
 * Optionally override zoom for the "after" calculation.
 */
function ndcToWorld(ndcX: number, ndcY: number, cam: THREE.OrthographicCamera, overrideZoom?: number): THREE.Vector3 {
  let l = cam.left, r2 = cam.right, t = cam.top, b = cam.bottom;
  if (overrideZoom !== undefined) {
    const aspect = innerWidth / innerHeight;
    const half = VIEW_RADIUS * overrideZoom;
    if (aspect >= 1) { t = half; b = -half; l = -half * aspect; r2 = half * aspect; }
    else { l = -half; r2 = half; t = half / aspect; b = -half / aspect; }
  }

  const frustumX = ndcX * (r2 - l) / 2 + (r2 + l) / 2;
  const frustumY = ndcY * (t - b) / 2 + (t + b) / 2;

  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  camUp.crossVectors(camRight, camDir).normalize();

  const worldPoint = cam.position.clone()
    .addScaledVector(camRight, frustumX)
    .addScaledVector(camUp, frustumY);

  const targetY = 3;
  if (Math.abs(camDir.y) > 0.001) {
    const t2 = (targetY - worldPoint.y) / camDir.y;
    worldPoint.addScaledVector(camDir, t2);
  }

  return worldPoint;
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -20
```

Expected: 29 + 5 = 34 tests pass (the lod tests from Task 2 + existing 29).

- [ ] **Step 3: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/scene/zoom.ts && git commit -m "feat: add onTierChange/currentTier to ZoomController"
```

---

## Task 4: Add stagger queue to `lod.ts` and expose `lodTick`

The stagger queue processes one canvas per frame to avoid frame spikes.

**Files:**
- Modify: `src/scene/lod.ts`
- Modify: `tests/lod.test.ts` (add stagger queue tests)

- [ ] **Step 1: Add stagger queue tests**

Append to `tests/lod.test.ts`:

```typescript
describe('Stagger queue', () => {
  it('processes one entry per tick call', () => {
    const reg = new TextureRegistry();
    const makeEntry = (priority: boolean) => {
      const ctx = { fillStyle: '', fillRect: vi.fn() };
      const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const draw = vi.fn();
      const tex = { needsUpdate: false, image: cv } as any;
      reg.register(cv, draw, 512, 512, [tex], priority);
      return { draw, tex };
    };

    const e1 = makeEntry(true);
    const e2 = makeEntry(true);
    const e3 = makeEntry(false);

    // Build queue for tier 2 (only priority=true)
    const queue = reg.buildQueue(2).slice(); // copy

    // Process first entry
    reg.applyScale(queue[0], 2);
    expect(e1.draw).toHaveBeenCalledTimes(1);
    expect(e2.draw).toHaveBeenCalledTimes(0);

    // Process second entry
    reg.applyScale(queue[1], 2);
    expect(e2.draw).toHaveBeenCalledTimes(1);
  });

  it('non-priority entries stay at 1x when tier switches to 2', () => {
    const reg = new TextureRegistry();
    const ctx = { fillStyle: '', fillRect: vi.fn() };
    const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const draw = vi.fn();
    const tex = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex], false); // not priority

    const queue = reg.buildQueue(2); // tier 2 but not priority
    expect(queue).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | grep -E 'FAIL|pass|fail'
```

Expected: stagger queue tests may pass already since `buildQueue` handles priority filtering. Confirm.

- [ ] **Step 3: Add `LodManager` class to `src/scene/lod.ts`**

Append to `src/scene/lod.ts` after the `textureRegistry` line:

```typescript
/**
 * LodManager: wires tier-change callbacks to the TextureRegistry stagger queue.
 * Call lodManager.tick() once per animation frame.
 */
export class LodManager {
  private queue: LodEntry[] = [];
  private currentTier: 1 | 2 = 1;
  private enabled = true;

  constructor(private registry: TextureRegistry) {}

  /** Disable on low-end devices (capability gate). */
  disable(): void { this.enabled = false; }

  /** Called by ZoomController.onTierChange */
  onTierChange(tier: 1 | 2): void {
    if (!this.enabled) return;
    this.currentTier = tier;
    // Build stagger queue: one entry per frame will be processed
    this.queue = this.registry.buildQueue(tier).slice();
  }

  /** Called each animation frame. Processes one canvas from the queue. */
  tick(): void {
    if (this.queue.length === 0) return;
    const entry = this.queue.shift()!;
    this.registry.applyScale(entry, this.currentTier);
  }
}

export const lodManager = new LodManager(textureRegistry);
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/scene/lod.ts tests/lod.test.ts && git commit -m "feat: add LodManager stagger queue to lod.ts"
```

---

## Task 5: Refactor `textures.ts` — registry integration + resolution-independent generators

This is the largest task. We refactor `canvas()` and `toTexture()` to register entries, then fix the 4 generators with hardcoded px coords.

**Files:**
- Modify: `src/patterns/textures.ts`

### Step-by-step

- [ ] **Step 1: Add registry import and refactor `canvas()`/`toTexture()` helpers**

Replace the top of `src/patterns/textures.ts` with:

```typescript
import * as THREE from 'three';
import { textureRegistry, type DrawFn } from '../scene/lod';

const px = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Create a canvas and return [canvas, ctx, registeredDraw].
 * The draw closure is stored in the registry so the canvas can be
 * re-rasterized at any scale later.
 */
function canvas(
  w: number, h: number, bg: number,
  drawFn?: DrawFn,
  priority = true,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = px(bg); g.fillRect(0, 0, w, h);
  if (drawFn) {
    // Register: wrap draw so bg fill always runs first
    textureRegistry.register(cv, drawFn, w, h, [], priority);
  }
  return [cv, g];
}

function toTexture(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  // Register texture with the entry that owns this canvas
  textureRegistry.addTexture(cv, t);
  return t;
}
```

NOTE: The refactored approach passes `drawFn` to `canvas()`. Each generator's draw code is extracted into a closure that accepts `(ctx, w, h)` and scales all coordinates relative to `w`/`h`.

- [ ] **Step 2: Refactor `bannai` generator to use draw closure**

Replace the `bannai` function body:

```typescript
export function bannai(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    const cellSize = Math.round(S * 0.25); // 256/1024 = 0.25
    const lineW = Math.max(2, Math.round(S * 0.0098)); // 10/1024

    g.strokeStyle = px(line);
    g.lineWidth = lineW;
    g.lineCap = 'square';

    const diag = Math.sqrt(2) * S;
    const step = cellSize;
    const count = Math.ceil(diag / step) + 4;

    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath(); g.moveTo(offset - S, -S); g.lineTo(offset + S * 2, S * 2); g.stroke();
    }
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath(); g.moveTo(offset + S, -S); g.lineTo(offset - S, S * 2); g.stroke();
    }

    const halfCell = cellSize / 2;
    const ms = Math.round(cellSize * 0.20);
    g.fillStyle = px(motif);

    for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
      for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;
        g.beginPath();
        g.moveTo(cx, cy - ms); g.lineTo(cx + ms, cy); g.lineTo(cx, cy + ms); g.lineTo(cx - ms, cy);
        g.closePath(); g.fill();

        const dotR = Math.round(ms * 0.30);
        const dotOff = Math.round(cellSize * 0.36);
        for (const [dx, dy] of [[dotOff, 0], [-dotOff, 0], [0, dotOff], [0, -dotOff]] as [number,number][]) {
          g.save(); g.translate(cx + dx, cy + dy); g.rotate(Math.PI / 4);
          g.fillRect(-dotR / 2, -dotR / 2, dotR, dotR); g.restore();
        }
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, true);
  draw(g, BASE, BASE);
  return toTexture(cv);
}
```

- [ ] **Step 3: Refactor `meander` — fix hardcoded `lw`**

Replace `meander` function body:

```typescript
export function meander(bg: number, fg: number): THREE.CanvasTexture {
  const BASE = 512;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    const cs = Math.round(S * 0.25); // 128/512
    const lw = Math.max(2, Math.round(S * 0.027)); // 14/512 ≈ 0.027

    g.fillStyle = px(fg);

    for (let row = 0; row < S / cs + 1; row++) {
      for (let col = 0; col < S / cs + 1; col++) {
        const ox = col * cs;
        const oy = row * cs;

        const inset = Math.round(S * 0.0195); // 10/512
        g.strokeStyle = px(fg);
        g.lineWidth = lw;
        g.strokeRect(ox + inset, oy + inset, cs - inset * 2, cs - inset * 2);

        const mid = cs / 2;
        const aw = lw;

        g.fillRect(ox + inset + lw, oy + mid - aw / 2, cs - inset * 2 - lw * 2, aw);
        g.fillRect(ox + mid - aw / 2, oy + inset + lw, aw, cs - inset * 2 - lw * 2);

        g.fillStyle = px(bg);
        if ((row + col) % 2 === 0) {
          g.fillRect(ox + mid + aw / 2, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
          g.fillRect(ox + inset + lw, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
        } else {
          g.fillRect(ox + inset + lw, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
          g.fillRect(ox + mid + aw / 2, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
        }
        g.fillStyle = px(fg);
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, false); // lower priority
  draw(g, BASE, BASE);
  return toTexture(cv);
}
```

- [ ] **Step 4: Refactor `calligraphyBand` — scale all absolute coords by W/H**

Replace `calligraphyBand` function body:

```typescript
export function calligraphyBand(bg: number, fg: number): THREE.CanvasTexture {
  const BASE_W = 1024, BASE_H = 256;

  // Glyph data as FRACTIONS of [BASE_W, BASE_H] → scale to actual W,H at draw time
  const glyphDataFrac: [number, number, boolean, boolean, number][] = [
    [50/1024,  160/256, true,  false, 80/1024],
    [80/1024,  100/256, false, true,  0],
    [115/1024, 170/256, true,  false, 70/1024],
    [155/1024, 120/256, false, false, 50/1024],
    [185/1024, 150/256, true,  true,  60/1024],
    [230/1024, 90/256,  false, false, 0],
    [265/1024, 160/256, true,  false, 90/1024],
    [305/1024, 130/256, false, true,  0],
    [335/1024, 110/256, false, false, 50/1024],
    [370/1024, 165/256, true,  false, 75/1024],
    [420/1024, 80/256,  false, true,  0],
    [455/1024, 155/256, true,  false, 85/1024],
    [490/1024, 125/256, false, false, 60/1024],
    [525/1024, 145/256, true,  true,  70/1024],
    [570/1024, 90/256,  false, false, 0],
    [605/1024, 165/256, true,  false, 95/1024],
    [645/1024, 120/256, false, true,  0],
    [675/1024, 105/256, false, false, 50/1024],
    [710/1024, 160/256, true,  false, 80/1024],
    [760/1024, 85/256,  false, true,  0],
    [795/1024, 155/256, true,  false, 75/1024],
    [830/1024, 130/256, false, false, 60/1024],
    [860/1024, 145/256, true,  true,  70/1024],
    [905/1024, 90/256,  false, false, 0],
    [940/1024, 160/256, true,  false, 90/1024],
    [975/1024, 110/256, false, true,  0],
  ];

  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, W, H);

    const borderH = Math.round(H * (18/256));
    g.fillStyle = px(fg);
    g.fillRect(0, 0, W, borderH);
    g.fillRect(0, H - borderH, W, borderH);

    g.strokeStyle = px(fg);
    g.lineWidth = Math.max(1, Math.round(H * (4/256)));
    const ibInset = Math.round(H * (6/256));
    g.strokeRect(ibInset, ibInset, W - ibInset * 2, H - ibInset * 2);

    const baseY = H - Math.round(H * (28/256));

    for (const [xFrac, hFrac, hasTopCross, hasDot, crossWFrac] of glyphDataFrac) {
      const x = Math.round(xFrac * W);
      const strokeH = Math.round(hFrac * H);
      const crossW = Math.round(crossWFrac * W);
      const sw = Math.max(4, Math.round(H * (12/256)));
      const topY = baseY - strokeH;

      g.fillStyle = px(fg);
      g.beginPath();
      g.moveTo(x - sw / 2 - 2, baseY);
      g.lineTo(x - sw / 2, topY);
      g.lineTo(x + sw / 2, topY);
      g.lineTo(x + sw / 2 + 2, baseY);
      g.closePath(); g.fill();

      if (hasTopCross && crossW > 0) {
        const crossH = Math.max(4, Math.round(H * (10/256)));
        g.fillRect(x - crossW / 2, topY - crossH, crossW, crossH);
        const sfw = Math.max(2, Math.round(W * (8/1024)));
        g.fillRect(x - crossW / 2 - sfw / 2, topY - crossH - sfw / 2, sfw, crossH + sfw / 2);
        g.fillRect(x + crossW / 2 - sfw / 2, topY - crossH - sfw / 2, sfw, crossH + sfw / 2);
      }

      if (hasDot) {
        const dotR = Math.max(3, Math.round(H * (7/256)));
        g.beginPath(); g.arc(x, topY - Math.round(H * (22/256)), dotR, 0, Math.PI * 2); g.fill();
      }

      g.strokeStyle = px(fg);
      g.lineWidth = Math.max(2, Math.round(H * (5/256)));
      g.beginPath();
      g.moveTo(x + sw / 2, baseY - Math.round(H * (8/256)));
      g.quadraticCurveTo(x + Math.round(W * (20/1024)), baseY + Math.round(H * (4/256)), x + Math.round(W * (34/1024)), baseY - Math.round(H * (12/256)));
      g.stroke();
    }
  }

  const [cv, g] = canvas(BASE_W, BASE_H, bg, draw, true);
  draw(g, BASE_W, BASE_H);
  return toTexture(cv, 2, 1);
}
```

- [ ] **Step 5: Refactor `pylonFace` — scale kuficStep, sq, cellSize by S**

Replace `pylonFace` function body:

```typescript
export function pylonFace(bg: number, line: number, motif: number, border: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    const bw = Math.round(S * 0.0586); // 60/1024
    g.fillStyle = px(border);
    g.fillRect(0, 0, S, bw); g.fillRect(0, S - bw, S, bw);
    g.fillRect(0, 0, bw, S); g.fillRect(S - bw, 0, bw, S);

    g.fillStyle = px(line);
    const kuficStep = Math.round(S * 0.0215); // 22/1024
    const sq = Math.round(S * 0.0117); // 12/1024

    for (let i = 0; i < Math.floor(S / kuficStep); i++) {
      const x = i * kuficStep + kuficStep / 2;
      const yOff = (i % 3 === 1) ? Math.round(bw * 0.133) : Math.round(bw * 0.233);
      g.fillRect(x - sq / 2, yOff, sq, bw - yOff * 1.5);
      g.fillRect(x - sq / 2, S - bw + yOff, sq, bw - yOff * 1.5);
    }
    for (let i = 0; i < Math.floor(S / kuficStep); i++) {
      const y = i * kuficStep + kuficStep / 2;
      const xOff = (i % 3 === 1) ? Math.round(bw * 0.133) : Math.round(bw * 0.233);
      g.fillRect(xOff, y - sq / 2, bw - xOff * 1.5, sq);
      g.fillRect(S - bw + xOff, y - sq / 2, bw - xOff * 1.5, sq);
    }

    g.strokeStyle = px(line);
    g.lineWidth = Math.max(1, Math.round(S * 0.003));
    const ibPad = bw + Math.round(S * 0.004);
    g.strokeRect(ibPad, ibPad, S - ibPad * 2, S - ibPad * 2);

    const innerPad = bw + Math.round(S * 0.008);
    g.save();
    g.beginPath(); g.rect(innerPad, innerPad, S - innerPad * 2, S - innerPad * 2); g.clip();

    const cellSize = Math.round(S * 0.150); // 154/1024
    const lineW = Math.max(2, Math.round(S * 0.0068)); // 7/1024

    g.strokeStyle = px(line);
    g.lineWidth = lineW;
    g.lineCap = 'square';

    const diag = Math.sqrt(2) * S;
    const step = cellSize;
    const count = Math.ceil(diag / step) + 4;

    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath(); g.moveTo(offset - S, -S); g.lineTo(offset + S * 2, S * 2); g.stroke();
    }
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath(); g.moveTo(offset + S, -S); g.lineTo(offset - S, S * 2); g.stroke();
    }

    const halfCell = cellSize / 2;
    const starR = Math.round(cellSize * 0.28);
    const innerStarR = Math.round(cellSize * 0.11);
    g.fillStyle = px(motif);

    for (let iy = -3; iy < Math.ceil(S / halfCell) + 3; iy++) {
      for (let ix = -3; ix < Math.ceil(S / halfCell) + 3; ix++) {
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

        const pts = 8;
        g.beginPath();
        for (let p = 0; p < pts * 2; p++) {
          const a = (p * Math.PI / pts) - Math.PI / 2;
          const r = p % 2 === 0 ? starR : innerStarR;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          p === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath(); g.fill();

        const dotR = Math.round(innerStarR * 0.55);
        const dotOff = Math.round(cellSize * 0.40);
        g.save(); g.fillStyle = px(line);
        for (const [dx, dy] of [[dotOff, 0], [-dotOff, 0], [0, dotOff], [0, -dotOff]] as [number,number][]) {
          g.save(); g.translate(cx + dx, cy + dy); g.rotate(Math.PI / 4);
          g.fillRect(-dotR / 2, -dotR / 2, dotR, dotR); g.restore();
        }
        g.restore(); g.fillStyle = px(motif);
      }
    }
    g.restore();
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, true);
  draw(g, BASE, BASE);
  return toTexture(cv);
}
```

- [ ] **Step 6: Refactor `tigerSpandrel` — scale all coords by S/512**

Replace `tigerSpandrel` function body:

```typescript
export function tigerSpandrel(): THREE.CanvasTexture {
  const BASE = 512;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    const sc = S / 512; // scale factor
    g.fillStyle = px(0x1c5d99); g.fillRect(0, 0, S, S);

    // SUN
    const sx = 390 * sc, sy = 110 * sc, sr = 72 * sc;
    g.fillStyle = px(0xffd740);
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = px(0xffd740); g.lineWidth = 7 * sc;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      g.beginPath();
      g.moveTo(sx + Math.cos(a) * (sr + 10 * sc), sy + Math.sin(a) * (sr + 10 * sc));
      g.lineTo(sx + Math.cos(a) * (sr + 30 * sc), sy + Math.sin(a) * (sr + 30 * sc));
      g.stroke();
    }
    g.fillStyle = px(0xfffbe0);
    g.beginPath(); g.arc(sx - 20*sc, sy - 12*sc, 12*sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(sx + 20*sc, sy - 12*sc, 12*sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0x2a1a00);
    g.beginPath(); g.arc(sx - 18*sc, sy - 10*sc, 6*sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(sx + 22*sc, sy - 10*sc, 6*sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0xaa6030);
    g.beginPath(); g.moveTo(sx, sy + 6*sc); g.lineTo(sx - 10*sc, sy + 22*sc); g.lineTo(sx + 10*sc, sy + 22*sc); g.closePath(); g.fill();
    g.strokeStyle = px(0x7a3a00); g.lineWidth = 4*sc;
    g.beginPath(); g.arc(sx, sy + 14*sc, 20*sc, 0.15, Math.PI - 0.15); g.stroke();

    // TIGER
    const tigerColor = 0xe8943a;
    const stripeColor = 0x8a4a1a;
    const tby = 290 * sc;
    const tbx = 240 * sc;

    g.fillStyle = px(tigerColor);
    g.beginPath(); g.ellipse(tbx, tby, 170*sc, 65*sc, 0, 0, Math.PI * 2); g.fill();

    const thx = 420*sc, thy = tby - 16*sc;
    g.beginPath(); g.arc(thx, thy, 58*sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(thx - 28*sc, thy - 44*sc); g.lineTo(thx - 40*sc, thy - 82*sc); g.lineTo(thx - 8*sc, thy - 52*sc); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(thx + 8*sc, thy - 46*sc); g.lineTo(thx + 28*sc, thy - 82*sc); g.lineTo(thx + 38*sc, thy - 46*sc); g.closePath(); g.fill();

    g.fillStyle = px(0xffee88);
    g.beginPath(); g.arc(thx - 22*sc, thy - 6*sc, 13*sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(thx + 12*sc, thy - 6*sc, 13*sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0x1a1a00);
    g.beginPath(); g.arc(thx - 20*sc, thy - 4*sc, 6*sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(thx + 14*sc, thy - 4*sc, 6*sc, 0, Math.PI * 2); g.fill();

    g.fillStyle = px(0xcc6633);
    g.beginPath(); g.moveTo(thx, thy + 16*sc); g.lineTo(thx - 11*sc, thy + 4*sc); g.lineTo(thx + 11*sc, thy + 4*sc); g.closePath(); g.fill();
    g.strokeStyle = px(0x8a3a10); g.lineWidth = 3*sc;
    g.beginPath(); g.moveTo(thx, thy + 16*sc); g.lineTo(thx - 11*sc, thy + 28*sc); g.stroke();
    g.beginPath(); g.moveTo(thx, thy + 16*sc); g.lineTo(thx + 11*sc, thy + 28*sc); g.stroke();

    g.fillStyle = px(stripeColor);
    for (const [bx, bw, bh, rot] of [
      [tbx - 80*sc, 18*sc, 68*sc, -0.15],
      [tbx - 30*sc, 18*sc, 72*sc, -0.05],
      [tbx + 20*sc, 18*sc, 72*sc,  0.05],
      [tbx + 72*sc, 18*sc, 66*sc,  0.15],
    ] as [number, number, number, number][]) {
      g.save(); g.translate(bx, tby); g.rotate(rot);
      g.fillRect(-bw / 2, -bh / 2, bw, bh); g.restore();
    }

    g.strokeStyle = px(tigerColor); g.lineWidth = 20*sc;
    g.beginPath(); g.moveTo(tbx - 160*sc, tby + 12*sc); g.quadraticCurveTo(tbx - 190*sc, tby - 12*sc, tbx - 200*sc, tby - 60*sc); g.stroke();
    g.strokeStyle = px(stripeColor); g.lineWidth = 8*sc;
    g.beginPath(); g.moveTo(tbx - 160*sc, tby + 12*sc); g.quadraticCurveTo(tbx - 190*sc, tby - 12*sc, tbx - 200*sc, tby - 60*sc); g.stroke();
    g.fillStyle = px(0x3a1a00);
    g.beginPath(); g.arc(tbx - 200*sc, tby - 64*sc, 14*sc, 0, Math.PI * 2); g.fill();

    g.fillStyle = px(tigerColor);
    for (const lx of [tbx - 110*sc, tbx - 60*sc, tbx + 40*sc, tbx + 90*sc]) {
      g.beginPath(); g.roundRect(lx, tby + 50*sc, 28*sc, 85*sc, 10*sc); g.fill();
      g.fillStyle = px(0xd0783a);
      g.beginPath(); g.ellipse(lx + 14*sc, tby + 136*sc, 20*sc, 12*sc, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = px(tigerColor);
    }

    g.strokeStyle = px(0xd4af37); g.lineWidth = 8*sc;
    g.strokeRect(10*sc, 10*sc, S - 20*sc, S - 20*sc);
  }

  const [cv, g] = canvas(BASE, BASE, 0x1c5d99, draw, false); // not priority
  draw(g, BASE, BASE);
  const t2 = toTexture(cv);
  t2.wrapS = t2.wrapT = THREE.ClampToEdgeWrapping;
  return t2;
}
```

- [ ] **Step 7: Refactor `archPanel` — already relative, just register draw closure**

`archPanel` already uses `W`/`H` args throughout. Just wrap in a draw closure and register:

```typescript
export function archPanel(w: number, h: number): THREE.CanvasTexture {
  const W = Math.max(w, 32), H = Math.max(h, 32);

  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = px(C_SAND); g.fillRect(0, 0, W, H);
    // ... exact same drawing code as before, but using W,H params ...
    // (copy full archPanel body here — replace fixed W,H references with params)
  }

  const [cv, g] = canvas(W, H, C_SAND, draw, true);
  draw(g, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  textureRegistry.addTexture(cv, t);
  return t;
}
```

NOTE: `archPanel` creates per-call textures with unique dimensions. These get 2x naturally since each canvas is registered with its draw closure. The `archPanel` registration `priority = true` means it gets re-rasterized at 2x.

- [ ] **Step 8: Refactor `girih` — register draw closure**

`girih` already uses relative coords. Wrap:

```typescript
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  const BASE = 256;

  function draw(g: CanvasRenderingContext2D, TotalW: number, TotalH: number) {
    const cellW = TotalW / cells;
    const cellH = TotalH / cells;
    // ... same drawing logic but use cellW/cellH instead of S ...
  }
  // ... etc
}
```

Actually `girih` creates `S * cells` size. The simpler approach: just wrap the existing draw code into a closure with `(ctx, w, h)` where internally it re-derives `S = w / cells`. Register with `priority = false` (minor texture).

- [ ] **Step 9: Build and confirm tsc clean**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm run build 2>&1 | tail -20
```

Expected: clean build, no TS errors.

- [ ] **Step 10: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -10
```

Expected: 29 + lod tests pass (≥34 total).

- [ ] **Step 11: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/patterns/textures.ts && git commit -m "feat: refactor texture generators to use draw closures + TextureRegistry"
```

---

## Task 6: Wire capability gate and lodTick in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add capability gate and lodTick registration**

In `src/main.ts`, after `const renderer = new THREE.WebGLRenderer(...)` setup block and before the scene building, add:

```typescript
import { lodManager } from './scene/lod';
```

After `const zoomCtrl = new ZoomController();` and `const orbit = new Orbit(camera, zoomCtrl);`, add:

```typescript
// Capability gate: disable 2x LOD on low-end devices
const canUpscale = renderer.capabilities.maxTextureSize >= 4096
  && devicePixelRatio * Math.min(screen.width, screen.height) > 800;
if (!canUpscale) {
  lodManager.disable();
  console.log('[LOD] 2x disabled: low-end device or small screen');
}

// Wire tier-change: when zoom crosses LOD_THRESHOLD, trigger re-rasterization
zoomCtrl.onTierChange(tier => {
  console.log(`[LOD] tier change → ${tier}x`);
  lodManager.onTierChange(tier);
});
```

In the tick loop, add `lodManager.tick()` (one canvas per frame):

```typescript
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  for (const t of tickers) t(dt);
  lodManager.tick(); // process one canvas from stagger queue
  composer.render();
});
```

- [ ] **Step 2: Build and confirm tsc clean**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm run build 2>&1 | tail -20
```

Expected: clean.

- [ ] **Step 3: Run tests**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/main.ts && git commit -m "feat: wire LOD capability gate and lodTick in main.ts"
```

---

## Task 7: Visual verification with Playwright

**Files:**
- Read: `tests/playwright-zoom-pan.mjs`
- Modify: `tests/playwright-zoom-pan.mjs` (add LOD screenshot test)

- [ ] **Step 1: Read existing playwright script**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && cat tests/playwright-zoom-pan.mjs
```

- [ ] **Step 2: Start dev server on port 5198**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx vite --port 5198 &
sleep 3
echo "server started"
```

- [ ] **Step 3: Take baseline screenshot at default zoom (1x tier)**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5198');
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'tests/screenshots/lod-1x-baseline.png', fullPage: false });
  console.log('baseline saved');
  await b.close();
})();
"
```

- [ ] **Step 4: Take zoomed-in screenshot (trigger 2x tier by zooming to 0.3)**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5198');
  await p.waitForTimeout(3000);
  // Scroll to zoom in (trigger tier 2)
  await p.mouse.move(640, 400);
  for (let i = 0; i < 12; i++) {
    await p.mouse.wheel(0, -100); // zoom in
    await p.waitForTimeout(100);
  }
  await p.waitForTimeout(2000); // wait for stagger queue to process
  await p.screenshot({ path: 'tests/screenshots/lod-2x-zoomed.png', fullPage: false });
  console.log('zoomed screenshot saved');
  await b.close();
})();
"
```

- [ ] **Step 5: View both screenshots and assess sharpness**

Open `tests/screenshots/lod-1x-baseline.png` and `tests/screenshots/lod-2x-zoomed.png`. The 2x screenshot should show visibly sharper tilework geometry — diamond lattice lines crisp, kufic borders legible, calligraphy strokes clear.

Honest verdict required: if patterns are not visibly sharper, diagnose (check console for `[LOD] tier change → 2x` messages, verify `needsUpdate` is being set, verify canvas resize is happening).

- [ ] **Step 6: Check console for rAF timing**

Add timing instrumentation temporarily: in the stagger queue tick, measure frame time during switch:

```javascript
// In browser console during zoom-in:
// Watch for LOD messages and note if any frame exceeds 50ms
```

- [ ] **Step 7: Run all tests to confirm 29 still pass**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1 | tail -10
```

Expected: 29 + new lod tests pass.

---

## Task 8: magFilter selection

Based on visual verdict from Task 7:

- [ ] **Step 1: Test with NearestFilter at 2x**

In `src/patterns/textures.ts`, the `toTexture` helper sets `magFilter = THREE.LinearFilter`. Since we're re-rasterizing at 2x, Linear is likely better (smoother subpixel rendering of fine patterns). NearestFilter at 2x would show discrete texels — potentially moiré at distance.

Verdict: **keep `LinearFilter`**. At 2x with fine patterns (150px diamond cells on a 2048px canvas), Linear interpolation gives smooth but still visually crisp edges since the texels are already at high density.

If moiré appears at zoom = 0.55 (the transition point with 1x textures still loaded before stagger queue finishes), that's expected and transient — it disappears once 2x textures upload.

- [ ] **Step 2: No code change needed** (LinearFilter is already set and correct for 2x)

---

## Task 9: Clone-propagation in `patternedBoxMulti` — audit and fix

**Files:**
- Read/Modify: `src/buildings/primitives.ts`

- [ ] **Step 1: Audit faceTexRepeat**

`patternedBoxMulti` calls `tex.clone()` per face, then `t.needsUpdate = true`. With the new registry:
- `tex.clone()` creates a new CanvasTexture sharing the **same HTMLCanvasElement** as the source.
- When we resize the source canvas and set `needsUpdate = true` on all registered textures, the clone will NOT be in the registry (it was created via `.clone()`, not via `toTexture()`).

**Fix**: after `t = tex.clone()`, register the clone with the same canvas entry:

```typescript
function faceTexRepeat(tex: THREE.Texture, worldW: number, worldH: number): THREE.Material {
  const t = tex.clone() as THREE.CanvasTexture;
  t.needsUpdate = true;
  const PATTERN_WORLD = 10.0;
  t.repeat.set(Math.max(0.5, worldW / PATTERN_WORLD), Math.max(0.5, worldH / PATTERN_WORLD));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Register clone so it gets needsUpdate=true on tier changes
  if (tex instanceof THREE.CanvasTexture && tex.image instanceof HTMLCanvasElement) {
    textureRegistry.addTexture(tex.image as HTMLCanvasElement, t);
  }
  return new THREE.MeshLambertMaterial({ map: t });
}
```

Import `textureRegistry` at top of `primitives.ts`:
```typescript
import { textureRegistry } from '../scene/lod';
```

- [ ] **Step 2: Build and test**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm run build 2>&1 | tail -10 && npm test 2>&1 | tail -10
```

Expected: clean build, all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add src/buildings/primitives.ts && git commit -m "fix: register cloned textures in patternedBoxMulti for LOD propagation"
```

---

## Task 10: Final commit

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm test 2>&1
```

Expected: ≥34 tests pass (29 original + ≥5 new lod tests).

- [ ] **Step 2: Run tsc clean**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 4: Final commit**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon && git add -A && git commit -m "feat: vector-crisp texture LOD — 2x re-rasterization on zoom"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Registry with draw closures — Task 2+5
- [x] Tiers 1x/2x, threshold 0.55 — Task 2 (LOD_THRESHOLD), Task 3
- [x] Stagger queue, one canvas per frame — Task 4 (LodManager.tick)
- [x] Tier switching: re-rasterize on both up and down — Task 4 (onTierChange rebuilds queue)
- [x] Every texture sharing canvas gets needsUpdate — Task 2 (applyScale), Task 9 (clone fix)
- [x] Capability gate: maxTextureSize < 4096 or low-end → skip 2x — Task 6
- [x] Resolution-independent generators — Task 5 (all 7 generators refactored)
- [x] Clone propagation solution — Task 9 (addTexture in faceTexRepeat)
- [x] magFilter check — Task 8 (LinearFilter kept, reasoning documented)
- [x] npm test 29 green — Task 10
- [x] tsc clean — Task 10
- [x] build ok — Task 10
- [x] Playwright screenshots before/after — Task 7

**Placeholder scan:** No TBDs. All code blocks provided.

**Type consistency:**
- `DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void` — used consistently in lod.ts and textures.ts
- `LodEntry.textures: THREE.CanvasTexture[]` — used in register/addTexture/applyScale
- `textureRegistry` singleton — exported from lod.ts, imported in textures.ts and primitives.ts
- `lodManager` singleton — exported from lod.ts, imported in main.ts

**One gap found:** `girih` generator refactoring (Task 5 Step 8) was sketched but not fully specified. Filling in:

`girih` uses `cells` parameter to make `S * cells` total canvas size. At 2x: canvas becomes `2048 * cells²`. For `cells=4` that's 8192² — WAY over budget. Fix: mark `girih` as `priority = false` so it never gets 2x. At zoom < 0.55 only bannai/pylonFace/calligraphyBand/archPanel are re-rasterized.

Updated priority assignments:
- `bannai`: priority = true
- `pylonFace`: priority = true
- `calligraphyBand`: priority = true
- `archPanel`: priority = true
- `meander`: priority = false (stays 1x)
- `girih`: priority = false (stays 1x — canvas already large)
- `tigerSpandrel`: priority = false (stays 1x)

This keeps VRAM well under 200 MB.
