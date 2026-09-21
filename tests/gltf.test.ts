import { describe, it, expect } from 'vitest';
import { gltfRequested, placementFor, MADRASAH_PLACEMENTS } from '../src/buildings/gltf';

describe('gltfRequested', () => {
  it('is false with no flag', () => {
    expect(gltfRequested('')).toBe(false);
    expect(gltfRequested('?foo=1')).toBe(false);
  });
  it('is true for bare and truthy flags', () => {
    expect(gltfRequested('?gltf')).toBe(true);
    expect(gltfRequested('?gltf=1')).toBe(true);
    expect(gltfRequested('?foo=1&gltf=true')).toBe(true);
  });
  it('is false for explicit off values', () => {
    expect(gltfRequested('?gltf=0')).toBe(false);
    expect(gltfRequested('?gltf=false')).toBe(false);
  });
});

describe('placementFor', () => {
  it('matches the procedural builder placements', () => {
    expect(placementFor('UlughBeg')).toEqual({ position: [-13.5, 0, 0], rotationY: Math.PI / 2 });
    expect(placementFor('SherDor')).toEqual({ position: [13.0, 0, 0], rotationY: -Math.PI / 2 });
    expect(placementFor('TilyaKori')).toEqual({ position: [0, 0, -12.5], rotationY: 0 });
  });
  it('returns null for unknown names', () => {
    expect(placementFor('Fountain')).toBeNull();
    expect(placementFor('')).toBeNull();
  });
  it('covers all three madrasahs', () => {
    expect(Object.keys(MADRASAH_PLACEMENTS).sort()).toEqual(['SherDor', 'TilyaKori', 'UlughBeg']);
  });
});
