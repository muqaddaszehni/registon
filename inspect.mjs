import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/insp';
const ONLY = process.argv[3];            // optional: capture only shots whose name includes this
mkdirSync(OUT, { recursive: true });

// Per-block inspection shots. az: 0=+X camera, PI/2=+Z, PI=-X. el=elevation rad. zoom: ortho zoom (higher=closer).
const SHOTS = [
  { n: 'A1-sd-dome-right', tx: 17.5, ty: 12, tz: 6.6,  az: 0.55,  el: 0.42, zoom: 3.2 },
  { n: 'A2-sd-dome-left',  tx: 17.5, ty: 12, tz: -6.6, az: -0.55, el: 0.42, zoom: 3.2 },
  { n: 'B-tk-dome',        tx: -9,   ty: 14, tz: -13,  az: 1.05,  el: 0.40, zoom: 2.6 },
  { n: 'C-sd-portal',      tx: 10,   ty: 7.5, tz: 0,   az: 2.62,  el: 0.30, zoom: 2.3 },
  { n: 'D-ub-portal',      tx: -11.5,ty: 7.5, tz: 0,   az: 0.52,  el: 0.30, zoom: 2.3 },
  { n: 'E-tk-portal',      tx: 0,    ty: 6.8, tz: -10, az: 1.07,  el: 0.28, zoom: 2.1 },
  { n: 'F-sd-minaret',     tx: 13,   ty: 9,  tz: 10.8, az: 0.7,   el: 0.22, zoom: 2.1 },
  { n: 'G-sd-sidewall',    tx: 13,   ty: 5,  tz: 7,    az: 1.35,  el: 0.18, zoom: 3.0 },
  { n: 'H-overall',        tx: 0,    ty: 5,  tz: 0,    az: 0.785, el: 0.50, zoom: 0.9 },
  { n: 'I-sd-portal-back', tx: 13,   ty: 8,  tz: 0,    az: 0.05,  el: 0.30, zoom: 2.1 },
  { n: 'J-ub-portal-back', tx: -13.5,ty: 8,  tz: 0,    az: 3.10,  el: 0.30, zoom: 2.1 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });

const PORT = process.env.PORT || 5173;
await page.goto(`http://localhost:${PORT}/?dbg`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4500);  // let intro finish + LOD tier-2 textures rasterize

for (const s of SHOTS) {
  if (ONLY && !s.n.includes(ONLY)) continue;
  await page.evaluate((p) => window.inspect(p), s);
  await page.waitForTimeout(700);   // settle + texture stagger
  await page.screenshot({ path: `${OUT}/${s.n}.png` });
  console.log('shot', s.n);
}
await browser.close();
console.log('done ->', OUT);
