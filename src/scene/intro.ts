/**
 * MV-style intro camera sweep.
 *
 * The camera starts pulled back / elevated / rotated −30° from the default
 * azimuth and eases (cubic ease-in-out) to the standard framing over 2.8 s.
 *
 * Composing with Orbit:
 *   - Orbit calls intro.override(azimuth) each tick while the sweep is active.
 *   - intro.override returns a modified azimuth + tweaks the camera's frustum
 *     size and elevation so the handoff is seamless.
 *   - When done, override returns the azimuth unchanged and Orbit proceeds as normal.
 *
 * Reduced-motion: sweep is skipped entirely (duration = 0).
 * Input during sweep: the first tap/click completes the sweep instantly and
 *   triggers the normal tap-to-move handler — simplest approach, feels right.
 */

import * as THREE from 'three';
import { VIEW_RADIUS } from './camera';

const DURATION = 2.8; // seconds

// How much wider / higher the start position is relative to default
const START_AZIMUTH_OFFSET = -Math.PI / 6; // −30°
const START_ZOOM_FACTOR = 1.5;             // frustum 1.5× wider
const START_ELEV_FACTOR = 1.25;            // slightly higher

function easeInOut(t: number): number {
  // classic cubic ease-in-out
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class Intro {
  private elapsed = 0;
  private done = false;
  private reduced: boolean;

  constructor() {
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) this.done = true;

    // On first pointer event, fast-forward the sweep to completion
    const finish = () => {
      if (!this.done) {
        this.elapsed = DURATION;
        this.done = true;
      }
    };
    window.addEventListener('pointerdown', finish, { once: true });
  }

  get active(): boolean { return !this.done; }

  /**
   * Called every tick by Orbit.
   * Returns the azimuth Orbit should pass to placeCamera, and also directly
   * adjusts the camera frustum size and elevation for the pull-back effect.
   */
  override(cam: THREE.OrthographicCamera, azimuth: number, dt: number): number {
    if (this.done) return azimuth;

    this.elapsed += dt;
    if (this.elapsed >= DURATION) {
      this.done = true;
      // restore exact default frustum size (camera.ts sizeCamera handles aspect, but
      // VIEW_RADIUS is already the default half — just reset any scale factor)
      applyFrustumScale(cam, 1.0);
      return azimuth;
    }

    const t = easeInOut(this.elapsed / DURATION);

    // Azimuth: lerp from (default + offset) to default
    const sweepAzimuth = azimuth + START_AZIMUTH_OFFSET * (1 - t);

    // Frustum scale: lerp from START_ZOOM_FACTOR to 1
    const scale = START_ZOOM_FACTOR + (1 - START_ZOOM_FACTOR) * t;
    applyFrustumScale(cam, scale);

    // Elevation: baked into placeCamera via the camera position y; we nudge the
    // camera position directly after placeCamera runs. Store factor for caller.
    (cam as CamWithIntro).__introElevFactor = START_ELEV_FACTOR + (1 - START_ELEV_FACTOR) * t;

    return sweepAzimuth;
  }
}

// Small type extension to pass elevation factor without a global
interface CamWithIntro extends THREE.OrthographicCamera {
  __introElevFactor?: number;
}

function applyFrustumScale(cam: THREE.OrthographicCamera, scale: number) {
  const aspect = innerWidth / innerHeight;
  const half = VIEW_RADIUS * scale;
  if (aspect >= 1) {
    cam.top = half; cam.bottom = -half;
    cam.left = -half * aspect; cam.right = half * aspect;
  } else {
    cam.left = -half; cam.right = half;
    cam.top = half / aspect; cam.bottom = -half / aspect;
  }
  cam.updateProjectionMatrix();
}

export type { CamWithIntro };
