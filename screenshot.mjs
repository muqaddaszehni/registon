import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/shadow-test.png' });
  console.log('Screenshot saved: /tmp/shadow-test.png');
  process.exit(0);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await browser.close();
}
