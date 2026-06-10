import * as THREE from 'three';
import { C } from '../palette';
import { LAYOUT } from '../world/layout';

// --- colour helpers ---
function hex(n: number): string { return '#' + n.toString(16).padStart(6, '0'); }

// Blend two hex colours by factor t (0=a, 1=b)
function blendHex(a: number, b: number, t: number): string {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (gg << 8) | bl).toString(16).padStart(6, '0');
}

// Darken a hex colour by factor (0=same, 1=black)
function darken(n: number, f: number): string { return blendHex(n, 0x000000, f); }

export function makeGround(): THREE.Mesh {
  const cols = LAYOUT[0].length, rows = LAYOUT.length;
  const tileSize = 48; // px per tile — higher res for crisp detail
  const W = cols * tileSize, H = rows * tileSize;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;

  // ── 1. Base fill: pale warm stone under everything ──────────────────────
  g.fillStyle = hex(C.plaza);
  g.fillRect(0, 0, W, H);

  // ── 2. Darken building-footprint regions (blocked tiles) ────────────────
  // Slightly cooler/darker so bright plaza doesn't bleed under buildings
  const blockedFill = darken(C.plazaPath, 0.18);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = (LAYOUT[r]?.[c]) ?? '#';
      if (ch === '#') {
        g.fillStyle = blockedFill;
        g.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }
  }

  // ── 3. Large panel grid (4x4 tile groups, ~192px panels) ────────────────
  // Seam colour: slightly darker than plaza, 2px wide
  const panelSize = 4 * tileSize; // 192px
  const seamColor = darken(C.plaza, 0.18);
  g.strokeStyle = seamColor;
  g.lineWidth = 2.5;
  for (let x = 0; x <= W; x += panelSize) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 0; y <= H; y += panelSize) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }

  // Fine tile lines within panels (slightly visible)
  g.strokeStyle = darken(C.plaza, 0.09);
  g.lineWidth = 0.8;
  for (let x = 0; x <= W; x += tileSize) {
    if (x % panelSize === 0) continue; // skip panel seams (already drawn thicker)
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 0; y <= H; y += tileSize) {
    if (y % panelSize === 0) continue;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }

  // ── 4. Walkway cross: lighter strips (vertical + horizontal) ─────────────
  // Vertical: cols 13-15 → px 624–768 (3 tiles wide = 144px)
  // Horizontal: rows 9-11 → px 432–576 (3 rows = 144px)
  const walkwayColor = hex(C.sandLight); // lighter warm stone
  const walkAlpha = 0.30; // subtle walkway highlight
  g.save();
  g.globalAlpha = walkAlpha;
  g.fillStyle = walkwayColor;
  // Vertical strip (south entrance → center)
  g.fillRect(13 * tileSize, 0, 3 * tileSize, H);
  // Horizontal strip (across the full plaza width)
  g.fillRect(0, 9 * tileSize, W, 3 * tileSize);
  g.restore();

  // ── 5. Medallions: faint floor art at 7 panel centers ────────────────────
  // Positions: [col, row] of tile at medallion center (deterministic)
  const medalPositions: [number, number][] = [
    [6, 7],   // left upper
    [6, 13],  // left lower
    [22, 7],  // right upper
    [22, 13], // right lower
    [14, 5],  // center top
    [10, 11], // center-left
    [18, 11], // center-right
  ];

  const medalAlpha = 0.26; // subtle but visible — floor art, not targets
  const medalColor = darken(C.plazaPath, 0.12);

  for (const [mc, mr] of medalPositions) {
    const cx = (mc + 0.5) * tileSize;
    const cy = (mr + 0.5) * tileSize;
    const radius = tileSize * 1.8; // ~86px radius
    drawMedallion(g, cx, cy, radius, medalColor, medalAlpha);
  }

  // ── 6. Build texture ──────────────────────────────────────────────────────
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cols, 1, rows),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.position.y = -0.5; // top surface at y=0
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/** Draw a faint concentric-circle + petal-tick medallion at (cx,cy). */
function drawMedallion(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string, alpha: number,
): void {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1.2;

  // 3 concentric circles
  for (const frac of [1.0, 0.65, 0.35]) {
    g.beginPath();
    g.arc(cx, cy, r * frac, 0, Math.PI * 2);
    g.stroke();
  }

  // Small filled center dot
  g.beginPath();
  g.arc(cx, cy, r * 0.07, 0, Math.PI * 2);
  g.fill();

  // 8 petal ticks radiating from inner ring to outer ring
  const nPetals = 8;
  for (let i = 0; i < nPetals; i++) {
    const angle = (i / nPetals) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Outer tick mark (short radial line at outer edge)
    g.beginPath();
    g.moveTo(cx + cos * r * 0.65, cy + sin * r * 0.65);
    g.lineTo(cx + cos * r * 0.90, cy + sin * r * 0.90);
    g.stroke();
    // Small arc segment at inner ring (petal suggestion)
    g.beginPath();
    g.arc(cx, cy, r * 0.35, angle - 0.22, angle + 0.22);
    g.stroke();
  }

  // 4 intermediate ticks (45° offset) — lighter
  g.globalAlpha = alpha * 0.6;
  for (let i = 0; i < 4; i++) {
    const angle = ((i + 0.5) / 4) * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    g.beginPath();
    g.moveTo(cx + cos * r * 0.35, cy + sin * r * 0.35);
    g.lineTo(cx + cos * r * 0.65, cy + sin * r * 0.65);
    g.stroke();
  }

  g.restore();
}
