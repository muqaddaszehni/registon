import * as THREE from 'three';
import { C } from '../palette';

export function addSunsetLights(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(C.sun, 2.2);
  sun.position.set(-30, 12, 8); // west, low — long shadows across the plaza
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 30;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  const fill = new THREE.HemisphereLight(C.skyBottom, C.skyTop, 0.9);
  scene.add(fill);
}
