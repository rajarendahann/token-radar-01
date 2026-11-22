import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

async function main() {
  mkdirSync('screenshots', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const indexPath = 'file://' + resolve('out/dashboard/index.html');

  // 1. board.png
  const page1 = await context.newPage();
  await page1.goto(indexPath);
  await page1.waitForLoadState('networkidle');
  await page1.waitForTimeout(1000);
  await page1.screenshot({ path: resolve('screenshots/board.png'), clip: { x: 0, y: 0, width: 1440, height: 1800 } });
  await page1.close();

  // 2. detail.png
  const page2 = await context.newPage();
  await page2.goto(indexPath);
  await page2.waitForLoadState('networkidle');
  await page2.waitForTimeout(1000);
  await page2.click('tbody tr:first-child');
  await page2.waitForSelector('dialog.detail[open], dialog.detail');
  await page2.waitForTimeout(1000);
  await page2.screenshot({ path: resolve('screenshots/detail.png'), clip: { x: 0, y: 0, width: 1440, height: 1800 } });
  await page2.close();

  // 3. filtered.png
  const page3 = await context.newPage();
  await page3.goto(indexPath + '#filter=category:Lending');
  await page3.waitForLoadState('networkidle');
  await page3.waitForTimeout(1000);
  await page3.screenshot({ path: resolve('screenshots/filtered.png'), clip: { x: 0, y: 0, width: 1440, height: 1800 } });
  await page3.close();

  await browser.close();
  console.log('Screenshots captured.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
