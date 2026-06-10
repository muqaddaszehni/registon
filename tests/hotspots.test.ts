import { describe, it, expect } from 'vitest';
import { parseLayout } from '../src/world/grid';
import { hotspotForTile } from '../src/hotspots';

const g = parseLayout(['#####', '#S31#', '#####']);

describe('hotspotForTile', () => {
  it('returns id on hotspot tile', () => {
    expect(hotspotForTile(g, { x: 2, y: 1 })).toBe(3);
    expect(hotspotForTile(g, { x: 3, y: 1 })).toBe(1);
  });
  it('undefined elsewhere', () => {
    expect(hotspotForTile(g, { x: 1, y: 1 })).toBeUndefined();
  });
});
