import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/registon-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
page.on('pageerror', e => console.log('PAGE EXCEPTION:', e.message));

const PORT = process.env.PORT || 5173;
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 15000 });
// Let intro sweep finish
await page.waitForTimeout(4000);

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot:', name);
}

await shot('00-default');

const rotateBtn = page.locator('[aria-label="Rotate view"]');
for (let i = 1; i <= 3; i++) {
  await rotateBtn.click();
  await page.waitForTimeout(900);
  await shot(`0${i}-rot${i}`);
}
// back to default orientation (4th rotation = full turn)
await rotateBtn.click();
await page.waitForTimeout(900);

// zoom in twice
const zoomIn = page.locator('[aria-label="Zoom in"]');
await zoomIn.click(); await page.waitForTimeout(700);
await zoomIn.click(); await page.waitForTimeout(900);
await shot('05-zoomed');

await browser.close();
console.log('done ->', OUT);
