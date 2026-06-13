import { madrasah } from './madrasah';

export function sherDor() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 8, h: 15, d: 5 },
    wingH: 7,
    minarets: [{ offset: -10.8, h: 17 }, { offset: 10.8, h: 17 }],
    domes: [
      { offset: -6.6, r: 2.2, ribbed: true, z: -4.5, yLift: 1.5 },
      { offset:  6.6, r: 2.2, ribbed: true, z: -4.5, yLift: 1.5 },
    ],
    variant: 'sherdor',
    wingStyle: 'meander', // SD: cobalt/cream swastika-meander dominant
  });
  g.rotation.y = -Math.PI / 2;  // faces -X → west
  g.position.set(13.0, 0, 0);   // front face at x = +10.5 (clear of walkable col 24 ≈ +9)
  return g;
}
