# Registon — MV-Style Interactive Registan Square — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen web app where a character walks Registan Square (plaza + three madrasah facades) in Monument Valley style — Majolica & Sand palette, fixed sunset lighting, 8 bilingual (EN/Tajik) story hotspots.

**Architecture:** Vanilla Three.js + Vite + TypeScript. All geometry procedural (primitives), all ornament procedurally drawn canvas textures — zero asset files. Pure-logic modules (grid, A*, movement, i18n, hotspot triggers) are unit-tested with Vitest; visual modules are verified in the browser (canvas rasterization doesn't exist in jsdom/happy-dom — do not fake tests for them).

**Tech Stack:** three (latest), vite, typescript, vitest. Deploy: Cloudflare Pages via wrangler.

**Repo:** `/Users/kijon/Documents/Claude/Projects/Registon` (already a git repo; spec in `docs/superpowers/specs/`). App lives at repo root.

**Spec:** `docs/superpowers/specs/2026-06-10-registan-mv-design.md` — read it first.

**Conventions used throughout:**
- Grid coords `(x, y)` are tile indices; world coords are `(x, z)` floats, y-up.
- `TILE = 1` world unit. World origin = plaza center.
- Every material is `MeshLambertMaterial` (flat-shaded for boxes, smooth for domes) — no PBR.
- Commit after every task minimum; steps marked Commit are mandatory.

---

### Task 1: Scaffold — Vite + TS + Three + Vitest, full-screen sunset sky

**Files:**
- Create: project scaffold at repo root, `index.html`, `src/main.ts`, `src/palette.ts`, `src/scene/sky.ts`
- Test: none (no logic yet) — verification is the dev server rendering the gradient.

- [ ] **Step 1: Scaffold project**

```bash
cd /Users/kijon/Documents/Claude/Projects/Registon
npm create vite@latest . -- --template vanilla-ts   # accept "ignore existing files" / current dir
npm i three
npm i -D @types/three vitest
rm -f src/counter.ts src/typescript.svg public/vite.svg src/style.css
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Registon</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #f7b690; }
    #app { position: fixed; inset: 0; }
    #ui { position: fixed; inset: 0; pointer-events: none; font-family: Georgia, 'Times New Roman', serif; }
    #ui > * { pointer-events: auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="ui"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Write `src/palette.ts`**

```ts
export const C = {
  sand: 0xd9a96c, sandLight: 0xe8c08a, sandDark: 0xb8865a,
  plaza: 0xe9d3a3, plazaPath: 0xdfc28e,
  cobalt: 0x1c5d99, lapis: 0x123a66,
  turquoise: 0x3fc1c9, teal: 0x2a9da6,
  cream: 0xfff3da, gold: 0xd4af37,
  terracotta: 0xc94f4f, leaf: 0x7fae6a, trunk: 0x9a6b4f,
  dove: 0xf2ece0,
  skyTop: 0x8d6a9f, skyBottom: 0xf7b690, sun: 0xffb070,
} as const;
```

- [ ] **Step 4: Write `src/scene/sky.ts`** (canvas gradient as scene background)

```ts
import * as THREE from 'three';
import { C } from '../palette';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 512;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#' + C.skyTop.toString(16).padStart(6, '0'));
  grad.addColorStop(1, '#' + C.skyBottom.toString(16).padStart(6, '0'));
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

- [ ] **Step 5: Write `src/main.ts`** (renderer loop, nothing else yet)

```ts
import * as THREE from 'three';
import { makeSky } from './scene/sky';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSky();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200); // sized properly in Task 4

addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

const clock = new THREE.Clock();
const tickers: Array<(dt: number) => void> = [];
export function onTick(fn: (dt: number) => void) { tickers.push(fn); }

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const t of tickers) t(dt);
  renderer.render(scene, camera);
});

export { scene, camera, renderer };
```

- [ ] **Step 6: Verify**

Run: `npm run dev`, open the URL. Expected: full-screen peach→lavender gradient, no scrollbars, no console errors. Also run `npm test` → "No test files found" exits 0 (or passes trivially).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite+Three+Vitest, full-screen sunset sky"
```

---

### Task 2: World grid — layout map + parser (TDD)

The walkable world is an ASCII map: `#` blocked, `.` walkable, `1`–`8` walkable hotspot tiles, `S` walkable spawn. Pure logic — fully unit-tested.

**Files:**
- Create: `src/world/layout.ts`, `src/world/grid.ts`, `src/world/coords.ts`
- Test: `tests/grid.test.ts`, `tests/coords.test.ts`

- [ ] **Step 1: Write failing tests `tests/grid.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseLayout, isWalkable, hotspotAt } from '../src/world/grid';

const MAP = [
  '#####',
  '#.2.#',
  '#.#.#',
  '#S..#',
  '#####',
];

describe('parseLayout', () => {
  it('parses dimensions', () => {
    const g = parseLayout(MAP);
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(5);
  });
  it('finds spawn', () => {
    expect(parseLayout(MAP).spawn).toEqual({ x: 1, y: 3 });
  });
  it('walkability: walls blocked, floor/spawn/hotspots walkable, out-of-bounds blocked', () => {
    const g = parseLayout(MAP);
    expect(isWalkable(g, 0, 0)).toBe(false);
    expect(isWalkable(g, 1, 1)).toBe(true);
    expect(isWalkable(g, 1, 3)).toBe(true);
    expect(isWalkable(g, 2, 1)).toBe(true);
    expect(isWalkable(g, -1, 2)).toBe(false);
    expect(isWalkable(g, 5, 2)).toBe(false);
  });
  it('hotspot lookup', () => {
    const g = parseLayout(MAP);
    expect(hotspotAt(g, 2, 1)).toBe(2);
    expect(hotspotAt(g, 1, 1)).toBeUndefined();
  });
  it('throws when no spawn', () => {
    expect(() => parseLayout(['#.#'])).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test` — Expected: FAIL, cannot resolve `../src/world/grid`.

- [ ] **Step 3: Implement `src/world/grid.ts`**

```ts
export interface Pt { x: number; y: number }
export interface Grid {
  cols: number; rows: number;
  walk: boolean[];           // index y*cols+x
  hotspots: Map<number, Pt>; // hotspot id -> tile
  spawn: Pt;
}

export function parseLayout(rows: string[]): Grid {
  const h = rows.length, w = rows[0].length;
  const walk = new Array<boolean>(w * h).fill(false);
  const hotspots = new Map<number, Pt>();
  let spawn: Pt | null = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '#') continue;
      walk[y * w + x] = true;
      if (ch === 'S') spawn = { x, y };
      else if (ch >= '1' && ch <= '8') hotspots.set(Number(ch), { x, y });
    }
  }
  if (!spawn) throw new Error('layout has no spawn S');
  return { cols: w, rows: h, walk, hotspots, spawn };
}

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.cols && y < g.rows && g.walk[y * g.cols + x];
}

export function hotspotAt(g: Grid, x: number, y: number): number | undefined {
  for (const [id, p] of g.hotspots) if (p.x === x && p.y === y) return id;
  return undefined;
}
```

- [ ] **Step 4: Write failing tests `tests/coords.test.ts`** (tile↔world mapping, world origin at grid center)

```ts
import { describe, it, expect } from 'vitest';
import { tileToWorld, worldToTile } from '../src/world/coords';

describe('coords', () => {
  it('round-trips center of grid', () => {
    // 10x10 grid: tile (5,5) center sits at world (0.5, 0.5)
    expect(tileToWorld(10, 10, { x: 5, y: 5 })).toEqual({ x: 0.5, z: 0.5 });
    expect(worldToTile(10, 10, { x: 0.5, z: 0.5 })).toEqual({ x: 5, y: 5 });
  });
  it('round-trips corner', () => {
    expect(worldToTile(10, 10, tileToWorld(10, 10, { x: 0, y: 9 }))).toEqual({ x: 0, y: 9 });
  });
});
```

- [ ] **Step 5: Run to verify failure, then implement `src/world/coords.ts`**

```ts
import type { Pt } from './grid';
export interface V2 { x: number; z: number }
export const TILE = 1;

export function tileToWorld(cols: number, rows: number, t: Pt): V2 {
  return { x: (t.x - cols / 2 + 0.5) * TILE, z: (t.y - rows / 2 + 0.5) * TILE };
}
export function worldToTile(cols: number, rows: number, w: V2): Pt {
  return { x: Math.round(w.x / TILE + cols / 2 - 0.5), y: Math.round(w.z / TILE + rows / 2 - 0.5) };
}
```

- [ ] **Step 6: Write `src/world/layout.ts`** — the real Registan map, 28×22. North (Tilya-Kori) at top. Ulugh Beg west (left), Sher-Dor east (right). Hotspots per spec: 1 UB portal, 2 UB minaret, 3 SD portal, 4 SD dome, 5 TK portal, 6 TK dome, 7 plaza centre, 8 doves.

```ts
export const LAYOUT = [
  '############################',
  '############################',
  '############################',
  '####......6...5.......######',
  '####..................######',
  '###....................####',
  '###.2..................4.###',
  '###......................##',
  '###......................##',
  '###.1..................3.##',
  '###......................##',
  '###......................##',
  '###...........8..........##',
  '###......................##',
  '###..........7...........##',
  '###......................##',
  '####....................###',
  '####....................###',
  '#####......................#',
  '##########....S...##########',
  '##########........##########',
  '############################',
];
```

(Blocked `#` border rows/cols are where building meshes will stand; exact ragged edges are fine to tune visually later — tests don't depend on this file.)

- [ ] **Step 7: Run all tests**

Run: `npm test` — Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: world grid, layout map, tile/world coords (TDD)"
```

---

### Task 3: A* pathfinding (TDD)

**Files:**
- Create: `src/character/astar.ts`
- Test: `tests/astar.test.ts`

- [ ] **Step 1: Write failing tests `tests/astar.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseLayout } from '../src/world/grid';
import { findPath } from '../src/character/astar';

const g = parseLayout([
  '#####',
  '#S..#',
  '#.#.#',
  '#...#',
  '#####',
]);

describe('findPath', () => {
  it('straight line', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 3, y: 1 }))
      .toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
  });
  it('routes around wall', () => {
    const p = findPath(g, { x: 1, y: 3 }, { x: 3, y: 1 })!;
    expect(p[0]).toEqual({ x: 1, y: 3 });
    expect(p[p.length - 1]).toEqual({ x: 3, y: 1 });
    expect(p).not.toContainEqual({ x: 2, y: 2 }); // the wall
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i].x - p[i-1].x) + Math.abs(p[i].y - p[i-1].y)).toBe(1); // 4-connected
    }
  });
  it('start equals goal', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('unreachable / blocked goal returns null', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
    expect(findPath(g, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test`, FAIL on missing module.

- [ ] **Step 3: Implement `src/character/astar.ts`**

```ts
import { Grid, Pt, isWalkable } from '../world/grid';

export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
  if (!isWalkable(g, start.x, start.y) || !isWalkable(g, goal.x, goal.y)) return null;
  const key = (p: Pt) => p.y * g.cols + p.x;
  const open: Pt[] = [start];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(start), 0]]);
  const h = (p: Pt) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const fa = gScore.get(key(open[i]))! + h(open[i]);
      const fb = gScore.get(key(open[bi]))! + h(open[bi]);
      if (fa < fb) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      const path: Pt[] = [cur];
      let k = key(cur);
      while (came.has(k)) {
        k = came.get(k)!;
        path.unshift({ x: k % g.cols, y: Math.floor(k / g.cols) });
      }
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (!isWalkable(g, n.x, n.y)) continue;
      const ng = gScore.get(key(cur))! + 1;
      if (ng < (gScore.get(key(n)) ?? Infinity)) {
        gScore.set(key(n), ng);
        came.set(key(n), key(cur));
        if (!open.some(p => p.x === n.x && p.y === n.y)) open.push(n);
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests** — `npm test`, all PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: A* pathfinding on walkable grid (TDD)"`

---

### Task 4: Scene — isometric camera, sunset lighting, plaza ground

**Files:**
- Create: `src/scene/camera.ts`, `src/scene/lights.ts`, `src/scene/ground.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/scene/camera.ts`**

```ts
import * as THREE from 'three';

const ELEV = 0.82;            // camera height factor (MV-ish, slightly above true iso)
const DIST = 60;
export const VIEW_RADIUS = 24; // world units that must fit on screen

export function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  sizeCamera(cam);
  placeCamera(cam, azimuthFor(0));
  return cam;
}

export function azimuthFor(i: number): number {
  return Math.PI / 4 + i * Math.PI / 2; // start SE
}

export function placeCamera(cam: THREE.OrthographicCamera, azimuth: number) {
  cam.position.set(Math.sin(azimuth) * DIST, DIST * ELEV, Math.cos(azimuth) * DIST);
  cam.lookAt(0, 0, 0);
}

export function sizeCamera(cam: THREE.OrthographicCamera) {
  const aspect = innerWidth / innerHeight;
  // fit VIEW_RADIUS in the SMALLER dimension → portrait pulls back automatically (spec edge case)
  const half = VIEW_RADIUS;
  if (aspect >= 1) { cam.top = half; cam.bottom = -half; cam.left = -half * aspect; cam.right = half * aspect; }
  else { cam.left = -half; cam.right = half; cam.top = half / aspect; cam.bottom = -half / aspect; }
  cam.updateProjectionMatrix();
}
```

- [ ] **Step 2: Write `src/scene/lights.ts`** (fixed golden hour — low warm sun from the west, lavender fill)

```ts
import * as THREE from 'three';
import { C } from '../palette';

export function addSunsetLights(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(C.sun, 2.2);
  sun.position.set(-30, 12, 8); // west, low — long shadows across the plaza
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 30;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 100 });
  scene.add(sun);

  const fill = new THREE.HemisphereLight(C.skyBottom, C.skyTop, 0.9);
  scene.add(fill);
}
```

- [ ] **Step 3: Write `src/scene/ground.ts`** (plaza slab + faint tile lines via canvas texture)

```ts
import * as THREE from 'three';
import { C } from '../palette';
import { LAYOUT } from '../world/layout';

export function makeGround(): THREE.Mesh {
  const cols = LAYOUT[0].length, rows = LAYOUT.length;
  const cv = document.createElement('canvas');
  cv.width = cols * 16; cv.height = rows * 16;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#' + C.plaza.toString(16).padStart(6, '0');
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#' + C.plazaPath.toString(16).padStart(6, '0');
  g.lineWidth = 1;
  for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * 16, 0); g.lineTo(x * 16, cv.height); g.stroke(); }
  for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * 16); g.lineTo(cv.width, y * 16); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cols, 1, rows),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.position.y = -0.5; // top surface at y=0
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
```

- [ ] **Step 4: Wire into `src/main.ts`** — replace the placeholder camera line and add ground/lights:

```ts
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround } from './scene/ground';
// replace: const camera = new THREE.OrthographicCamera(...)
const camera = makeCamera();
addSunsetLights(scene);
scene.add(makeGround());
// in the resize listener, add: sizeCamera(camera);
```

- [ ] **Step 5: Verify** — `npm run dev`: warm sandy slab floating in the gradient, viewed isometrically from the south-east, subtle grid lines, no errors. Rotate the phone-simulated viewport (devtools) — portrait still frames the whole slab.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: iso camera, sunset lighting, plaza ground"`

---

### Task 5: Camera rotation — 90° snaps with easing + rotate button

**Files:**
- Create: `src/scene/orbit.ts`, `src/ui/buttons.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/scene/orbit.ts`**

```ts
import * as THREE from 'three';
import { azimuthFor, placeCamera } from './camera';

export class Orbit {
  private index = 0;
  private current = azimuthFor(0);
  private target = this.current;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private cam: THREE.OrthographicCamera) {}

  rotate() {
    this.index = (this.index + 1) % 4;
    this.target = this.current + Math.PI / 2; // always turn the same way
    if (this.reduced) this.current = this.target;
  }

  tick(dt: number) {
    this.current += (this.target - this.current) * Math.min(1, dt * 5);
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;
    placeCamera(this.cam, this.current);
  }
}
```

- [ ] **Step 2: Write `src/ui/buttons.ts`** (corner buttons share one factory; music button added in Task 16)

```ts
export function cornerButton(label: string, title: string, slot: number, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.style.cssText = `position:absolute;right:16px;bottom:${16 + slot * 56}px;width:44px;height:44px;
    border-radius:50%;border:none;background:#123a66;color:#fff3da;font-size:20px;cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.25);`;
  b.addEventListener('click', onClick);
  document.getElementById('ui')!.appendChild(b);
  return b;
}
```

- [ ] **Step 3: Wire into `src/main.ts`**

```ts
import { Orbit } from './scene/orbit';
import { cornerButton } from './ui/buttons';
const orbit = new Orbit(camera);
onTick(dt => orbit.tick(dt));
cornerButton('⟳', 'Rotate view', 0, () => orbit.rotate());
```

- [ ] **Step 4: Verify** — `npm run dev`: button bottom-right; each click swings the view 90° with an ease-out; four clicks return home. With devtools emulating `prefers-reduced-motion: reduce`, rotation snaps instantly.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: 90-degree camera rotation with easing"`

---

### Task 6: Patterns — procedural majolica canvas textures

Ornament generators. No unit tests (needs real canvas rasterization); verified via a temporary gallery wall in the scene, deleted before commit of Task 8.

**Files:**
- Create: `src/patterns/textures.ts`

- [ ] **Step 1: Write `src/patterns/textures.ts`**

```ts
import * as THREE from 'three';

const px = (n: number) => '#' + n.toString(16).padStart(6, '0');

function canvas(w: number, h: number, bg: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = px(bg); g.fillRect(0, 0, w, h);
  return [cv, g];
}

function toTexture(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.magFilter = THREE.NearestFilter; // crisp tile edges, MV-flat
  return t;
}

/** 8-pointed girih star lattice: two overlapping rotated squares per cell. */
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  const S = 128;
  const [cv, g] = canvas(S * cells, S * cells, bg);
  for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
    const ox = cx * S + S / 2, oy = cy * S + S / 2, r = S * 0.38;
    for (const [rot, col] of [[0, star], [Math.PI / 4, accent]] as const) {
      g.fillStyle = px(col);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = rot + i * Math.PI / 2;
        const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fill();
    }
    g.fillStyle = px(bg);
    g.beginPath(); g.arc(ox, oy, S * 0.12, 0, Math.PI * 2); g.fill();
  }
  return toTexture(cv);
}

/** Horizontal majolica band: alternating diamonds. */
export function band(bg: number, fg: number): THREE.CanvasTexture {
  const [cv, g] = canvas(256, 64, bg);
  g.fillStyle = px(fg);
  for (let i = 0; i < 8; i++) {
    const x = i * 32 + 16;
    g.beginPath();
    g.moveTo(x, 8); g.lineTo(x + 12, 32); g.lineTo(x, 56); g.lineTo(x - 12, 32);
    g.closePath(); g.fill();
  }
  return toTexture(cv, 4, 1);
}

/** Kufic-style angular strip: blocky meander strokes. */
export function kufic(bg: number, fg: number): THREE.CanvasTexture {
  const [cv, g] = canvas(256, 64, bg);
  g.fillStyle = px(fg);
  for (let i = 0; i < 8; i++) {
    const x = i * 32;
    g.fillRect(x + 4, 12, 6, 40);
    g.fillRect(x + 4, 12, 22, 6);
    g.fillRect(x + 20, 12, 6, 24);
    if (i % 2) g.fillRect(x + 12, 40, 14, 6);
  }
  return toTexture(cv, 4, 1);
}

/** Sher-Dor tiger decal: stylized flat tiger chasing deer, sun rising on its back. */
export function tigerDecal(): THREE.CanvasTexture {
  const [cv, g] = canvas(512, 256, 0x1c5d99);
  // sun with face + rays
  g.fillStyle = px(0xffd9a0);
  g.beginPath(); g.arc(330, 80, 42, 0, Math.PI * 2); g.fill();
  g.strokeStyle = px(0xffd9a0); g.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.beginPath();
    g.moveTo(330 + Math.cos(a) * 50, 80 + Math.sin(a) * 50);
    g.lineTo(330 + Math.cos(a) * 64, 80 + Math.sin(a) * 64);
    g.stroke();
  }
  g.fillStyle = px(0xb8865a); // sun face features
  g.beginPath(); g.arc(316, 72, 5, 0, Math.PI * 2); g.arc(344, 72, 5, 0, Math.PI * 2); g.fill();
  // tiger body (rounded rect), striped
  g.fillStyle = px(0xe8943a);
  g.beginPath(); g.roundRect(180, 120, 200, 70, 30); g.fill();
  g.beginPath(); g.arc(390, 140, 32, 0, Math.PI * 2); g.fill();           // head
  for (const lx of [200, 250, 300, 350]) g.fillRect(lx, 180, 16, 50);     // legs
  g.fillStyle = px(0x8a4a1a);
  for (const sx of [210, 245, 280, 315]) g.fillRect(sx, 124, 10, 62);     // stripes
  // fleeing deer
  g.fillStyle = px(0xfff3da);
  g.beginPath(); g.roundRect(60, 140, 90, 40, 18); g.fill();
  g.beginPath(); g.arc(60, 132, 16, 0, Math.PI * 2); g.fill();
  for (const lx of [70, 120] ) g.fillRect(lx, 172, 10, 44);
  g.strokeStyle = px(0xfff3da); g.lineWidth = 4;                           // antlers
  g.beginPath(); g.moveTo(56, 120); g.lineTo(44, 96); g.moveTo(62, 118); g.lineTo(66, 94); g.stroke();
  const t = toTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
```

- [ ] **Step 2: Temporary visual gallery** — add to `src/main.ts` (REMOVE in Task 8 Step 4):

```ts
import { girih, band, kufic, tigerDecal } from './patterns/textures';
import { C } from './palette';
[girih(C.cobalt, C.turquoise, C.cream), band(C.lapis, C.turquoise), kufic(C.cream, C.lapis), tigerDecal()]
  .forEach((tex, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: tex }));
    p.position.set(-12 + i * 7, 4, 0);
    scene.add(p);
  });
```

- [ ] **Step 3: Verify** — `npm run dev`: four floating panels — star lattice, diamond band, angular kufic strip, tiger-and-sun. Crisp edges, palette colors. Iterate the drawing code until each motif reads clearly at plaza-view distance — this step is *expected* to take a few rounds.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: procedural majolica pattern textures (girih, band, kufic, tiger)"`

---

### Task 7: Building primitives — pishtaq, dome, ribbed dome, minaret, arcade wall

**Files:**
- Create: `src/buildings/primitives.ts`

- [ ] **Step 1: Write `src/buildings/primitives.ts`**

```ts
import * as THREE from 'three';
import { C } from '../palette';
import { girih, band, kufic } from '../patterns/textures';

export const mat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const matMap = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

export function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = h / 2;
  return m;
}

/** Box whose +Z face carries a pattern texture; other faces plain. */
export function patternedBox(w: number, h: number, d: number, color: number, face: THREE.Texture): THREE.Mesh {
  const plain = mat(color);
  const mats = [plain, plain, plain, plain, matMap(face), plain]; // +x,-x,+y,-y,+z,-z
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.y = h / 2;
  return m;
}

function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(); const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(-r, h - r);
  s.quadraticCurveTo(-r, h - r * 0.1, 0, h);       // slightly pointed Persian arch
  s.quadraticCurveTo(r, h - r * 0.1, r, h - r);
  s.lineTo(r, 0); s.closePath();
  return s;
}

export function archNiche(w: number, h: number, depth: number, color: number): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(archShape(w, h), { depth, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat(color));
  return m; // caller positions; extrudes toward +Z
}

/** Monumental portal: patterned frame + recessed dark arch, kufic strip across the top. */
export function pishtaq(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(patternedBox(w, h, d, C.sand, girih(C.cobalt, C.turquoise, C.cream)));
  const niche = archNiche(w * 0.52, h * 0.72, d * 0.4, C.lapis);
  niche.position.set(0, 0, d / 2 - d * 0.4 + 0.02);
  g.add(niche);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.1),
    new THREE.MeshLambertMaterial({ map: kufic(C.cream, C.lapis) }));
  strip.position.set(0, h * 0.92, d / 2 + 0.02);
  g.add(strip);
  return g;
}

/** Bulbous turquoise dome on a patterned drum. */
export function dome(r: number, ribbed = false): THREE.Group {
  const g = new THREE.Group();
  const drumH = r * 1.1;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, drumH, 20),
    new THREE.MeshLambertMaterial({ map: band(C.cobalt, C.cream) }));
  drum.position.y = drumH / 2;
  g.add(drum);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = -0.5 + (i / 14) * (Math.PI / 2 + 0.5); // sweep below equator → onion bulge
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const cap = new THREE.Mesh(new THREE.LatheGeometry(pts, 24),
    new THREE.MeshLambertMaterial({ color: C.turquoise }));
  cap.position.y = drumH + r * 0.48;
  g.add(cap);
  if (ribbed) {
    for (let i = 0; i < 16; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06 * r, r * 1.7, 0.16 * r),
        new THREE.MeshLambertMaterial({ color: C.teal }));
      const a = (i / 16) * Math.PI * 2;
      rib.position.set(Math.cos(a) * r * 0.92, cap.position.y, Math.sin(a) * r * 0.92);
      rib.lookAt(0, cap.position.y, 0);
      rib.rotateX(0.35);
      g.add(rib);
    }
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 8, 8), mat(C.gold));
  finial.position.y = cap.position.y + r * 1.05;
  g.add(finial);
  return g;
}

/** Tapered minaret with patterned shaft, cornice and cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.055, h * 0.085, h, 14),
    new THREE.MeshLambertMaterial({ map: band(C.sand, C.cobalt) }));
  shaft.material.map!.repeat.set(2, 6);
  shaft.position.y = h / 2;
  g.add(shaft);
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.085, h * 0.06, h * 0.05, 14), mat(C.cream));
  cornice.position.y = h * 0.97;
  g.add(cornice);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.06, 12, 10), mat(C.turquoise));
  cap.position.y = h * 1.03;
  g.add(cap);
  return g;
}

/** Two-storey arcade wall with dark arch niches and a band strip. */
export function arcadeWall(len: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(len, h, d, C.sand));
  const n = Math.floor(len / 2.4);
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < n; i++) {
      const niche = archNiche(1.1, 1.8, 0.3, C.sandDark);
      niche.position.set(-len / 2 + 1.6 + i * 2.4, 0.5 + s * h * 0.48, d / 2 - 0.28);
      g.add(niche);
    }
  }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.96, 0.5),
    new THREE.MeshLambertMaterial({ map: band(C.lapis, C.turquoise) }));
  strip.position.set(0, h * 0.93, d / 2 + 0.02);
  g.add(strip);
  return g;
}
```

- [ ] **Step 2: Verify compile only** — `npx tsc --noEmit` passes. (Visual verification comes with the first madrasah.)

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: building primitives (pishtaq, domes, minaret, arcade)"`

---

### Task 8: Madrasah composer + Ulugh Beg Madrasah

One parameterized composer; three config files (Tasks 8–10). All madrasahs: central pishtaq flanked by arcade wings, optional corner minarets, optional domes, optional decal.

**Files:**
- Create: `src/buildings/madrasah.ts`, `src/buildings/ulughbeg.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/buildings/madrasah.ts`**

```ts
import * as THREE from 'three';
import { pishtaq, arcadeWall, minaret, dome, shadowed } from './primitives';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];  // x-offsets from center
  domes?: { offset: number; r: number; ribbed?: boolean }[];
  decal?: THREE.Texture;    // applied above the portal arch
}

export function madrasah(o: MadrasahOpts): THREE.Group {
  const g = new THREE.Group();
  const wingLen = (o.facadeLen - o.portal.w) / 2;

  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d);
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
  if (o.decal) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.portal.w * 0.42, o.portal.w * 0.21),
      new THREE.MeshLambertMaterial({ map: o.decal, transparent: true }));
    pl.position.set(0, o.portal.h * 0.8, o.portal.d / 2 + 0.04);
    g.add(pl);
  }
  return shadowed(g);
}
```

- [ ] **Step 2: Write `src/buildings/ulughbeg.ts`** (west side, faces east/plaza; two tall corner minarets, no facade domes)

```ts
import { madrasah } from './madrasah';

export function ulughBeg() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 7, h: 11, d: 4 },
    wingH: 6,
    minarets: [{ offset: -9.5, h: 14 }, { offset: 9.5, h: 14 }],
  });
  g.rotation.y = Math.PI / 2;   // front faces +X→ east
  g.position.set(-13.5, 0, -1); // west edge of plaza (matches LAYOUT blocked columns)
  return g;
}
```

- [ ] **Step 3: Wire into `src/main.ts`**

```ts
import { ulughBeg } from './buildings/ulughbeg';
scene.add(ulughBeg());
```

- [ ] **Step 4: Remove the Task 6 temporary pattern gallery from `src/main.ts`.**

- [ ] **Step 5: Verify** — `npm run dev`: Ulugh Beg stands on the west edge: patterned cobalt portal with dark pointed-arch niche, kufic strip, arcaded wings, two minarets. Long warm shadows fall east across the plaza. Rotate the camera — it holds up from all four views. Tune positions/sizes here, not later.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: madrasah composer + Ulugh Beg madrasah"`

---

### Task 9: Sher-Dor Madrasah (ribbed twin domes + tiger decal)

**Files:**
- Create: `src/buildings/sherdor.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/buildings/sherdor.ts`** (east side, faces west; ribbed domes flank the portal; tiger decal on portal)

```ts
import { madrasah } from './madrasah';
import { tigerDecal } from '../patterns/textures';

export function sherDor() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 7, h: 11, d: 4 },
    wingH: 6,
    minarets: [{ offset: -9.5, h: 12 }, { offset: 9.5, h: 12 }],
    domes: [{ offset: -6, r: 2.2, ribbed: true }, { offset: 6, r: 2.2, ribbed: true }],
    decal: tigerDecal(),
  });
  g.rotation.y = -Math.PI / 2;  // faces -X → west
  g.position.set(13.5, 0, -1);
  return g;
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — `import { sherDor } from './buildings/sherdor'; scene.add(sherDor());`

- [ ] **Step 3: Verify** — `npm run dev`: Sher-Dor mirrors Ulugh Beg across the plaza; ribbed turquoise twin domes catch the sunset on their west faces; tiger-and-sun decal visible above the arch when camera faces east.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: Sher-Dor madrasah with ribbed domes and tiger decal"`

---

### Task 10: Tilya-Kori Madrasah (north, wide facade, grand central dome)

**Files:**
- Create: `src/buildings/tilyakori.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/buildings/tilyakori.ts`** (long low facade closing the north side; one big smooth turquoise dome left of the portal, as in reality)

```ts
import { madrasah } from './madrasah';

export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 7, h: 10, d: 4 },
    wingH: 5.5,
    domes: [{ offset: -7, r: 3 }],
  });
  // faces +Z → south (default orientation), so no rotation
  g.position.set(0, 0, -12.5);
  return g;
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — `import { tilyaKori } from './buildings/tilyakori'; scene.add(tilyaKori());`

- [ ] **Step 3: Verify** — `npm run dev`: the square now reads as Registan — three facades around the plaza, Tilya-Kori's big dome glowing turquoise against the lavender sky. Check all 4 camera rotations; check portrait framing; check the console for zero warnings.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: Tilya-Kori madrasah completes the square"`

---

### Task 11: Character — movement logic (TDD), mesh, tap-to-move

**Files:**
- Create: `src/character/walker.ts`, `src/character/character.ts`, `src/input.ts`
- Modify: `src/main.ts`
- Test: `tests/walker.test.ts`

- [ ] **Step 1: Write failing tests `tests/walker.test.ts`** (pure waypoint-following — no Three)

```ts
import { describe, it, expect } from 'vitest';
import { advance } from '../src/character/walker';

describe('advance', () => {
  it('moves toward first waypoint by dist', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 2, z: 0 }], 0.5);
    expect(r.pos).toEqual({ x: 0.5, z: 0 });
    expect(r.waypoints.length).toBe(1);
  });
  it('consumes waypoint and continues with leftover distance', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 1, z: 1 }], 1.5);
    expect(r.pos.x).toBeCloseTo(1);
    expect(r.pos.z).toBeCloseTo(0.5);
    expect(r.waypoints.length).toBe(1);
  });
  it('stops exactly at final waypoint', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 1, z: 0 }], 5);
    expect(r.pos).toEqual({ x: 1, z: 0 });
    expect(r.waypoints.length).toBe(0);
  });
  it('no waypoints → unchanged', () => {
    expect(advance({ x: 3, z: 4 }, [], 1)).toEqual({ pos: { x: 3, z: 4 }, waypoints: [] });
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/character/walker.ts`:

```ts
import type { V2 } from '../world/coords';

export function advance(pos: V2, waypoints: V2[], dist: number): { pos: V2; waypoints: V2[] } {
  let p = { ...pos };
  let wp = waypoints.slice();
  while (dist > 0 && wp.length) {
    const t = wp[0];
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= dist) { p = { ...t }; wp.shift(); dist -= d; }
    else { p = { x: p.x + (dx / d) * dist, z: p.z + (dz / d) * dist }; dist = 0; }
  }
  return { pos: p, waypoints: wp };
}
```

- [ ] **Step 3: Run tests** — all PASS.

- [ ] **Step 4: Write `src/character/character.ts`** (MV-style figure: terracotta cone, cream head, gold cap; walk bob; emits arrival events)

```ts
import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';
import { advance } from './walker';
import { Grid, Pt } from '../world/grid';
import { findPath } from './astar';
import { tileToWorld, V2 } from '../world/coords';

const SPEED = 3.2; // tiles per second

export class Character {
  group = new THREE.Group();
  private pos: V2;
  private waypoints: V2[] = [];
  private heading = 0;

  constructor(private grid: Grid) {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 10), mat(C.terracotta));
    body.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat(C.cream));
    head.position.y = 1.0;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 10), mat(C.gold));
    cap.position.y = 1.16;
    this.group.add(body, head, cap);
    shadowed(this.group);
    this.pos = tileToWorld(grid.cols, grid.rows, grid.spawn);
    this.group.position.set(this.pos.x, 0, this.pos.z);
  }

  get tile(): Pt {
    return { x: Math.round(this.pos.x + this.grid.cols / 2 - 0.5), y: Math.round(this.pos.z + this.grid.rows / 2 - 0.5) };
  }

  walkTo(target: Pt): boolean {
    const path = findPath(this.grid, this.tile, target);
    if (!path) return false;
    this.waypoints = path.slice(1).map(p => tileToWorld(this.grid.cols, this.grid.rows, p));
    return true;
  }

  tick(dt: number) {
    const wasMoving = this.waypoints.length > 0;
    const r = advance(this.pos, this.waypoints, SPEED * dt);
    this.pos = r.pos; this.waypoints = r.waypoints;
    if (wasMoving) {
      const t = performance.now() / 1000;
      this.group.position.set(this.pos.x, Math.abs(Math.sin(t * 10)) * 0.06, this.pos.z);
      if (r.waypoints.length) {
        const n = r.waypoints[0];
        this.heading = Math.atan2(n.x - this.pos.x, n.z - this.pos.z);
      }
      this.group.rotation.y = this.heading;
      if (!this.waypoints.length) {
        this.group.position.y = 0;
        this.group.dispatchEvent({ type: 'arrived' } as never);
      }
    }
  }
}
```

- [ ] **Step 5: Write `src/input.ts`** (raycast tap → tile → walk)

```ts
import * as THREE from 'three';
import { Grid, isWalkable } from './world/grid';
import { worldToTile } from './world/coords';
import { Character } from './character/character';

export function bindTapToMove(
  renderer: THREE.WebGLRenderer, camera: THREE.Camera, ground: THREE.Mesh,
  grid: Grid, ch: Character,
) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = 0;
  renderer.domElement.addEventListener('pointerdown', () => { downAt = performance.now(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (performance.now() - downAt > 300) return; // it was a drag/hold, not a tap
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(ground, false)[0];
    if (!hit) return;
    const t = worldToTile(grid.cols, grid.rows, { x: hit.point.x, z: hit.point.z });
    if (isWalkable(grid, t.x, t.y)) ch.walkTo(t);
  });
}
```

- [ ] **Step 6: Wire into `src/main.ts`**

```ts
import { parseLayout } from './world/grid';
import { LAYOUT } from './world/layout';
import { Character } from './character/character';
import { bindTapToMove } from './input';
const grid = parseLayout(LAYOUT);
const ground = makeGround();          // change existing scene.add(makeGround()) to keep the reference
scene.add(ground);
const hero = new Character(grid);
scene.add(hero.group);
onTick(dt => hero.tick(dt));
bindTapToMove(renderer, camera, ground, grid, hero);
```

- [ ] **Step 7: Verify** — `npm run dev`: figure stands at the south entrance; click anywhere on the plaza → walks there with a gentle bob, faces travel direction, routes around buildings, ignores clicks on blocked tiles and on buildings. Test on devtools touch emulation too.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: character with A* tap-to-move (walker TDD)"`

---

### Task 12: Story content + i18n (TDD)

**Files:**
- Create: `src/content/content.json`, `src/content/i18n.ts`
- Test: `tests/i18n.test.ts`

- [ ] **Step 1: Write failing tests `tests/i18n.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getCard, CARD_IDS } from '../src/content/i18n';

describe('content', () => {
  it('has all 8 hotspot cards', () => {
    expect(CARD_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('returns english card', () => {
    const c = getCard(1, 'en');
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.body.length).toBeGreaterThan(20);
  });
  it('returns tajik card with cyrillic', () => {
    const c = getCard(3, 'tj');
    expect(/[Ѐ-ӿ]/.test(c.title + c.body)).toBe(true);
  });
  it('throws on unknown id', () => {
    expect(() => getCard(99, 'en')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**, then write `src/content/content.json`.
**⚠ All `_tj` strings are machine drafts — flagged in the spec for native-speaker review before launch. Do not silently "improve" them; leave for human review.**

```json
[
  { "id": 1,
    "title_en": "Ulugh Beg Madrasah", "body_en": "Built 1417–1420 by Ulugh Beg, Timur's grandson — a king who loved mathematics more than conquest. Here students studied astronomy under a ruler who measured the length of the year to within a minute.",
    "title_tj": "Мадрасаи Улуғбек", "body_tj": "Солҳои 1417–1420 аз ҷониби Улуғбек, набераи Темур, сохта шудааст — подшоҳе, ки илмро аз ҷанг бештар дӯст медошт. Дар ин ҷо толибилмон зери роҳбарии ӯ илми нуҷумро меомӯхтанд." },
  { "id": 2,
    "title_en": "The Leaning Minaret", "body_en": "By the twentieth century the north-east minaret leaned like a tired sentry. In 1932 Soviet engineers jacked the whole tower straight — a feat of engineering almost as bold as building it.",
    "title_tj": "Манораи моил", "body_tj": "То асри бистум манораи шимолу шарқӣ моил шуда буд. Соли 1932 муҳандисон тамоми манораро рост карданд — кори ҷасуронаи муҳандисӣ." },
  { "id": 3,
    "title_en": "Sher-Dor — the Lion Bearer", "body_en": "Finished in 1636, its portal dares to show living creatures: tiger-lions chasing white deer beneath rising suns with human faces. Figurative art on a madrasah — a rule broken in glazed tile, six centuries loud.",
    "title_tj": "Шердор", "body_tj": "Соли 1636 анҷом ёфт. Дар пешоқи он шерҳо оҳувонро таъқиб мекунанд ва офтоб бо чеҳраи инсон тулӯъ мекунад — санъати тасвирӣ дар мадраса, қоидае, ки шикаста шуд." },
  { "id": 4,
    "title_en": "The Ribbed Twin Domes", "body_en": "Sher-Dor's two fluted turquoise domes were built by governor Yalangtush Bahadur's craftsmen to answer Ulugh Beg's facade across the square — a 200-year architectural echo.",
    "title_tj": "Гунбазҳои дугона", "body_tj": "Ду гунбази кабуди Шердор аз ҷониби устодони Ялангтӯш Баҳодур сохта шудаанд — ҷавоби меъморӣ ба мадрасаи Улуғбек дар тарафи дигари майдон." },
  { "id": 5,
    "title_en": "Tilya-Kori — the Gilded One", "body_en": "Completed around 1660, it closed the square's north side and did two jobs at once: madrasah and Friday mosque. Its name promises gold, and the interior delivers.",
    "title_tj": "Тиллокорӣ", "body_tj": "Тақрибан соли 1660 анҷом ёфт ва тарафи шимолии майдонро пӯшид. Он ҳам мадраса буд, ҳам масҷиди ҷомеъ. Номи он ваъдаи тилло медиҳад." },
  { "id": 6,
    "title_en": "The Dome That Isn't", "body_en": "Inside Tilya-Kori, gold leaf covers a mihrab hall whose soaring dome is an illusion — the ceiling is nearly flat, painted in perfect perspective. Monument Valley would approve.",
    "title_tj": "Гунбази хаёлӣ", "body_tj": "Дар дохили Тиллокорӣ толори тиллоӣ ҷойгир аст, ки гунбази он хаёлист — шифт қариб ҳамвор аст, вале бо санъати наққошӣ баланд менамояд." },
  { "id": 7,
    "title_en": "The Registan", "body_en": "\"Registan\" means sandy place. For six centuries this plaza was the city's heart: royal proclamations, parades, bazaars, and the crowds of the Silk Road crossing beneath these three facades.",
    "title_tj": "Регистон", "body_tj": "«Регистон» маънои ҷои регзорро дорад. Шаш аср ин майдон дили шаҳр буд: фармонҳои шоҳона, идҳо, бозорҳо ва корвонҳои Роҳи абрешим." },
  { "id": 8,
    "title_en": "The Doves", "body_en": "They have nested in these niches longer than any empire lasted. Walk through them — they always come back.",
    "title_tj": "Кабӯтарҳо", "body_tj": "Онҳо дар ин тоқчаҳо аз ҳар империя дарозтар зиндагӣ кардаанд. Аз байнашон гузаред — онҳо ҳамеша бармегарданд." }
]
```

- [ ] **Step 3: Implement `src/content/i18n.ts`**

```ts
import raw from './content.json';

export type Lang = 'en' | 'tj';
interface Entry { id: number; title_en: string; body_en: string; title_tj: string; body_tj: string }
const entries = raw as Entry[];

export const CARD_IDS = entries.map(e => e.id);

export function getCard(id: number, lang: Lang): { title: string; body: string } {
  const e = entries.find(x => x.id === id);
  if (!e) throw new Error(`no card ${id}`);
  return lang === 'en' ? { title: e.title_en, body: e.body_en } : { title: e.title_tj, body: e.body_tj };
}
```

Add to `tsconfig.json` compilerOptions if not present: `"resolveJsonModule": true`.

- [ ] **Step 4: Run tests** — all PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: bilingual story content + i18n lookup (TDD; Tajik flagged for native review)"`

---

### Task 13: Hotspots — glowing tiles + arrival triggers (TDD for trigger logic)

**Files:**
- Create: `src/hotspots.ts`
- Modify: `src/main.ts`, `src/character/character.ts` (arrival callback)
- Test: `tests/hotspots.test.ts`

- [ ] **Step 1: Write failing test `tests/hotspots.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseLayout } from '../src/world/grid';
import { hotspotForTile } from '../src/hotspots';

const g = parseLayout(['#####', '#S31#', '#####']);

describe('hotspotForTile', () => {
  it('returns id on hotspot tile', () => {
    expect(hotspotForTile(g, { x: 2, y: 1 })).toBe(3);
    expect(hotspotForTile(g, { x: 3, y: 1 })).toBe(1);
  });
  it('undefined elsewhere', () => {
    expect(hotspotForTile(g, { x: 1, y: 1 })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/hotspots.ts`:

```ts
import * as THREE from 'three';
import { Grid, Pt, hotspotAt } from './world/grid';
import { tileToWorld } from './world/coords';
import { C } from './palette';

export function hotspotForTile(g: Grid, t: Pt): number | undefined {
  return hotspotAt(g, t.x, t.y);
}

/** Glowing star tiles; returns a tick function that pulses them. */
export function addHotspotMarkers(scene: THREE.Scene, grid: Grid): (dt: number) => void {
  const mats: THREE.MeshLambertMaterial[] = [];
  for (const [, tile] of grid.hotspots) {
    const w = tileToWorld(grid.cols, grid.rows, tile);
    const m = new THREE.MeshLambertMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.5 });
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), m); // 8-gon ~ star tile
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(w.x, 0.02, w.z);
    scene.add(marker);
    mats.push(m);
  }
  let t = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const k = 0.35 + 0.3 * (0.5 + Math.sin(t * 2.5) / 2);
    for (const m of mats) m.emissiveIntensity = k;
  };
}
```

- [ ] **Step 3: Add an arrival callback to `Character`** — in `src/character/character.ts`, add a public field and call it instead of the dispatchEvent line:

```ts
  onArrive: (() => void) | null = null;
  // in tick(), replace this.group.dispatchEvent(...) with:
  this.onArrive?.();
```

- [ ] **Step 4: Wire into `src/main.ts`** (card UI arrives next task; log for now)

```ts
import { addHotspotMarkers, hotspotForTile } from './hotspots';
onTick(addHotspotMarkers(scene, grid));
hero.onArrive = () => {
  const id = hotspotForTile(grid, hero.tile);
  if (id) console.log('hotspot', id); // replaced in Task 14
};
```

- [ ] **Step 5: Run tests (`npm test`) and verify in browser** — 8 pulsing gold tiles at sensible spots; walking onto one logs its id once on arrival.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: hotspot markers and arrival triggers (TDD)"`

---

### Task 14: Story cards UI + EN/Тоҷикӣ toggle

**Files:**
- Create: `src/ui/cards.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/ui/cards.ts`** (DOM overlay; bottom-sheet on portrait via media query; language persisted)

```ts
import { getCard, Lang } from '../content/i18n';

const css = `
.card { position: absolute; left: 50%; bottom: 32px; transform: translateX(-50%) translateY(8px);
  width: min(420px, calc(100vw - 32px)); background: #fff8e7; color: #2a2350;
  border-radius: 14px; padding: 20px 22px; box-shadow: 0 8px 30px rgba(42,35,80,.35);
  border-top: 6px solid #3fc1c9; opacity: 0; transition: opacity .25s, transform .25s; }
.card.open { opacity: 1; transform: translateX(-50%) translateY(0); }
.card h3 { margin: 0 0 8px; font-size: 20px; }
.card p { margin: 0; line-height: 1.5; font-size: 15px; }
.card .close { position: absolute; top: 8px; right: 12px; border: none; background: none;
  font-size: 20px; cursor: pointer; color: #2a2350; }
@media (orientation: portrait) {
  .card { bottom: 0; border-radius: 14px 14px 0 0; width: 100vw; }
}
.langtoggle { position: absolute; left: 16px; bottom: 16px; border: none; cursor: pointer;
  background: #123a66; color: #fff3da; border-radius: 22px; padding: 10px 18px; font-size: 14px; }
`;

export class Cards {
  private lang: Lang = (localStorage.getItem('lang') as Lang) || 'en';
  private el: HTMLDivElement;
  private currentId: number | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const ui = document.getElementById('ui')!;

    this.el = document.createElement('div');
    this.el.className = 'card';
    ui.appendChild(this.el);

    const toggle = document.createElement('button');
    toggle.className = 'langtoggle';
    const label = () => (this.lang === 'en' ? 'Тоҷикӣ' : 'English');
    toggle.textContent = label();
    toggle.addEventListener('click', () => {
      this.lang = this.lang === 'en' ? 'tj' : 'en';
      localStorage.setItem('lang', this.lang);
      toggle.textContent = label();
      if (this.currentId) this.show(this.currentId);
    });
    ui.appendChild(toggle);
  }

  show(id: number) {
    const c = getCard(id, this.lang);
    this.currentId = id;
    this.el.innerHTML = `<button class="close" aria-label="Close">×</button><h3></h3><p></p>`;
    this.el.querySelector('h3')!.textContent = c.title;
    this.el.querySelector('p')!.textContent = c.body;
    this.el.querySelector('.close')!.addEventListener('click', () => this.hide());
    this.el.classList.add('open');
  }

  hide() { this.el.classList.remove('open'); this.currentId = null; }
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — replace the Task 13 console.log:

```ts
import { Cards } from './ui/cards';
const cards = new Cards();
hero.onArrive = () => {
  const id = hotspotForTile(grid, hero.tile);
  if (id) cards.show(id); else cards.hide();
};
```

- [ ] **Step 3: Verify** — walk to each of the 8 stars: card slides up with the right story; × closes; walking away then to another swaps content; toggle flips every card to Tajik and persists across reload (check localStorage); portrait mode shows bottom-sheet. **Walk all 8 in BOTH languages — this is the spec's required real check.**

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: bilingual story cards with EN/Tajik toggle"`

---

### Task 15: Ambience — trees, drifting leaves, doves that scatter

**Files:**
- Create: `src/ambience/trees.ts`, `src/ambience/doves.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/ambience/trees.ts`** (low-poly cone-stack trees + leaf particles drifting in sunset light; reduced-motion freezes leaves)

```ts
import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

const TREE_SPOTS: [number, number][] = [[-8, 8], [9, 7], [-3, 10]];

export function addTrees(scene: THREE.Scene): (dt: number) => void {
  for (const [x, z] of TREE_SPOTS) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7), mat(C.trunk));
    trunk.position.y = 0.6;
    tree.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 0.9, 8), mat(C.leaf));
      cone.position.y = 1.3 + i * 0.6;
      tree.add(cone);
    }
    tree.position.set(x, 0, z);
    scene.add(shadowed(tree));
  }

  // drifting leaves
  const N = 40;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [tx, tz] = TREE_SPOTS[i % TREE_SPOTS.length];
    pos.set([tx + (i % 7) - 3, 1 + (i % 5) * 0.6, tz + (i % 5) - 2], i * 3);
    seed[i] = i * 0.61;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: C.leaf, size: 0.12 }));
  scene.add(pts);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      a.setX(i, a.getX(i) + Math.sin(t + seed[i]) * dt * 0.4 + dt * 0.15); // drift east on the breeze
      a.setY(i, 1.2 + Math.sin(t * 0.7 + seed[i]) * 0.8);
      if (a.getX(i) > 14) a.setX(i, -10);
    }
    a.needsUpdate = true;
  };
}
```

- [ ] **Step 2: Write `src/ambience/doves.ts`** (wander near hotspot 8; scatter in an arc when the character comes close, land elsewhere; reduced-motion → walk, never fly)

```ts
import * as THREE from 'three';
import { C } from '../palette';
import { mat } from '../buildings/primitives';
import { Grid, isWalkable } from '../world/grid';
import { tileToWorld, V2 } from '../world/coords';

interface Dove { g: THREE.Group; pos: V2; target: V2; fly: number; phase: number }

export function addDoves(scene: THREE.Scene, grid: Grid, heroPos: () => V2): (dt: number) => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const home = tileToWorld(grid.cols, grid.rows, grid.hotspots.get(8)!);
  const doves: Dove[] = [];

  const spot = (i: number): V2 => { // deterministic scatter targets around home
    for (let r = 2 + (i % 3); r < 9; r++) {
      const a = i * 2.39996 + r;     // golden-angle spiral, no RNG needed
      const x = Math.round(home.x + Math.cos(a) * r + grid.cols / 2 - 0.5);
      const y = Math.round(home.z + Math.sin(a) * r + grid.rows / 2 - 0.5);
      if (isWalkable(grid, x, y)) return tileToWorld(grid.cols, grid.rows, { x, y });
    }
    return home;
  };

  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(C.dove));
    body.scale.set(1.4, 1, 1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat(C.dove));
    head.position.set(0.16, 0.08, 0);
    g.add(body, head);
    const p = spot(i);
    g.position.set(p.x, 0.1, p.z);
    scene.add(g);
    doves.push({ g, pos: { ...p }, target: spot(i + 7), fly: 0, phase: i });
  }

  return (dt: number) => {
    const hp = heroPos();
    for (const d of doves) {
      const dist = Math.hypot(d.pos.x - hp.x, d.pos.z - hp.z);
      if (dist < 1.6 && d.fly <= 0) { d.fly = reduced ? 0 : 1.4; d.target = spot(d.phase + Math.floor(d.pos.x * 7)); }
      const speed = d.fly > 0 ? 5 : 0.5;
      const dx = d.target.x - d.pos.x, dz = d.target.z - d.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.05) {
        d.pos.x += (dx / dd) * speed * dt;
        d.pos.z += (dz / dd) * speed * dt;
        d.g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      } else if (dist < 1.6 && reduced) {
        d.target = spot(d.phase + Math.floor(hp.x * 3)); // shooed: walk away instead of flying
      }
      d.fly = Math.max(0, d.fly - dt);
      const h = d.fly > 0 ? Math.sin((1.4 - d.fly) / 1.4 * Math.PI) * 2.2 : 0; // flight arc
      d.g.position.set(d.pos.x, 0.1 + h, d.pos.z);
    }
  };
}
```

- [ ] **Step 3: Expose hero position** — add to `Character`: `get worldPos(): V2 { return { ...this.pos }; }`

- [ ] **Step 4: Wire into `src/main.ts`**

```ts
import { addTrees } from './ambience/trees';
import { addDoves } from './ambience/doves';
onTick(addTrees(scene));
onTick(addDoves(scene, grid, () => hero.worldPos));
```

- [ ] **Step 5: Verify** — trees cast long shadows; leaves drift; doves potter near the plaza heart and burst into a low flight arc when you walk through them, landing elsewhere; with reduced-motion emulated they walk away instead and leaves freeze. Watch the FPS meter (devtools) — must hold 60.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: ambience — trees, drifting leaves, scattering doves"`

---

### Task 16: Audio toggle + no-WebGL fallback

**Files:**
- Create: `src/audio.ts`, `src/fallback.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/audio.ts`** (toggle ships now; track URL empty until one is chosen — spec open item)

```ts
import { cornerButton } from './ui/buttons';

const TRACK_URL = ''; // set when a track is chosen (spec open item)

export function addAudioToggle() {
  let audio: HTMLAudioElement | null = null;
  let on = false;
  const btn = cornerButton('♪', 'Music', 1, () => {
    on = !on;
    btn.style.opacity = on ? '1' : '0.55';
    if (!TRACK_URL) return; // silent until a track ships
    if (!audio) { audio = new Audio(TRACK_URL); audio.loop = true; audio.volume = 0.35; }
    on ? audio.play().catch(() => {}) : audio.pause();
  });
  btn.style.opacity = '0.55'; // starts muted (autoplay policy + spec)
}
```

- [ ] **Step 2: Write `src/fallback.ts`**

```ts
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function showFallback() {
  document.getElementById('app')!.innerHTML = `
    <div style="height:100%;display:flex;align-items:center;justify-content:center;
                background:linear-gradient(#8d6a9f,#f7b690);font-family:Georgia,serif;">
      <div style="background:#fff8e7;color:#2a2350;max-width:420px;margin:16px;padding:28px;
                  border-radius:14px;border-top:6px solid #3fc1c9;text-align:center;">
        <h2 style="margin-top:0">Registon</h2>
        <p>This experience needs WebGL, which your browser has turned off.
           Registan Square will be waiting when you return on a WebGL-enabled browser.</p>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Wire into `src/main.ts`** — at the very top, before creating the renderer:

```ts
import { webglAvailable, showFallback } from './fallback';
import { addAudioToggle } from './audio';
if (!webglAvailable()) { showFallback(); throw new Error('no webgl'); }
// ... after other UI setup:
addAudioToggle();
```

- [ ] **Step 4: Verify** — music button shows dimmed (muted default), toggles opacity; disable WebGL (Firefox `webgl.disabled` or Chrome `--disable-webgl`) → graceful card, no white screen, no uncaught errors beyond the deliberate one.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: audio toggle (track pending) + no-WebGL fallback"`

---

### Task 17: Real verification pass (spec's hard requirement)

No new features. **No "done" claims without this passing on real targets.**

- [ ] **Step 1: Full test suite** — `npm test` → all green. `npx tsc --noEmit` → clean.

- [ ] **Step 2: Production build** — `npm run build` → succeeds; `npm run preview`; verify the built bundle behaves identically to dev. Note total bundle size (expect < 500 KB gzipped; three.js dominates).

- [ ] **Step 3: Desktop walkthrough** — Chrome + Safari (both installed on this Mac): walk every hotspot in EN and Тоҷикӣ, rotate camera ×4, music toggle, dove scatter, resize window through portrait/landscape. Console must stay clean.

- [ ] **Step 4: Mobile profile** — devtools device emulation (iPhone-class) + 4× CPU throttle: performance recording while walking across the plaza with doves scattering. Requirement: steady 60fps (frame time ≤ 16.6 ms). If it dips: first suspect is shadow map size (drop to 1024), then dove/leaf counts. Fix and re-measure — do not ship a dip.

- [ ] **Step 5: Real phone (if available on the same network)** — `npm run dev -- --host`, open from the phone, repeat the walkthrough. If no phone is available, SAY SO in the commit/report — emulation is evidence, not proof.

- [ ] **Step 6: Accessibility passes** — `prefers-reduced-motion` honored (orbit snaps, leaves frozen, doves walk); cards readable at 200% zoom; buttons have `title`/aria labels.

- [ ] **Step 7: Commit any fixes** — `git add -A && git commit -m "fix: verification pass findings"`

---

### Task 18: Deploy to Cloudflare Pages

**Files:** none new (wrangler runs from CLI).

- [ ] **Step 1: One-time auth (user action)** — needs the user present: `npx wrangler login` (opens browser OAuth). If the user isn't around, stop here and report — do not park credentials anywhere.

- [ ] **Step 2: Deploy**

```bash
npm run build
npx wrangler pages deploy dist --project-name registon
```

Expected: a `*.pages.dev` URL in the output.

- [ ] **Step 3: Verify the deployed site** — open the `pages.dev` URL on desktop AND phone (real network, not localhost): full walkthrough again. This is the spec's "real thing".

- [ ] **Step 4: Domain (blocked on open item)** — the GoDaddy domain choice is a spec open item. When the user picks one (GoDaddy MCP can list candidates next session): add the custom domain in Cloudflare Pages, point nameservers at Cloudflare from GoDaddy, wait for DNS, then verify HTTPS loads on the real domain from a phone off-wifi. Until then, the `pages.dev` URL is the live site.

- [ ] **Step 5: Commit + tag** — `git add -A && git commit -m "chore: first deploy to Cloudflare Pages" && git tag v0.1.0`

---

## Self-review notes (already applied)

- **Spec coverage:** full-screen landing ✓(T1), camera+rotation ✓(T4,T5), sunset lighting ✓(T4), ornament-first patterns ✓(T6), three madrasahs ✓(T8–10), tap-to-move character ✓(T11), 8 bilingual hotspots ✓(T12–14), ambience ✓(T15), audio toggle muted-by-default ✓(T16), no-WebGL + portrait + reduced-motion ✓(T4,T5,T13,T15,T16), 60fps verification ✓(T17), Cloudflare deploy + GoDaddy domain ✓(T18). Interiors/puzzles/day-cycle correctly absent (out of scope).
- **Honest testing boundary:** pure logic TDD'd; canvas/GL visuals browser-verified — no fake DOM-environment tests pretending to cover rendering.
- **Type consistency check:** `Grid`/`Pt` from `world/grid`, `V2` from `world/coords`, used consistently in astar/walker/character/doves; `cornerButton(label, title, slot, onClick)` matches both call sites (T5, T16); `Character.worldPos` getter added in T15 Step 3 before use in Step 4.
- **Known visual-tuning expectation:** building proportions, pattern scales, and dove behavior will need eyeball iteration at T6/T8–10/T15 — the plan's code is the starting point, and that iteration happens *within* those tasks, not deferred.
