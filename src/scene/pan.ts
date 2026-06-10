/**
 * PanController: mouse drag and touch drag pan.
 * Pan is only active when zoomed in (zoom < 0.95).
 * Converts screen-space drag delta to world-space pan delta.
 */
import * as THREE from 'three';
import { VIEW_RADIUS, type CameraState } from './camera';
import { clampTarget } from './zoom';

export class PanController {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  /** Start a drag from screen coords */
  startDrag(clientX: number, clientY: number) {
    this.dragging = true;
    this.lastX = clientX;
    this.lastY = clientY;
  }

  /** Called on pointermove; mutates state.target */
  moveDrag(clientX: number, clientY: number, cam: THREE.OrthographicCamera, state: CameraState) {
    if (!this.dragging) return;
    const dx = clientX - this.lastX;
    const dy = clientY - this.lastY;
    this.lastX = clientX;
    this.lastY = clientY;
    applyScreenDeltaToTarget(dx, dy, cam, state);
  }

  endDrag() {
    this.dragging = false;
  }

  get isDragging() { return this.dragging; }
}

/**
 * Convert a screen-pixel drag delta to a world-space pan of state.target.
 * Screen rightward = world cam-right; screen upward = world cam-up projected onto XZ.
 */
export function applyScreenDeltaToTarget(
  dx: number, dy: number,
  cam: THREE.OrthographicCamera,
  state: CameraState,
) {
  // World units per pixel in ortho
  const aspect = innerWidth / innerHeight;
  const half = VIEW_RADIUS * state.zoom;
  const frustumW = aspect >= 1 ? half * 2 * aspect : half * 2;
  const frustumH = aspect >= 1 ? half * 2 : (half / aspect) * 2;
  const wpp = frustumW / innerWidth;   // world units per pixel horizontally
  const hpp = frustumH / innerHeight;  // world units per pixel vertically

  // Camera right/up in world space
  const camRight = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  cam.getWorldDirection(camDir);
  camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

  // Panning: negate because dragging right means camera moves left (world moves right)
  const panX = -dx * wpp;
  const panZ = dy * hpp; // screen y inverted: drag down moves cam forward → target z increases

  // Apply in XZ (y stays at 3)
  state.target.x += camRight.x * panX;
  state.target.z += camRight.z * panX;

  // For Z panning: use cam forward projected onto XZ plane
  const camForwardXZ = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
  state.target.x += camForwardXZ.x * panZ;
  state.target.z += camForwardXZ.z * panZ;

  clampTarget(state);
}
