/**
 * ZoomController: manages zoom factor with smooth easing.
 * Wheel/pinch set a target; per-tick exponential ease.
 * Corner +/- buttons call zoomBy().
 */
import * as THREE from 'three';
import { VIEW_RADIUS, type CameraState } from './camera';
import { getTier } from './lod';

export const ZOOM_MIN = 0.18;
export const ZOOM_MAX = 1.0;

// How much the pan target can roam at full zoom (unity-side: ±13 world units x/z)
export const PAN_RADIUS_MAX = 13;

export class ZoomController {
  private targetZoom = 1.0;
  private _tier: 1 | 2 = 1;
  private _tierCallbacks: Array<(tier: 1 | 2) => void> = [];

  onTierChange(cb: (tier: 1 | 2) => void): void {
    this._tierCallbacks.push(cb);
  }

  get currentTier(): 1 | 2 { return this._tier; }

  /** Wheel delta: deltaY in pixels, anchor in NDC [-1,1] */
  onWheel(e: WheelEvent, cam: THREE.OrthographicCamera, state: CameraState) {
    // Compute world point under cursor BEFORE zoom
    const worldBefore = ndcToWorld(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1), cam);

    // Update target zoom
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    this.targetZoom = clampZoom(this.targetZoom * factor);

    // Compute world point under cursor AFTER target zoom
    const worldAfter = ndcToWorld(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1), cam, this.targetZoom);

    // Shift pan target so the world point stays fixed
    const dx = worldBefore.x - worldAfter.x;
    const dz = worldBefore.z - worldAfter.z;
    state.target.x += dx;
    state.target.z += dz;
    clampTarget(state);
  }

  /** Pinch: provide the scale delta (newSpan/oldSpan) and anchor in client coords */
  onPinch(scaleDelta: number, anchorX: number, anchorY: number, cam: THREE.OrthographicCamera, state: CameraState) {
    const worldBefore = ndcToWorld(anchorX / innerWidth * 2 - 1, -(anchorY / innerHeight * 2 - 1), cam);
    this.targetZoom = clampZoom(this.targetZoom / scaleDelta);
    const worldAfter = ndcToWorld(anchorX / innerWidth * 2 - 1, -(anchorY / innerHeight * 2 - 1), cam, this.targetZoom);
    state.target.x += worldBefore.x - worldAfter.x;
    state.target.z += worldBefore.z - worldAfter.z;
    clampTarget(state);
  }

  /** Step zoom toward center (for corner buttons) */
  zoomIn(state: CameraState) {
    this.targetZoom = clampZoom(this.targetZoom * 0.7);
    clampTarget(state);
  }

  zoomOut(state: CameraState) {
    this.targetZoom = clampZoom(this.targetZoom * (1 / 0.7));
    clampTarget(state);
  }

  /** Quick-zoom to specific value (double-click/tap) */
  setTarget(z: number) {
    this.targetZoom = clampZoom(z);
  }

  get target() { return this.targetZoom; }
  get isZoomedIn() { return this.targetZoom < 0.95; }

  /** Called each tick — eases state.zoom toward target; fires tier-change callbacks */
  tick(dt: number, state: CameraState) {
    state.zoom += (this.targetZoom - state.zoom) * Math.min(1, dt * 8);
    if (Math.abs(this.targetZoom - state.zoom) < 0.001) state.zoom = this.targetZoom;
    clampTarget(state);

    const newTier = getTier(state.zoom);
    if (newTier !== this._tier) {
      this._tier = newTier;
      for (const cb of this._tierCallbacks) cb(newTier);
    }
  }
}

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Max allowed pan radius for current zoom (0 at zoom=1, PAN_RADIUS_MAX at zoom=ZOOM_MIN) */
export function panRadius(zoom: number): number {
  return PAN_RADIUS_MAX * (1 - zoom) / (1 - ZOOM_MIN);
}

export function clampTarget(state: CameraState) {
  const r = panRadius(state.zoom);
  state.target.x = Math.max(-r, Math.min(r, state.target.x));
  state.target.z = Math.max(-r, Math.min(r, state.target.z));
  state.target.y = 3; // y always stays at 3
}

/**
 * Convert NDC (x,y in [-1,1]) to world XZ at y=3.
 * Optionally override zoom for the "after" calculation.
 */
function ndcToWorld(ndcX: number, ndcY: number, cam: THREE.OrthographicCamera, overrideZoom?: number): THREE.Vector3 {
  // In ortho cam, world x/z from NDC:
  // worldX = ndcX * (right - left)/2 + (right + left)/2
  // worldZ = ndcY * (top - bottom)/2 + (top + bottom)/2  -- but we need world XZ, not screen YZ
  // Better: use cam matrices
  let l = cam.left, r2 = cam.right, t = cam.top, b = cam.bottom;
  if (overrideZoom !== undefined) {
    const aspect = innerWidth / innerHeight;
    const half = VIEW_RADIUS * overrideZoom;
    if (aspect >= 1) { t = half; b = -half; l = -half * aspect; r2 = half * aspect; }
    else { l = -half; r2 = half; t = half / aspect; b = -half / aspect; }
  }

  // In ortho projection, NDC maps linearly to frustum coords
  const frustumX = ndcX * (r2 - l) / 2 + (r2 + l) / 2;
  const frustumY = ndcY * (t - b) / 2 + (t + b) / 2;

  // cam is looking at state.target from azimuthal direction
  // The frustum X/Y in view space map to world via inverse view matrix
  // For ortho: ray from (frustumX, frustumY) in view space, direction = cam.getWorldDirection
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  camUp.crossVectors(camRight, camDir).normalize();

  // Point in view space, at distance from cam
  const worldPoint = cam.position.clone()
    .addScaledVector(camRight, frustumX)
    .addScaledVector(camUp, frustumY);

  // Project onto y=3 plane along camDir
  const targetY = 3;
  if (Math.abs(camDir.y) > 0.001) {
    const t2 = (targetY - worldPoint.y) / camDir.y;
    worldPoint.addScaledVector(camDir, t2);
  }

  return worldPoint;
}
