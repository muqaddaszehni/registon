import * as THREE from 'three';
import { C } from '../palette';

export function addSunsetLights(scene: THREE.Scene) {
  // Sun elevated to y=20 — open plaza in direct light, long raking shadows from minarets/pylons.
  const sun = new THREE.DirectionalLight(C.sun, 2.2);
  sun.position.set(-30, 20, 8); // west-ish, elevated — good shadow angle + plaza sunlit
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 32;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.intensity = 0.55; // crisper shadow contrast
  scene.add(sun);

  // Hemisphere: warm sky top, very warm sandy bounce from ground
  // Ground hemisphere colour is key: warm sand/amber keeps shadowed floor cream not grey
  const fill = new THREE.HemisphereLight(0xf8ead8, 0xf0c878, 0.80);
  scene.add(fill);

  // East/front fill: warm orange-white — keeps side faces from going dead grey
  const east = new THREE.DirectionalLight(0xf8e4c0, 0.45);
  east.position.set(30, 10, -5);
  scene.add(east);
}
