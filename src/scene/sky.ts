import * as THREE from 'three';
import { C } from '../palette';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 512;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,    '#' + C.skyTop.toString(16).padStart(6, '0'));
  // Horizon and bottom stops are pre-compensated for ACES desaturation through EffectComposer.
  // The ACES pipeline compresses warm channels; source values are boosted so the rendered
  // output matches the intended warm peach gradient.
  grad.addColorStop(0.75, '#' + (0xffd09c).toString(16).padStart(6, '0')); // horizon glow
  grad.addColorStop(1,    '#' + (0xffc07c).toString(16).padStart(6, '0')); // bottom peach
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
