import * as THREE from 'three';
import { C } from '../palette';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 512;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,    '#' + C.skyTop.toString(16).padStart(6, '0'));
  grad.addColorStop(0.75, '#' + (0xf8ddb8).toString(16).padStart(6, '0')); // horizon glow
  grad.addColorStop(1,    '#' + C.skyBottom.toString(16).padStart(6, '0'));
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
