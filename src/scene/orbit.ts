import * as THREE from 'three';
import { azimuthFor, placeCamera } from './camera';
import { Intro, type CamWithIntro } from './intro';

export function nextTarget(turns: number): number {
  return azimuthFor(0) + turns * (Math.PI / 2);
}

export class Orbit {
  private turns = 0;
  private current = azimuthFor(0);
  private target = this.current;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private intro: Intro;

  constructor(private cam: THREE.OrthographicCamera) {
    this.intro = new Intro();
  }

  rotate() {
    this.turns += 1;
    this.target = nextTarget(this.turns); // always a clean stop, always same direction
    if (this.reduced) this.current = this.target;
  }

  tick(dt: number) {
    this.current += (this.target - this.current) * Math.min(1, dt * 5);
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;

    // Let intro override azimuth + frustum during sweep; no-op once done
    const azimuth = this.intro.override(this.cam, this.current, dt);
    placeCamera(this.cam, azimuth);

    // Apply elevation boost from intro if active
    const elevFactor = (this.cam as CamWithIntro).__introElevFactor;
    if (elevFactor !== undefined && elevFactor !== 1.0) {
      this.cam.position.y *= elevFactor;
      this.cam.lookAt(0, 3, 0);
      (this.cam as CamWithIntro).__introElevFactor = undefined;
    }
  }
}
