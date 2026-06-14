import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Build the EffectComposer chain:
 *   RenderPass → UnrealBloomPass (turquoise dome glints only) → OutputPass
 *
 * Bloom tuning:
 *   threshold 0.88 — only very bright emissive surfaces (turquoise domes + gold finials)
 *                    raised from 0.82 so lit stone faces (mid-bright) don't bloom
 *   strength  0.20 — subtle sparkle, not hazy
 *   radius    0.55 — tight spread, prevents halo bleed onto stone walls
 *
 * ACES tone mapping must be set on the renderer BEFORE this is called.
 * Sky gradient stops are pre-compensated for ACES compression — preserve this.
 */
export function makeComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): EffectComposer {
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.20,   // strength — subtle, no haze
    0.55,   // radius — tight, prevents bleed
    0.88,   // threshold — only very bright emissive turquoise/gold blooms; stone stays clean
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return composer;
}
