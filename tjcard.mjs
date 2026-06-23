import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.addInitScript(()=>localStorage.setItem('lang','tj'));
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
await p.evaluate(()=>window.__cards.show(1)); // Ulugh Beg — longest TJ body
await p.waitForTimeout(1500);
await p.screenshot({ path:'/tmp/tjcard.png' });
const m = await p.evaluate(()=>{ const f=document.querySelector('.card .frame'); return { scrolls: f.scrollHeight>f.clientHeight+1, sh:f.scrollHeight, ch:f.clientHeight }; });
console.log(JSON.stringify(m));
await b.close();
