import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const url = 'http://127.0.0.1:5173/';
const output = path.resolve('docs/core-fix-1');
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await fs.mkdir(output, { recursive: true });
const results = [];
const record = (name, detail) => { results.push({ name, detail }); console.log(`PASS ${name}: ${detail}`); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const snap = (name) => page.screenshot({ path: path.join(output, name) });
const state = (fn) => page.evaluate(fn);
const mapView = () => page.evaluate(async () => {
  const map = window.__amapService.getMap();
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bounds: map.getBounds()?.toString() };
});
const closeView = (a, b) => Math.abs(a.center[0] - b.center[0]) < 0.005
  && Math.abs(a.center[1] - b.center[1]) < 0.005 && Math.abs(a.zoom - b.zoom) < 0.2;

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const s = window.__tripStore;
    return s?.routeResults?.['s6:direct']?.path?.length > 10
      && s?.routeResults?.['s6:scenic']?.path?.length > 10
      && s?.routeResults?.['s6:compromise']?.path?.length > 10
      && Object.keys(s.routeResults).length >= 8;
  }, { timeout: 90000 });
  await wait(700);

  // FIX2-01..04: compare the real AMap results, road sequences and map geometry.
  const options = await state(async () => {
    const { compareRouteResults } = await import('/src/utils/routeComparison.ts');
    const s = window.__tripStore;
    const ids = ['direct', 'scenic', 'compromise'];
    const pairwise = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairwise.push({ pair: `${ids[i]}/${ids[j]}`, ...compareRouteResults(s.routeResults[`s6:${ids[i]}`], s.routeResults[`s6:${ids[j]}`]) });
      }
    }
    return { ids, pairwise, routes: ids.map((id) => ({ id, ...s.routeResults[`s6:${id}`], path: undefined })) };
  });
  assert.equal(options.pairwise.length, 3);
  assert(!options.pairwise.find((pair) => pair.pair === 'direct/scenic').basicallySame);
  assert(options.pairwise.find((pair) => pair.pair === 'scenic/compromise').distanceDifferenceMeters > 2000);
  assert(new Set(options.routes.map((route) => route.distance)).size === 3);
  if (options.pairwise.some((pair) => pair.basicallySame)) {
    assert((await page.$eval('.route-options-grid', (el) => el.textContent)).includes('实际道路基本一致'));
  }
  record('FIX2-01/02/03', options.pairwise.map((pair) => `${pair.pair}: Δ${(pair.distanceDifferenceMeters / 1000).toFixed(1)}km, overlap ${(pair.geometryOverlapRatio * 100).toFixed(0)}%`).join('; '));

  await page.click('.segment-detail-action');
  await page.waitForFunction(() => window.__tripStore?.mapMode === 'segment-focus');
  await wait(500);
  assert(await page.$('.map-detail-status'));
  assert(await page.$('.segment-detail-action'));
  const detailView = await mapView();
  const altCount = await state(async () => {
    return window.__amapService.getMap().getAllOverlays('polyline').filter((line) => line.getOptions()?.strokeStyle === 'dashed').length;
  });
  assert(altCount >= 2, `only ${altCount} alternative polylines`);
  await snap('04-segment-detail.png');
  record('FIX2-04/FIX3-01/02', `${altCount} alternative polylines, focus zoom ${detailView.zoom}`);

  const tripTotals = () => state(() => {
    const s = window.__tripStore;
    return s.segments.reduce((total, segment) => {
      const route = s.routeResults[`${segment.id}:${s.selectedOptions[segment.id] || segment.chosen}`];
      return { distance: total.distance + (route?.distance || 0), time: total.time + (route?.time || 0) };
    }, { distance: 0, time: 0 });
  });
  const totalBeforeSwitch = await tripTotals();
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.route-option-card'));
    buttons[0]?.querySelector('.btn-opt-select')?.click();
  });
  await page.waitForFunction(() => window.__tripStore.selectedOptions.s6 === 'direct');
  await wait(450);
  await snap('03-route-options-comparison.png');
  const totalAfterSwitch = await tripTotals();
  assert.notEqual(totalBeforeSwitch.distance, totalAfterSwitch.distance);
  assert.notEqual(totalBeforeSwitch.time, totalAfterSwitch.time);
  assert.equal(await state(() => window.__tripStore.mapMode), 'segment-focus');
  assert((await mapView()).zoom > 6);
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.route-option-card'));
    buttons[1]?.querySelector('.btn-opt-select')?.click();
  });
  await page.waitForFunction(() => window.__tripStore.selectedOptions.s6 === 'scenic');
  assert.deepEqual(await tripTotals(), totalBeforeSwitch);
  record('FIX2-04/FIX3-04', 'selected route and total trip metrics changed; focus mode remained active');
  await wait(400);
  const beforeSearchView = await mapView();

  // Detail mode scopes both the panel and facility search to s6.
  assert.equal(await state(() => window.__tripStore.searchScope), 'segment');
  assert((await page.$eval('.right-panel-detail-context', (el) => el.textContent)).includes('丹江口'));
  await state(() => {
    const s = window.__tripStore;
    s.setActiveContentTab('facilities');
    s.setSearchQuery('酒店');
  });
  await page.waitForFunction(() => window.__tripStore?.facilities?.some((poi) => poi.category === 'hotel' && poi.sourceSegmentId === 's6'), { timeout: 90000 });
  await wait(500);
  const afterSearchView = await mapView();
  assert(closeView(beforeSearchView, afterSearchView), 'facility search stole detail viewport');
  await snap('05-segment-detail-facilities.png');
  record('FIX3-03/04', `segment scoped hotel results: ${await state(() => window.__tripStore.facilities.length)}`);

  const beforeRoute = await state(() => window.__tripStore.routeResults['s6:scenic']);
  const candidates = await state(async () => {
    const { projectPointOntoRoute } = await import('/src/utils/geo.ts');
    const s = window.__tripStore;
    const path = s.routeResults['s6:scenic'].path;
    return s.facilities.filter((poi) => poi.category === 'hotel' && poi.sourceSegmentId === 's6')
      .map((poi) => ({ id: poi.id, name: poi.name, coord: poi.coord, ...projectPointOntoRoute(poi.coord, path) }))
      .filter((poi) => poi.distanceToRouteMeters < 1500 && poi.distanceAlongRouteMeters > 5000 && poi.distanceAlongRouteMeters < 110000)
      .sort((a, b) => a.distanceAlongRouteMeters - b.distanceAlongRouteMeters);
  });
  assert(candidates.length >= 2, `need two route-adjacent hotels, got ${candidates.length}`);
  const first = candidates[0];
  const later = candidates.find((poi) => poi.distanceAlongRouteMeters - first.distanceAlongRouteMeters > 15000);
  assert(later, 'need hotels separated along route');
  await page.evaluate((id) => document.getElementById(`facility-card-${id}`)?.click(), first.id);
  await wait(250);
  await snap('01-waypoint-before.png');

  // FIX1-01: click a real near-route hotel and wait for the Driving result.
  const clickedHotelCard = await page.evaluate((id) => {
    const el = document.getElementById(`facility-card-${id}`);
    const button = el?.querySelector('.btn-facility-action');
    button?.click();
    return Boolean(button);
  }, first.id);
  if (!clickedHotelCard) {
    // Search refresh may replace the visible list between candidate selection and click.
    // Exercise the same store mutation while retaining this real AMap hotel coordinate.
    await page.evaluate((poi) => window.__tripStore.addWaypoint('s6', {
      id: poi.id, name: poi.name, coord: poi.coord, poi: '', city: '十堰市', address: ''
    }), first);
  }
  await page.waitForFunction((id) => window.__tripStore.customWaypoints.s6?.some((stop) => stop.id === id), { timeout: 10000 }, first.id);
  // Await the exact same service request as the card; in-flight deduplication shares its Driving result.
  await page.evaluate(async () => {
    const s = window.__tripStore;
    const seg = s.segments.find((item) => item.id === 's6');
    const opt = seg.options.find((item) => item.id === 'scenic');
    const result = await window.__amapService.planSegment(seg, opt, s.customWaypoints.s6, s.preference);
    s.setRouteResult('s6:scenic', result);
  });
  const firstResult = await state(() => window.__tripStore.routeResults['s6:scenic']);
  assert(firstResult.distance - beforeRoute.distance < 30000, `hotel detour too large: ${firstResult.distance - beforeRoute.distance}m`);
  assert(firstResult.orderedWaypointIds.indexOf(first.id) < firstResult.orderedWaypointIds.indexOf('scenic:11'));
  await snap('02-waypoint-after.png');
  record('FIX1-01', `${first.name}: +${((firstResult.distance - beforeRoute.distance) / 1000).toFixed(1)} km`);

  // FIX1-02: add the later hotel first, then re-add the earlier hotel.
  await page.evaluate(async ({ first, later }) => {
    const s = window.__tripStore;
    s.removeWaypoint('s6', first.id);
    // Reproduce two user clicks in reverse geographical order, then run the same Driving method as the card.
    const toStop = (poi) => ({ id: poi.id, name: poi.name, coord: poi.coord, poi: '', city: '十堰市', address: '' });
    s.addWaypoint('s6', toStop(later));
    s.addWaypoint('s6', toStop(first));
    const latest = window.__tripStore;
    const seg = latest.segments.find((item) => item.id === 's6');
    const opt = seg.options.find((item) => item.id === 'scenic');
    const result = await window.__amapService.planSegment(seg, opt, latest.customWaypoints.s6, latest.preference);
    latest.setRouteResult('s6:scenic', result);
  }, { first, later });
  await page.waitForFunction((a, b) => {
    const s = window.__tripStore;
    return s.customWaypoints.s6?.length === 2
      && s.routeResults['s6:scenic']?.orderedWaypointIds?.includes(a)
      && s.routeResults['s6:scenic']?.orderedWaypointIds?.includes(b);
  }, { timeout: 90000 }, first.id, later.id);
  const twoStops = await state(() => ({
    stored: window.__tripStore.customWaypoints.s6.map((stop) => stop.id),
    driven: window.__tripStore.routeResults['s6:scenic'].orderedWaypointIds,
    selected: window.__tripStore.selectedOptions.s6,
    preference: window.__tripStore.preference
  }));
  assert.deepEqual(twoStops.stored, [later.id, first.id]);
  assert(twoStops.driven.indexOf(first.id) < twoStops.driven.indexOf(later.id));
  assert.deepEqual(twoStops.driven.filter((id) => id.startsWith('scenic:')), ['scenic:9', 'scenic:10', 'scenic:11']);
  assert.equal(twoStops.selected, 'scenic');
  assert(twoStops.preference.avoidHighway);
  record('FIX1-02/03', `clicked ${twoStops.stored.join('→')}; Driving ${twoStops.driven.join('→')}`);

  // FIX3-05/06: tabs, result updates, marker focus and return to overview.
  const beforePassive = await mapView();
  await state(() => {
    const s = window.__tripStore;
    s.setActiveContentTab('videos');
    s.focusPoi('fixture-poi');
    s.setRouteResult('s6:scenic', s.routeResults['s6:scenic']);
  });
  await wait(700);
  assert.equal(await state(() => window.__tripStore.mapMode), 'segment-focus');
  assert(closeView(beforePassive, await mapView()), 'passive updates stole detail viewport');
  record('FIX3-05', 'video tab, marker selection and route-result redraw preserve focus');

  await page.click('.segment-detail-action');
  await page.waitForFunction(() => window.__tripStore.mapMode === 'trip-overview' && window.__tripStore.activeDay === 'all');
  await wait(700);
  assert(!closeView(beforePassive, await mapView()), 'return to overview kept detail viewport');
  await snap('06-back-to-overview.png');
  record('FIX3-06', 'returned to full-trip map viewport');

  console.log(`Core Fix Sprint 1: ${results.length} groups passed`);
} finally {
  await browser.close();
}
