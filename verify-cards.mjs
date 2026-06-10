import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  
  // Test portrait mode
  const portraitPage = await browser.newPage({ viewport: { width: 400, height: 800 } });
  await portraitPage.goto('http://localhost:5173');
  
  const portraitBottom = await portraitPage.evaluate(() => {
    const card = document.querySelector('#ui .card');
    return window.getComputedStyle(card).bottom;
  });
  
  const portraitWidth = await portraitPage.evaluate(() => {
    const card = document.querySelector('#ui .card');
    return window.getComputedStyle(card).width;
  });
  
  console.log('PORTRAIT (400x800):');
  console.log(`  bottom: ${portraitBottom}`);
  console.log(`  width: ${portraitWidth}`);
  
  await portraitPage.close();
  
  // Test landscape mode
  const landscapePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await landscapePage.goto('http://localhost:5173');
  
  const landscapeBottom = await landscapePage.evaluate(() => {
    const card = document.querySelector('#ui .card');
    return window.getComputedStyle(card).bottom;
  });
  
  const landscapeWidth = await landscapePage.evaluate(() => {
    const card = document.querySelector('#ui .card');
    return window.getComputedStyle(card).width;
  });
  
  console.log('LANDSCAPE (1280x800):');
  console.log(`  bottom: ${landscapeBottom}`);
  console.log(`  width: ${landscapeWidth}`);
  
  await landscapePage.close();
  await browser.close();
  
  // Check results
  const portraitOk = portraitBottom === '0px' && portraitWidth === '400px';
  const landscapeOk = landscapeBottom === '32px';
  
  process.exit((portraitOk && landscapeOk) ? 0 : 1);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
