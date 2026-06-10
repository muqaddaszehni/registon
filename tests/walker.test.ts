import { describe, it, expect } from 'vitest';
import { advance } from '../src/character/walker';

describe('advance', () => {
  it('moves toward first waypoint by dist', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 2, z: 0 }], 0.5);
    expect(r.pos).toEqual({ x: 0.5, z: 0 });
    expect(r.waypoints.length).toBe(1);
  });
  it('consumes waypoint and continues with leftover distance', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 1, z: 0 }, { x: 1, z: 1 }], 1.5);
    expect(r.pos.x).toBeCloseTo(1);
    expect(r.pos.z).toBeCloseTo(0.5);
    expect(r.waypoints.length).toBe(1);
  });
  it('stops exactly at final waypoint', () => {
    const r = advance({ x: 0, z: 0 }, [{ x: 1, z: 0 }], 5);
    expect(r.pos).toEqual({ x: 1, z: 0 });
    expect(r.waypoints.length).toBe(0);
  });
  it('no waypoints → unchanged', () => {
    expect(advance({ x: 3, z: 4 }, [], 1)).toEqual({ pos: { x: 3, z: 4 }, waypoints: [] });
  });
});
