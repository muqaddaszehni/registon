import * as THREE from 'three';
import { C } from '../palette';

export function addSunsetLights(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight(C.sun, 1.8);
  sun.position.set(-30, 12, 8); // west, low — long shadows across the plaza
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 30;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  // Hemisphere: sky=pale blue-white, ground=warm sand reflection
  const fill = new THREE.HemisphereLight(C.skyFill, C.bounce, 0.65);
  scene.add(fill);

  // East/front fill: warm white — keeps side faces from going dead grey
  const east = new THREE.DirectionalLight(0xf0e0c8, 0.45);
  east.position.set(30, 8, -5);
  scene.add(east);
}
