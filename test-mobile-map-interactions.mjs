import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

// Real map interaction checks; APP_URL can target the published Pages build.
const url = process.env.APP_URL || 'http://127.0.0.1:5185/';
const screenshots = path.join(os.tmpdir(), 'map-travel-mobile-interactions');
fs.mkdirSync(screenshots, { recursive: true });
let server;
let browser;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function swipe(page, selector, distance) {
  const box = await page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + Math.min(18, rect.height / 2) };
  });
  const session = await page.createCDPSession();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
  for (let step = 1; step <= 8; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.y + distance * step / 8 }] });
    await pause(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await pause(240);
}

async function openStartNode(page) {
  await pause(300);
  const markers = await page.$$('.trip-node-marker');
  for (const marker of markers) {
    if ((await marker.evaluate((element) => element.textContent)).includes('黄冈师范学院')) {
      await marker.click();
      await page.waitForSelector('.trip-node-actions', { visible: true }).catch(async (error) => {
        await page.screenshot({ path: path.join(screenshots, 'popup-failure.png') });
        throw error;
      });
      await pause(500);
      return;
    }
  }
  throw new Error('Start marker missing');
}

try {
  if (!process.env.APP_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5185', '--strictPort'], { stdio: 'ignore', windowsHide: true });
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      try { ready = (await fetch(url)).ok; } catch {}
      if (!ready) await pause(100);
    }
    assert(ready, 'Test server did not start');
  }
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  for (const [width, height] of [[390, 844], [375, 667], [844, 390], [1440, 900]]) {
    const mobile = width <= 1024;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const s = window.__tripStore;
      return s && s.segments.every((seg) => s.routeResults[`${seg.id}:${s.selectedOptions[seg.id] || seg.chosen}`]?.path.length > 1);
    }, { timeout: 45000 });
    await pause(400);
    assert.equal(await page.$('.route-options-grid'), null);
    if (mobile) {
      const expanded = await page.$eval('.map-detail-sheet', (element) => element.clientHeight);
      await swipe(page, '.map-sheet-handle', Math.min(170, expanded - 45));
      assert(await page.$eval('.map-detail-sheet', (element) => element.clientHeight <= 36), 'Swipe down must collapse to handle only');
      await page.screenshot({ path: path.join(screenshots, `${width}-collapsed.png`) });
      await swipe(page, '.map-sheet-handle', -Math.min(220, height / 2));
      assert(Math.abs(await page.$eval('.map-detail-sheet', (element) => element.clientHeight) - expanded) <= 1, 'Swipe up restores original maximum height');
      await swipe(page, '.map-sheet-handle', -Math.min(150, height / 4));
      assert(Math.abs(await page.$eval('.map-detail-sheet', (element) => element.clientHeight) - expanded) <= 1, 'Cannot expand above original height');
      await swipe(page, '.center-bottom-panel', -Math.min(120, height / 4));
      assert(await page.$eval('.center-bottom-panel', (element) => element.scrollTop > 0), 'Content must still scroll independently');
      await page.click('.map-sheet-handle');
      await page.waitForFunction(() => document.querySelector('.map-sheet-handle').getAttribute('aria-expanded') === 'false');
      await pause(240);
    }
    await openStartNode(page);
    const popup = await page.$eval('.trip-node-actions', (element) => {
      const rect = element.getBoundingClientRect();
      return { buttons: [...element.querySelectorAll('button')].map((button) => button.textContent), images: element.querySelectorAll('img').length, width: rect.width, left: rect.left, right: rect.right };
    });
    assert.deepEqual(popup.buttons, ['查看此路段', '周边设施', '周边影像']);
    assert.equal(popup.images, 0);
    await page.screenshot({ path: path.join(screenshots, `${width}-popup.png`) });
    assert(popup.width >= 200 && popup.left >= 0 && popup.right <= width, `Popup must fit screen without squeezed labels: ${JSON.stringify(popup)}`);
    await page.click('#btn-node-view-media');
    await page.waitForSelector('.media-scope-summary', { visible: true });
    assert.equal(await page.evaluate(() => window.__tripStore.activeSegmentId), 's1');
    assert.match(await page.$eval('.media-scope-summary', (element) => element.textContent), /黄冈师范学院/);
    if (mobile) {
      assert.equal(await page.evaluate(() => window.__tripStore.mobileActiveTab), 'media');
      await page.click('#btn-mobile-nav-map');
    }
    await openStartNode(page);
    await page.click('#btn-node-search-facilities');
    await page.waitForSelector('.facilities-tab-content', { visible: true });
    assert.deepEqual(await page.evaluate(() => ({ segment: window.__tripStore.activeSegmentId, scope: window.__tripStore.searchScope, query: window.__tripStore.searchQuery, tab: window.__tripStore.activeContentTab })), { segment: 's1', scope: 'segment', query: '', tab: 'facilities' });
    if (mobile) {
      assert.equal(await page.evaluate(() => window.__tripStore.mobileActiveTab), 'facilities');
      await page.click('#btn-mobile-nav-map');
      await page.click('.map-sheet-handle');
      await pause(240);
    }
    await openStartNode(page);
    await page.click('#btn-node-view-segment');
    await page.waitForSelector('.route-options-grid', { visible: true });
    if (mobile) assert.equal(await page.$eval('.map-sheet-handle', (element) => element.getAttribute('aria-expanded')), 'true');
    console.log(`PASS ${width}x${height}: compact popup, segment/media/facility links${mobile ? ', touch collapse/expand, height limit, content scrolling, auto expansion' : ''}`);
    await context.close();
  }
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  server?.kill();
}
