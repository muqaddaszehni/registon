import { chromium } from 'playwright';
const PORT = process.env.PORT || 5173;
const flag = process.argv[2] || '';
const b = await chromium.launch({ args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
await p.goto(`http://localhost:${PORT}/${flag}`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(5000);
const fps=[],cpu=[],frame=[];
for (let i=0;i<16;i++){ await p.waitForTimeout(250); const x=await p.evaluate(()=>window.__perf); if(x){fps.push(x.fps);cpu.push(x.cpuMs);frame.push(x.frameMs);} }
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
console.log(`${flag||'(post)'}: fps≈${avg(fps).toFixed(1)}  cpuMs≈${avg(cpu).toFixed(2)}  frameMs≈${avg(frame).toFixed(1)}`);
await b.close();
