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
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** 8-pointed girih star lattice: proper 8-pointed star polygon with inner/outer radii. */
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  const S = 128;
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
  // 512×128 canvas, 4 big diamonds per tile, repeat ×2
  const W = 512, H = 128;
  const [cv, g] = canvas(W, H, bg);
  const count = 4;
  const cellW = W / count;

  // Top and bottom border stripes
  g.fillStyle = px(fg);
  g.fillRect(0, 0, W, 12);
  g.fillRect(0, H - 12, W, 12);

  // Thin mid stripe
  g.fillRect(0, H / 2 - 4, W, 8);

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

    // Small center dot in fg
    g.fillStyle = px(fg);
    g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
  }
  return toTexture(cv, 2, 1);
}

/** Kufic-style angular strip: blocky meander strokes. */
export function kufic(bg: number, fg: number): THREE.CanvasTexture {
  // 512×128 — 4 repeating Kufic units of 128px each, repeat ×2 on texture
  const W = 512, H = 128;
  const [cv, g] = canvas(W, H, bg);
  g.fillStyle = px(fg);

  // Thick top and bottom borders
  g.fillRect(0, 0, W, 14);
  g.fillRect(0, H - 14, W, 14);

  // 4 large Kufic units of 128px each
  const unit = 128;
  for (let i = 0; i < 4; i++) {
    const x = i * unit;
    const t = 14;   // top of glyph zone
    const b = H - 14; // bottom of glyph zone
    const h = b - t; // glyph height = 100

    // Thick vertical left stem
    g.fillRect(x + 8, t, 18, h);

    // Top horizontal full-width bar
    g.fillRect(x + 8, t, unit - 8, 18);

    // Mid horizontal bar (shorter, alternating direction)
    if (i % 2 === 0) {
      g.fillRect(x + 8, t + h / 2 - 9, unit - 28, 18);
      // Right vertical descender from mid
      g.fillRect(x + unit - 46, t + h / 2 - 9, 18, h / 2 + 9);
    } else {
      g.fillRect(x + 28, t + h / 2 - 9, unit - 36, 18);
      // Left inner vertical from mid down
      g.fillRect(x + 28, t + h / 2 - 9, 18, h / 2 + 9);
    }

    // Bottom horizontal bar
    g.fillRect(x + 8, b - 18, unit - 8, 18);
  }

  return toTexture(cv, 2, 1);
}

/** Sher-Dor tiger decal: stylized flat tiger chasing deer, sun rising on its back. */
export function tigerDecal(): THREE.CanvasTexture {
  // 512×256. Tiger+deer occupy y=80..230, sun upper-right.
  const [cv, g] = canvas(512, 256, 0x1c5d99);

  // === SUN (upper right) — y centred at 60 ===
  const sx = 400, sy = 58, sr = 42;
  g.fillStyle = px(0xffd740);
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = px(0xffd740); g.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.beginPath();
    g.moveTo(sx + Math.cos(a) * (sr + 7), sy + Math.sin(a) * (sr + 7));
    g.lineTo(sx + Math.cos(a) * (sr + 20), sy + Math.sin(a) * (sr + 20));
    g.stroke();
  }
  // Face whites + pupils
  g.fillStyle = px(0xfffbe0);
  g.beginPath(); g.arc(sx - 13, sy - 8, 8, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 13, sy - 8, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x2a1a00);
  g.beginPath(); g.arc(sx - 12, sy - 7, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + 14, sy - 7, 4, 0, Math.PI * 2); g.fill();
  // Eyebrows
  g.strokeStyle = px(0x6a3a00); g.lineWidth = 3;
  g.beginPath(); g.moveTo(sx - 20, sy - 18); g.lineTo(sx - 5, sy - 16); g.stroke();
  g.beginPath(); g.moveTo(sx + 5, sy - 16); g.lineTo(sx + 20, sy - 18); g.stroke();
  // Nose
  g.fillStyle = px(0xaa6030);
  g.beginPath(); g.moveTo(sx, sy + 4); g.lineTo(sx - 6, sy + 14); g.lineTo(sx + 6, sy + 14); g.closePath(); g.fill();
  // Smile
  g.strokeStyle = px(0x7a3a00); g.lineWidth = 3;
  g.beginPath(); g.arc(sx, sy + 10, 14, 0.15, Math.PI - 0.15); g.stroke();
  // Moustache
  g.strokeStyle = px(0x6a3a00); g.lineWidth = 2;
  g.beginPath(); g.moveTo(sx - 4, sy + 16); g.quadraticCurveTo(sx - 14, sy + 20, sx - 20, sy + 16); g.stroke();
  g.beginPath(); g.moveTo(sx + 4, sy + 16); g.quadraticCurveTo(sx + 14, sy + 20, sx + 20, sy + 16); g.stroke();
  // Sun outline
  g.strokeStyle = px(0xb87800); g.lineWidth = 2;
  g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.stroke();

  // === TIGER — body centred at y=118, legs end at ~y=210 ===
  const tigerColor = 0xe8943a;
  const stripeColor = 0x8a4a1a;
  const tby = 118; // tiger body centre y

  // Body
  g.fillStyle = px(tigerColor);
  g.beginPath(); g.ellipse(218, tby, 105, 40, 0, 0, Math.PI * 2); g.fill();

  // Head (facing right)
  const thx = 330, thy = tby - 10;
  g.beginPath(); g.arc(thx, thy, 36, 0, Math.PI * 2); g.fill();

  // Ears
  g.beginPath(); g.moveTo(thx - 18, thy - 28); g.lineTo(thx - 26, thy - 52); g.lineTo(thx - 6, thy - 34); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 6, thy - 30); g.lineTo(thx + 18, thy - 52); g.lineTo(thx + 24, thy - 30); g.closePath(); g.fill();
  g.fillStyle = px(0xffb080);
  g.beginPath(); g.moveTo(thx - 17, thy - 30); g.lineTo(thx - 23, thy - 47); g.lineTo(thx - 8, thy - 35); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(thx + 8, thy - 30); g.lineTo(thx + 17, thy - 48); g.lineTo(thx + 22, thy - 31); g.closePath(); g.fill();

  // Eyes
  g.fillStyle = px(0xffee88);
  g.beginPath(); g.arc(thx - 14, thy - 4, 8, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 8, thy - 4, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0x1a1a00);
  g.beginPath(); g.arc(thx - 13, thy - 3, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(thx + 9, thy - 3, 4, 0, Math.PI * 2); g.fill();

  // Nose
  g.fillStyle = px(0xcc6633);
  g.beginPath(); g.moveTo(thx, thy + 10); g.lineTo(thx - 7, thy + 3); g.lineTo(thx + 7, thy + 3); g.closePath(); g.fill();

  // Mouth
  g.strokeStyle = px(0x8a3a10); g.lineWidth = 2;
  g.beginPath(); g.moveTo(thx, thy + 10); g.lineTo(thx - 7, thy + 17); g.stroke();
  g.beginPath(); g.moveTo(thx, thy + 10); g.lineTo(thx + 7, thy + 17); g.stroke();

  // Whiskers
  g.strokeStyle = px(0xfff3da); g.lineWidth = 2;
  g.beginPath(); g.moveTo(thx - 20, thy + 4); g.lineTo(thx - 42, thy - 1); g.stroke();
  g.beginPath(); g.moveTo(thx - 20, thy + 9); g.lineTo(thx - 42, thy + 9); g.stroke();
  g.beginPath(); g.moveTo(thx + 20, thy + 4); g.lineTo(thx + 40, thy - 1); g.stroke();
  g.beginPath(); g.moveTo(thx + 20, thy + 9); g.lineTo(thx + 40, thy + 9); g.stroke();

  // Body stripes
  g.fillStyle = px(stripeColor);
  for (const [bx, by, bw, bh, rot] of [
    [170, tby - 22, 12, 42, -0.2],
    [200, tby - 26, 12, 44, -0.1],
    [232, tby - 26, 12, 44,  0.0],
    [264, tby - 24, 12, 42,  0.1],
    [294, tby - 20, 12, 38,  0.2],
  ] as [number, number, number, number, number][]) {
    g.save(); g.translate(bx, by + bh / 2); g.rotate(rot);
    g.fillRect(-bw / 2, -bh / 2, bw, bh);
    g.restore();
  }

  // Tail — curls up from back-left of body
  g.strokeStyle = px(tigerColor); g.lineWidth = 13;
  g.beginPath(); g.moveTo(114, tby + 8); g.quadraticCurveTo(88, tby - 8, 74, tby - 38); g.stroke();
  g.strokeStyle = px(stripeColor); g.lineWidth = 5;
  g.beginPath(); g.moveTo(114, tby + 8); g.quadraticCurveTo(88, tby - 8, 74, tby - 38); g.stroke();
  g.fillStyle = px(0x3a1a00);
  g.beginPath(); g.arc(74, tby - 40, 9, 0, Math.PI * 2); g.fill();

  // Legs — tops at tby+32, length 52, paws at tby+84 = y~202
  g.fillStyle = px(tigerColor);
  for (const lx of [156, 188, 240, 272]) {
    g.beginPath(); g.roundRect(lx, tby + 32, 18, 52, 7); g.fill();
    g.fillStyle = px(0xd0783a);
    g.beginPath(); g.ellipse(lx + 9, tby + 85, 13, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(tigerColor);
  }
  g.fillStyle = px(stripeColor);
  for (const lx of [156, 188, 240, 272]) {
    g.fillRect(lx + 4, tby + 40, 6, 10);
    g.fillRect(lx + 4, tby + 56, 6, 10);
  }

  // === DEER — left side, clear of tiger's tail tip ===
  // Scaled up ~25%: body centred at (58, tby+10)
  const deerColor = 0xfff3da;
  const dcy = tby + 10; // deer body centre y ≈ 128

  // Scale deer 1.25× around its visual centre
  g.save();
  g.translate(62, dcy - 8);
  g.scale(1.25, 1.25);
  g.translate(-62, -(dcy - 8));

  g.fillStyle = px(deerColor);
  // Body
  g.beginPath(); g.ellipse(52, dcy, 34, 20, -0.1, 0, Math.PI * 2); g.fill();
  // Neck bridge
  g.beginPath(); g.moveTo(68, dcy - 10); g.lineTo(74, dcy - 32); g.lineTo(86, dcy - 24); g.lineTo(78, dcy - 4); g.closePath(); g.fill();
  // Head
  g.beginPath(); g.arc(86, dcy - 34, 17, 0, Math.PI * 2); g.fill();

  // Antlers
  g.strokeStyle = px(0xb8865a); g.lineWidth = 3;
  g.beginPath(); g.moveTo(80, dcy - 48); g.lineTo(74, dcy - 68); g.lineTo(66, dcy - 78); g.stroke();
  g.beginPath(); g.moveTo(74, dcy - 62); g.lineTo(84, dcy - 54); g.stroke();
  g.beginPath(); g.moveTo(90, dcy - 48); g.lineTo(96, dcy - 68); g.lineTo(104, dcy - 78); g.stroke();
  g.beginPath(); g.moveTo(96, dcy - 62); g.lineTo(86, dcy - 54); g.stroke();

  // Eye + shine
  g.fillStyle = px(0x333333);
  g.beginPath(); g.arc(91, dcy - 37, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = px(0xffffff);
  g.beginPath(); g.arc(92, dcy - 38, 1.5, 0, Math.PI * 2); g.fill();

  // Legs — tops at dcy+16
  g.fillStyle = px(deerColor);
  for (const lx of [30, 44, 58, 70]) {
    g.beginPath(); g.roundRect(lx, dcy + 16, 9, 44, 3); g.fill();
  }

  // Spots
  g.fillStyle = px(0xd4c090);
  g.beginPath(); g.arc(44, dcy - 4, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(58, dcy - 8, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(66, dcy + 2, 4, 0, Math.PI * 2); g.fill();

  g.restore();

  // === BORDERS ===
  g.strokeStyle = px(0x0d2a50); g.lineWidth = 8;
  g.strokeRect(4, 4, 504, 248);
  g.strokeStyle = px(0xd4af37); g.lineWidth = 3;
  g.strokeRect(12, 12, 488, 232);

  const t = toTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
