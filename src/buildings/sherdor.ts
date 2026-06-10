import { madrasah } from './madrasah';
import { tigerDecal } from '../patterns/textures';

export function sherDor() {
  const g = madrasah({
    facadeLen: 18,
    portal: { w: 7, h: 12, d: 4 },
    wingH: 7,
    minarets: [{ offset: -10, h: 12 }, { offset: 10, h: 12 }],
    domes: [{ offset: -6, r: 2.2, ribbed: true }, { offset: 6, r: 2.2, ribbed: true }],
    decal: tigerDecal(),
  });
  g.rotation.y = -Math.PI / 2;  // faces -X → west
  g.position.set(13.0, 0, 0);
  return g;
}
