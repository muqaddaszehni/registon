import { madrasah } from './madrasah';

export function ulughBeg() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 8, h: 15, d: 5 },
    wingH: 7,
    variant: 'ulughbeg',
    minarets: [{ offset: -10.8, h: 17 }, { offset: 10.8, h: 17 }],
    wingStyle: 'diagonal-lattice', // UB: star-accent diagonal lattice (default)
  });
  g.rotation.y = Math.PI / 2;   // front faces +X → east
  g.position.set(-13.5, 0, 0);  // front face at x = -11.0 (clear of walkable col 3 ≈ -9)
  return g;
}
