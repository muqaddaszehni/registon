import * as THREE from 'three';
import { azimuthFor, placeCamera } from './camera';

export class Orbit {
  private index = 0;
  private current = azimuthFor(0);
  private target = this.current;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private cam: THREE.OrthographicCamera) {}

  rotate() {
    this.index = (this.index + 1) % 4;
    void this.index; // keep for future use; silence noUnusedLocals
    this.target = this.current + Math.PI / 2; // always turn the same way
    if (this.reduced) this.current = this.target;
  }

  tick(dt: number) {
    this.current += (this.target - this.current) * Math.min(1, dt * 5);
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;
    placeCamera(this.cam, this.current);
  }
}
