const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3001/login');
  await page.waitForSelector('.role-card', { timeout: 10000 });
  const roleCards = await page.$$('.role-card');
  for (const card of roleCards) {
    const text = await card.textContent();
    if (text.includes('Cashier') || text.includes('Branch Manager')) {
      await card.click();
      await page.waitForTimeout(1000);
      const staffCards = await page.$$eval('.role-card', els => els.map(el => el.textContent));
      console.log(`Staff inside ${text}:`, staffCards);
      const backBtn = await page.$('button:has-text("Change Role")');
      if (backBtn) await backBtn.click();
      await page.waitForTimeout(1000);
    }
  }
  await browser.close();
})();
