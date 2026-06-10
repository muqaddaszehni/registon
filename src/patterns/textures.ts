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
  // 256px → 4 diamonds per tile; with PATTERN_WORLD=2 → ~1 tile per 2 world units → diamond ≈ 2.5 wu
  const cellSize = 256;
  const lineW = 10;     // px stroke width (~4% of cell) — subtle cream lines on buff

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

  // Diamond centre motif: a square rotated 45° (a smaller diamond) — covers ~25-30% of cell area
  // This is the classic Timurid bannai motif: a diamond-in-diamond at each intersection
  const halfCell = cellSize / 2;
  // Motif diamond inscribed radius: ~20% of cell width keeps coverage ~30%
  const ms = Math.round(cellSize * 0.20);

  g.fillStyle = px(motif);

  for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
    for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
      // Diamond centre in rotated grid: transform back to screen coords
      const cx = (ix + iy) * halfCell;
      const cy = (iy - ix) * halfCell;
      if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

      // Draw a small filled diamond (rotated square) as the motif
      g.beginPath();
      g.moveTo(cx,      cy - ms);
      g.lineTo(cx + ms, cy);
      g.lineTo(cx,      cy + ms);
      g.lineTo(cx - ms, cy);
      g.closePath();
      g.fill();

      // Small accent squares at the four diagonal corners (inside the diamond cell)
      const dotR = Math.round(ms * 0.30);
      const dotOff = Math.round(cellSize * 0.36);
      for (const [dx, dy] of [[dotOff, 0], [-dotOff, 0], [0, dotOff], [0, -dotOff]]) {
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate(Math.PI / 4);
        g.fillRect(-dotR / 2, -dotR / 2, dotR, dotR);
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
 * Used on wing fronts. High-contrast cobalt frame + prominent arch outline.
 */
export function archPanel(w: number, h: number): THREE.CanvasTexture {
  const W = Math.max(w, 32), H = Math.max(h, 32);
  const [cv, g] = canvas(W, H, C_SAND);

  // Wide cobalt border frame (10% of width) — must be visible at iso scale
  const frameW = Math.round(W * 0.10);

  // --- Outer cobalt border frame ---
  g.fillStyle = px(C_COBALT);
  g.fillRect(0, 0, W, frameW);
  g.fillRect(0, H - frameW, W, frameW);
  g.fillRect(0, 0, frameW, H);
  g.fillRect(W - frameW, 0, frameW, H);

  // Cream inner accent line
  const ib = frameW + 3;
  g.strokeStyle = px(C_CREAM);
  g.lineWidth = Math.max(3, Math.round(W * 0.015));
  g.strokeRect(ib, ib, W - ib * 2, H - ib * 2);

  // Kufic step-pattern along frame strips (cream squares on cobalt)
  g.fillStyle = px(C_CREAM);
  const stepSize = Math.round(frameW * 0.7);
  const stepsX = Math.max(2, Math.floor(W / (stepSize * 1.8)));
  const stepsY = Math.max(2, Math.floor(H / (stepSize * 1.8)));
  for (let i = 0; i < stepsX; i++) {
    const x = (i + 0.5) * (W / stepsX);
    const sq = Math.round(stepSize * 0.55);
    g.fillRect(x - sq / 2, Math.round(frameW * 0.22), sq, sq);
    g.fillRect(x - sq / 2, H - Math.round(frameW * 0.22) - sq, sq, sq);
  }
  for (let i = 0; i < stepsY; i++) {
    const y = (i + 0.5) * (H / stepsY);
    const sq = Math.round(stepSize * 0.55);
    g.fillRect(Math.round(frameW * 0.22), y - sq / 2, sq, sq);
    g.fillRect(W - Math.round(frameW * 0.22) - sq, y - sq / 2, sq, sq);
  }

  // --- Inner field: warm sand with subtle cobalt diamond lattice ---
  const padding = frameW + Math.round(W * 0.04);
  const innerX = padding, innerY = padding;
  const innerW = W - padding * 2, innerH = H - padding * 2;

  if (innerW > 4 && innerH > 4) {
    g.save();
    g.beginPath();
    g.rect(innerX, innerY, innerW, innerH);
    g.clip();

    // Warm sand field
    g.fillStyle = px(C_SAND);
    g.fillRect(innerX, innerY, innerW, innerH);

    // Diagonal lattice lines (cobalt, more visible than cream)
    const cellSize = Math.round(innerW * 0.30);
    const lineW2 = Math.max(2, Math.round(cellSize * 0.05));
    const halfCell = cellSize / 2;
    g.strokeStyle = px(C_COBALT);
    g.lineWidth = lineW2;
    g.globalAlpha = 0.35; // semi-transparent so lattice is subtle but present
    g.lineCap = 'square';
    const diagLen = Math.sqrt(2) * Math.max(innerW, innerH);
    const cnt = Math.ceil(diagLen / cellSize) + 4;
    for (let i = -cnt; i < cnt * 2; i++) {
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
    g.globalAlpha = 1.0;

    // Cobalt diamond motifs at intersections
    g.fillStyle = px(C_COBALT);
    const ms = Math.round(cellSize * 0.26);
    for (let iy = -2; iy < Math.ceil(innerH / halfCell) + 4; iy++) {
      for (let ix = -2; ix < Math.ceil(innerW / halfCell) + 4; ix++) {
        const cx = innerX + (ix + iy) * halfCell;
        const cy = innerY + (iy - ix) * halfCell;
        if (cx < innerX - cellSize || cx > innerX + innerW + cellSize) continue;
        if (cy < innerY - cellSize || cy > innerY + innerH + cellSize) continue;
        g.beginPath();
        g.moveTo(cx, cy - ms);
        g.lineTo(cx + ms, cy);
        g.lineTo(cx, cy + ms);
        g.lineTo(cx - ms, cy);
        g.closePath();
        g.fill();
      }
    }

    g.restore();
  }

  // --- Prominent pointed arch outline ---
  const archInset = frameW + Math.round(W * 0.06);
  const aX = archInset;
  const aW = W - archInset * 2;
  const aR = aW / 2;
  const aY = frameW + Math.round(H * 0.04);
  const aH = H - aY - frameW * 0.5;

  // Cobalt outer arch (thick — dominant feature)
  const archLW = Math.max(8, Math.round(W * 0.035));
  g.strokeStyle = px(C_COBALT);
  g.lineWidth = archLW;
  g.beginPath();
  g.moveTo(aX, aY + aH);
  g.lineTo(aX, aY + aR);
  g.quadraticCurveTo(aX, aY + aR * 0.08, aX + aR, aY);
  g.quadraticCurveTo(aX + aW, aY + aR * 0.08, aX + aW, aY + aR);
  g.lineTo(aX + aW, aY + aH);
  g.stroke();

  // Turquoise inner arch (thinner accent line)
  const iLW = Math.max(4, Math.round(W * 0.018));
  const iad = Math.round(aW * 0.07);
  g.strokeStyle = px(0x42c8c8);
  g.lineWidth = iLW;
  g.beginPath();
  g.moveTo(aX + iad, aY + aH);
  g.lineTo(aX + iad, aY + (aR - iad));
  g.quadraticCurveTo(aX + iad, aY + aR * 0.12 + iad, aX + aR, aY + iad);
  g.quadraticCurveTo(aX + aW - iad, aY + aR * 0.12 + iad, aX + aW - iad, aY + (aR - iad));
  g.lineTo(aX + aW - iad, aY + aH);
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

/**
 * Spandrel tiger panel — same tiger+sun motif but
 * cropped to a square 512×512 aspect, no outer black border frame.
 * Used as left and right spandrel plane textures on Sher-Dor portal.
 * The caller mirrors the right-side copy (scale.x = -1) to get the symmetric pair.
 */
export function tigerSpandrel(): THREE.CanvasTexture {
  const S = 512;
  const [cv, g] = canvas(S, S, 0x1c5d99);

  // --- SUN (upper right) ---
  const sx = 390, sy = 110, sr = 72;
  g.fillStyle = px(0xffd740);
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = px(0xffd740); g.lineWidth = 7;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.beginPath();
    g.moveTo(sx + Math.cos(a) * (sr + 10), sy + Math.sin(a) * (sr + 10));
    g.lineTo(sx + Math.cos(a) * (sr + 30), sy + Math.sin(a) * (sr + 30));
    g.stroke();
  }
  // Sun face
  g.fillStyle = px(0xfffbe0);
  g.beginPath(); g.arc(sx - 20, sy - 12, 12, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 20, sy - 12, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x2a1a00);
  g.beginPath(); g.arc(sx - 18, sy - 10, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 22, sy - 10, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0xaa6030);
  g.beginPath(); g.moveTo(sx, sy + 6); g.lineTo(sx - 10, sy + 22); g.lineTo(sx + 10, sy + 22); g.closePath(); g.fill();
  g.strokeStyle = px(0x7a3a00); g.lineWidth = 4;
  g.beginPath(); g.arc(sx, sy + 14, 20, 0.15, Math.PI - 0.15); g.stroke();

  // --- TIGER body centred at y=290, x=240 ---
  const tigerColor = 0xe8943a;
  const stripeColor = 0x8a4a1a;
  const tby = 290;
  const tbx = 240;

  // Body ellipse
  g.fillStyle = px(tigerColor);
  g.beginPath(); g.ellipse(tbx, tby, 170, 65, 0, 0, Math.PI * 2); g.fill();

  // Head facing right
  const thx = 420, thy = tby - 16;
  g.beginPath(); g.arc(thx, thy, 58, 0, Math.PI * 2); g.fill();

  // Ears
  g.beginPath(); g.moveTo(thx - 28, thy - 44); g.lineTo(thx - 40, thy - 82); g.lineTo(thx - 8, thy - 52); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 8, thy - 46); g.lineTo(thx + 28, thy - 82); g.lineTo(thx + 38, thy - 46); g.closePath(); g.fill();

  // Eyes
  g.fillStyle = px(0xffee88);
  g.beginPath(); g.arc(thx - 22, thy - 6, 13, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 12, thy - 6, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x1a1a00);
  g.beginPath(); g.arc(thx - 20, thy - 4, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 14, thy - 4, 6, 0, Math.PI * 2); g.fill();

  // Nose + mouth
  g.fillStyle = px(0xcc6633);
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx - 11, thy + 4); g.lineTo(thx + 11, thy + 4); g.closePath(); g.fill();
  g.strokeStyle = px(0x8a3a10); g.lineWidth = 3;
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx - 11, thy + 28); g.stroke();
  g.beginPath(); g.moveTo(thx, thy + 16); g.lineTo(thx + 11, thy + 28); g.stroke();

  // Body stripes
  g.fillStyle = px(stripeColor);
  for (const [bx, bw, bh, rot] of [
    [tbx - 80, 18, 68, -0.15],
    [tbx - 30, 18, 72, -0.05],
    [tbx + 20, 18, 72,  0.05],
    [tbx + 72, 18, 66,  0.15],
  ] as [number, number, number, number][]) {
    g.save(); g.translate(bx, tby); g.rotate(rot);
    g.fillRect(-bw / 2, -bh / 2, bw, bh);
    g.restore();
  }

  // Tail curling up from back
  g.strokeStyle = px(tigerColor); g.lineWidth = 20;
  g.beginPath(); g.moveTo(tbx - 160, tby + 12); g.quadraticCurveTo(tbx - 190, tby - 12, tbx - 200, tby - 60); g.stroke();
  g.strokeStyle = px(stripeColor); g.lineWidth = 8;
  g.beginPath(); g.moveTo(tbx - 160, tby + 12); g.quadraticCurveTo(tbx - 190, tby - 12, tbx - 200, tby - 60); g.stroke();
  g.fillStyle = px(0x3a1a00);
  g.beginPath(); g.arc(tbx - 200, tby - 64, 14, 0, Math.PI * 2); g.fill();

  // Legs
  g.fillStyle = px(tigerColor);
  for (const lx of [tbx - 110, tbx - 60, tbx + 40, tbx + 90]) {
    g.beginPath(); g.roundRect(lx, tby + 50, 28, 85, 10); g.fill();
    g.fillStyle = px(0xd0783a);
    g.beginPath(); g.ellipse(lx + 14, tby + 136, 20, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(tigerColor);
  }

  // Gold inner border only (no outer black frame)
  g.strokeStyle = px(0xd4af37); g.lineWidth = 8;
  g.strokeRect(10, 10, S - 20, S - 20);

  const t2 = toTexture(cv);
  t2.wrapS = t2.wrapT = THREE.ClampToEdgeWrapping;
  return t2;
}
