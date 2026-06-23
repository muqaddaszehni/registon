import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/bench';
const ONLY = process.argv[3];
const PORT = process.env.PORT || 5173;
mkdirSync(OUT, { recursive: true });

// Photo-matching framings (orthographic dbg poses). az: 0=+X cam, PI/2=+Z, PI=-X.
const SHOTS = [
  { n: 'pano',      tx: 0,    ty: 7,  tz: 3,    az: Math.PI / 2, el: 0.17, zoom: 0.82 }, // ↔ panorama.jpg
  { n: 'sherdor',   tx: 13,   ty: 8,  tz: 0,    az: Math.PI,     el: 0.12, zoom: 1.5 },  // ↔ sherdor.jpg
  { n: 'tilyakori', tx: 0,    ty: 7,  tz: -12.5,az: Math.PI / 2, el: 0.12, zoom: 1.25 }, // ↔ tilyakori.jpg
  { n: 'sidewall',  tx: 13,   ty: 6,  tz: -4,   az: 2.35,        el: 0.20, zoom: 1.0 },  // ↔ sherdor_ulugbeg.jpg
  { n: 'dome',      tx: 17.5, ty: 12, tz: 6.6,  az: 0.55,        el: 0.42, zoom: 3.0 },
  { n: 'minaret',   tx: 13,   ty: 13, tz: 10.8, az: 0.7,         el: 0.20, zoom: 2.2 },
];

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));
await page.goto(`http://localhost:${PORT}/?dbg`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4500);

for (const s of SHOTS) {
  if (ONLY && !s.n.includes(ONLY)) continue;
  await page.evaluate(p => window.inspect(p), s);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${s.n}.png` });
  console.log('shot', s.n);
}
await browser.close();
console.log('done ->', OUT);
