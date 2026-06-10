import * as THREE from 'three';
import { pishtaq, arcadeWall, minaret, dome, shadowed } from './primitives';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];  // x-offsets from center
  domes?: { offset: number; r: number; ribbed?: boolean }[];
  decal?: THREE.Texture;    // applied above the portal arch
}

export function madrasah(o: MadrasahOpts): THREE.Group {
  const g = new THREE.Group();
  const wingLen = (o.facadeLen - o.portal.w) / 2;

  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d);
  g.add(portal);

  for (const side of [-1, 1]) {
    const wing = arcadeWall(wingLen, o.wingH, o.portal.d * 0.8);
    wing.position.x = side * (o.portal.w / 2 + wingLen / 2);
    g.add(wing);
  }
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.x = m.offset;
    // no z-offset: minarets sit centered on the facade depth, flanking the wings
    g.add(t);
  }
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed);
    dd.position.set(d.offset, o.wingH, -o.portal.d * 0.1);
    g.add(dd);
  }
  if (o.decal) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.portal.w * 0.42, o.portal.w * 0.21),
      new THREE.MeshLambertMaterial({ map: o.decal, transparent: true }));
    pl.position.set(0, o.portal.h * 0.8, o.portal.d / 2 + 0.04);
    g.add(pl);
  }
  return shadowed(g);
}
