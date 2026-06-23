import * as THREE from 'three';
import { azimuthFor, placeCameraFromState, ELEV, FRONTAL_ELEV, type CameraState } from './camera';
import { Intro, type CamWithIntro } from './intro';
import { ZoomController } from './zoom';

export function nextTarget(turns: number): number {
  return azimuthFor(0) + turns * (Math.PI / 2);
}

export class Orbit {
  /** Single source of truth for composed camera state */
  readonly state: CameraState = {
    azimuth: azimuthFor(0),
    zoom: 1.0,
    target: new THREE.Vector3(0, 3, 0),
    elev: ELEV,
  };

  private turns_ = 0;
  private targetAzimuth = azimuthFor(0);
  private frontal = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private intro: Intro;

  constructor(private cam: THREE.OrthographicCamera, private zoom: ZoomController) {
    this.intro = new Intro();
  }

  /** Number of 90° rotations the user has made (drives the secret-button reveal). */
  get turns(): number { return this.turns_; }

  get isFrontal(): boolean { return this.frontal; }

  /** Secret "frontal view": ease to a low, head-on framing from the south. */
  setFrontal(on: boolean) { this.frontal = on; }

  rotate() {
    this.frontal = false; // rotating returns to the normal iso orbit
    this.turns_ += 1;
    this.targetAzimuth = nextTarget(this.turns_);
    if (this.reduced) this.state.azimuth = this.targetAzimuth;
  }

  tick(dt: number) {
    // 1. Ease azimuth + elevation toward the active mode (iso orbit vs frontal).
    const targetAz = this.frontal ? 0 : this.targetAzimuth; // 0 = head-on from the south
    const targetElev = this.frontal ? FRONTAL_ELEV : ELEV;
    const k = Math.min(1, dt * 5);
    this.state.azimuth += (targetAz - this.state.azimuth) * k;
    this.state.elev = (this.state.elev ?? ELEV) + (targetElev - (this.state.elev ?? ELEV)) * k;
    if (Math.abs(targetAz - this.state.azimuth) < 0.0005) {
      this.state.azimuth = targetAz;
    }

    // 2. Ease zoom
    this.zoom.tick(dt, this.state);

    // 3. Let intro override during sweep — it mutates cam frustum directly and
    //    returns the overridden azimuth
    const overriddenAzimuth = this.intro.override(this.cam, this.state.azimuth, dt);

    // Build the effective state for placement (intro may override azimuth)
    const effectiveAzimuth = overriddenAzimuth;

    // Build effective state for placement — preserve pan target, zoom & elevation
    placeCameraFromState(this.cam, {
      azimuth: effectiveAzimuth,
      zoom: this.state.zoom,
      target: this.state.target,
      elev: this.state.elev,
    });

    // Intro elevation boost (kept for compat)
    const elevFactor = (this.cam as CamWithIntro).__introElevFactor;
    if (elevFactor !== undefined && elevFactor !== 1.0) {
      this.cam.position.y *= elevFactor;
      this.cam.lookAt(this.state.target.x, this.state.target.y, this.state.target.z);
      (this.cam as CamWithIntro).__introElevFactor = undefined;
    }

    // Intro also overrides frustum scale during sweep — that's fine since zoom.tick
    // already ran; intro's applyFrustumScale overwrites at combined scale only during sweep
  }
}
