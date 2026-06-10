import * as THREE from 'three';
import { C } from '../palette';
import { LAYOUT } from '../world/layout';

export function makeGround(): THREE.Mesh {
  const cols = LAYOUT[0].length, rows = LAYOUT.length;
  const tileSize = 48; // was 16 — higher res for crispness
  const cv = document.createElement('canvas');
  cv.width = cols * tileSize; cv.height = rows * tileSize;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#' + C.plaza.toString(16).padStart(6, '0');
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#' + C.plazaPath.toString(16).padStart(6, '0');
  g.lineWidth = 2;
  for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * tileSize, 0); g.lineTo(x * tileSize, cv.height); g.stroke(); }
  for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * tileSize); g.lineTo(cv.width, y * tileSize); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cols, 1, rows),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.position.y = -0.5; // top surface at y=0
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
