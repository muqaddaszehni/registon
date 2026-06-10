import { describe, it, expect } from 'vitest';
import { tileToWorld, worldToTile } from '../src/world/coords';

describe('coords', () => {
  it('round-trips center of grid', () => {
    // 10x10 grid: tile (5,5) center sits at world (0.5, 0.5)
    expect(tileToWorld(10, 10, { x: 5, y: 5 })).toEqual({ x: 0.5, z: 0.5 });
    expect(worldToTile(10, 10, { x: 0.5, z: 0.5 })).toEqual({ x: 5, y: 5 });
  });
  it('round-trips corner', () => {
    expect(worldToTile(10, 10, tileToWorld(10, 10, { x: 0, y: 9 }))).toEqual({ x: 0, y: 9 });
  });
});
