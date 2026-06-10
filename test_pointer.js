const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.card', { timeout: 5000 });
    
    const pointerEvents = await page.evaluate(() => {
      const card = document.querySelector('.card');
      return window.getComputedStyle(card).pointerEvents;
    });
    
    console.log('Computed pointer-events:', pointerEvents);
    
    if (pointerEvents === 'none') {
      console.log('SUCCESS: pointer-events is none when card is closed');
      process.exit(0);
    } else {
      console.log('FAILURE: pointer-events should be none but is', pointerEvents);
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
