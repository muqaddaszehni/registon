import * as THREE from 'three';
import { C } from '../palette';
import { girih, bannai, calligraphyBand, archPanel, tigerSpandrel } from '../patterns/textures';

export const mat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const matMap = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

export function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = h / 2;
  return m;
}

/** Box whose +Z face carries a pattern texture; other faces plain. */
export function patternedBox(w: number, h: number, d: number, color: number, face: THREE.Texture): THREE.Mesh {
  const plain = mat(color);
  const mats = [plain, plain, plain, plain, matMap(face), plain]; // +x,-x,+y,-y,+z,-z
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.y = h / 2;
  return m;
}

/**
 * Box with per-face texture map.
 * facesMap keys: 'px'|'nx'|'py'|'ny'|'pz'|'nz'
 * Any face not listed gets a plain color material.
 * Texture repeat is computed from world-size / patternWorldSize so pattern scale
 * stays consistent: one bannai diamond ≈ 1.2 world units.
 */
export function patternedBoxMulti(
  w: number, h: number, d: number,
  color: number,
  facesMap: Partial<Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', THREE.Texture>>,
): THREE.Mesh {
  const plain = mat(color);
  // Helper: clone texture with correct repeat for this face's world dimensions
  function faceTexRepeat(tex: THREE.Texture, worldW: number, worldH: number): THREE.Material {
    const t = tex.clone();
    t.needsUpdate = true;
    const PATTERN_WORLD = 10.0; // one bannai tile = 10 world units (4 diamonds/tile → ~2.5 wu/diamond — large geometry like refs)
    // Clamp to at least 0.5 repeats so shallow faces don't show stretched blobs
    t.repeat.set(Math.max(0.5, worldW / PATTERN_WORLD), Math.max(0.5, worldH / PATTERN_WORLD));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map: t });
  }
  const faceOrder: Array<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'> = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const faceDims: Record<string, [number, number]> = {
    px: [d, h], nx: [d, h], py: [w, d], ny: [w, d], pz: [w, h], nz: [w, h],
  };
  const mats = faceOrder.map(key => {
    const tex = facesMap[key];
    if (!tex) return plain;
    const [fw, fh] = faceDims[key];
    return faceTexRepeat(tex, fw, fh);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.y = h / 2;
  return m;
}

function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(); const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(-r, h - r);
  s.quadraticCurveTo(-r, h - r * 0.1, 0, h);       // slightly pointed Persian arch
  s.quadraticCurveTo(r, h - r * 0.1, r, h - r);
  s.lineTo(r, 0); s.closePath();
  return s;
}

export function archNiche(w: number, h: number, depth: number, color: number): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(archShape(w, h), { depth, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat(color));
  return m; // caller positions; extrudes toward +Z
}

/** Arch trim ring shape: outer arch outline minus inner arch (annular frame for extruding). */
function archTrimShape(w: number, h: number, trimW: number): THREE.Shape {
  const outer = archShape(w, h);
  // Inner cutout — slightly smaller arch
  const iw = w - trimW * 2;
  const ih = h - trimW * 1.2;
  const ir = iw / 2;
  const inner = new THREE.Path();
  inner.moveTo(-ir, 0);
  inner.lineTo(-ir, ih - ir);
  inner.quadraticCurveTo(-ir, ih - ir * 0.1, 0, ih);
  inner.quadraticCurveTo(ir, ih - ir * 0.1, ir, ih - ir);
  inner.lineTo(ir, 0);
  inner.closePath();
  outer.holes.push(inner);
  return outer;
}

/**
 * Monumental portal with anatomically-correct parts:
 *   - Two flanking PYLON boxes (bannai-patterned)
 *   - LINTEL box bridging top (girih front + calligraphy band)
 *   - IWAN: floor + back wall (girih dark) + two side walls + deep-shadow arch face
 *   - ARCH TRIM: cream/gold extruded annular ring following pointed arch edge
 *   - SPANDREL panels: 'tigers' → twin mirrored tigerSpandrel planes; else girih
 *   - CALLIGRAPHY BAND: proud plane at very top of lintel
 *
 * opts.decals = 'tigers' → Sher-Dor twin mirrored tiger spandrels
 */
export function pishtaq(
  w: number, h: number, d: number,
  opts: { decals?: 'tigers' } = {},
): THREE.Group {
  const g = new THREE.Group();

  // Proportions
  const pylonW    = w * 0.13;        // border frame width (≈12% each side)
  const iwanW     = w - pylonW * 2;  // clear arch opening width
  const iwanH     = h * 0.78;        // height of arch opening
  const iwanDepth = Math.min(d * 0.85, 4.5); // recess depth (inward, away from plaza)

  const frontZ = d / 2;              // portal front face z (local)
  const backZ  = frontZ - iwanDepth; // iwan back wall z (local)

  const bannaiTex = bannai(C.sand, C.cream, C.cobalt);

  // ── LEFT & RIGHT PYLONS ─────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const pylon = patternedBoxMulti(pylonW, h, d, C.sand, {
      pz: bannai(C.sand, C.cream, C.cobalt),
      nz: bannaiTex,
      px: bannaiTex,
      nx: bannaiTex,
    });
    pylon.position.x = sx * (iwanW / 2 + pylonW / 2);
    // patternedBoxMulti auto-sets y = h/2 internally
    g.add(pylon);
  }

  // ── LINTEL ──────────────────────────────────────────────────────
  const lintelH = h - iwanH;
  const lintel = patternedBoxMulti(iwanW, lintelH, d, C.sand, {
    pz: girih(C.sand, C.cobalt, C.turquoise, 2),
    nz: bannaiTex,
    px: bannaiTex,
    nx: bannaiTex,
  });
  lintel.position.set(0, iwanH + lintelH / 2, 0);
  g.add(lintel);

  // ── IWAN FLOOR ──────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, 0.12, iwanDepth),
    mat(C.sandDark),
  );
  floor.position.set(0, 0.06, frontZ - iwanDepth / 2);
  g.add(floor);

  // ── IWAN SIDE WALLS ─────────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, iwanH, iwanDepth),
      new THREE.MeshLambertMaterial({ color: 0x4a6898 }),  // shadowed blue
    );
    sw.position.set(sx * (iwanW / 2 - 0.07), iwanH / 2, frontZ - iwanDepth / 2);
    g.add(sw);
  }

  // ── IWAN BACK WALL ──────────────────────────────────────────────
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, iwanH, 0.14),
    new THREE.MeshLambertMaterial({
      map: (() => { const t = girih(C.lapis, C.cobalt, C.turquoise, 2); t.repeat.set(0.5, 0.5); return t; })(),
      color: 0x3a587e,
    }),
  );
  backWall.position.set(0, iwanH / 2, backZ + 0.07);
  g.add(backWall);

  // Small door on back wall
  const doorW = iwanW * 0.30, doorH = iwanH * 0.35;
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    mat(0x0f1f35),
  );
  door.position.set(0, doorH / 2 + 0.01, backZ + 0.22);
  g.add(door);

  // ── ARCH FACE (deep shadow at front of iwan) ────────────────────
  const archFace = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape(iwanW, iwanH), { depth: 0.22, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({
      color: 0x050e1e,
      emissive: new THREE.Color(0x000208),
      emissiveIntensity: 0.8,
    }),
  );
  archFace.position.set(-iwanW / 2, 0, frontZ - 0.22);
  g.add(archFace);

  // ── ARCH TRIM (cream/gold extruded annular ring) ─────────────────
  const trimW = Math.max(0.18, pylonW * 0.22);
  const trim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archTrimShape(iwanW, iwanH, trimW), { depth: 0.24, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({
      color: C.cream,
      emissive: new THREE.Color(C.gold),
      emissiveIntensity: 0.06,
    }),
  );
  trim.position.set(-iwanW / 2, 0, frontZ - 0.01);
  g.add(trim);

  // ── SPANDREL PANELS ─────────────────────────────────────────────
  // Zone above arch opening, flanking the pointed crown
  const spandrelBaseY = iwanH * 0.80;
  const spandrelH2    = (h - spandrelBaseY) * 0.70;
  const spandrelW2    = iwanW * 0.42;

  if (opts.decals === 'tigers') {
    const tex = tigerSpandrel();
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelW2, spandrelH2),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      if (sx === 1) panel.scale.x = -1;  // mirror right tiger
      panel.position.set(
        sx * (spandrelW2 / 2 + 0.04),
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.04,
      );
      g.add(panel);
    }
  } else {
    const spTex = girih(C.sand, C.cobalt, C.turquoise, 1);
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelW2, spandrelH2),
        new THREE.MeshLambertMaterial({ map: spTex }),
      );
      panel.position.set(
        sx * (spandrelW2 / 2 + 0.04),
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.03,
      );
      g.add(panel);
    }
  }

  // ── CALLIGRAPHY BAND ─────────────────────────────────────────────
  const bandH = h * 0.085;
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }),
  );
  band.position.set(0, h - bandH / 2 - h * 0.01, frontZ + 0.03);
  g.add(band);

  return g;
}

/** Bulbous turquoise dome on a patterned drum. */
export function dome(r: number, ribbed = false): THREE.Group {
  const g = new THREE.Group();
  const drumH = r * 1.1;
  // Drum uses calligraphyBand — refs show kufic/thuluth band on drums
  const drumTex = calligraphyBand(C.lapis, C.cream);
  drumTex.repeat.set(1, 1);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, drumH, 20),
    new THREE.MeshLambertMaterial({ map: drumTex }));
  drum.position.y = drumH / 2;
  g.add(drum);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = -0.5 + (i / 14) * (Math.PI / 2 + 0.5); // sweep below equator → onion bulge
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const cap = new THREE.Mesh(new THREE.LatheGeometry(pts, 24),
    new THREE.MeshLambertMaterial({ color: C.turquoise, emissive: new THREE.Color(C.turquoise), emissiveIntensity: 0.12 }));
  cap.position.y = drumH + r * 0.48;
  g.add(cap);
  if (ribbed) {
    for (let i = 0; i < 16; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06 * r, r * 1.7, 0.16 * r),
        new THREE.MeshLambertMaterial({ color: C.teal }));
      const a = (i / 16) * Math.PI * 2;
      rib.position.set(Math.cos(a) * r * 0.92, cap.position.y, Math.sin(a) * r * 0.92);
      rib.lookAt(0, cap.position.y, 0);
      rib.rotateX(0.35);
      g.add(rib);
    }
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 8, 8), mat(C.gold));
  finial.position.y = cap.position.y + r * 1.05;
  g.add(finial);
  return g;
}

/** Tapered minaret with bannai shaft, corbel cornice rings, gallery, and buff dome cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // ── SHAFT (tapered, bannai pattern) ──────────────────────────────
  const shaftTex = bannai(C.sand, C.cream, C.cobalt);
  shaftTex.repeat.set(1, Math.max(1, Math.round(h / 8)));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const rBase = h * 0.095;  // slightly fatter base (real ones are stout)
  const rTop  = h * 0.058;  // top of shaft just below cornice
  const shaftH = h * 0.88;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBase, shaftH, 16), shaftMat);
  shaft.position.y = shaftH / 2;
  g.add(shaft);

  // ── CORBEL CORNICE (3 stacking rings, widening outward) ──────────
  const corniceBase = shaftH;
  const ringData: [number, number, number][] = [
    // [yOffset from corniceBase, radius, ringHeight]
    [0.000, rTop * 1.10, h * 0.018],
    [0.024, rTop * 1.22, h * 0.022],
    [0.052, rTop * 1.38, h * 0.026],
  ];
  for (const [yOff, r, rh] of ringData) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.96, rh, 16),
      mat(C.cream),
    );
    ring.position.y = corniceBase + yOff * h + rh / 2;
    g.add(ring);
  }

  // ── GALLERY (short cylinder with arch-panel band) ─────────────────
  const [lastYOff, , lastRH] = ringData[2];
  const galleryBase = corniceBase + lastYOff * h + lastRH;
  const galleryR    = rTop * 1.32;
  const galleryH    = h * 0.065;
  const galleryTex  = archPanel(256, 128);
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(galleryR, galleryR, galleryH, 16),
    new THREE.MeshLambertMaterial({ map: galleryTex }),
  );
  gallery.position.y = galleryBase + galleryH / 2;
  g.add(gallery);

  // ── DOME CAP (buff/sand sphere — NOT turquoise, refs show buff caps) ─
  const capBase = galleryBase + galleryH;
  const capR    = galleryR * 0.80;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 12, 10), mat(C.sand));
  cap.position.y = capBase + capR * 0.85;
  g.add(cap);

  // ── FINIAL ────────────────────────────────────────────────────────
  const finial = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.22, 8, 8), mat(C.gold));
  finial.position.y = capBase + capR * 1.75;
  g.add(finial);

  return g;
}

/** Two-storey arcade wall: bannai side faces, arch-panel front, calligraphy top band. */
export function arcadeWall(len: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();

  // Wall slab: bannai on all exterior faces; arch panels placed proud on +Z front
  // buff field, cream lattice lines (subtle), cobalt diamond motifs (~30% area)
  const bannaiTex = bannai(C.sand, C.cream, C.cobalt);
  const bannaiInnerTex = bannai(C.sand, C.cream, C.sandDark); // muted field behind panels
  g.add(patternedBoxMulti(len, h, d, C.sand, {
    pz: bannaiInnerTex, // front wall behind panels — subtle so arch panels pop
    px: bannaiTex,
    nx: bannaiTex,
    nz: bannaiTex,  // outside back
  }));

  // Front face: two rows of framed arch panels (flat planes proud of wall)
  const n = Math.max(2, Math.floor(len / 2.6));
  const panelW = (len * 0.9) / n;
  const panelH = h * 0.42;
  const panelSpacingX = len / n;

  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < n; i++) {
      const px2 = -len / 2 + panelSpacingX * (i + 0.5);
      const py2 = s === 0 ? panelH * 0.55 : panelH * 0.55 + h * 0.46;
      // archPanel is non-tiling; generate per-panel (shared per storey to save draw calls)
      const panelTex = archPanel(Math.round(panelW * 100), Math.round(panelH * 100));
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW * 0.92, panelH * 0.9),
        new THREE.MeshLambertMaterial({ map: panelTex }),
      );
      panel.position.set(px2, py2, d / 2 + 0.02);
      g.add(panel);
    }
  }

  // Top calligraphy band
  const bandH = h * 0.10;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.96, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }));
  strip.position.set(0, h - bandH / 2 - h * 0.02, d / 2 + 0.02);
  g.add(strip);

  return g;
}
