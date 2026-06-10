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
