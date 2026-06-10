import * as THREE from 'three';
import { makeSky } from './scene/sky';
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround } from './scene/ground';
import { Orbit } from './scene/orbit';
import { cornerButton } from './ui/buttons';
// TEMP gallery — remove in Task 8
import { girih, band, kufic, tigerDecal } from './patterns/textures';
import { C } from './palette';

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
scene.add(makeGround());

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

// TEMP gallery — remove in Task 8
[girih(C.cobalt, C.turquoise, C.cream), band(C.lapis, C.turquoise), kufic(C.cream, C.lapis), tigerDecal()]
  .forEach((tex, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: tex }));
    p.position.set(-12 + i * 7, 4, 0);
    scene.add(p);
  });

export { scene, camera, renderer };
