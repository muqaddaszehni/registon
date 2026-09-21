// Optional Blender-exported GLB of the three madrasahs, loaded behind a `?gltf`
// URL flag. Falls back to the procedural builders (ulughbeg/sherdor/tilyakori)
// when the file is missing or fails to parse.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** True when the query string carries a `gltf` flag (`?gltf`, `?gltf=1`), false for `?gltf=0`. */
export function gltfRequested(search: string = location.search): boolean {
  const params = new URLSearchParams(search);
  if (!params.has('gltf')) return false;
  const v = params.get('gltf') ?? '';
  return !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
}

export type MadrasahName = 'UlughBeg' | 'SherDor' | 'TilyaKori';

export interface Placement {
  readonly position: readonly [number, number, number];
  /** Y rotation in radians. */
  readonly rotationY: number;
}

/** World placement used by the procedural builders (see ulughbeg.ts / sherdor.ts / tilyakori.ts). */
export const MADRASAH_PLACEMENTS: Readonly<Record<MadrasahName, Placement>> = {
  UlughBeg: { position: [-13.5, 0, 0], rotationY: Math.PI / 2 },   // faces +X (east)
  SherDor:  { position: [13.0, 0, 0],  rotationY: -Math.PI / 2 },  // faces -X (west)
  TilyaKori: { position: [0, 0, -12.5], rotationY: 0 },            // faces +Z (south)
};

export function isMadrasahName(name: string): name is MadrasahName {
  return name in MADRASAH_PLACEMENTS;
}

/** Placement for a madrasah node name, or null for anything else. */
export function placementFor(name: string): Placement | null {
  return isMadrasahName(name) ? MADRASAH_PLACEMENTS[name] : null;
}

const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

function prepareMesh(mesh: THREE.Mesh): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    // Blender exports are usually single-sided; keep FrontSide unless the
    // authored material is already double-sided (thin walls, foliage).
    if (m.side !== THREE.DoubleSide) m.side = THREE.FrontSide;
  }
}

/**
 * If the root children are the three named madrasahs, all sitting at the local
 * origin, apply the procedural world placements (GLB authored per-building).
 * Otherwise the GLB is assumed to already be in world coordinates.
 */
export function applyPlacements(root: THREE.Object3D): boolean {
  const named = root.children.filter(c => isMadrasahName(c.name));
  if (named.length === 0) return false;
  if (!named.every(c => c.position.length() < 0.001)) return false;
  for (const child of named) {
    const p = placementFor(child.name);
    if (!p) continue;
    child.position.set(p.position[0], p.position[1], p.position[2]);
    child.rotation.y = p.rotationY;
  }
  return true;
}

/** Load the Registan GLB; resolves to null (with a console.warn) on any failure. */
export async function loadRegistanGLB(url = '/models/registan.glb'): Promise<THREE.Group | null> {
  try {
    const gltf = await makeLoader().loadAsync(url);
    const root = gltf.scene;
    root.name = 'registan-glb';
    root.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) prepareMesh(obj as THREE.Mesh);
    });
    applyPlacements(root);
    return root;
  } catch (err) {
    console.warn(`[gltf] failed to load ${url}; using procedural buildings`, err);
    return null;
  }
}

/** Number of meshes in an object tree (for logging). */
export function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse(obj => { if ((obj as THREE.Mesh).isMesh) n++; });
  return n;
}
