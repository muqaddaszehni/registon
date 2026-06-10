import { describe, it, expect } from 'vitest';
import { parseLayout } from './grid';
import { findPath } from '../character/astar';

const g = parseLayout([
  '#####',
  '#S..#',
  '#.#.#',
  '#...#',
  '#####',
]);

describe('findPath', () => {
  it('straight line', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 3, y: 1 }))
      .toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
  });
  it('routes around wall', () => {
    const p = findPath(g, { x: 1, y: 3 }, { x: 3, y: 1 })!;
    expect(p[0]).toEqual({ x: 1, y: 3 });
    expect(p[p.length - 1]).toEqual({ x: 3, y: 1 });
    expect(p).not.toContainEqual({ x: 2, y: 2 }); // the wall
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i].x - p[i-1].x) + Math.abs(p[i].y - p[i-1].y)).toBe(1); // 4-connected
    }
  });
  it('start equals goal', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('unreachable / blocked goal returns null', () => {
    expect(findPath(g, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
    expect(findPath(g, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });
});
