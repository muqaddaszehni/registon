import * as THREE from 'three';

const px = (n: number) => '#' + n.toString(16).padStart(6, '0');

function canvas(w: number, h: number, bg: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = px(bg); g.fillRect(0, 0, w, h);
  return [cv, g];
}

function toTexture(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/**
 * Banna'i (bannai) diagonal brick lattice — the workhorse pattern.
 * 1024² tileable canvas: diagonal grid of cream lines forming diamonds,
 * with a small square-meander cross motif inside each diamond.
 * bg = field colour, line = outline colour, motif = inner accent colour.
 */
export function bannai(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const S = 1024;
  const [cv, g] = canvas(S, S, bg);

  // Diamond cell size: one full diamond spans cellSize along each diagonal axis
  // 256px → 4 diamonds per tile; combined with PATTERN_WORLD=5 → ~6 diamonds across a 7-unit face
  const cellSize = 256;
  const lineW = 15;     // px stroke width (~6% of cell)

  // Draw diagonal grid lines: two families of lines at +45° and -45°
  g.strokeStyle = px(line);
  g.lineWidth = lineW;
  g.lineCap = 'square';

  // We draw lines from outside the canvas to ensure coverage at edges
  const diag = Math.sqrt(2) * S;
  const step = cellSize;
  const count = Math.ceil(diag / step) + 4;

  // Family 1: top-left to bottom-right (+45°) — offset along perpendicular
  for (let i = -count; i < count * 2; i++) {
    const offset = i * step;
    g.beginPath();
    g.moveTo(offset - S, -S);
    g.lineTo(offset + S * 2, S * 2);
    g.stroke();
  }
  // Family 2: top-right to bottom-left (−45°)
  for (let i = -count; i < count * 2; i++) {
    const offset = i * step;
    g.beginPath();
    g.moveTo(offset + S, -S);
    g.lineTo(offset - S, S * 2);
    g.stroke();
  }

  // Now draw a small square-meander cross motif at each diamond centre
  // Diamond centres are at half-cell offsets on both diagonals
  const halfCell = cellSize / 2;
  // Motif size: about 35% of cell width
  const ms = Math.round(cellSize * 0.28);

  g.fillStyle = px(motif);

  for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
    for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
      // Diamond centre in rotated grid: transform back to screen coords
      const cx = (ix + iy) * halfCell;
      const cy = (iy - ix) * halfCell;
      if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

      // Small square-meander cross: a plus (+) shape made of 3 rects
      // Centre square
      g.fillRect(cx - ms / 2, cy - ms / 2, ms, ms);
      // Four arms (short)
      const armW = Math.round(ms * 0.35);
      const armL = Math.round(ms * 0.55);
      // top arm
      g.fillRect(cx - armW / 2, cy - ms / 2 - armL, armW, armL);
      // bottom arm
      g.fillRect(cx - armW / 2, cy + ms / 2, armW, armL);
      // left arm
      g.fillRect(cx - ms / 2 - armL, cy - armW / 2, armL, armW);
      // right arm
      g.fillRect(cx + ms / 2, cy - armW / 2, armL, armW);

      // Small corner accents (rotated squares)
      const dotR = Math.round(ms * 0.14);
      const dotOff = Math.round(ms * 0.55);
      for (const [dx, dy] of [[-dotOff, -dotOff], [dotOff, -dotOff], [-dotOff, dotOff], [dotOff, dotOff]]) {
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate(Math.PI / 4);
        g.fillRect(-dotR, -dotR, dotR * 2, dotR * 2);
        g.restore();
      }
    }
  }

  return toTexture(cv);
}

/**
 * Square swastika-meander interlock (hazarbaf) — portal flank panels.
 * 512² tileable. bg = field, fg = pattern lines.
 */
export function meander(bg: number, fg: number): THREE.CanvasTexture {
  const S = 512;
  const [cv, g] = canvas(S, S, bg);

  // Cell size: 128px → 4 repeats across tile
  const cs = 128;
  const lw = 14; // line width

  g.fillStyle = px(fg);

  // Draw swastika-meander: a right-angle hook pattern that interlocks
  // Each cell draws one swastika arm; the full tile makes the interlock
  for (let row = 0; row < S / cs + 1; row++) {
    for (let col = 0; col < S / cs + 1; col++) {
      const ox = col * cs;
      const oy = row * cs;

      // Outer border of cell
      const inset = 10;
      // Stroke border
      g.strokeStyle = px(fg);
      g.lineWidth = lw;
      g.strokeRect(ox + inset, oy + inset, cs - inset * 2, cs - inset * 2);

      // Inner meander cross (swastika-ish)
      const mid = cs / 2;
      const aw = lw;

      // Horizontal bar
      g.fillRect(ox + inset + lw, oy + oy - oy + mid - aw / 2, cs - inset * 2 - lw * 2, aw);
      // Vertical bar
      g.fillRect(ox + mid - aw / 2, oy + inset + lw, aw, cs - inset * 2 - lw * 2);

      // Four corner L-bends (makes the meander/swastika interlocking effect)
      g.fillStyle = px(bg);
      // Erase quarters to create the swastika rotation
      if ((row + col) % 2 === 0) {
        // top-right quadrant: erase bottom-left of that quadrant
        g.fillRect(ox + mid + aw / 2, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
        // bottom-left quadrant: erase top-right of that quadrant
        g.fillRect(ox + inset + lw, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
      } else {
        // top-left quadrant: erase bottom-right
        g.fillRect(ox + inset + lw, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
        // bottom-right quadrant: erase top-left
        g.fillRect(ox + mid + aw / 2, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
      }
      g.fillStyle = px(fg);
    }
  }

  return toTexture(cv);
}

/**
 * Stylized thuluth-like calligraphy band.
 * 1024×256. NOT real letters — flowing vertical strokes with varied heights and dots.
 * White on cobalt, reads as calligraphy at distance.
 */
export function calligraphyBand(bg: number, fg: number): THREE.CanvasTexture {
  const W = 1024, H = 256;
  const [cv, g] = canvas(W, H, bg);

  // Top and bottom border stripes
  g.fillStyle = px(fg);
  g.fillRect(0, 0, W, 18);
  g.fillRect(0, H - 18, W, 18);

  // Inner border lines
  g.strokeStyle = px(fg);
  g.lineWidth = 4;
  g.strokeRect(6, 6, W - 12, H - 12);

  // Generate pseudo-calligraphic strokes
  // Pattern of tall/short vertical strokes with horizontal connectors and dots
  const glyphData = [
    // [x, strokeH, hasTopCross, hasDot, crossW]
    [50,  160, true,  false, 80],
    [80,  100, false, true,  0],
    [115, 170, true,  false, 70],
    [155, 120, false, false, 50],
    [185, 150, true,  true,  60],
    [230, 90,  false, false, 0],
    [265, 160, true,  false, 90],
    [305, 130, false, true,  0],
    [335, 110, false, false, 50],
    [370, 165, true,  false, 75],
    [420, 80,  false, true,  0],
    [455, 155, true,  false, 85],
    [490, 125, false, false, 60],
    [525, 145, true,  true,  70],
    [570, 90,  false, false, 0],
    [605, 165, true,  false, 95],
    [645, 120, false, true,  0],
    [675, 105, false, false, 50],
    [710, 160, true,  false, 80],
    [760, 85,  false, true,  0],
    [795, 155, true,  false, 75],
    [830, 130, false, false, 60],
    [860, 145, true,  true,  70],
    [905, 90,  false, false, 0],
    [940, 160, true,  false, 90],
    [975, 110, false, true,  0],
  ] as [number, number, boolean, boolean, number][];

  const baseY = H - 28; // bottom of strokes

  for (const [x, strokeH, hasTopCross, hasDot, crossW] of glyphData) {
    const sw = 12; // stroke width
    const topY = baseY - strokeH;

    // Main vertical stroke (slightly tapered — wider at bottom)
    g.fillStyle = px(fg);
    g.beginPath();
    g.moveTo(x - sw / 2 - 2, baseY);
    g.lineTo(x - sw / 2, topY);
    g.lineTo(x + sw / 2, topY);
    g.lineTo(x + sw / 2 + 2, baseY);
    g.closePath();
    g.fill();

    // Horizontal cross at top (like alif with crossbar)
    if (hasTopCross && crossW > 0) {
      const crossH = 10;
      g.fillRect(x - crossW / 2, topY - crossH, crossW, crossH);
      // Small serifs on ends
      g.fillRect(x - crossW / 2 - 4, topY - crossH - 4, 8, crossH + 4);
      g.fillRect(x + crossW / 2 - 4, topY - crossH - 4, 8, crossH + 4);
    }

    // Dot accent below baseline or above stroke
    if (hasDot) {
      const dotR = 7;
      g.beginPath();
      g.arc(x, topY - 22, dotR, 0, Math.PI * 2);
      g.fill();
    }

    // Curved baseline connector to next visible stroke (subtle horizontal link)
    g.strokeStyle = px(fg);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x + sw / 2, baseY - 8);
    g.quadraticCurveTo(x + 20, baseY + 4, x + 34, baseY - 12);
    g.stroke();
  }

  return toTexture(cv, 2, 1);
}

/**
 * Non-tiling framed panel texture: buff field, kufic-meander border frame,
 * pointed-arch outline inside filled with bannai-style diagonal lattice.
 * Used on wing fronts.
 */
export function archPanel(w: number, h: number): THREE.CanvasTexture {
  const W = w, H = h;
  const [cv, g] = canvas(W, H, C_SAND);

  const frameW = Math.round(W * 0.07);

  // --- Outer kufic-meander border frame ---
  g.fillStyle = px(C_COBALT);
  g.fillRect(0, 0, W, frameW);
  g.fillRect(0, H - frameW, W, frameW);
  g.fillRect(0, 0, frameW, H);
  g.fillRect(W - frameW, 0, frameW, H);

  // Inner border accent (cream line)
  const ib = frameW + 4;
  g.strokeStyle = px(C_CREAM);
  g.lineWidth = 4;
  g.strokeRect(ib, ib, W - ib * 2, H - ib * 2);

  // Draw small kufic step-pattern along the frame strips
  g.fillStyle = px(C_CREAM);
  const stepSize = frameW - 4;
  const stepsX = Math.floor(W / (stepSize * 1.5));
  const stepsY = Math.floor(H / (stepSize * 1.5));
  for (let i = 0; i < stepsX; i++) {
    const x = i * (W / stepsX) + (W / stepsX) / 2;
    const sq = stepSize * 0.5;
    // top frame steps
    g.fillRect(x - sq / 2, frameW * 0.25, sq, sq);
    // bottom frame steps
    g.fillRect(x - sq / 2, H - frameW * 0.25 - sq, sq, sq);
  }
  for (let i = 0; i < stepsY; i++) {
    const y = i * (H / stepsY) + (H / stepsY) / 2;
    const sq = stepSize * 0.5;
    g.fillRect(frameW * 0.25, y - sq / 2, sq, sq);
    g.fillRect(W - frameW * 0.25 - sq, y - sq / 2, sq, sq);
  }

  // --- Inner field: bannai lattice ---
  const padding = frameW + 8;
  const innerX = padding, innerY = padding;
  const innerW = W - padding * 2, innerH = H - padding * 2;

  // Draw diagonal lattice inside the panel (scaled to inner region)
  const cellSize = Math.round(innerW * 0.22);
  const lineW = Math.max(3, Math.round(cellSize * 0.07));
  const halfCell = cellSize / 2;

  // Clip to inner region
  g.save();
  g.beginPath();
  g.rect(innerX, innerY, innerW, innerH);
  g.clip();

  // Fill with cobalt — blue field with cream lattice (matches ulughbeg-portal ref)
  g.fillStyle = px(C_COBALT);
  g.fillRect(innerX, innerY, innerW, innerH);

  // Diagonal grid lines in cream
  g.strokeStyle = px(C_CREAM);
  g.lineWidth = lineW;
  g.lineCap = 'square';
  const diag = Math.sqrt(2) * Math.max(innerW, innerH);
  const count2 = Math.ceil(diag / cellSize) + 4;
  for (let i = -count2; i < count2 * 2; i++) {
    const off = i * cellSize;
    g.beginPath();
    g.moveTo(innerX + off - innerH, innerY - innerH);
    g.lineTo(innerX + off + innerH * 2, innerY + innerH * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(innerX + innerW + off - innerH, innerY - innerH);
    g.lineTo(innerX + off - innerH, innerY + innerH * 2);
    g.stroke();
  }

  // Cross motifs at diamond centres (sand/gold on cobalt field)
  g.fillStyle = px(C_GOLD);
  const ms = Math.round(cellSize * 0.28);
  for (let iy = -2; iy < Math.ceil(innerH / halfCell) + 4; iy++) {
    for (let ix = -2; ix < Math.ceil(innerW / halfCell) + 4; ix++) {
      const cx = innerX + (ix + iy) * halfCell;
      const cy = innerY + (iy - ix) * halfCell;
      if (cx < innerX - cellSize || cx > innerX + innerW + cellSize) continue;
      if (cy < innerY - cellSize || cy > innerY + innerH + cellSize) continue;
      const armW2 = Math.round(ms * 0.35);
      const armL2 = Math.round(ms * 0.5);
      g.fillRect(cx - ms / 2, cy - ms / 2, ms, ms);
      g.fillRect(cx - armW2 / 2, cy - ms / 2 - armL2, armW2, armL2);
      g.fillRect(cx - armW2 / 2, cy + ms / 2, armW2, armL2);
      g.fillRect(cx - ms / 2 - armL2, cy - armW2 / 2, armL2, armW2);
      g.fillRect(cx + ms / 2, cy - armW2 / 2, armL2, armW2);
    }
  }

  g.restore();

  // --- Pointed arch outline inside the field ---
  const archPad = padding + Math.round(innerW * 0.06);
  const archX = archPad, archY = padding;
  const archW = W - archPad * 2, archH = H - padding * 1.5;
  const archR = archW / 2;

  g.strokeStyle = px(C_GOLD);
  g.lineWidth = Math.max(4, lineW + 4);
  g.beginPath();
  g.moveTo(archX, archY + archH - archY);
  g.lineTo(archX, archY + archR);
  g.quadraticCurveTo(archX, archY + archR * 0.1, archX + archR, archY);
  g.quadraticCurveTo(archX + archW, archY + archR * 0.1, archX + archW, archY + archR);
  g.lineTo(archX + archW, archY + archH - archY);
  g.stroke();

  // Second inner arch (slightly smaller) for layered frame effect
  const iap = archPad + Math.round(archW * 0.05);
  const iaW = W - iap * 2;
  const iaR = iaW / 2;
  g.strokeStyle = px(C_CREAM);
  g.lineWidth = Math.max(2, lineW - 2);
  g.beginPath();
  g.moveTo(iap, archY + archH - archY);
  g.lineTo(iap, archY + iaR);
  g.quadraticCurveTo(iap, archY + iaR * 0.1, iap + iaR, archY);
  g.quadraticCurveTo(iap + iaW, archY + iaR * 0.1, iap + iaW, archY + iaR);
  g.lineTo(iap + iaW, archY + archH - archY);
  g.stroke();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Internal colour constants used by archPanel (avoids importing palette)
const C_SAND = 0xecdfc4;
const C_COBALT = 0x1e5fa8;
const C_CREAM = 0xfff6e3;
const C_GOLD = 0xd9b545;

/** 8-pointed girih star lattice: proper 8-pointed star polygon with inner/outer radii. */
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  const S = 256;
  const [cv, g] = canvas(S * cells, S * cells, bg);

  for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
    const ox = cx * S + S / 2, oy = cy * S + S / 2;
    const outerR = S * 0.44;
    const innerR = S * 0.18;
    const points = 8;

    // Draw 8-pointed star with alternating outer/inner radii
    g.fillStyle = px(star);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI / points) - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = ox + Math.cos(a) * r;
      const y = oy + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.fill();

    // Accent small squares between star points (rotated 45°, at inner positions)
    g.fillStyle = px(accent);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) - Math.PI / 8;
      const midR = (outerR + innerR) * 0.5;
      const cx2 = ox + Math.cos(a) * midR;
      const cy2 = oy + Math.sin(a) * midR;
      const sq = S * 0.07;
      g.save();
      g.translate(cx2, cy2);
      g.rotate(a);
      g.fillRect(-sq, -sq, sq * 2, sq * 2);
      g.restore();
    }

    // Small center circle in background color
    g.fillStyle = px(bg);
    g.beginPath();
    g.arc(ox, oy, S * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(cv);
}

/** Horizontal majolica band: alternating diamonds with outline. */
export function band(bg: number, fg: number): THREE.CanvasTexture {
  // 1024×256 canvas (4× the original 512×128), 4 big diamonds per tile, repeat ×2
  const W = 1024, H = 256;
  const [cv, g] = canvas(W, H, bg);
  const count = 4;
  const cellW = W / count;

  // Top and bottom border stripes (×4 scaled)
  g.fillStyle = px(fg);
  g.fillRect(0, 0, W, 48);
  g.fillRect(0, H - 48, W, 48);

  // Thin mid stripe (×4 scaled)
  g.fillRect(0, H / 2 - 16, W, 32);

  for (let i = 0; i < count; i++) {
    const cx = i * cellW + cellW / 2;
    const cy = H / 2;
    const hw = cellW * 0.42; // half-width
    const hh = H * 0.38;    // half-height (stops short of border stripes)

    // Main diamond fill
    g.fillStyle = px(fg);
    g.beginPath();
    g.moveTo(cx,      cy - hh);
    g.lineTo(cx + hw, cy);
    g.lineTo(cx,      cy + hh);
    g.lineTo(cx - hw, cy);
    g.closePath();
    g.fill();

    // Inner cutout in background color
    g.fillStyle = px(bg);
    g.beginPath();
    g.moveTo(cx,           cy - hh * 0.55);
    g.lineTo(cx + hw * 0.45, cy);
    g.lineTo(cx,           cy + hh * 0.55);
    g.lineTo(cx - hw * 0.45, cy);
    g.closePath();
    g.fill();

    // Small center dot in fg (×4 scaled)
    g.fillStyle = px(fg);
    g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
  }
  return toTexture(cv, 2, 1);
}

/** Kufic-style angular strip: blocky meander strokes. */
export function kufic(bg: number, fg: number): THREE.CanvasTexture {
  // 1024×256 (4× original 512×128) — 4 repeating Kufic units of 256px each, repeat ×2 on texture
  const W = 1024, H = 256;
  const [cv, g] = canvas(W, H, bg);
  g.fillStyle = px(fg);

  // Thick top and bottom borders (×4 scaled)
  g.fillRect(0, 0, W, 56);
  g.fillRect(0, H - 56, W, 56);

  // 4 large Kufic units of 256px each
  const unit = 256;
  for (let i = 0; i < 4; i++) {
    const x = i * unit;
    const t = 56;   // top of glyph zone
    const b = H - 56; // bottom of glyph zone
    const h = b - t; // glyph height

    // Thick vertical left stem (×4 scaled)
    g.fillRect(x + 32, t, 72, h);

    // Top horizontal full-width bar
    g.fillRect(x + 32, t, unit - 32, 72);

    // Mid horizontal bar (shorter, alternating direction)
    if (i % 2 === 0) {
      g.fillRect(x + 32, t + h / 2 - 36, unit - 112, 72);
      // Right vertical descender from mid
      g.fillRect(x + unit - 184, t + h / 2 - 36, 72, h / 2 + 36);
    } else {
      g.fillRect(x + 112, t + h / 2 - 36, unit - 144, 72);
      // Left inner vertical from mid down
      g.fillRect(x + 112, t + h / 2 - 36, 72, h / 2 + 36);
    }

    // Bottom horizontal bar
    g.fillRect(x + 32, b - 72, unit - 32, 72);
  }

  return toTexture(cv, 2, 1);
}

/** Sher-Dor tiger decal: stylized flat tiger chasing deer, sun rising on its back. */
export function tigerDecal(): THREE.CanvasTexture {
  // 1024×512 (2× original 512×256). All coords scaled ×2.
  const [cv, g] = canvas(1024, 512, 0x1c5d99);

  // === SUN (upper right) — y centred at 116 ===
  const sx = 800, sy = 116, sr = 84;
  g.fillStyle = px(0xffd740);
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = px(0xffd740); g.lineWidth = 10;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.beginPath();
    g.moveTo(sx + Math.cos(a) * (sr + 14), sy + Math.sin(a) * (sr + 14));
    g.lineTo(sx + Math.cos(a) * (sr + 40), sy + Math.sin(a) * (sr + 40));
    g.stroke();
  }
  // Face whites + pupils
  g.fillStyle = px(0xfffbe0);
  g.beginPath(); g.arc(sx - 26, sy - 16, 16, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 26, sy - 16, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x2a1a00);
  g.beginPath(); g.arc(sx - 24, sy - 14, 8, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 28, sy - 14, 8, 0, Math.PI * 2); g.fill();
  // Eyebrows
  g.strokeStyle = px(0x6a3a00); g.lineWidth = 6;
  g.beginPath(); g.moveTo(sx - 40, sy - 36); g.lineTo(sx - 10, sy - 32); g.stroke();
  g.beginPath(); g.moveTo(sx + 10, sy - 32); g.lineTo(sx + 40, sy - 36); g.stroke();
  // Nose
  g.fillStyle = px(0xaa6030);
  g.beginPath(); g.moveTo(sx, sy + 8); g.lineTo(sx - 12, sy + 28); g.lineTo(sx + 12, sy + 28); g.closePath(); g.fill();
  // Smile
  g.strokeStyle = px(0x7a3a00); g.lineWidth = 6;
  g.beginPath(); g.arc(sx, sy + 20, 28, 0.15, Math.PI - 0.15); g.stroke();
  // Moustache
  g.strokeStyle = px(0x6a3a00); g.lineWidth = 4;
  g.beginPath(); g.moveTo(sx - 8, sy + 32); g.quadraticCurveTo(sx - 28, sy + 40, sx - 40, sy + 32); g.stroke();
  g.beginPath(); g.moveTo(sx + 8, sy + 32); g.quadraticCurveTo(sx + 28, sy + 40, sx + 40, sy + 32); g.stroke();
  // Sun outline
  g.strokeStyle = px(0xb87800); g.lineWidth = 4;
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.stroke();

  // === TIGER — body centred at y=236, legs end at ~y=420 ===
  const tigerColor = 0xe8943a;
  const stripeColor = 0x8a4a1a;
  const tby = 236; // tiger body centre y

  // Body
  g.fillStyle = px(tigerColor);
  g.beginPath(); g.ellipse(436, tby, 210, 80, 0, 0, Math.PI * 2); g.fill();

  // Head (facing right)
  const thx = 660, thy = tby - 20;
  g.beginPath(); g.arc(thx, thy, 72, 0, Math.PI * 2); g.fill();

  // Ears
  g.beginPath(); g.moveTo(thx - 36, thy - 56); g.lineTo(thx - 52, thy - 104); g.lineTo(thx - 12, thy - 68); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 12, thy - 60); g.lineTo(thx + 36, thy - 104); g.lineTo(thx + 48, thy - 60); g.closePath(); g.fill();
  g.fillStyle = px(0xffb080);
  g.beginPath(); g.moveTo(thx - 34, thy - 60); g.lineTo(thx - 46, thy - 94); g.lineTo(thx - 16, thy - 70); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 16, thy - 60); g.lineTo(thx + 34, thy - 96); g.lineTo(thx + 44, thy - 62); g.closePath(); g.fill();

  // Eyes
  g.fillStyle = px(0xffee88);
  g.beginPath(); g.arc(thx - 28, thy - 8, 16, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 16, thy - 8, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x1a1a00);
  g.beginPath(); g.arc(thx - 26, thy - 6, 8, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 18, thy - 6, 8, 0, Math.PI * 2); g.fill();

  // Nose
  g.fillStyle = px(0xcc6633);
  g.beginPath(); g.moveTo(thx, thy + 20); g.lineTo(thx - 14, thy + 6); g.lineTo(thx + 14, thy + 6); g.closePath(); g.fill();

  // Mouth
  g.strokeStyle = px(0x8a3a10); g.lineWidth = 4;
  g.beginPath(); g.moveTo(thx, thy + 20); g.lineTo(thx - 14, thy + 34); g.stroke();
  g.beginPath(); g.moveTo(thx, thy + 20); g.lineTo(thx + 14, thy + 34); g.stroke();

  // Whiskers
  g.strokeStyle = px(0xfff3da); g.lineWidth = 4;
  g.beginPath(); g.moveTo(thx - 40, thy + 8); g.lineTo(thx - 84, thy - 2); g.stroke();
  g.beginPath(); g.moveTo(thx - 40, thy + 18); g.lineTo(thx - 84, thy + 18); g.stroke();
  g.beginPath(); g.moveTo(thx + 40, thy + 8); g.lineTo(thx + 80, thy - 2); g.stroke();
  g.beginPath(); g.moveTo(thx + 40, thy + 18); g.lineTo(thx + 80, thy + 18); g.stroke();

  // Body stripes
  g.fillStyle = px(stripeColor);
  for (const [bx, by, bw, bh, rot] of [
    [340, tby - 44, 24, 84, -0.2],
    [400, tby - 52, 24, 88, -0.1],
    [464, tby - 52, 24, 88,  0.0],
    [528, tby - 48, 24, 84,  0.1],
    [588, tby - 40, 24, 76,  0.2],
  ] as [number, number, number, number, number][]) {
    g.save(); g.translate(bx, by + bh / 2); g.rotate(rot);
    g.fillRect(-bw / 2, -bh / 2, bw, bh);
    g.restore();
  }

  // Tail — curls up from back-left of body
  g.strokeStyle = px(tigerColor); g.lineWidth = 26;
  g.beginPath(); g.moveTo(228, tby + 16); g.quadraticCurveTo(176, tby - 16, 148, tby - 76); g.stroke();
  g.strokeStyle = px(stripeColor); g.lineWidth = 10;
  g.beginPath(); g.moveTo(228, tby + 16); g.quadraticCurveTo(176, tby - 16, 148, tby - 76); g.stroke();
  g.fillStyle = px(0x3a1a00);
  g.beginPath(); g.arc(148, tby - 80, 18, 0, Math.PI * 2); g.fill();

  // Legs — tops at tby+64, length 104, paws at tby+168
  g.fillStyle = px(tigerColor);
  for (const lx of [312, 376, 480, 544]) {
    g.beginPath(); g.roundRect(lx, tby + 64, 36, 104, 14); g.fill();
    g.fillStyle = px(0xd0783a);
    g.beginPath(); g.ellipse(lx + 18, tby + 170, 26, 16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(tigerColor);
  }
  g.fillStyle = px(stripeColor);
  for (const lx of [312, 376, 480, 544]) {
    g.fillRect(lx + 8, tby + 80, 12, 20);
    g.fillRect(lx + 8, tby + 112, 12, 20);
  }

  // === DEER — left side, clear of tiger's tail tip ===
  const deerColor = 0xfff3da;
  const dcy = tby + 20; // deer body centre y

  // Scale deer 1.25× around its visual centre (×2 all coords from original)
  g.save();
  g.translate(124, dcy - 16);
  g.scale(1.25, 1.25);
  g.translate(-124, -(dcy - 16));

  g.fillStyle = px(deerColor);
  // Body
  g.beginPath(); g.ellipse(104, dcy, 68, 40, -0.1, 0, Math.PI * 2); g.fill();
  // Neck bridge
  g.beginPath(); g.moveTo(136, dcy - 20); g.lineTo(148, dcy - 64); g.lineTo(172, dcy - 48); g.lineTo(156, dcy - 8); g.closePath(); g.fill();
  // Head
  g.beginPath(); g.arc(172, dcy - 68, 34, 0, Math.PI * 2); g.fill();

  // Antlers
  g.strokeStyle = px(0xb8865a); g.lineWidth = 6;
  g.beginPath(); g.moveTo(160, dcy - 96); g.lineTo(148, dcy - 136); g.lineTo(132, dcy - 156); g.stroke();
  g.beginPath(); g.moveTo(148, dcy - 124); g.lineTo(168, dcy - 108); g.stroke();
  g.beginPath(); g.moveTo(180, dcy - 96); g.lineTo(192, dcy - 136); g.lineTo(208, dcy - 156); g.stroke();
  g.beginPath(); g.moveTo(192, dcy - 124); g.lineTo(172, dcy - 108); g.stroke();

  // Eye + shine
  g.fillStyle = px(0x333333);
  g.beginPath(); g.arc(182, dcy - 74, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0xffffff);
  g.beginPath(); g.arc(184, dcy - 76, 3, 0, Math.PI * 2); g.fill();

  // Legs — tops at dcy+32
  g.fillStyle = px(deerColor);
  for (const lx of [60, 88, 116, 140]) {
    g.beginPath(); g.roundRect(lx, dcy + 32, 18, 88, 6); g.fill();
  }

  // Spots
  g.fillStyle = px(0xd4c090);
  g.beginPath(); g.arc(88, dcy - 8, 10, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(116, dcy - 16, 8, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(132, dcy + 4, 8, 0, Math.PI * 2); g.fill();

  g.restore();

  // === BORDERS ===
  g.strokeStyle = px(0x0d2a50); g.lineWidth = 16;
  g.strokeRect(8, 8, 1008, 496);
  g.strokeStyle = px(0xd4af37); g.lineWidth = 6;
  g.strokeRect(24, 24, 976, 464);

  const t = toTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
