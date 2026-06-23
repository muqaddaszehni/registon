import { chromium } from 'playwright';

const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('EXC: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('ERR: ' + m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3500);

// Turn music on (creates + resumes the shared AudioContext)
await page.locator('[aria-label="Music"]').click();
await page.waitForTimeout(2500);

const music = await page.evaluate(async () => {
  const ctx = window.__audioCtx, mg = window.__masterGain;
  if (!ctx || !mg) return { err: 'no audio graph' };
  const an = ctx.createAnalyser(); an.fftSize = 2048;
  mg.connect(an);
  // Sparse plucks → sample peak RMS over ~5 s rather than one window.
  let peak = 0;
  for (let s = 0; s < 25; s++) {
    await new Promise(r => setTimeout(r, 200));
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += v * v;
    peak = Math.max(peak, Math.sqrt(sum / buf.length));
  }
  return { state: ctx.state, gain: +mg.gain.value.toFixed(4), peakRms: +peak.toFixed(5) };
});
console.log('MUSIC:', JSON.stringify(music));

// Exercise the bird-scatter SFX directly via the live audio module.
const bird = await page.evaluate(async () => {
  try {
    const mod = await import('/src/audio.ts');
    if (typeof mod.playBirdScatter !== 'function') return { err: 'no playBirdScatter export' };
    mod.playBirdScatter();
    await new Promise(r => setTimeout(r, 100));
    mod.playBirdScatter(); // 2nd call within cooldown → should no-op without error
    return { ok: true };
  } catch (e) { return { err: String(e) }; }
});
console.log('BIRD:', JSON.stringify(bird));
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
