import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// World positions verified: walkable tiles, min 5.39 units from any hotspot/spawn
// (10.5,7.5)→tile(24,18), (-8.5,7.5)→tile(5,18), (5.5,3.5)→tile(19,14)
const TREE_SPOTS: [number, number][] = [[10.5, 7.5], [-8.5, 7.5], [5.5, 3.5]];

export function addTrees(scene: THREE.Scene): (dt: number) => void {
  for (const [x, z] of TREE_SPOTS) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7), mat(C.trunk));
    trunk.position.y = 0.6;
    tree.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 0.9, 8), mat(C.leaf));
      cone.position.y = 1.3 + i * 0.6;
      tree.add(cone);
    }
    tree.position.set(x, 0, z);
    scene.add(shadowed(tree));
  }

  const N = 40;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [tx, tz] = TREE_SPOTS[i % TREE_SPOTS.length];
    pos.set([tx + (i % 7) - 3, 1 + (i % 5) * 0.6, tz + (i % 5) - 2], i * 3);
    seed[i] = i * 0.61;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: C.leaf, size: 0.12 }));
  scene.add(pts);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      a.setX(i, a.getX(i) + Math.sin(t + seed[i]) * dt * 0.4 + dt * 0.15);
      a.setY(i, 1.2 + Math.sin(t * 0.7 + seed[i]) * 0.8);
      if (a.getX(i) > 14) a.setX(i, -10);
    }
    a.needsUpdate = true;
  };
}
