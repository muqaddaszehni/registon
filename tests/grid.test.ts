import { describe, it, expect } from 'vitest';
import { parseLayout, isWalkable, hotspotAt } from '../src/world/grid';

const MAP = [
  '#####',
  '#.2.#',
  '#.#.#',
  '#S..#',
  '#####',
];

describe('parseLayout', () => {
  it('parses dimensions', () => {
    const g = parseLayout(MAP);
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(5);
  });
  it('finds spawn', () => {
    expect(parseLayout(MAP).spawn).toEqual({ x: 1, y: 3 });
  });
  it('walkability: walls blocked, floor/spawn/hotspots walkable, out-of-bounds blocked', () => {
    const g = parseLayout(MAP);
    expect(isWalkable(g, 0, 0)).toBe(false);
    expect(isWalkable(g, 1, 1)).toBe(true);
    expect(isWalkable(g, 1, 3)).toBe(true);
    expect(isWalkable(g, 2, 1)).toBe(true);
    expect(isWalkable(g, -1, 2)).toBe(false);
    expect(isWalkable(g, 5, 2)).toBe(false);
  });
  it('hotspot lookup', () => {
    const g = parseLayout(MAP);
    expect(hotspotAt(g, 2, 1)).toBe(2);
    expect(hotspotAt(g, 1, 1)).toBeUndefined();
  });
  it('throws when no spawn', () => {
    expect(() => parseLayout(['#.#'])).toThrow();
  });
  it('ragged rows: short rows treat missing chars as blocked', () => {
    // row 0 is 5 wide; row 1 is only 3 wide — positions x=3,4 on row 1 should be blocked
    const g = parseLayout(['#S..#', '#.#']);
    expect(isWalkable(g, 3, 1)).toBe(false);
    expect(isWalkable(g, 4, 1)).toBe(false);
    expect(isWalkable(g, 1, 1)).toBe(true); // '#.#' — x=1 is '.'
  });
});
