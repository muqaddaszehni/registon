import { madrasah } from './madrasah';

export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 7, h: 11, d: 4 },
    wingH: 6,
    domes: [{ offset: -7, r: 3 }],
  });
  // faces +Z → south (default orientation), so no rotation
  g.position.set(0, 0, -12.5);
  return g;
}
