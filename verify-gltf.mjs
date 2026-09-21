// verify-gltf.mjs — compare the procedural scene against the `?gltf` build.
// Starts a vite dev server, opens the page twice (with/without ?gltf), reads
// window.__perf, screenshots both to docs/screenshots/, prints a comparison.
// Exit code: 0 unless a page throws an uncaught error (or the harness fails).
//
// Usage: node verify-gltf.mjs            (uses a fresh vite on PORT, default 5199)
//        PORT=5173 node verify-gltf.mjs  (attaches to an already-running server if it answers)

import { launchChromium } from './harness/browser.mjs';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(ROOT, 'docs/screenshots');
const PORT = Number(process.env.PORT || 5199);
const URL = `http://localhost:${PORT}/`;
const SETTLE_MS = 4000;      // wait after load (intro + LOD settle)
const LAUNCH_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
mkdirSync(OUT, { recursive: true });

// ---------- vite ----------
async function alreadyUp() {
  try { const r = await fetch(URL, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

let vite = null;
async function startVite() {
  if (await alreadyUp()) { console.log(`[vite] reusing server on ${URL}`); return; }
  const bin = resolve(ROOT, 'node_modules/.bin/vite');
  vite = spawn(bin, ['--port', String(PORT), '--strictPort', '--host', 'localhost'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' },
  });
  let log = '';
  vite.stdout.on('data', d => { log += d; });
  vite.stderr.on('data', d => { log += d; });
  const exited = new Promise(r => vite.once('exit', code => r(code)));
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    if (await alreadyUp()) { console.log(`[vite] ready on ${URL} (${Date.now() - t0}ms)`); return; }
    const code = await Promise.race([exited, new Promise(r => setTimeout(() => r(null), 300))]);
    if (code !== null) throw new Error(`vite exited early with code ${code}\n${log}`);
  }
  throw new Error(`vite did not become ready within 20s\n${log}`);
}
function stopVite() { if (vite && !vite.killed) { vite.kill('SIGTERM'); vite = null; } }

// ---------- one run ----------
async function run(browser, name, query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const console_ = [], errors = [], failed = [];
  page.on('console', m => console_.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  const url = URL + query;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(SETTLE_MS);

  // a few samples so fps is a settled average rather than one EMA read
  const samples = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(250);
    const p = await page.evaluate(() => window.__perf ? { ...window.__perf } : null);
    if (p) samples.push(p);
  }
  const perf = samples.at(-1);
  const fps = samples.length ? samples.reduce((s, p) => s + p.fps, 0) / samples.length : NaN;

  const shot = resolve(OUT, `verify-${name}.png`);
  await page.screenshot({ path: shot });
  await page.close();

  const loaded = console_.find(t => /\[gltf\]\s*loaded/i.test(t)) || null;
  const fallback = console_.find(t => /\[gltf\].*(fallback|falling back|failed|not found|procedural)/i.test(t)) || null;
  const glbFail = failed.find(t => /\.glb/i.test(t)) || null;
  return { name, url, perf, fps, shot, loaded, fallback, glbFail, errors, console: console_ };
}

// ---------- main ----------
let exitCode = 0;
let browser;
try {
  await startVite();
  browser = await launchChromium({ args: LAUNCH_ARGS });
  const runs = [];
  for (const [name, query] of [['procedural', ''], ['gltf', '?gltf']]) {
    console.log(`\n[run] ${name}  ${URL}${query}`);
    const r = await run(browser, name, query);
    runs.push(r);
    console.log(`  saved ${r.shot}`);
    if (!r.perf) console.log('  WARN: window.__perf not found');
    if (r.errors.length) console.log('  EXC: ' + r.errors.join(' | '));
  }

  // comparison table
  const fmt = v => (v == null || Number.isNaN(v)) ? 'n/a' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));
  const rows = [
    ['metric', ...runs.map(r => r.name)],
    ['draw calls', ...runs.map(r => fmt(r.perf?.calls))],
    ['triangles', ...runs.map(r => fmt(r.perf?.tris))],
    ['fps (avg)', ...runs.map(r => fmt(r.fps))],
    ['frameMs', ...runs.map(r => fmt(r.perf?.frameMs))],
    ['cpuMs', ...runs.map(r => fmt(r.perf?.cpuMs))],
    ['[gltf] loaded', ...runs.map(r => r.loaded ? 'yes' : 'no')],
    ['[gltf] fallback', ...runs.map(r => r.fallback ? 'yes' : 'no')],
    ['page errors', ...runs.map(r => String(r.errors.length))],
  ];
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => r[i].length)));
  console.log('');
  rows.forEach((r, i) => {
    console.log(r.map((c, j) => c.padEnd(w[j])).join('  '));
    if (i === 0) console.log(w.map(n => '-'.repeat(n)).join('  '));
  });

  const g = runs.find(r => r.name === 'gltf');
  console.log('');
  if (g.loaded) console.log(`GLB run: ${g.loaded}`);
  else {
    console.log('NOTE: the ?gltf run did NOT report "[gltf] loaded" — it fell back to procedural geometry.');
    if (g.fallback) console.log('  console: ' + g.fallback);
    if (g.glbFail) console.log('  request: ' + g.glbFail);
    if (!g.fallback && !g.glbFail) console.log('  (no [gltf] console line at all — is the ?gltf flag wired up yet?)');
  }
  for (const r of runs) {
    const gl = r.console.filter(t => t.includes('[gltf]'));
    if (gl.length) console.log(`${r.name} [gltf] console: ${gl.join(' | ')}`);
  }

  if (runs.some(r => r.errors.length)) {
    exitCode = 1;
    console.log('\nFAIL: uncaught page error(s):');
    runs.forEach(r => r.errors.forEach(e => console.log(`  [${r.name}] ${e}`)));
  }
} catch (e) {
  console.error('HARNESS ERROR:', e.stack || e.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  stopVite();
}
process.exit(exitCode);
