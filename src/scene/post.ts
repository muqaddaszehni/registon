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
 *   threshold 0.82 — only very bright surfaces (turquoise emissive domes + sky glints)
 *   strength  0.22 — subtle sparkle, not hazy
 *   radius    0.60 — tight spread, prevents halo bleed onto stone walls
 *
 * ACES tone mapping must be set on the renderer BEFORE this is called.
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
    0.22,   // strength
    0.60,   // radius
    0.82,   // threshold — only very bright emissive turquoise blooms
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return composer;
}
