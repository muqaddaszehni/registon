import * as THREE from 'three';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024; // 1024 for smoother gradient bands (one-time bake)
  const g = cv.getContext('2d')!;
  g.scale(cv.width / 512, cv.height / 512); // author everything below in 512-space

  // ── Clear-day sky to match the Wikipedia photos: a soft daytime blue zenith
  //    easing to a pale, faintly-warm haze at the horizon (the dawn-panorama
  //    look). Values are pre-compensated for ACES desaturation downstream.
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,    '#8aa0c0'); // desaturated blue crown
  grad.addColorStop(0.22, '#a3b6cf'); // soft blue
  grad.addColorStop(0.44, '#c2cdd4'); // neutral mid-sky
  grad.addColorStop(0.64, '#dcd6c6'); // warming toward golden hour
  grad.addColorStop(0.82, '#ecdcc0'); // warm pale haze
  grad.addColorStop(0.93, '#f3e3c2'); // golden horizon
  grad.addColorStop(1,    '#f6e4bd'); // warm golden-hour horizon base
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  // ── Soft horizon haze: a gentle pale brightening at the horizon (atmospheric
  //    depth on a clear day), no warm sunset disc.
  g.save();
  const glow = g.createRadialGradient(256, 560, 30, 256, 560, 340);
  glow.addColorStop(0,    'rgba(245,242,228,0.10)');
  glow.addColorStop(0.5,  'rgba(235,238,238,0.04)');
  glow.addColorStop(1,    'rgba(230,235,238,0.0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = glow;
  g.fillRect(0, 320, 512, 192);
  g.restore();

  // ── Warm sun-side glow: a large soft luminous patch high on the sun side,
  //    giving the upper air luminosity and feeding UnrealBloom (hazy sun air).
  g.save();
  const sun = g.createRadialGradient(215, 154, 0, 215, 154, 300);
  sun.addColorStop(0,   'rgba(255,244,222,0.18)');
  sun.addColorStop(0.5, 'rgba(255,240,210,0.06)');
  sun.addColorStop(1,   'rgba(255,240,210,0.0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = sun;
  g.fillRect(0, 0, 512, 512);
  g.restore();

  // ── High cirrus wisps — deterministic seed positions, now spread down across
  //    the mid-sky (behind the domes) and stronger so they survive ACES + grade.
  g.save();
  g.globalAlpha = 0.12;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.2;
  g.lineCap = 'round';

  // Seeded wisp positions (no Math.random — fixed geometry), y spread ~12-258
  const wisps = [
    // [x1, y1, cpx, cpy, x2, y2, width]
    [60,   30, 160,  22, 280,  34, 1.0],
    [200,  60, 290,  50, 420,  66, 0.8],
    [80,   95, 170,  86, 310, 100, 0.6],
    [310,  18, 390,  12, 490,  26, 0.9],
    [30,  130, 130, 120, 240, 134, 0.5],
    [350, 165, 430, 156, 500, 170, 0.7],
    [140, 200, 230, 190, 370, 205, 0.6],
    [20,  235, 100, 225, 200, 240, 0.4],
    [420, 110, 480, 102, 510, 116, 0.5],
    [250, 255, 340, 245, 460, 258, 0.6],
  ] as const;

  for (const [x1, y1, cpx, cpy, x2, y2, lw] of wisps) {
    g.lineWidth = lw * 1.5;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(cpx, cpy, x2, y2);
    g.stroke();
  }
  g.restore();

  // ── Distant bird specks — tiny V-shapes at high altitude, very subtle
  g.save();
  g.globalAlpha = 0.12;
  g.strokeStyle = '#c8b8d8'; // slightly cool-purple so they read against warm horizon
  g.lineWidth = 0.9;
  g.lineCap = 'round';

  // Fixed seed positions for birds (deterministic)
  const birds = [
    // [cx, cy, size] — wing spread as small V
    [380, 48, 4],
    [395, 42, 3],
    [365, 52, 3.5],
    [408, 46, 2.5],
    [355, 44, 3],
    [110, 35, 3.5],
    [125, 30, 3],
    [98,  40, 2.5],
    [460, 60, 3],
    [472, 55, 2.5],
    [450, 65, 2],
    [240, 22, 3],
    [252, 18, 2.5],
  ] as const;

  for (const [cx, cy, size] of birds) {
    const s = size * 1.5; // larger so the V-shapes survive the downstream stretch
    g.beginPath();
    // Left wing
    g.moveTo(cx - s, cy + s * 0.4);
    g.quadraticCurveTo(cx - s * 0.5, cy - s * 0.2, cx, cy);
    // Right wing
    g.quadraticCurveTo(cx + s * 0.5, cy - s * 0.2, cx + s, cy + s * 0.4);
    g.stroke();
  }
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
