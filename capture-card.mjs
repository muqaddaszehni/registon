import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/cards';
const PORT = process.env.PORT || 5173;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('ERR:', m.text()); });

// Force Tajik before load so the card opens in TJ.
await page.addInitScript(() => localStorage.setItem('lang', 'tj'));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4000);

for (const id of [7, 3, 5, 1]) {
  await page.evaluate((i) => window.__cards.show(i), id);
  await page.waitForTimeout(1200); // let Nastaliq font shape/lay out
  await page.screenshot({ path: `${OUT}/card-tj-${id}.png` });
  console.log('card', id);
}
// Also one EN for comparison
await page.evaluate(() => { localStorage.setItem('lang', 'en'); });
await browser.close();
console.log('done ->', OUT);
