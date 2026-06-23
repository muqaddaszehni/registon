import * as THREE from 'three';
import { Grid, isWalkable } from './world/grid';
import { worldToTile } from './world/coords';
import { Character } from './character/character';
import { PanController, applyScreenDeltaToTarget } from './scene/pan';
import { ZoomController } from './scene/zoom';
import { type CameraState } from './scene/camera';

const TAP_MAX_MS = 350;
const TAP_MAX_MOVE_PX = 8;

export function bindTapToMove(
  renderer: THREE.WebGLRenderer, camera: THREE.Camera, ground: THREE.Mesh,
  grid: Grid, ch: Character,
  pan: PanController, zoom: ZoomController, state: CameraState,
) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let isDrag = false;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    // Only handle primary pointer (single-touch or mouse left)
    if (e.isPrimary === false) return;
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
    isDrag = false;

    // Start pan drag tracking
    if (zoom.isZoomedIn) {
      pan.startDrag(e.clientX, e.clientY);
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (e.isPrimary === false) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const moved = Math.sqrt(dx * dx + dy * dy);

    if (moved > TAP_MAX_MOVE_PX) {
      isDrag = true;
    }

    if (isDrag && zoom.isZoomedIn) {
      pan.moveDrag(e.clientX, e.clientY, camera as THREE.OrthographicCamera, state);
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (e.isPrimary === false) return;
    pan.endDrag();

    const elapsed = performance.now() - downAt;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const isTap = elapsed < TAP_MAX_MS && moved < TAP_MAX_MOVE_PX;

    if (!isTap) return;

    // Double-tap/double-click detection
    const now = performance.now();
    const dtTap = now - lastTapAt;
    const tapDist = Math.sqrt((e.clientX - lastTapX) ** 2 + (e.clientY - lastTapY) ** 2);
    const isDoubleTap = dtTap < 400 && tapDist < 40;
    lastTapAt = now;
    lastTapX = e.clientX;
    lastTapY = e.clientY;

    if (isDoubleTap) {
      // Double-tap = quick-zoom. Cancel the step the first tap started so the
      // hero doesn't wander off while you zoom (keeps the single tap snappy).
      ch.stop();
      if (zoom.target < 0.95) {
        zoom.setTarget(1.0);
        state.target.set(0, 3, 0);
      } else {
        // Zoom toward clicked world point
        ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(ground, false)[0];
        if (hit) {
          state.target.set(hit.point.x, 3, hit.point.z);
        }
        zoom.setTarget(0.4);
      }
      lastTapAt = 0; // reset to prevent triple-tap
      return;
    }

    // Single tap → walk immediately (snappy).
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(ground, false)[0];
    if (!hit) return;
    const t = worldToTile(grid.cols, grid.rows, { x: hit.point.x, z: hit.point.z });
    if (isWalkable(grid, t.x, t.y)) ch.walkTo(t);
  });
}

/** Two-finger touch handling for pinch-zoom and two-finger pan */
export function bindTouchGestures(
  el: HTMLElement,
  cam: THREE.OrthographicCamera,
  zoom: ZoomController,
  state: CameraState,
) {
  let prevTouches: Map<number, {x: number; y: number}> = new Map();

  el.addEventListener('touchstart', (e) => {
    // Only block default for multi-touch (pinch/pan); single-finger taps flow to
    // the pointer handlers (tap-to-move) cleanly. touch-action:none already stops
    // the browser from scrolling/zooming the page.
    if (e.touches.length >= 2) e.preventDefault();
    prevTouches = getTouchMap(e.touches);
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    if (e.touches.length >= 2) e.preventDefault();
    const curr = getTouchMap(e.touches);
    const keys = [...curr.keys()];

    if (keys.length === 2) {
      const [a, b] = keys;
      const prevA = prevTouches.get(a);
      const prevB = prevTouches.get(b);
      const currA = curr.get(a)!;
      const currB = curr.get(b)!;

      if (prevA && prevB) {
        // Pinch: compare spans
        const prevSpan = dist(prevA, prevB);
        const currSpan = dist(currA, currB);
        if (prevSpan > 1) {
          const scaleDelta = currSpan / prevSpan;
          const midX = (currA.x + currB.x) / 2;
          const midY = (currA.y + currB.y) / 2;
          zoom.onPinch(scaleDelta, midX, midY, cam, state);
        }

        // Two-finger pan: midpoint delta
        const prevMidX = (prevA.x + prevB.x) / 2;
        const prevMidY = (prevA.y + prevB.y) / 2;
        const currMidX = (currA.x + currB.x) / 2;
        const currMidY = (currA.y + currB.y) / 2;
        const dx = currMidX - prevMidX;
        const dy = currMidY - prevMidY;
        applyScreenDeltaToTarget(dx, dy, cam, state);
      }
    }

    prevTouches = curr;
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    prevTouches = getTouchMap(e.touches);
  });
}

function getTouchMap(touches: TouchList): Map<number, {x: number; y: number}> {
  const m = new Map<number, {x: number; y: number}>();
  for (let i = 0; i < touches.length; i++) {
    m.set(touches[i].identifier, { x: touches[i].clientX, y: touches[i].clientY });
  }
  return m;
}

function dist(a: {x: number; y: number}, b: {x: number; y: number}): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
