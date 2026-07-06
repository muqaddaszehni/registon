import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../palette';
import { mat } from '../buildings/primitives';

// Two low circular reflecting basins flanking the south axis — the ref's
// signature foreground cue (twin pools either side of the central walk). Each is
// a marble drum rimmed by a slightly smaller water disc, with a tiny center jet.
// The water carries a soft emissive so the existing UnrealBloom catches a
// highlight. Rims merged into one geometry; rims are the only shadow casters.

const FOUNTAIN_SPOTS: [number, number][] = [
  [-6.0, 4.5],
  [ 6.0, 4.5],
];

const WATER = 0x3fa9c8;

export function addFountains(scene: THREE.Scene): void {
  const rimGeos: THREE.BufferGeometry[] = [];
  const waterGeos: THREE.BufferGeometry[] = [];
  const jetGeos: THREE.BufferGeometry[] = [];

  for (const [x, z] of FOUNTAIN_SPOTS) {
    // Marble basin drum.
    rimGeos.push(new THREE.CylinderGeometry(1.5, 1.5, 0.34, 28).translate(x, 0.17, z));
    // Water disc inset on top → reads as a ring of marble lip around the water.
    waterGeos.push(new THREE.CircleGeometry(1.25, 28).rotateX(-Math.PI / 2).translate(x, 0.345, z));
    // Tiny center jet.
    jetGeos.push(new THREE.ConeGeometry(0.05, 0.5, 6).translate(x, 0.59, z));
  }

  const rim = new THREE.Mesh(mergeGeometries(rimGeos), mat(C.marble));
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);

  const waterMat = new THREE.MeshLambertMaterial({
    color: WATER,
    emissive: new THREE.Color(WATER),
    emissiveIntensity: 0.18,
  });
  scene.add(new THREE.Mesh(mergeGeometries(waterGeos), waterMat));

  const jetMat = new THREE.MeshLambertMaterial({
    color: C.turquoise,
    emissive: new THREE.Color(C.turquoise),
    emissiveIntensity: 0.18,
  });
  scene.add(new THREE.Mesh(mergeGeometries(jetGeos), jetMat));
}
