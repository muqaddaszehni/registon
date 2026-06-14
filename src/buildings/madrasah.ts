import * as THREE from 'three';
import { pishtaq, minaret, dome, shadowed, patternedBoxMulti } from './primitives';
import { C } from '../palette';
import { bannai, arcadeFacade, brickWall, type PortalVariant } from '../patterns/textures';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];
  domes?: { offset: number; r: number; ribbed?: boolean; z?: number; yLift?: number }[];
  /**
   * Portal tympanum + texture variant.
   * 'ulughbeg'  → girih star constellation tympanum
   * 'sherdor'   → tiger + doe + human-faced sun tympanum
   * 'tilyakori' → gold rosette/arabesque tympanum
   */
  variant?: PortalVariant;
  /** Corner turrets at facade ends — patterned cylinder + small dome cap */
  turrets?: { offset: number; h: number; r: number }[];
  /** Wing texture identity: 'diagonal-lattice'(default/UB) | 'meander'(SD) | 'arch-floral'(TK) */
  wingStyle?: 'diagonal-lattice' | 'meander' | 'arch-floral';
  /** Total depth front-face to back-face (world units). Default 9.0 */
  totalDepth?: number;
  /** Thickness of side and back wings. Default 2.0 */
  wingThickness?: number;
  /** Gold trim on courtyard arcade bands (Tilya-Kori). Default false */
  goldTrim?: boolean;
}

export function madrasah(o: MadrasahOpts): THREE.Group {
  const g = new THREE.Group();

  // ── GEOMETRY CONSTANTS ──────────────────────────────────────────────
  const totalD = o.totalDepth    ?? 9.0;
  const wingT  = o.wingThickness ?? 2.0;
  const frontD = o.portal.d;           // front wing depth = portal depth (d=5, so frontD=5)
  // Side wings butt against back wing inner face (fix 4):
  // sideLen = totalD - frontD - wingT so side wings end exactly at back wing's courtyard face.
  const sideLen = totalD - frontD - wingT; // = 9 - 5 - 2 = 2
  const sideH   = o.wingH * 0.87;     // courtyard wings slightly shorter
  // Front wing back face at -frontD/2; side wings go from there to back wing inner face.
  // sideZCenter = -(frontD/2 + sideLen/2)
  const sideZCenter  = -(frontD / 2 + sideLen / 2);
  // backZCenter: back wing inner face at -(frontD/2 + sideLen), back wing center is further by wingT/2
  const backZCenter  = -(frontD / 2 + sideLen + wingT / 2);
  const goldTrim = o.goldTrim ?? false;

  // ── MARBLE PLINTH ────────────────────────────────────────────────
  const plinthH = 0.6;
  const plinthW = o.facadeLen + 1.0;
  const plinthD = totalD + 0.5;       // full footprint + slight overhang front/back
  // Front edge at +frontD/2; plinthD spans totalD+0.5
  // plinthCenterZ so front of plinth = +frontD/2 + 0.0 (flush):
  // plinth front at plinthCenterZ + plinthD/2 = frontD/2  → plinthCenterZ = frontD/2 - plinthD/2
  // = frontD/2 - (totalD+0.5)/2 = (frontD - totalD - 0.5) / 2
  const plinthCenterZ = (frontD - totalD - 0.5) / 2;
  const plinthMat = new THREE.MeshLambertMaterial({ color: C.marble });
  // Fix 9: sink plinth 0.05 so bottom face is inside ground (no coplanar shimmer).
  // Height increases by 0.05 to keep top flush; center y shifts to (plinthH+0.05)/2 - 0.05.
  const plinthActualH = plinthH + 0.05;
  const plinthGeo = new THREE.BoxGeometry(plinthW, plinthActualH, plinthD);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.set(0, plinthActualH / 2 - 0.05, plinthCenterZ);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // ── PORTAL STEPS ─────────────────────────────────────────────────
  const stepW = o.portal.w * 0.8;
  const stepDepth = 0.40;
  const stepH = plinthH / 3;
  for (let i = 0; i < 3; i++) {
    const sz = o.portal.d / 2 + (i + 0.5) * stepDepth;
    const sy = plinthH - (i + 0.5) * stepH;
    const sw = stepW * (1 - i * 0.04);
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

  // Exterior brick texture (per wingStyle)
  // 'meander' (SD): buff/sand field with cobalt outer diamond, turquoise inner accent —
  // warm 70/30 buff/blue economy matching ref photo (warm stone + sparse blue geometric tracery).
  // brickWall(bg, line, motif): line=inner, motif=outer → brickWall(sand, turquoise, cobalt)
  // gives sand bg, cobalt outer diamond, turquoise inner square.
  let extTex: THREE.Texture;
  if (o.wingStyle === 'meander') {
    extTex = brickWall(C.sand, C.turquoise, C.cobalt);
  } else if (o.wingStyle === 'arch-floral') {
    extTex = brickWall(C.sand, C.cream, C.gold);
  } else {
    extTex = brickWall(C.sand, C.cream, C.cobalt);
  }

  // ── FRONT WING — two flanking segments (fix 1) ──────────────────
  // The pishtaq occupies the central portalW gap; no wing volume behind the portal.
  // Each segment: width = (facadeLen - portalW) / 2, height = wingH, depth = frontD.
  const portalW = o.portal.w;
  const segW = (o.facadeLen - portalW) / 2;
  const segXCenter = portalW / 2 + segW / 2;
  // Each segment gets its own arcade facade scaled to segW.
  for (const sgn of [-1, 1] as const) {
    const segArcade   = arcadeFacade(segW, o.wingH, goldTrim);
    const segInterior = arcadeFacade(segW, o.wingH, false);
    const seg = patternedBoxMulti(segW, o.wingH, frontD, C.sand, {
      pz: segArcade,
      nz: segInterior,
      px: extTex,
      nx: extTex,
    });
    seg.position.x = sgn * segXCenter;
    seg.position.z = 0;
    raised.add(seg);
  }

  // ── PORTAL (pishtaq stands in the central gap — no wing body behind it) ────
  const portal = pishtaq(o.portal.w, o.portal.h, o.portal.d, {
    variant: o.variant,
    wingH: o.wingH,   // so pishtaq can close its sides down to the wing roof level
  });
  raised.add(portal);

  // ── SIDE WINGS ──────────────────────────────────────────────────
  // Each wing: width=wingT, height=sideH, depth=sideLen.
  // sideLen is already shortened (fix 4) so wings butt against back wing's inner face.
  // sideXCenter: outer edge at ±facadeLen/2, inner at ±(facadeLen/2 - wingT).
  // Center: ±(facadeLen/2 - wingT/2).
  const sideXCenter  = o.facadeLen / 2 - wingT / 2;
  const sideInterior = arcadeFacade(sideLen, sideH, false);

  for (const sgn of [-1, 1] as const) {
    // sgn=-1: left wing (−X outer), interior = +X face
    // sgn=+1: right wing (+X outer), interior = −X face
    const sideWing = patternedBoxMulti(wingT, sideH, sideLen, C.sand, {
      px: sgn < 0 ? sideInterior : extTex,
      nx: sgn > 0 ? sideInterior : extTex,
      pz: extTex,
      nz: extTex,
      // py omitted → plain sand roof
    });
    // patternedBoxMulti sets y internally; set only X and Z
    sideWing.position.x = sgn * sideXCenter;
    sideWing.position.z = sideZCenter;
    raised.add(sideWing);
  }

  // ── BACK WING ───────────────────────────────────────────────────
  // Width=facadeLen, height=sideH, depth=wingT.
  // +Z face (courtyard-facing): interior arcade.
  // -Z face (exterior back): brick.
  const backInterior = arcadeFacade(o.facadeLen, sideH, false);
  const backWing = patternedBoxMulti(o.facadeLen, sideH, wingT, C.sand, {
    pz: backInterior,
    nz: extTex,
    px: extTex,
    nx: extTex,
    // py omitted → plain sand roof
  });
  backWing.position.x = 0;
  backWing.position.z = backZCenter;
  raised.add(backWing);

  // ── COURTYARD FLOOR ─────────────────────────────────────────────
  // Fills the open courtyard between the four wings.
  // Width: facadeLen - 2*wingT (between inner faces of side wings).
  // Depth: sideLen (from front wing back face to back wing inner face — side wings now butt flush).
  const courtW = o.facadeLen - 2 * wingT;
  const courtDepth = sideLen;
  // Z center: midpoint between front wing back (-frontD/2) and back wing inner face (-(frontD/2+sideLen))
  const courtZCenter = -(frontD / 2 + sideLen / 2);
  const courtFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(courtW, courtDepth),
    new THREE.MeshLambertMaterial({
      color: 0xd4bc96, // warm sandy courtyard paving
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.set(0, 0.08, courtZCenter);
  raised.add(courtFloor);

  // ── MINARETS ────────────────────────────────────────────────────
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.x = m.offset;
    raised.add(t);
  }

  // ── DOMES ───────────────────────────────────────────────────────
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed);
    const domeZ = d.z ?? -o.portal.d * 0.1;
    const yLift = d.yLift ?? 0;
    const domeY = o.wingH + yLift;
    dd.position.set(d.offset, domeY, domeZ);
    raised.add(dd);

    // When yLift > 0 the dome group sits above the wing roof, leaving a gap.
    // Close it with a tall support drum that spans from the wing roof (y=0 here,
    // i.e. y=wingH in raised-group space) up to the dome group origin (y=yLift above that).
    // Radii match the dome's drum so the stack is seamless and continuous.
    if (yLift > 0) {
      const drumR = d.r * 0.72;
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR * 1.05, drumR * 1.12, yLift, 24),
        new THREE.MeshLambertMaterial({ color: 0xc8b89a }), // warm sandstone
      );
      // Bottom of support at wing roof (y=wingH), top at wing roof + yLift = domeY
      support.position.set(d.offset, o.wingH + yLift / 2, domeZ);
      support.castShadow = true;
      support.receiveShadow = true;
      raised.add(support);
    }
  }

  // ── CORNER TURRETS ───────────────────────────────────────────────
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
