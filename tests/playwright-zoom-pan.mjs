/**
 * Playwright verification for Lap 4a: zoom + pan
 * Usage: node tests/playwright-zoom-pan.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const BASE = 'http://localhost:5199';
const SHOTS = 'regression-shots/lap4a';

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[PAGE]', m.text()); });
page.on('pageerror', e => console.error('[PAGE ERROR]', e.message));

async function shot(name) {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path });
  console.log(`Screenshot: ${path}`);
  return path;
}

async function waitFrames(n = 5) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000); // let intro start

// Skip intro by clicking
await page.mouse.click(640, 400);
await page.waitForTimeout(500);
await waitFrames(10);

// ─── Test 1: Initial state (baseline) ─────────────────────────────────────────
console.log('\n=== Test 1: Baseline ===');
await shot('01-baseline');

// ─── Test 2: Wheel zoom into Ulugh Beg portal ─────────────────────────────────
console.log('\n=== Test 2: Wheel zoom (center of scene) ===');
// Wheel down 8× toward center to zoom in
const cx = 640, cy = 400;
for (let i = 0; i < 8; i++) {
  await page.mouse.wheel(0, 200); // deltaY positive = zoom in
  await waitFrames(2);
}
await page.waitForTimeout(600); // let easing complete
await waitFrames(30);
await shot('02-wheel-zoom-in');
console.log('Expect: facade/geometry fills frame, crisp edges (textures blurry ok)');

// ─── Test 3: Drag pan along the facade ────────────────────────────────────────
console.log('\n=== Test 3: Drag pan ===');
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(400, 400, { steps: 20 });
await page.mouse.up();
await waitFrames(10);
await shot('03-drag-pan-left');
console.log('Expect: scene shifted right relative to test 2');

// Pan back to roughly center
await page.mouse.move(400, 400);
await page.mouse.down();
await page.mouse.move(640, 400, { steps: 20 });
await page.mouse.up();
await waitFrames(10);

// ─── Test 4: Rotate while zoomed ──────────────────────────────────────────────
console.log('\n=== Test 4: Rotate while zoomed ===');
// Click the rotate button (slot 0: bottom-right)
await page.click('button[title="Rotate view"]');
await page.waitForTimeout(800);
await waitFrames(30);
await shot('04-rotate-while-zoomed');
console.log('Expect: pivot around current pan target (same area visible after rotate)');

// ─── Test 5: Tap to move while zoomed ─────────────────────────────────────────
console.log('\n=== Test 5: Tap to move while zoomed ===');
// Quick tap on visible ground area
await page.mouse.click(640, 500);
await page.waitForTimeout(300);
await waitFrames(5);
await shot('05-tap-while-zoomed');
console.log('Expect: hero walks (may go off-frame at deep zoom — that is fine)');

// ─── Test 6: Double-click zoom ────────────────────────────────────────────────
console.log('\n=== Test 6: Double-click to zoom in ===');
// First zoom back out fully
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, -200);
  await waitFrames(2);
}
await page.waitForTimeout(800);
await waitFrames(30);

// Double-click to quick-zoom
await page.mouse.dblclick(700, 380);
await page.waitForTimeout(600);
await waitFrames(30);
await shot('06-double-click-zoom-in');
console.log('Expect: zoomed in to ~0.4 centered on clicked point');

// Double-click again to zoom out
await page.mouse.dblclick(700, 380);
await page.waitForTimeout(600);
await waitFrames(30);
await shot('07-double-click-zoom-out');
console.log('Expect: back to full view (matches baseline)');

// ─── Test 7: Corner zoom buttons ──────────────────────────────────────────────
console.log('\n=== Test 7: Corner zoom buttons ===');
await page.click('button[title="Zoom in"]');
await page.waitForTimeout(500);
await waitFrames(30);
await shot('08-button-zoom-in');

await page.click('button[title="Zoom out"]');
await page.waitForTimeout(500);
await waitFrames(30);
await shot('09-button-zoom-out');
console.log('Expect: zoom in then back out');

// ─── Test 8: Full zoom-out returns to standard framing ────────────────────────
console.log('\n=== Test 8: Standard framing after full zoom-out ===');
// Ensure fully zoomed out by wheeling out several times
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, -200);
  await waitFrames(2);
}
await page.waitForTimeout(1000);
await waitFrames(30);
await shot('10-full-zoomout-standard-framing');
console.log('Expect: matches baseline / lap2b standard framing');

// ─── Mobile: note about pinch ─────────────────────────────────────────────────
console.log('\n=== UNTESTED: Pinch-zoom ===');
console.log('Native two-finger pinch cannot be emulated in Playwright without CDP extensions.');
console.log('The pinch code path (zoom.onPinch) shares the same ZoomController as wheel,');
console.log('so the zoom logic is covered by wheel tests. Touch logic is UNTESTED-pinch.');

await browser.close();
console.log('\n=== Playwright verification complete ===');
console.log(`Screenshots saved to: ${SHOTS}/`);
