import { webglAvailable, showFallback } from './fallback';
import { addAudioToggle } from './audio';
if (!webglAvailable()) { showFallback(); throw new Error('no webgl'); }

import * as THREE from 'three';
import { makeSky } from './scene/sky';
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround } from './scene/ground';
import { Orbit } from './scene/orbit';
import { ZoomController } from './scene/zoom';
import { PanController } from './scene/pan';
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

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSky();

const camera = makeCamera();
addSunsetLights(scene);
const ground = makeGround(); scene.add(ground);

const composer = makeComposer(renderer, scene, camera);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sizeCamera(camera, orbit.state.zoom);
});

let last = performance.now();
const tickers: Array<(dt: number) => void> = [];
export function onTick(fn: (dt: number) => void) { tickers.push(fn); }

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  for (const t of tickers) t(dt);
  composer.render();
});

// Zoom + pan controllers
const zoomCtrl = new ZoomController();
const panCtrl = new PanController();

const orbit = new Orbit(camera, zoomCtrl);
onTick(dt => orbit.tick(dt));

// Rotation button (slot 0)
cornerButton('⟳', 'Rotate view', 0, () => orbit.rotate());
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

onTick(addHotspotMarkers(scene, grid));
const cards = new Cards();
hero.onArrive = () => {
  const id = hotspotForTile(grid, hero.tile);
  if (id) cards.show(id); else cards.hide();
};

onTick(addTrees(scene));
addGardens(scene);
onTick(addDoves(scene, grid, () => hero.worldPos));

export { scene, camera, renderer };
