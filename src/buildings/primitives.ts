import * as THREE from 'three';
import { C } from '../palette';
import { girih, bannai, meander, calligraphyBand, archPanel } from '../patterns/textures';

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
    const PATTERN_WORLD = 5.0; // one bannai tile = 5 world units (4 diamonds/tile → ~1.25 wu/diamond)
    t.repeat.set(worldW / PATTERN_WORLD, worldH / PATTERN_WORLD);
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

/** Monumental portal: patterned frame + recessed dark arch, calligraphy band + bannai flanks. */
export function pishtaq(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();

  // Main portal slab — front face: girih (spandrel zone); sides: bannai
  const bannaiTex = bannai(C.sand, C.cobalt, C.turquoise);
  // Portal front: girih with 2 cells (bigger stars) — patternedBoxMulti sets repeat via PATTERN_WORLD
  g.add(patternedBoxMulti(w, h, d, C.sand, {
    pz: girih(C.sand, C.cobalt, C.turquoise, 2),  // 2-cell canvas → bigger stars
    px: bannaiTex,
    nx: bannaiTex,
    nz: bannai(C.sandDark, C.sand, C.lapis),
  }));

  // Recessed arch niche
  const niche = archNiche(w * 0.52, h * 0.72, d * 0.4, C.lapis);
  niche.position.set(0, 0, d / 2 - d * 0.4 + 0.02);
  g.add(niche);

  // Meander panels flanking the arch (left and right, proud of wall face)
  const flankW = (w - w * 0.52) / 2 * 0.88;
  const flankH = h * 0.68;
  const meanderTex = meander(C.cobalt, C.cream);
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(flankW, flankH),
      new THREE.MeshLambertMaterial({ map: meanderTex }),
    );
    panel.position.set(sx * (w * 0.52 / 2 + flankW / 2 + 0.01), flankH / 2 + h * 0.02, d / 2 + 0.02);
    g.add(panel);
  }

  // Calligraphy band across the top (replaces kufic strip)
  const bandH = h * 0.11;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }));
  strip.position.set(0, h - bandH / 2 - h * 0.02, d / 2 + 0.02);
  g.add(strip);

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

/** Tapered minaret with diagonal-lattice shaft (bannai colorway) and calligraphy drum. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // Shaft: bannai pattern in sand/cobalt — diagonal lattice ref
  // CylinderGeometry circumference ≈ 2π*r ≈ 0.5wu; height = h
  // With PATTERN_WORLD=5 → repeat ~1 across circumference, ~h/5 vertically
  const shaftTex = bannai(C.sand, C.cobalt, C.turquoise);
  shaftTex.repeat.set(1, Math.round(h / 3.5));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.055, h * 0.085, h, 14), shaftMat);
  shaft.position.y = h / 2;
  g.add(shaft);

  // Cornice
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.085, h * 0.06, h * 0.05, 14), mat(C.cream));
  cornice.position.y = h * 0.97;
  g.add(cornice);

  // Cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.06, 12, 10), mat(C.turquoise));
  cap.position.y = h * 1.03;
  g.add(cap);
  return g;
}

/** Two-storey arcade wall: bannai side faces, arch-panel front, calligraphy top band. */
export function arcadeWall(len: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();

  // Wall slab: bannai on all exterior faces; arch panels placed proud on +Z front
  const bannaiTex = bannai(C.sand, C.cobalt, C.turquoise);
  const bannaiBackTex = bannai(C.sand, C.cobalt, C.turquoise); // same vivid on outside
  const bannaiInnerTex = bannai(C.sandLight, C.sandDark, C.sand); // very muted behind panels
  g.add(patternedBoxMulti(len, h, d, C.sand, {
    pz: bannaiInnerTex, // front wall behind panels — muted so blue panels pop
    px: bannaiTex,
    nx: bannaiTex,
    nz: bannaiBackTex,  // outside back — full contrast like sherdor-side-wall.jpg
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
