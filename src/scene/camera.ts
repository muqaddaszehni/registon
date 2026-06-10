import * as THREE from 'three';

const ELEV = 0.82;            // camera height factor (MV-ish, slightly above true iso)
const DIST = 60;
export const VIEW_RADIUS = 24; // world units that must fit on screen

export function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  sizeCamera(cam);
  placeCamera(cam, azimuthFor(0));
  return cam;
}

export function azimuthFor(i: number): number {
  return Math.PI / 4 + i * Math.PI / 2; // start SE
}

export function placeCamera(cam: THREE.OrthographicCamera, azimuth: number) {
  cam.position.set(Math.sin(azimuth) * DIST, DIST * ELEV, Math.cos(azimuth) * DIST);
  cam.lookAt(0, 3, 0);  // raised to recentre taller portals and minarets
}

export function sizeCamera(cam: THREE.OrthographicCamera) {
  const aspect = innerWidth / innerHeight;
  // fit VIEW_RADIUS in the SMALLER dimension → portrait pulls back automatically (spec edge case)
  const half = VIEW_RADIUS;
  if (aspect >= 1) { cam.top = half; cam.bottom = -half; cam.left = -half * aspect; cam.right = half * aspect; }
  else { cam.left = -half; cam.right = half; cam.top = half / aspect; cam.bottom = -half / aspect; }
  cam.updateProjectionMatrix();
}
