import * as THREE from 'three';
import { azimuthFor, placeCamera } from './camera';

export function nextTarget(turns: number): number {
  return azimuthFor(0) + turns * (Math.PI / 2);
}

export class Orbit {
  private turns = 0;
  private current = azimuthFor(0);
  private target = this.current;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private cam: THREE.OrthographicCamera) {}

  rotate() {
    this.turns += 1;
    this.target = nextTarget(this.turns); // always a clean stop, always same direction
    if (this.reduced) this.current = this.target;
  }

  tick(dt: number) {
    this.current += (this.target - this.current) * Math.min(1, dt * 5);
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;
    placeCamera(this.cam, this.current);
  }
}
