import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/glimmer';
const PORT = process.env.PORT || 5173;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4500); // intro done

// Press rotate, then grab a rapid burst of frames DURING the eased rotation
// (azimuth eases at dt*5 → ~0.4–0.8 s of motion). Glimmer/aliasing shows mid-motion.
const rotate = page.locator('[aria-label="Rotate view"]');
await rotate.click();
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `${OUT}/rot-${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(55);
}
console.log('done ->', OUT);
await browser.close();
