import * as THREE from 'three';
import { pishtaq, minaret, dome, shadowed, patternedBoxMulti, recessedHujraFace, DRUM_R_FACTOR } from './primitives';
import { C } from '../palette';
import { bannai, brickWall, type PortalVariant } from '../patterns/textures';

export interface MadrasahOpts {
  facadeLen: number;        // total width along its plaza edge
  portal: { w: number; h: number; d: number };
  wingH: number;
  minarets?: { offset: number; h: number }[];
  domes?: { offset: number; r: number; ribbed?: boolean; z?: number; yLift?: number; glaze?: number }[];
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

  // Helper: compute how many bays fit in a given length.
  // Larger bays = bigger, more legible arches. ~3.0 wu/bay, min 2.
  const bayCount = (len: number) => Math.max(2, Math.round(len / 3.0));

  // ── FRONT WING — two flanking segments (fix 1) ──────────────────
  // The pishtaq occupies the central portalW gap; no wing volume behind the portal.
  // Each segment: width = (facadeLen - portalW) / 2, height = wingH, depth = frontD.
  const portalW = o.portal.w;
  const segW = (o.facadeLen - portalW) / 2;
  const segXCenter = portalW / 2 + segW / 2;

  for (const sgn of [-1, 1] as const) {
    // Structural box — plain sand on pz (+Z plaza) and nz (-Z courtyard) since
    // those faces will be covered by recessedHujraFace overlays.
    // px/nx are the end-grain sides visible between the portal and minaret.
    const seg = patternedBoxMulti(segW, o.wingH, frontD, C.sand, {
      px: extTex,   // right end face (exposed to sides)
      nx: extTex,   // left end face (exposed to sides)
      // pz and nz left plain — both covered by recessedHujraFace
    });
    seg.position.x = sgn * segXCenter;
    seg.position.z = 0;
    raised.add(seg);

    // Plaza-facing recessed arcade (+Z face at z = +frontD/2)
    const frontArcade = recessedHujraFace(segW, o.wingH, bayCount(segW), {
      goldTrim, wingStyle: o.wingStyle,
    });
    // Screen front at local z=0; we want it at world z=frontD/2 relative to raised group.
    // Group origin at (sgn * segXCenter, 0, frontD/2), no rotation needed since +Z = plaza.
    frontArcade.position.set(sgn * segXCenter, 0, frontD / 2);
    raised.add(frontArcade);

    // Courtyard-facing recessed arcade (-Z face at z = -frontD/2)
    // Rotate 180° around Y so the screen's -Z becomes the facing direction, recessing into the wing (+Z).
    const courtArcade = recessedHujraFace(segW, o.wingH, bayCount(segW), {
      goldTrim: false, wingStyle: o.wingStyle,
    });
    courtArcade.rotation.y = Math.PI;
    courtArcade.position.set(sgn * segXCenter, 0, -frontD / 2);
    raised.add(courtArcade);
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
  const sideXCenter = o.facadeLen / 2 - wingT / 2;

  for (const sgn of [-1, 1] as const) {
    // Structural box — px/nx baked in here to avoid a separate overlapping face (z-fight).
    const sideWing = patternedBoxMulti(wingT, sideH, sideLen, C.sand, {
      pz: extTex,
      nz: extTex,
      px: extTex,   // outer/inner X faces textured directly — no separate overlay needed
      nx: extTex,
    });
    sideWing.position.x = sgn * sideXCenter;
    sideWing.position.z = sideZCenter;
    raised.add(sideWing);

    // Courtyard-facing recessed arcade on the inner X face (faces toward x=0)
    // sgn=+1 right wing: courtyard face is -X → place at x = sideXCenter - wingT/2 = facadeLen/2-wingT
    // sgn=-1 left wing: courtyard face is +X → place at x = -(facadeLen/2-wingT)
    const innerXEdge = sgn * (o.facadeLen / 2 - wingT); // inner face x position
    const sideCourtArcade = recessedHujraFace(sideLen, sideH, bayCount(sideLen), {
      goldTrim: false, wingStyle: o.wingStyle,
    });
    // For sgn=+1: inner face is at -X direction; screen should face -X (toward x=0)
    // recessedHujraFace screen faces +Z; rotate -90°Y → faces +X; then another 180° → faces -X for sgn=+1
    // Simpler: sgn=+1 inner face needs the screen to face -X, so rotate Y by +90°.
    // sgn=-1 inner face needs screen to face +X, rotate Y by -90°.
    sideCourtArcade.rotation.y = -sgn * Math.PI / 2;
    sideCourtArcade.position.set(innerXEdge, 0, sideZCenter);
    raised.add(sideCourtArcade);

    // Exterior (outer X) face texture is now baked directly into sideWing above (px/nx).
    // No separate overlay needed — avoids coplanar z-fighting.
  }

  // ── BACK WING ───────────────────────────────────────────────────
  // Width=facadeLen, height=sideH, depth=wingT.
  // +Z face (courtyard-facing): recessed arcade.
  // -Z face (exterior back): brick.
  const backWing = patternedBoxMulti(o.facadeLen, sideH, wingT, C.sand, {
    nz: extTex,
    px: extTex,
    nx: extTex,
    // pz courtyard face covered by recessedHujraFace
  });
  backWing.position.x = 0;
  backWing.position.z = backZCenter;
  raised.add(backWing);

  // Back wing courtyard face (+Z = toward courtyard)
  const backCourtArcade = recessedHujraFace(o.facadeLen, sideH, bayCount(o.facadeLen), {
    goldTrim: false, wingStyle: o.wingStyle,
  });
  // +Z face is at z = backZCenter + wingT/2
  backCourtArcade.position.set(0, 0, backZCenter + wingT / 2);
  raised.add(backCourtArcade);


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
  // Corner minarets overhang the plinth, so they're dropped to the plaza ground
  // (world y=0 → raised-space y=-plinthH) and given a square stone footing.
  // Without this they floated plinthH (0.6) above the plaza where off-plinth.
  for (const m of o.minarets ?? []) {
    const t = minaret(m.h);
    t.position.set(m.offset, -plinthH, 0);
    raised.add(t);

    // Square footing pedestal: from plaza ground up past the plinth top.
    const baseR = m.h * 0.095;            // = minaret base radius
    const padW  = baseR * 2.2;
    const padH  = plinthH + 0.35;
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(padW, padH, padW),
      plinthMat,
    );
    pad.position.set(m.offset, -plinthH + padH / 2, 0);
    pad.castShadow = true;
    pad.receiveShadow = true;
    raised.add(pad);
  }

  // ── DOMES ───────────────────────────────────────────────────────
  for (const d of o.domes ?? []) {
    const dd = dome(d.r, d.ribbed, d.glaze);
    const domeZ = d.z ?? -o.portal.d * 0.1;
    const yLift = d.yLift ?? 0;
    const domeY = o.wingH + yLift;
    dd.position.set(d.offset, domeY, domeZ);
    raised.add(dd);

    // When yLift > 0 the dome group sits above the wing roof. Carry it on a tall
    // transition drum that reaches all the way DOWN into the actual roof beneath
    // it (side/back wings are 0.87× wingH), not just to wingH — otherwise the
    // drum (and dome) float ~0.9 above the lower courtyard-wing roof.
    if (yLift > 0) {
      // drumR matches dome()'s own drum exactly: r * DRUM_R_FACTOR, bottom × 1.04
      const drumR = d.r * DRUM_R_FACTOR;
      const drumRBottom = drumR * 1.04; // = dome drum's bottom radius (seamless joint)
      const roofY  = o.wingH * 0.87;    // courtyard-wing roof height the drum stands on
      const top    = domeY + 0.05;      // overlap up into the dome's own drum base
      const bottom = roofY - 0.45;      // embed down into the wing roof (no gap/float)
      const supportH = top - bottom;
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(drumRBottom, drumRBottom * 1.05, supportH, 28),
        new THREE.MeshLambertMaterial({ color: 0xc8b89a }), // warm sandstone
      );
      support.position.set(d.offset, bottom + supportH / 2, domeZ);
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

    // Drop to the plaza ground (turrets overhang the plinth at the facade ends) and
    // give them a footing pad, mirroring the minaret fix — otherwise they float
    // plinthH above the plaza and hang off the plinth edge.
    tg.position.set(turret.offset, -plinthH, 0);
    raised.add(tg);

    const tpadH = plinthH + 0.35;
    const tpad = new THREE.Mesh(
      new THREE.BoxGeometry(turret.r * 2.2, tpadH, turret.r * 2.2),
      plinthMat,
    );
    tpad.position.set(turret.offset, -plinthH + tpadH / 2, 0);
    tpad.castShadow = true;
    tpad.receiveShadow = true;
    raised.add(tpad);
  }

  g.add(raised);
  return shadowed(g);
}
