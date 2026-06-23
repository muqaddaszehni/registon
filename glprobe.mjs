import { chromium } from 'playwright';
for (const headless of [true, false]) {
  try {
    const b = await chromium.launch({ headless, args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
    const p = await b.newPage();
    await p.goto('http://localhost:5174/', { waitUntil:'domcontentloaded', timeout:15000 });
    const s = await p.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'no-ext';
    });
    console.log(`headless=${headless}: ${s}`);
    await b.close();
  } catch(e){ console.log(`headless=${headless}: ERR ${e.message.split('\n')[0]}`); }
}
