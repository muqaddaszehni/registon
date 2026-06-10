import * as THREE from 'three';
import { makeSky } from './scene/sky';
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround } from './scene/ground';
import { Orbit } from './scene/orbit';
import { cornerButton } from './ui/buttons';
import { ulughBeg } from './buildings/ulughbeg';
import { sherDor } from './buildings/sherdor';
import { tilyaKori } from './buildings/tilyakori';
import { parseLayout } from './world/grid';
import { LAYOUT } from './world/layout';
import { Character } from './character/character';
import { bindTapToMove } from './input';
import { addHotspotMarkers, hotspotForTile } from './hotspots';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSky();

const camera = makeCamera();
addSunsetLights(scene);
const ground = makeGround(); scene.add(ground);

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); sizeCamera(camera); });

const clock = new THREE.Clock();
const tickers: Array<(dt: number) => void> = [];
export function onTick(fn: (dt: number) => void) { tickers.push(fn); }

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const t of tickers) t(dt);
  renderer.render(scene, camera);
});

const orbit = new Orbit(camera);
onTick(dt => orbit.tick(dt));
cornerButton('⟳', 'Rotate view', 0, () => orbit.rotate());

scene.add(ulughBeg());
scene.add(sherDor());
scene.add(tilyaKori());

const grid = parseLayout(LAYOUT);
const hero = new Character(grid);
scene.add(hero.group);
onTick(dt => hero.tick(dt));
bindTapToMove(renderer, camera, ground, grid, hero);
onTick(addHotspotMarkers(scene, grid));
hero.onArrive = () => {
  const id = hotspotForTile(grid, hero.tile);
  if (id) console.log('hotspot', id); // replaced in Task 14
};

export { scene, camera, renderer };
