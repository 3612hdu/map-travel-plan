import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

// UI regression checks intentionally isolate third-party map APIs.
// Run against Vite, or set APP_URL to check the deployed build.
const url = process.env.APP_URL || 'http://127.0.0.1:5183/';
if (!process.env.APP_URL) {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { stdio: 'ignore', windowsHide: true });
  process.on('exit', () => server.kill());
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    if (server.exitCode !== null) throw new Error('Could not start the test server on port 5183');
    try { ready = (await fetch(url)).ok; } catch {}
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'Test server did not become ready');
  // The browser checks are the only work that should keep this process alive.
  server.unref();
}
const origin = new URL(url).origin;
const screenshotDir = path.join(os.tmpdir(), 'map-travel-scroll-qa');
fs.mkdirSync(screenshotDir, { recursive: true });
const browsers = [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
].filter(([, executable]) => fs.existsSync(executable));
assert(browsers.length, 'A supported browser must be installed');

async function clickText(page, selector, text) {
  const elements = await page.$$(selector);
  for (const element of elements) {
    if ((await element.evaluate((node) => node.textContent)).includes(text)) {
      await element.click();
      return;
    }
  }
  throw new Error(`Missing ${selector}: ${text}`);
}

async function reachableBottom(page, selector, touch = false) {
  const metrics = await page.$eval(selector, (element) => {
    element.scrollTop = 0;
    const rect = element.getBoundingClientRect();
    const nav = document.querySelector('.mobile-bottom-nav');
    const limit = !element.closest('[role="dialog"]') && nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
    return { top: rect.top, bottom: rect.bottom, x: rect.right - 16, height: rect.height,
      overflow: element.scrollHeight - element.clientHeight, limit };
  });
  assert(metrics.height > 40, `${selector}: usable height`);
  assert(metrics.top >= 0 && metrics.bottom <= metrics.limit + 1, `${selector}: clipped outside viewport`);
  if (metrics.overflow > 2) {
    if (touch) {
      const session = await page.createCDPSession();
      const start = metrics.bottom - 12;
      const distance = Math.min(metrics.height - 24, 160);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: metrics.x, y: start }] });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: metrics.x, y: start - distance * step / 6 }] });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction((s) => document.querySelector(s).scrollTop > 0, {}, selector);
      await session.detach();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await page.mouse.move(metrics.x, metrics.top + metrics.height / 2);
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.mouse.wheel({ deltaY: 600 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (await page.$eval(selector, (element) => element.scrollHeight - element.clientHeight - element.scrollTop < 2)) break;
    }
    await page.waitForFunction((s) => {
      const element = document.querySelector(s);
      return element.scrollHeight - element.clientHeight - element.scrollTop < 2;
    }, {}, selector).catch(async (error) => {
      console.log('Scroll failure', selector, metrics, await page.$eval(selector, (element) => ({ top: element.scrollTop, client: element.clientHeight, scroll: element.scrollHeight })),
        await page.evaluate(({ x, top, height }) => document.elementFromPoint(x, top + height / 2)?.outerHTML.slice(0, 400), metrics));
      await page.screenshot({ path: path.join(screenshotDir, 'scroll-failure.png') });
      throw error;
    });
  }
  assert(await page.$eval(selector, (element) => {
    const last = element.lastElementChild;
    return !last || last.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1;
  }), `${selector}: final content remains unreachable`);
}

let checkedBrowsers = 0;
for (const [browserName, executablePath] of browsers) {
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  } catch (error) {
    console.warn(`SKIP ${browserName}: browser could not launch (${error.message.split('\n')[0]})`);
    continue;
  }
  checkedBrowsers++;
  try {
    for (const [width, height] of [[375, 667], [844, 390], [768, 1024], [1440, 700]]) {
      const mobile = width <= 1024;
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      await page.setViewport({ width, height, hasTouch: mobile });
      await page.setRequestInterception(true);
      page.on('request', (request) => request.url().startsWith(origin + '/') ? request.continue() : request.abort());
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__tripStore);
      assert.equal(await page.evaluate(() => window.__tripStore.mapMode), 'trip-overview');
      await page.evaluate(() => window.__tripStore.enterSegmentDetail('s6'));
      await reachableBottom(page, '.center-bottom-panel', mobile);

      await page.evaluate(() => window.__tripStore.setActiveDay('all'));
      if (mobile) await page.click('#btn-mobile-nav-media');
      await page.waitForSelector('[data-media-id="photo-s1-macheng"]');
      assert((await page.$$('[data-media-id]')).length > 6, 'Overview must include multiple segments');
      const filterTop = await page.$eval('.category-filter-bar', (element) => element.getBoundingClientRect().top);
      await reachableBottom(page, '.video-content-wrapper', mobile);
      assert.equal(await page.$eval('.category-filter-bar', (element) => element.getBoundingClientRect().top), filterTop);
      assert(await page.$$eval('.category-filter-bar .filter-pill', (buttons) => buttons.every((button) => {
        const rect = button.getBoundingClientRect(), parent = button.parentElement.getBoundingClientRect();
        return rect.top >= parent.top && rect.bottom <= parent.bottom;
      })), 'Media filters must not be vertically squeezed');
      await page.click('[data-media-id]:last-child');
      await page.waitForSelector('[role="dialog"] .modal-body');
      await reachableBottom(page, '.modal-body', mobile);
      await page.click('.modal-close-btn');
      assert((await page.$$('[data-media-id]')).length > 6, 'Closing media must preserve full-trip scope');
      await clickText(page, '.panel-tab-btn', '沿途设施');
      if (mobile) assert.equal(await page.evaluate(() => window.__tripStore.mobileActiveTab), 'facilities');

      if (mobile) await page.click('#btn-mobile-nav-trip');
      await clickText(page, '.sidebar-nav-tabs button', '周边推荐');
      assert((await page.$$('.recommendation-card')).length >= 10, 'Recommendations contain route stops');
      await page.type('.recommendation-search', '凉水河');
      assert.equal((await page.$$('.recommendation-card')).length, 1);
      await page.click('.recommendation-save');
      await clickText(page, '.sidebar-nav-tabs button', '行程收藏');
      assert.equal((await page.$$('.recommendation-card')).length, 1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__tripStore);
      if (mobile) await page.click('#btn-mobile-nav-trip');
      await clickText(page, '.sidebar-nav-tabs button', '行程收藏');
      assert.equal((await page.$$('.recommendation-card')).length, 1, 'Favorite survives reload');
      await page.evaluate(() => window.__tripStore.selectRouteOption('s6', 'direct'));
      assert.match(await page.$eval('.recommendation-meta', (element) => element.textContent), /备选途经点/);
      await clickText(page, '.recommendation-actions button', '本段餐饮');
      const facilityState = await page.evaluate(() => ({ segment: window.__tripStore.activeSegmentId, category: window.__tripStore.selectedCategory, content: window.__tripStore.activeContentTab }));
      assert.deepEqual(facilityState, { segment: 's6', category: 'food', content: 'facilities' });
      if (mobile) await page.click('#btn-mobile-nav-trip');
      await clickText(page, '.recommendation-actions button', '本段影像');
      assert.equal(await page.evaluate(() => window.__tripStore.activeContentTab), 'videos');
      if (mobile) await page.click('#btn-mobile-nav-trip');
      await page.evaluate(() => { window.open = (target) => { window.__navigationTarget = target; return null; }; });
      await clickText(page, '.recommendation-actions button', '导航到参考点');
      const navigation = new URL(await page.evaluate(() => window.__navigationTarget));
      assert.equal(navigation.hostname, 'uri.amap.com');
      assert.match(navigation.searchParams.get('to'), /凉水河/);
      await clickText(page, '.recommendation-actions button', '地图定位');
      assert.equal(await page.evaluate(() => window.__tripStore.mapMode), 'segment-focus');
      if (mobile) await page.click('#btn-mobile-nav-trip');
      await page.click('.recommendation-save');
      assert.equal((await page.$$('.recommendation-card')).length, 0);
      await page.click('#btn-day-filter-all');
      await clickText(page, '.sidebar-nav-tabs button', '周边推荐');
      await page.evaluate(() => window.__tripStore.selectRouteOption('s6', 'scenic'));
      await reachableBottom(page, '.sidebar-content-scroll', mobile);
      await page.$eval('.sidebar-content-scroll', (element) => { element.scrollTop = 0; });
      await page.screenshot({ path: path.join(screenshotDir, `${browserName}-${width}-recommendations.png`) });
      await clickText(page, '.sidebar-nav-tabs button', '行程规划');
      await page.click('#btn-day-filter-2');
      assert.equal((await page.$$('.segment-card')).length, 3, 'Day filter must filter route cards');
      await page.evaluate(() => localStorage.setItem('map-travel-plan:saved-recommendations:v1', '{broken-json'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.__tripStore);
      assert.deepEqual(await page.evaluate(() => window.__tripStore.savedRecommendationIds), [], 'Invalid saved data must not break startup');
      console.log(`PASS ${browserName} ${width}x${height}: scroll, media modal, recommendations, favorites, navigation, day filter`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
assert(checkedBrowsers > 0, 'No browser could run the regression checks');
console.log(`Screenshots: ${screenshotDir}`);
