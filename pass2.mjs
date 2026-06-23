import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/insp-pass2';
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { n: 'K-tk-back',          tx: 0,   ty: 8, tz: -13, az: 4.712, el: 0.30, zoom: 1.7 },
  { n: 'L-ub-courtyard',     tx: -13.5,ty: 2, tz: 0,  az: 0.6,   el: 0.95, zoom: 1.9 },
  { n: 'M-sd-corner',        tx: 13,  ty: 4, tz: 9,   az: 0.6,   el: 0.22, zoom: 2.6 },
  { n: 'N-plaza-grazing',    tx: 0,   ty: 2, tz: 0,   az: 0.785, el: 0.08, zoom: 1.0 },
  { n: 'O-tk-corner-junction',tx: 7,  ty: 6, tz: -11, az: 0.9,   el: 0.30, zoom: 2.2 },
  { n: 'P-topdown',          tx: 0,   ty: 3, tz: 0,   az: 0.785, el: 1.35, zoom: 0.85 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
const PORT = process.env.PORT || 5173;
await page.goto(`http://localhost:${PORT}/?dbg`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4500);
for (const s of SHOTS) {
  await page.evaluate((p) => window.inspect(p), s);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${s.n}.png` });
  console.log('shot', s.n);
}
await browser.close();
console.log('done ->', OUT);
