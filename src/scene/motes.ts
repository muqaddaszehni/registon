import * as THREE from 'three';

/**
 * addMotes — thin field of slow-drifting dust motes for golden-hour shimmer.
 *
 * Uses a small THREE.Points field with additive blending, warm orange-gold color.
 * Positions are seeded deterministically (no Math.random).
 * Respects prefers-reduced-motion: if the user prefers reduced motion, motes freeze.
 *
 * Returns a tick function (dt: number) => void that animates the motes.
 * Wire this in main.ts:
 *   import { addMotes } from './scene/motes';
 *   onTick(addMotes(scene));
 *
 * NOTE: Controller must wire this — do NOT add to main.ts yourself.
 */
export function addMotes(scene: THREE.Scene): (dt: number) => void {
  const COUNT = 220;
  const positions = new Float32Array(COUNT * 3);

  // Deterministic seeded positions using a simple LCG pattern.
  // Spread across an air volume above the plaza so motes read as floating golden
  // dust, NOT specks on the floor: y in [1.5, 13], x/z in a disc of radius ~17.
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    const phi = i * 2.399963; // golden angle in radians — uniform disc distribution
    const r = Math.sqrt(t) * 17; // radial distance 0..17
    positions[i * 3 + 0] = Math.cos(phi) * r;                            // x
    positions[i * 3 + 1] = 1.5 + (((i * 7919) % 239) / 239) * 11.5;    // y: 1.5–13 (off floor)
    positions[i * 3 + 2] = Math.sin(phi) * r;                            // z
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffd28a,      // warm golden, slightly paler so it glows not glares
    size: 0.05,           // finer — reads as airborne dust, not dots
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.22,        // subtle — only catches where it crosses dark stone
    blending: THREE.AdditiveBlending,
    depthWrite: false,    // additive blend — don't write to depth buffer
  });

  const motes = new THREE.Points(geo, mat);
  motes.name = 'dust-motes';
  scene.add(motes);

  // Store per-mote drift velocities — tiny, warm thermal-like upward drift
  // Seeded deterministically
  const velocities = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    velocities[i * 3 + 0] = (((i * 2053) % 100) / 100 - 0.5) * 0.08;  // x drift ±0.04/s
    velocities[i * 3 + 1] = 0.04 + ((i * 3779) % 100) / 100 * 0.06;   // y rise  0.04–0.10/s
    velocities[i * 3 + 2] = (((i * 4093) % 100) / 100 - 0.5) * 0.08;  // z drift ±0.04/s
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (dt: number) => {
    if (prefersReducedMotion) return; // freeze motes for accessibility

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 0] += velocities[i * 3 + 0] * dt;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      // Wrap y: when mote drifts above 14 units, reset to lower air band
      if (arr[i * 3 + 1] > 14) {
        arr[i * 3 + 1] = 1.5;
      }
      // Wrap x/z if drifted outside band (±20)
      if (Math.abs(arr[i * 3 + 0]) > 20) arr[i * 3 + 0] *= -0.9;
      if (Math.abs(arr[i * 3 + 2]) > 20) arr[i * 3 + 2] *= -0.9;
    }

    pos.needsUpdate = true;
  };
}
