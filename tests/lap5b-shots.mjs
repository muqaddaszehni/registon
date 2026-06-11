/**
 * Lap 5b screenshot verification.
 * Usage: node tests/lap5b-shots.mjs
 * Requires: preview server running on port 5210
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:5210';
const OUT  = '.superpowers/finals';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[PAGE]', m.text()); });
page.on('pageerror', e => console.error('[PAGEERROR]', e.message));

const shot = async (name) => {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  -> ${path}`);
  return path;
};

const frames = async (n = 8) => {
  for (let i = 0; i < n; i++)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
};

// ── Load ─────────────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// Dismiss intro overlay
await page.mouse.click(720, 450);
await page.waitForTimeout(600);
await frames(20);

// ── R0 default overview ──────────────────────────────────────────────────────
console.log('R0: default overview');
await shot('lap5b-r0-overview');

// ── Zoom into UB left wing ───────────────────────────────────────────────────
console.log('Zoom: UB wing');
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
await shot('lap5b-ub-wing-zoom');

// ── Zoom out, rotate once (R1) ───────────────────────────────────────────────
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
// rotate
const rotBtn = page.locator('[title*="Rotate"], button:has-text("↻"), button:has-text("⟳")').first();
if (await rotBtn.count() > 0) {
  await rotBtn.click(); await page.waitForTimeout(1200); await frames(20);
} else {
  // keyboard R
  await page.keyboard.press('r'); await page.waitForTimeout(1200); await frames(20);
}
await shot('lap5b-r1-full');

// ── Rotate to R2 ─────────────────────────────────────────────────────────────
if (await rotBtn.count() > 0) {
  await rotBtn.click(); await page.waitForTimeout(1200); await frames(20);
} else {
  await page.keyboard.press('r'); await page.waitForTimeout(1200); await frames(20);
}
await shot('lap5b-r2-full');

// ── Zoom into TK wing from R2 ────────────────────────────────────────────────
console.log('Zoom: TK wing detail');
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
await shot('lap5b-tk-wing-zoom');

// ── Rotate to R3 ─────────────────────────────────────────────────────────────
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
if (await rotBtn.count() > 0) {
  await rotBtn.click(); await page.waitForTimeout(1200); await frames(20);
} else {
  await page.keyboard.press('r'); await page.waitForTimeout(1200); await frames(20);
}
await shot('lap5b-r3-full');

// ── Zoom into SD wing from R3 ────────────────────────────────────────────────
console.log('Zoom: SD wing detail');
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
await shot('lap5b-sd-wing-zoom');

// ── Back to overview ─────────────────────────────────────────────────────────
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -200); await frames(2); }
await page.waitForTimeout(600); await frames(20);
// rotate back to R0
if (await rotBtn.count() > 0) {
  await rotBtn.click(); await page.waitForTimeout(1200); await frames(20);
} else {
  await page.keyboard.press('r'); await page.waitForTimeout(1200); await frames(20);
}
await shot('lap5b-final-overview');

await browser.close();
console.log('\nDone. Screenshots in .superpowers/finals/');
