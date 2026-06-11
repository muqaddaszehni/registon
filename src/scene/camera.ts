import * as THREE from 'three';

const ELEV = 0.82;            // camera height factor (MV-ish, slightly above true iso)
export const DIST = 60;
export const VIEW_RADIUS = 24; // world units that must fit on screen

/** Composed camera state — single source of truth, mutated each tick */
export interface CameraState {
  azimuth: number;   // radians; owned by Orbit
  zoom: number;      // 1.0 = full view, 0.18 = facade close-up
  target: THREE.Vector3; // look-at point; (0,3,0) at rest, pan changes it
}

export function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 35, 130);
  sizeCamera(cam, 1.0);
  placeCameraFromState(cam, { azimuth: azimuthFor(0), zoom: 1.0, target: new THREE.Vector3(0, 3, 0) });
  return cam;
}

export function azimuthFor(i: number): number {
  return Math.PI / 4 + i * Math.PI / 2; // start SE
}

/** Legacy single-arg placement — used by tests and intro, kept for compat */
export function placeCamera(cam: THREE.OrthographicCamera, azimuth: number) {
  cam.position.set(Math.sin(azimuth) * DIST, DIST * ELEV, Math.cos(azimuth) * DIST);
  cam.lookAt(0, 3, 0);
}

/** Full composed placement from CameraState */
export function placeCameraFromState(cam: THREE.OrthographicCamera, state: CameraState) {
  const { azimuth, zoom, target } = state;
  cam.position.set(
    target.x + Math.sin(azimuth) * DIST,
    target.y + DIST * ELEV,
    target.z + Math.cos(azimuth) * DIST,
  );
  cam.lookAt(target.x, target.y, target.z);
  applyCameraZoom(cam, zoom);
}

export function sizeCamera(cam: THREE.OrthographicCamera, zoom = 1.0) {
  const aspect = innerWidth / innerHeight;
  const half = VIEW_RADIUS * zoom;
  if (aspect >= 1) { cam.top = half; cam.bottom = -half; cam.left = -half * aspect; cam.right = half * aspect; }
  else { cam.left = -half; cam.right = half; cam.top = half / aspect; cam.bottom = -half / aspect; }
  cam.updateProjectionMatrix();
}

export function applyCameraZoom(cam: THREE.OrthographicCamera, zoom: number) {
  sizeCamera(cam, zoom);
}
