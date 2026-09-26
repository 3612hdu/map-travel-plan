import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/core-audit');
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
const events = { consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], steps: [] };
const redactUrl = url => url.replace(/([?&]key=)[^&]+/gi, '$1[REDACTED]');
page.on('console', msg => { if (msg.type() === 'error') events.consoleErrors.push(msg.text()); });
page.on('pageerror', err => events.pageErrors.push(String(err)));
page.on('requestfailed', req => events.failedRequests.push({ url: redactUrl(req.url()), error: req.failure()?.errorText }));
page.on('response', res => { if (res.status() >= 400) events.httpErrors.push({ status: res.status(), url: redactUrl(res.url()) }); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function snap(name) { await page.screenshot({ path: path.join(out, name), fullPage: false }); }
async function state(label) {
  const value = await page.evaluate(() => {
    const s = window.__tripStore;
    const map = document.querySelector('#amap-root');
    const cards = [...document.querySelectorAll('.route-option-card')].map(el => ({ text: el.innerText.slice(0, 160), chosen: el.classList.contains('chosen') }));
    const stats = document.querySelector('header')?.innerText?.slice(0, 250);
    return { activeDay: s?.activeDay, activeSegmentId: s?.activeSegmentId, selectedOptions: s?.selectedOptions, routeKeys: Object.keys(s?.routeResults || {}), routePaths: Object.fromEntries(Object.entries(s?.routeResults || {}).map(([k, v]) => [k, { distance: v.distance, time: v.time, points: v.path?.length }])), searchQuery: s?.searchQuery, searchScope: s?.searchScope, facilityCount: s?.facilities?.length, activeContentTab: s?.activeContentTab, selectedPoiId: s?.selectedPoiId, waypointCounts: Object.fromEntries(Object.entries(s?.customWaypoints || {}).map(([k,v]) => [k,v.length])), overnightStop: s?.overnightStop?.name, segments: s?.segments?.map(x => ({ id: x.id, title: x.title, day: x.day })), mapCanvas: !!map?.querySelector('canvas'), markerCount: document.querySelectorAll('.amap-marker').length, mapText: map?.innerText?.slice(0, 200), optionCards: cards, header: stats, modal: document.querySelector('.modal-overlay')?.innerText?.slice(0, 250) };
  });
  events.steps.push({ label, value });
  console.log(label, JSON.stringify(value));
}
async function clickText(selector, text) {
  return page.evaluate((selector, text) => {
    const el = [...document.querySelectorAll(selector)].find(x => x.textContent?.includes(text));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, selector, text);
}
try {
  await page.goto('http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#amap-root', { timeout: 10000 });
  await delay(5000);
  await clickText('#btn-day-filter-all', '全程');
  await delay(1200);
  await state('overview');
  await snap('01-overview.png');

  await clickText('.segment-card', '黄冈师范学院');
  await delay(1200);
  await state('ordinary-segment');
  await snap('02-segment-focus.png');

  await clickText('.segment-card', '丹江口 → 郧阳');
  await delay(1200);
  await state('s6-segment');
  await snap('03-route-options.png');
  for (const [i, name] of ['direct', 'scenic', 'compromise'].entries()) {
    await page.evaluate(i => document.querySelectorAll('.route-option-card .btn-opt-select')[i]?.click(), i);
    await delay(1800);
    await state('route-option-' + name);
  }
  await page.evaluate(() => document.querySelectorAll('.route-option-card .btn-opt-select')[1]?.click());
  await delay(1000);
  events.steps.push({ label: 'detail-view-button', value: await page.evaluate(() => [...document.querySelectorAll('button')].filter(x => /详细查看/.test(x.innerText)).map(x => x.innerText)) });

  await page.click('.scope-selector-btn');
  await clickText('button', '全程走廊搜索');
  await page.click('.search-input');
  await page.keyboard.type('酒店');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__tripStore?.facilities?.length > 20, { timeout: 60000 }).catch(() => {});
  await delay(500);
  await state('trip-hotel-search');
  await snap('04-trip-search.png');

  const tripResultCount = await page.evaluate(() => window.__tripStore?.facilities?.length || 0);
  await page.click('.scope-selector-btn');
  await clickText('button', '当前路段沿途');
  await page.click('.search-input');
  await page.keyboard.press('Enter');
  await page.waitForFunction(count => window.__tripStore?.facilities?.length !== count, { timeout: 60000 }, tripResultCount).catch(() => {});
  await delay(500);
  await state('segment-hotel-search');
  await snap('05-segment-search.png');

  await clickText('.right-panel-shared button', '沿途视频');
  await delay(800);
  await state('video-tab');
  await snap('06-video-tab.png');
  await page.evaluate(() => document.querySelector('.video-featured-card')?.click());
  await delay(900);
  await state('video-open');
  await page.evaluate(() => document.querySelector('.modal-close-btn')?.click());

  await clickText('.right-panel-shared button', '沿途设施');
  await delay(1000);
  await state('facility-tab');
  await snap('07-facility-tab.png');
  await page.evaluate(() => document.querySelector('.facility-card-item')?.click());
  await delay(600);
  await state('facility-card-click');
  const markerClick = await page.evaluate(() => {
    const m = document.querySelectorAll('.amap-marker')[1];
    if (!m) return false;
    m.click(); return true;
  });
  events.steps.push({ label: 'marker-click-attempt', value: markerClick });
  await delay(400);
  await state('marker-click');
  await page.evaluate(() => document.querySelector('.facility-card-item .btn-facility-action')?.click());
  await delay(3000);
  await state('add-waypoint');
  await page.evaluate(() => document.querySelector('.facility-card-item .btn-facility-action')?.click());
  await delay(1000);
  await state('remove-waypoint');

  await clickText('#sidebar-overnight-summary-card button', '方案比较');
  await delay(600);
  await state('overnight-modal');
  await snap('08-overnight.png');
  await page.evaluate(() => document.querySelector('.btn-select-overnight')?.click());
  await delay(3000);
  await state('overnight-selected');
  await page.evaluate(() => document.querySelector('#btn-day-filter-all')?.click());
  await delay(800);
  await state('return-overview');
} catch (err) {
  events.fatal = String(err?.stack || err);
  console.error(events.fatal);
} finally {
  fs.writeFileSync(path.join(out, 'browser-evidence.json'), JSON.stringify(events, null, 2));
  await browser.close();
}
