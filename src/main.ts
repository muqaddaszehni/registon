import { webglAvailable, showFallback } from './fallback';
import { addAudioToggle } from './audio';
if (!webglAvailable()) { showFallback(); throw new Error('no webgl'); }

import * as THREE from 'three';
import { makeSky } from './scene/sky';
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround, makeApron, makeContactShadow } from './scene/ground';
import { Orbit } from './scene/orbit';
import { ZoomController } from './scene/zoom';
import { PanController } from './scene/pan';
import { lodManager } from './scene/lod';
import { makeComposer } from './scene/post';
import { cornerButton } from './ui/buttons';
import { ulughBeg } from './buildings/ulughbeg';
import { sherDor } from './buildings/sherdor';
import { tilyaKori } from './buildings/tilyakori';
import { parseLayout } from './world/grid';
import { LAYOUT } from './world/layout';
import { Character } from './character/character';
import { bindTapToMove, bindTouchGestures } from './input';
import { addHotspotMarkers, hotspotForTile } from './hotspots';
import { Cards } from './ui/cards';
import { addTrees } from './ambience/trees';
import { addDoves } from './ambience/doves';
import { addGardens } from './ambience/gardens';
import { addFountains } from './ambience/fountains';
import { addMotes } from './scene/motes';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // softer shadow edges (raked low-sun key)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05; // lift to compensate the reduced hemi/fill flood (AAA lighting pass)
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSky();

const camera = makeCamera();
addSunsetLights(scene);
const ground = makeGround(); scene.add(ground);
const apron = makeApron(); scene.add(apron);
const contactShadow = makeContactShadow(); scene.add(contactShadow);

const composer = makeComposer(renderer, scene, camera);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sizeCamera(camera, orbit.state.zoom);
});

const NO_POST = location.search.includes('nopost'); // perf diagnostic: bypass the composer
let last = performance.now();
const tickers: Array<(dt: number) => void> = [];
export function onTick(fn: (dt: number) => void) { tickers.push(fn); }

// Lightweight rolling perf counters (exposed for the FPS harness; ~free).
const perf = { fps: 0, frameMs: 0, cpuMs: 0, calls: 0, tris: 0 };
(window as unknown as Record<string, unknown>).__perf = perf;
let emaInt = 16.7, emaCpu = 4;

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  const interval = now - last;
  last = now;
  for (const t of tickers) t(dt);
  lodManager.tick(); // process one canvas from stagger queue per frame
  if (NO_POST) renderer.render(scene, camera); else composer.render();
  const cpu = performance.now() - now;
  emaInt += (interval - emaInt) * 0.1;
  emaCpu += (cpu - emaCpu) * 0.1;
  perf.frameMs = emaInt; perf.cpuMs = emaCpu; perf.fps = 1000 / emaInt;
  perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles;
});

// Zoom + pan controllers
const zoomCtrl = new ZoomController();
const panCtrl = new PanController();

const orbit = new Orbit(camera, zoomCtrl);
onTick(dt => orbit.tick(dt));

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

// Secret "frontal view" button (slot 4) — hidden until the user completes a full
// 360° rotation, then it reveals and toggles a low, head-on frontal framing.
const frontalBtn = cornerButton('◈', 'Frontal view', 4, () => {
  const on = !orbit.isFrontal;
  orbit.setFrontal(on);
  frontalBtn.style.opacity = on ? '1' : '0.7';
  if (on) { zoomCtrl.setTarget(1.0); orbit.state.target.set(0, 3, 0); }
});
frontalBtn.style.display = 'none';
frontalBtn.style.opacity = '0.7';

// Rotation button (slot 0)
cornerButton('⟳', 'Rotate view', 0, () => {
  orbit.rotate();
  if (orbit.turns >= 4 && frontalBtn.style.display === 'none') {
    frontalBtn.style.display = '';          // reveal the secret after one full turn
    frontalBtn.style.transition = 'opacity .6s ease';
    frontalBtn.style.opacity = '0';
    requestAnimationFrame(() => { frontalBtn.style.opacity = '0.85'; });
  }
});
addAudioToggle();

// Zoom-in button (slot 2)
cornerButton('+', 'Zoom in', 2, () => zoomCtrl.zoomIn(orbit.state));
// Zoom-out button (slot 3)
cornerButton('−', 'Zoom out', 3, () => zoomCtrl.zoomOut(orbit.state));

scene.add(ulughBeg());
scene.add(sherDor());
scene.add(tilyaKori());

const grid = parseLayout(LAYOUT);
const hero = new Character(grid);
scene.add(hero.group);
onTick(dt => hero.tick(dt));

bindTapToMove(renderer, camera, ground, grid, hero, panCtrl, zoomCtrl, orbit.state);
bindTouchGestures(renderer.domElement, camera, zoomCtrl, orbit.state);

// Wheel zoom
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomCtrl.onWheel(e, camera, orbit.state);
}, { passive: false });

onTick(addHotspotMarkers(scene, grid, () => hero.tile));
const cards = new Cards();
hero.onArrive = () => {
  const id = hotspotForTile(grid, hero.tile);
  if (id) cards.show(id); else cards.hide();
};

onTick(addTrees(scene, grid));
addGardens(scene);
addFountains(scene);
onTick(addDoves(scene, grid, () => hero.worldPos));
onTick(addMotes(scene));

// ── STATIC SHADOW MAP ────────────────────────────────────────────────────
// The sun and all buildings are fixed, so the shadow map (≈662 shadow-caster
// draw calls — the single biggest per-frame cost) does NOT need to re-render
// every frame. Freeze it and only refresh on demand while the hero walks
// (and a few frames after, so the resting shadow lands correctly). This is a
// pure perf win with no visual change to the static scene.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true; // render the static shadows once
let shadowHold = 4;                     // assert for the first frames (deferred adds settle)
onTick(() => {
  if (hero.moving) shadowHold = 4;
  if (shadowHold > 0) { renderer.shadowMap.needsUpdate = true; shadowHold--; }
});

// Expose interactive state for the E2E/mobile harness (harmless in production,
// matching __cards / __audioCtx).
(window as unknown as Record<string, unknown>).__game = { hero, zoom: zoomCtrl, orbit, pan: panCtrl };

// ── DEBUG INSPECTION HOOK (only active with ?dbg in the URL) ──────────────
// Lets an offline screenshot harness frame any block (facade/portal/minaret/
// dome/tile field) from an arbitrary orbit angle at high zoom, overriding the
// normal 90°-step orbit. Never runs in the shipped experience.
if (location.search.includes('dbg')) {
  type Pose = { tx?: number; ty?: number; tz?: number; az?: number; el?: number; zoom?: number };
  let pose: Pose | null = null;
  const w = window as unknown as Record<string, unknown>;
  lodManager.onTierChange(2); // force full-resolution textures for fair close-up inspection
  w.inspect = (cfg: Pose | null) => { pose = cfg; };
  w.clearInspect = () => { pose = null; };
  w.__dbg = { scene, camera, renderer };
  // Reassert the inspect pose AFTER all other tickers (incl. orbit) each frame.
  onTick(() => {
    if (!pose) return;
    const { tx = 0, ty = 6, tz = 0, az = Math.PI * 0.25, el = 0.5, zoom = 3 } = pose;
    const d = 90;
    const ce = Math.cos(el), se = Math.sin(el);
    camera.position.set(tx + d * ce * Math.cos(az), ty + d * se, tz + d * ce * Math.sin(az));
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.lookAt(tx, ty, tz);
  });
}

export { scene, camera, renderer };
