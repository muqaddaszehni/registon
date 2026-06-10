import * as THREE from 'three';
import { C } from '../palette';
import { girih, band, kufic } from '../patterns/textures';

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

/** Monumental portal: patterned frame + recessed dark arch, kufic strip across the top. */
export function pishtaq(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(patternedBox(w, h, d, C.sand, girih(C.cobalt, C.turquoise, C.cream)));
  const niche = archNiche(w * 0.52, h * 0.72, d * 0.4, C.lapis);
  niche.position.set(0, 0, d / 2 - d * 0.4 + 0.02);
  g.add(niche);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.1),
    new THREE.MeshLambertMaterial({ map: kufic(C.cream, C.lapis) }));
  strip.position.set(0, h * 0.92, d / 2 + 0.02);
  g.add(strip);
  return g;
}

/** Bulbous turquoise dome on a patterned drum. */
export function dome(r: number, ribbed = false): THREE.Group {
  const g = new THREE.Group();
  const drumH = r * 1.1;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, drumH, 20),
    new THREE.MeshLambertMaterial({ map: band(C.cobalt, C.cream) }));
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

/** Tapered minaret with patterned shaft, cornice and cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshLambertMaterial({ map: band(C.sand, C.cobalt) });
  shaftMat.map!.repeat.set(2, 6);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.055, h * 0.085, h, 14), shaftMat);
  shaft.position.y = h / 2;
  g.add(shaft);
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.085, h * 0.06, h * 0.05, 14), mat(C.cream));
  cornice.position.y = h * 0.97;
  g.add(cornice);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.06, 12, 10), mat(C.turquoise));
  cap.position.y = h * 1.03;
  g.add(cap);
  return g;
}

/** Two-storey arcade wall with dark arch niches and a band strip. */
export function arcadeWall(len: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(len, h, d, C.sand));
  const n = Math.floor(len / 2.4);
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < n; i++) {
      const niche = archNiche(1.1, 1.8, 0.3, C.sandDark);
      niche.position.set(-len / 2 + 1.6 + i * 2.4, 0.5 + s * h * 0.48, d / 2 - 0.28);
      g.add(niche);
    }
  }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.96, 0.5),
    new THREE.MeshLambertMaterial({ map: band(C.lapis, C.turquoise) }));
  strip.position.set(0, h * 0.93, d / 2 + 0.02);
  g.add(strip);
  return g;
}
