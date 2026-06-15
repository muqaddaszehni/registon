import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Cinematic golden-hour grade shader.
 *
 * Runs on the LINEAR HDR buffer (after bloom, before OutputPass tone-maps to sRGB),
 * so the math stays in linear light and the ACES sky pre-warm is preserved.
 *
 *   - Warm tint: gently lifts red, trims blue → golden air.
 *   - Vignette: soft radial darkening for cinematic framing (corners only).
 *   - Subtle contrast S-curve around mid-grey → richer, less pastel, without crushing.
 *
 * Cheap: one fullscreen pass, a handful of ALU ops, no texture taps beyond the input.
 */
const GoldenGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTint: { value: new THREE.Color(1.045, 1.005, 0.95) }, // warm: +R, ~G, -B
    uVignette: { value: 0.28 },   // strength of corner darkening
    uContrast: { value: 0.06 },   // gentle S-curve amount
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    uniform float uVignette;
    uniform float uContrast;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);

      // Warm color grade (linear space).
      c.rgb *= uTint;

      // Gentle contrast S-curve around mid-grey — richer, not crushed.
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), uContrast);

      // Soft vignette: smooth radial falloff from centre, corners only.
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.78, 0.30, dot(d, d) * 2.2);
      c.rgb *= mix(1.0 - uVignette, 1.0, v);

      gl_FragColor = c;
    }
  `,
};

/**
 * Build the EffectComposer chain:
 *   RenderPass → UnrealBloomPass (turquoise domes + gold glints only)
 *             → GoldenGrade (warm tint + vignette + contrast)
 *             → OutputPass (ACES tone-map → sRGB)
 *
 * Bloom tuning:
 *   threshold 0.85 — only bright emissive turquoise tile + gold finials bloom;
 *                    matte stone (mid-bright) stays clean.
 *   strength  0.26 — gentle glow on the domes, not hazy.
 *   radius    0.55 — tight spread, prevents halo bleed onto stone walls.
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
    0.26,   // strength — gentle glow on bright turquoise/gold
    0.55,   // radius — tight, prevents bleed
    0.85,   // threshold — only bright emissive blooms; matte stone stays clean
  );
  composer.addPass(bloom);

  composer.addPass(new ShaderPass(GoldenGradeShader));

  composer.addPass(new OutputPass());

  return composer;
}
