import * as THREE from 'three';

// Trees removed by design: every prior placement fell within a madrasa
// footprint/courtyard, and the real Registan square is paved stone with no
// trees among the buildings. Kept as a no-op so main.ts wiring is unchanged.
export function addTrees(_scene: THREE.Scene): (dt: number) => void {
  return () => {};
}
