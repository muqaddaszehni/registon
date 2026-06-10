import { madrasah } from './madrasah';

export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 8, h: 13, d: 5 },
    wingH: 6,
    domes: [{ offset: -7, r: 3 }],
  });
  // faces +Z → south (default orientation), no rotation
  g.position.set(0, 0, -12.5);  // front face at z = -10.0 (clear of walkable row 3 ≈ -7)
  return g;
}
