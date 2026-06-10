import { describe, it, expect } from 'vitest';
import { nextTarget } from '../src/scene/orbit';
import { azimuthFor } from '../src/scene/camera';

describe('nextTarget', () => {
  const base = azimuthFor(0);
  const HALF_PI = Math.PI / 2;
  const EPSILON = 1e-9;

  it('always lands on a clean 90-degree multiple from base', () => {
    for (let t = 1; t <= 8; t++) {
      const target = nextTarget(t);
      const offset = target - base;
      // offset should be an integer multiple of PI/2 — round-trip via rounding
      const multiple = offset / HALF_PI;
      expect(Math.abs(multiple - Math.round(multiple))).toBeLessThan(EPSILON);
    }
  });

  it('equals azimuthFor(0) + turns * PI/2', () => {
    for (let t = 1; t <= 8; t++) {
      expect(nextTarget(t)).toBeCloseTo(base + t * HALF_PI, 9);
    }
  });

  it('is strictly increasing', () => {
    for (let t = 1; t <= 8; t++) {
      expect(nextTarget(t)).toBeGreaterThan(nextTarget(t - 1));
    }
  });
});
