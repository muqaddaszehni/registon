import * as THREE from 'three';
import { makeSky } from './scene/sky';
import { makeCamera, sizeCamera } from './scene/camera';
import { addSunsetLights } from './scene/lights';
import { makeGround } from './scene/ground';

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

export { scene, camera, renderer };
