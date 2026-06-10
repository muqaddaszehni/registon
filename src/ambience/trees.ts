import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// World positions verified: walkable tiles, min 5.39 units from any hotspot/spawn
// (10.5,7.5)→tile(24,18), (-6.5,5.5)→tile(7,16), (5.5,3.5)→tile(19,14)
const TREE_SPOTS: [number, number][] = [[10.5, 7.5], [-6.5, 5.5], [5.5, 3.5]];

// Tree types: 0=round deciduous, 1=tall cypress
const TREE_TYPES: number[] = [0, 0, 1]; // two round + one cypress

function makeRoundTree(): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7), mat(C.trunk));
  trunk.position.y = 0.6;
  tree.add(trunk);
  // Three overlapping cones giving a round deciduous canopy
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 0.9, 8), mat(C.leaf));
    cone.position.y = 1.3 + i * 0.6;
    tree.add(cone);
  }
  return tree;
}

function makeCypressTree(): THREE.Group {
  const tree = new THREE.Group();
  // Slim trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.6, 6), mat(C.trunk));
  trunk.position.y = 0.8;
  tree.add(trunk);
  // Tall narrow cones stacked — classic cypress silhouette
  const darkGreen = 0x3d7a3a;
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.38 - i * 0.05, 0.75, 6),
      mat(darkGreen),
    );
    cone.position.y = 1.7 + i * 0.62;
    tree.add(cone);
  }
  return tree;
}

export function addTrees(scene: THREE.Scene): (dt: number) => void {
  for (let idx = 0; idx < TREE_SPOTS.length; idx++) {
    const [x, z] = TREE_SPOTS[idx];
    const tree = TREE_TYPES[idx] === 1 ? makeCypressTree() : makeRoundTree();
    tree.position.set(x, 0, z);
    scene.add(shadowed(tree));
  }

  const N = 40;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [tx, tz] = TREE_SPOTS[i % TREE_SPOTS.length];
    pos.set([Math.min(tx + (i % 7) - 3, 10), 1 + (i % 5) * 0.6, tz + (i % 5) - 2], i * 3);
    seed[i] = i * 0.61;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: C.leaf, size: 0.22 }));
  scene.add(pts);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const base = i * 3;
      pos[base] += Math.sin(t + seed[i]) * dt * 0.4 + dt * 0.15;
      pos[base + 1] = 1.2 + Math.sin(t * 0.7 + seed[i]) * 0.8;
      if (pos[base] > 10) pos[base] = -10;
    }
    a.needsUpdate = true;
  };
}
