import { madrasah } from './madrasah';
import { C } from '../palette';

export function tilyaKori() {
  const g = madrasah({
    facadeLen: 26,
    portal: { w: 8, h: 13, d: 5 },
    wingH: 6,
    variant: 'tilyakori',
    goldTrim: true,
    // Grand ribbed (melon-fluted) dome — all Registan domes are fluted turquoise.
    domes: [{ offset: -9, r: 3.8, ribbed: true, glaze: C.domeGlazeTK }],
    // Small corner turrets at facade ends (tilyakori-facade.jpg: round towers with small domes)
    turrets: [
      { offset: -14.1, h: 7, r: 0.9 },
      { offset:  14.1, h: 7, r: 0.9 },
    ],
    wingStyle: 'arch-floral', // TK: gold-accent floral (warm, floral-ish identity)
  });
  // faces +Z → south (default orientation), no rotation
  g.position.set(0, 0, -12.5);  // front face at z = -10.0 (clear of walkable row 3 ≈ -7)
  return g;
}
