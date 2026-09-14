import { chromium } from 'playwright';
const URL = `http://localhost:4321/c/master-property/keandra-park-cluster-aranda`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let fail = 0;
const check = (n, c, e = '') => (c ? console.log('PASS', n) : (fail++, console.log('FAIL', n, e)));
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'astro-dev-toolbar, astro-dev-overlay { display: none !important; }' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'astro-dev-toolbar, astro-dev-overlay { display: none !important; }' });
await page.waitForTimeout(300);

const visible = () => page.evaluate(() => {
  const el = document.getElementById('photo-expand');
  return !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
});

check('visible on load (sheet closed)', await visible());

// open sheet -> hidden
await page.locator('button[data-start-wizard]').first().click();
await page.waitForTimeout(500);
check('hidden when sheet opens', !(await visible()));

// input -> result state, still hidden
await page.locator('#income').fill('20000000');
await page.locator('#existing').fill('600000');
await page.locator('#expenses').fill('5850000');
await page.locator('#step1-next').click();
await page.waitForTimeout(500);
check('hidden in result state', !(await visible()));

// Esc close -> visible again
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
check('visible again after close (Esc)', await visible());

// reopen via other trigger, close via sheet-close button
await page.locator('button[data-start-wizard]').first().click();
await page.waitForTimeout(400);
check('hidden after reopen', !(await visible()));
await page.locator('#sheet-close').click();
await page.waitForTimeout(500);
check('visible after close button', await visible());

await browser.close();
console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILURES`);
