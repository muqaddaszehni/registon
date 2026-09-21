// Shared Chromium launcher for the root-level harness scripts.
//
// The installed playwright may expect a newer Chromium build than the one
// pre-installed under PLAYWRIGHT_BROWSERS_PATH (default /opt/pw-browsers).
// launchChromium() tries the normal playwright launch first and, only when it
// fails with "Executable doesn't exist", falls back to the newest
// chromium*/chrome-linux/{chrome,headless_shell,chrome-headless-shell} it can
// find there. CHROMIUM_PATH overrides everything. It never runs
// `playwright install`.
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dirs = existsSync(base) ? readdirSync(base).filter(d => /^chromium/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    for (const bin of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-linux/chrome-headless-shell']) {
      const p = resolve(base, d, bin);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export async function launchChromium(extraOptions = {}) {
  if (process.env.CHROMIUM_PATH) {
    console.log(`[browser] using CHROMIUM_PATH=${process.env.CHROMIUM_PATH}`);
    return chromium.launch({ ...extraOptions, executablePath: process.env.CHROMIUM_PATH });
  }
  try {
    return await chromium.launch(extraOptions);
  } catch (e) {
    if (!/Executable doesn't exist/i.test(String(e && e.message))) throw e;
    const p = findChromium();
    if (!p) throw e;
    console.log(`[browser] playwright's bundled Chromium is missing; using ${p}`);
    return chromium.launch({ ...extraOptions, executablePath: p });
  }
}
