import * as THREE from 'three';
import { pishtaq, arcadeWall, minaret, dome, shadowed } from './primitives';
import { C } from '../palette';
import { bannai } from '../patterns/textures';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];
  domes?: { offset: number; r: number; ribbed?: boolean }[];
  /** Pass 'tigers' to render twin mirrored Sher-Dor tiger spandrel panels */
  decals?: 'tigers';
  /** Corner turrets at facade ends — patterned cylinder + small dome cap */
  turrets?: { offset: number; h: number; r: number }[];
  /** Wing texture identity: 'diagonal-lattice'(default/UB) | 'meander'(SD) | 'arch-floral'(TK) */
  wingStyle?: 'diagonal-lattice' | 'meander' | 'arch-floral';
}

export function madrasah(o: MadrasahOpts): THREE.Group {
  const g = new THREE.Group();
  const wingLen = (o.facadeLen - o.portal.w) / 2;

  // ── MARBLE PLINTH ────────────────────────────────────────────────
  // Sits from y=0 to y=0.6; flush with front face (no plaza protrusion to avoid
  // collision issues), extends full facade width + slight side/back overhang.
  const plinthH = 0.6;
  const plinthW = o.facadeLen + 1.0;    // 0.5 overhang each side
  const plinthD = o.portal.d + 0.5;     // flush front (portal front at +d/2), extends back 0.5
  // Center plinth so its FRONT face is at +plinthD/2 - 0.0 = portal front = +portal.d/2.
  // Portal front is at local z = +portal.d/2. Plinth front must match → plinth center z = +(plinthD/2 - portal.d/2) ... wait:
  // Plinth spans z from -(portal.d/2 + 0.5) to +(portal.d/2). Center = portal.d/2 - (0.5+portal.d)/2.
  // Simpler: front flush at z = +portal.d/2; back at z = -(portal.d/2 + 0.5).
  // center z = (portal.d/2 + (-(portal.d/2+0.5))) / 2 = -0.25
  const plinthCenterZ = -(0.25); // 0.25 behind portal front center
  const plinthMat = new THREE.MeshLambertMaterial({ color: C.marble });
  const plinthGeo = new THREE.BoxGeometry(plinthW, plinthH, plinthD);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.set(0, plinthH / 2, plinthCenterZ);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // ── PORTAL STEPS ─────────────────────────────────────────────────
  // 3 shallow steps descending from plinth top to plaza, centered on portal.
  // Step widths taper; each step protrudes forward 0.25 units into plaza.
  // Maximum protrusion: 3 × 0.25 = 0.75 units in front of portal front face.
  // Portal front = +portal.d/2 local z; steps protrude to z = +portal.d/2 + 0.75.
  // This is safe: col 3 (UB) and col 24 (SD) are blocked '#' tiles.
  // TK steps at z = -10.0 + 0.75 = -9.25, well clear of row 3 center at z=-7.5.
  // Steps: 3 broad marble steps descending from plinth face to plaza.
  // Each step is 0.40 deep (reads clearly in iso), heights 0.20/0.20/0.20 = 0.60 total = plinth height.
  // Maximum protrusion: 3 × 0.40 = 1.20 units ahead of portal front face.
  // Safe: col 3 (UB/west wall x=-11.0) → steps reach x=-9.8, but col 3 center is at x=-10.5
  //   and col 3 is '#' (blocked), so no collision with walkable tile.
  // TK: steps reach world z = -10.0 + 1.20 = -8.80; row 3 center at z=-7.5 → 1.3 units clear.
  const stepW = o.portal.w * 0.8;   // 80% portal width → broad, visible
  const stepDepth = 0.40;
  const stepH = plinthH / 3;        // 0.20 each, stacks to full plinth height
  for (let i = 0; i < 3; i++) {
    // Step i: center is at portal front + (i+0.5) * stepDepth
    const sz = o.portal.d / 2 + (i + 0.5) * stepDepth;
    const sy = plinthH - (i + 0.5) * stepH; // y center: top step at plinthH-stepH/2, bottom at stepH/2
    const sw = stepW * (1 - i * 0.04);   // slightly taper each step outward
    const stepMesh = new THREE.Mesh(
      new THREE.BoxGeometry(sw, stepH, stepDepth),
      plinthMat,
    );
    stepMesh.position.set(0, sy, sz);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    g.add(stepMesh);
  }

  // ── MAIN BUILDING PARTS (raised by plinth height) ────────────────
  const raised = new THREE.Group();
  raised.position.y = plinthH;

  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d, {
    decals: o.decals,
  });
  raised.add(portal);

  for (const side of [-1, 1]) {
    const wing = arcadeWall(wingLen, o.wingH, o.portal.d * 0.8, o.wingStyle);
    wing.position.x = side * (o.portal.w / 2 + wingLen / 2);
    raised.add(wing);
  }
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.x = m.offset;
    raised.add(t);
  }
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed);
    dd.position.set(d.offset, o.wingH, -o.portal.d * 0.1);
    raised.add(dd);
  }

  // ── CORNER TURRETS ───────────────────────────────────────────────
  // Small patterned cylinders with turquoise dome caps at facade ends.
  for (const turret of o.turrets ?? []) {
    const tg = new THREE.Group();
    // Shaft: patterned cylinder
    const shaftTex = bannai(C.sand, C.cream, C.cobalt);
    shaftTex.repeat.set(2, Math.max(1, Math.round(turret.h / 4)));
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(turret.r, turret.r * 1.08, turret.h, 16),
      new THREE.MeshLambertMaterial({ map: shaftTex }),
    );
    shaft.position.y = turret.h / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    tg.add(shaft);

    // Small turquoise dome cap on top
    const capR = turret.r * 0.9;
    // Lathe dome profile — simple onion
    const capPts: THREE.Vector2[] = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(capR * 0.9, capR * 0.3),
      new THREE.Vector2(capR * 1.05, capR * 0.7),
      new THREE.Vector2(capR * 0.82, capR * 1.3),
      new THREE.Vector2(capR * 0.38, capR * 1.85),
      new THREE.Vector2(0, capR * 2.1),
    ];
    const cap = new THREE.Mesh(
      new THREE.LatheGeometry(capPts, 16),
      new THREE.MeshLambertMaterial({
        color: C.turquoise,
        emissive: new THREE.Color(C.turquoise),
        emissiveIntensity: 0.14,
      }),
    );
    cap.position.y = turret.h;
    cap.castShadow = true;
    tg.add(cap);

    // Gold finial
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(turret.r * 0.18, 6, 6),
      new THREE.MeshLambertMaterial({ color: C.gold }),
    );
    finial.position.y = turret.h + capR * 2.15;
    tg.add(finial);

    tg.position.x = turret.offset;
    raised.add(tg);
  }

  g.add(raised);
  return shadowed(g);
}
