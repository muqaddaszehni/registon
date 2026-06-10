import { madrasah } from './madrasah';

export function ulughBeg() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 7, h: 12, d: 4 },
    wingH: 7,
    minarets: [{ offset: -10, h: 16 }, { offset: 10, h: 16 }],
  });
  g.rotation.y = Math.PI / 2;   // front faces +X→ east
  g.position.set(-12, 0, 0);    // west edge of plaza, centered on z-axis
  return g;
}
