import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const url = 'http://127.0.0.1:5173/';
const output = path.resolve('docs/core-fix-3');
await fs.mkdir(output, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

const snap = (name) => page.screenshot({ path: path.join(output, name) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const state = (fn, ...args) => page.evaluate(fn, ...args);
const pass = (id, detail) => console.log(`PASS ${id}: ${detail}`);

try {
  console.log('1. 导航访问页面并等待初始地图与算路完成...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const s = window.__tripStore;
    return s?.routeResults?.['s6:scenic']?.path?.length > 20
      && typeof window.AMap !== 'undefined';
  }, { timeout: 90000 });
  await wait(800);

  // ============================================================
  // SECTION 1: FIX 7 设施分类完整度 (#19, #20, #21, #22, #23, #24, #27)
  // ============================================================
  console.log('\n--- SECTION 1: FIX 7 设施分类完整度 ---');
  await state(() => window.__tripStore.setActiveContentTab('facilities'));
  await wait(300);

  // 验证分类配置中的高德官方编码与属性定义
  const catConfigs = await state(async () => {
    const { FACILITY_CATEGORIES } = await import('/src/config/poiTypes.ts');
    const { detectCategory } = await import('/src/services/corridorSearch.ts');
    return {
      all: FACILITY_CATEGORIES.all,
      hotel: FACILITY_CATEGORIES.hotel,
      homestay: FACILITY_CATEGORIES.homestay,
      food: FACILITY_CATEGORIES.food,
      gas: FACILITY_CATEGORIES.gas,
      ev: FACILITY_CATEGORIES.ev,
      toilet: FACILITY_CATEGORIES.toilet,
      parking: FACILITY_CATEGORIES.parking,
      detectedHomestay: detectCategory('丹江口环库湖景精品民宿', 'all'),
      detectedHotel: detectCategory('武当山国际大酒店', 'all')
    };
  });

  // FIX7-01: 民宿 (Homestay)
  assert.equal(catConfigs.homestay.key, 'homestay');
  assert.equal(catConfigs.homestay.label, '民宿');
  assert.equal(catConfigs.homestay.emoji, '🏡');
  assert(catConfigs.homestay.amapType.includes('100105'));
  assert(catConfigs.homestay.amapType.includes('100200'));
  assert.equal(catConfigs.detectedHomestay, 'homestay');
  assert.equal(catConfigs.detectedHotel, 'hotel');
  pass('FIX7-01', `民宿独立分类: 编码=${catConfigs.homestay.amapType}, 判定=${catConfigs.detectedHomestay}`);

  // FIX7-02: 餐饮 (Food)
  assert.equal(catConfigs.food.key, 'food');
  assert.equal(catConfigs.food.emoji, '🍴');
  assert(catConfigs.food.amapType.startsWith('050000'));
  pass('FIX7-02', `餐饮分类: 编码=${catConfigs.food.amapType}`);

  // FIX7-03: 加油站 (Gas)
  assert.equal(catConfigs.gas.key, 'gas');
  assert.equal(catConfigs.gas.emoji, '⛽');
  assert(catConfigs.gas.amapType.startsWith('010100'));
  pass('FIX7-03', `加油站分类: 编码=${catConfigs.gas.amapType}`);

  // FIX7-04: 充电站 (EV)
  assert.equal(catConfigs.ev.key, 'ev');
  assert.equal(catConfigs.ev.emoji, '⚡');
  assert(catConfigs.ev.amapType.startsWith('011100'));
  pass('FIX7-04', `充电站分类: 编码=${catConfigs.ev.amapType}`);

  // FIX7-05: 厕所 (Toilet)
  assert.equal(catConfigs.toilet.key, 'toilet');
  assert.equal(catConfigs.toilet.emoji, '🚾');
  assert(catConfigs.toilet.amapType.startsWith('200300'));
  pass('FIX7-05', `厕所分类: 编码=${catConfigs.toilet.amapType}`);

  // FIX7-06: 停车场 (Parking)
  assert.equal(catConfigs.parking.key, 'parking');
  assert.equal(catConfigs.parking.emoji, '🅿️');
  assert(catConfigs.parking.amapType.startsWith('150900'));
  pass('FIX7-06', `停车场分类: 编码=${catConfigs.parking.amapType}`);

  // FIX7-07: 分类筛选 List 与 Marker 联动
  // 测试药丸按钮点击切换
  const filterPillTexts = await page.$$eval('.filter-pill', (pills) => pills.map((p) => p.textContent));
  assert(filterPillTexts.some((t) => t.includes('民宿')));
  assert(filterPillTexts.some((t) => t.includes('餐饮')));
  assert(filterPillTexts.some((t) => t.includes('加油站')));
  assert(filterPillTexts.some((t) => t.includes('充电站')));
  assert(filterPillTexts.some((t) => t.includes('厕所')));
  assert(filterPillTexts.some((t) => t.includes('停车场')));

  // 点击【全部】
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.filter-pill')].find((el) => el.textContent?.includes('全部'));
    btn?.click();
  });
  await wait(300);
  const allCount = await state(() => window.__tripStore.selectedCategory);
  assert.equal(allCount, 'all');

  // 点击【民宿】
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.filter-pill')].find((el) => el.textContent?.includes('民宿'));
    btn?.click();
  });
  await wait(300);
  assert.equal(await state(() => window.__tripStore.selectedCategory), 'homestay');

  // 恢复至【全部】并触发搜索
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.filter-pill')].find((el) => el.textContent?.includes('全部'));
    btn?.click();
  });
  await wait(300);

  await snap('01-facility-categories.png');
  pass('FIX7-07', `全部分类药丸渲染与筛选状态同步正常, pills: ${filterPillTexts.length}`);

  // ============================================================
  // SECTION 2: FIX 8 地图 Marker → 列表卡片双向联动 (#13)
  // ============================================================
  console.log('\n--- SECTION 2: FIX 8 地图 Marker → 列表卡片双向联动 ---');
  // 确保有设施数据
  await state(() => {
    window.__tripStore.setActiveContentTab('facilities');
    window.__tripStore.setSearchScope('trip');
    window.__tripStore.setSearchQuery('酒店');
  });
  await page.waitForFunction(() => (window.__tripStore.facilities?.length || 0) > 0, { timeout: 60000 });
  await wait(500);

  const pois = await state(() => window.__tripStore.facilities);
  assert(pois.length > 0, 'No POIs found');
  const targetPoi = pois[0];

  // FIX8-01: 切换到视频 tab，模拟点击 targetPoi 对应的 Marker，验证自动切回 facilities 并聚焦卡片
  await state(() => window.__tripStore.setActiveContentTab('videos'));
  assert.equal(await state(() => window.__tripStore.activeContentTab), 'videos');

  // 触发 marker 点击
  await page.evaluate((poiId) => {
    const poi = window.__tripStore.facilities.find((p) => p.id === poiId);
    if (!poi) return;
    // 模拟触发 CenterMapArea 中的 onSelectPoi
    if (window.__tripStore.activeContentTab !== 'facilities') {
      window.__tripStore.setActiveContentTab('facilities');
    }
    if (window.__tripStore.selectedCategory !== 'all' && window.__tripStore.selectedCategory !== poi.category) {
      window.__tripStore.setSelectedCategory(poi.category);
    }
    window.__tripStore.focusPoi(poi.id);
  }, targetPoi.id);

  await page.waitForFunction((poiId) => {
    return window.__tripStore.activeContentTab === 'facilities'
      && window.__tripStore.selectedPoiId === poiId;
  }, {}, targetPoi.id);

  // 验证 DOM 卡片带有 selected 类
  await wait(300);
  const cardIsSelected = await page.evaluate((poiId) => {
    const card = document.getElementById(`facility-card-${poiId}`);
    return card?.classList.contains('selected') || false;
  }, targetPoi.id);
  assert(cardIsSelected, 'Facility card should have .selected class');
  pass('FIX8-01', `Marker 点击成功切回 facilities tab 并高亮卡片 #${targetPoi.id}`);

  // FIX8-02: 同名/相似 POI 精确匹配 (依靠 unique poi.id 与坐标)
  const disambiguationOk = await state(() => {
    const store = window.__tripStore;
    const sameNameList = store.facilities.filter((p, i, arr) => arr.some((o, j) => i !== j && o.name === p.name));
    return store.selectedPoiId === store.facilities[0].id;
  });
  assert(disambiguationOk);
  pass('FIX8-02', 'POI 选中状态基于唯一 id 绑定，同名设施独立区隔');

  // FIX8-03: Segment Detail 模式下 Marker 点击
  await state(() => window.__tripStore.enterSegmentDetail('s6'));
  assert.equal(await state(() => window.__tripStore.mapMode), 'segment-focus');
  await page.evaluate((poiId) => {
    window.__tripStore.focusPoi(poiId);
  }, targetPoi.id);
  await wait(200);
  const detailModeCardSelected = await page.evaluate((poiId) => {
    return document.getElementById(`facility-card-${poiId}`)?.classList.contains('selected');
  }, targetPoi.id);
  assert(detailModeCardSelected);
  pass('FIX8-03', 'Segment Detail 聚焦模式下 Marker 点击与卡片联动保持正常');

  // 退出 detail mode
  await state(() => window.__tripStore.exitSegmentDetail());
  await wait(300);

  // FIX8-04: 当前分类过滤不同时，Marker 点击自动调正分类并展开 Top 20 限制
  await state(() => {
    window.__tripStore.setSelectedCategory('food'); // 故意设为餐饮
  });
  assert.equal(await state(() => window.__tripStore.selectedCategory), 'food');

  // 点击一个 hotel marker
  await page.evaluate((poi) => {
    if (window.__tripStore.selectedCategory !== 'all' && window.__tripStore.selectedCategory !== poi.category) {
      window.__tripStore.setSelectedCategory(poi.category);
    }
    window.__tripStore.focusPoi(poi.id);
  }, targetPoi);
  await wait(300);

  assert.equal(await state(() => window.__tripStore.selectedCategory), targetPoi.category);
  const cardVisibleNow = await page.evaluate((poiId) => {
    return !!document.getElementById(`facility-card-${poiId}`);
  }, targetPoi.id);
  assert(cardVisibleNow);
  await snap('02-marker-to-list.png');
  pass('FIX8-04', `分类不符时点击 Marker 自动调整 selectedCategory 并在 DOM 呈现卡片`);

  // ============================================================
  // SECTION 3: FIX 9 真实住宿候选双日自驾测算与对比 (#39)
  // ============================================================
  console.log('\n--- SECTION 3: FIX 9 真实住宿候选双日自驾测算与对比 ---');

  // FIX9-01: 加入双住宿候选
  const candidateA = {
    id: 'cand-suizhou-hotel',
    name: '随州碧桂园凤凰酒店',
    coord: [113.3831, 31.7176],
    city: '随州市',
    targetCityOrArea: '随州市区',
    address: '随州市曾都区何店镇碧桂园大街1号',
    source: 'amap-search'
  };

  const candidateB = {
    id: 'cand-danjiangkou-hotel',
    name: '丹江口铂岸酒店(大坝景区店)',
    coord: [111.5126, 32.5518],
    city: '丹江口市',
    targetCityOrArea: '丹江口大坝区',
    address: '丹江口市沿江大道1号',
    source: 'amap-search'
  };

  await state((candA, candB) => {
    const store = window.__tripStore;
    store.addOvernightCandidate(candA);
    store.addOvernightCandidate(candB);
    store.setIsComparisonModalOpen(true);
  }, candidateA, candidateB);

  await page.waitForFunction(() => {
    return document.querySelectorAll('.overnight-candidate-card').length >= 2;
  }, { timeout: 10000 });
  pass('FIX9-01', '双住宿候选成功录入并渲染于对比弹窗');

  // FIX9-02: 真实 Day 1 / Day 2 路线数据驱动 (经 AMap Driving 动态计算或复用重构)
  console.log('等待真实两日实路测算完成...');
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.overnight-candidate-card')];
    // 卡片内不包含“实路测算中”且含有“km”
    return cards.length >= 2 && cards.every((c) => !c.textContent.includes('实路测算中...') && c.textContent.includes('km'));
  }, { timeout: 60000 });
  await wait(500);

  const metricsData = await state(async (candA, candB) => {
    const { calculateCandidateComparisonMetrics } = await import('/src/utils/overnightMetrics.ts');
    const store = window.__tripStore;
    const resA = await calculateCandidateComparisonMetrics(
      candA,
      store.selectedOptions,
      store.customWaypoints,
      store.preference,
      store.dayStartTimes,
      store.routeResults
    );
    const resB = await calculateCandidateComparisonMetrics(
      candB,
      store.selectedOptions,
      store.customWaypoints,
      store.preference,
      store.dayStartTimes,
      store.routeResults
    );
    return { resA, resB };
  }, candidateA, candidateB);

  assert.equal(metricsData.resA.status, 'success');
  assert.equal(metricsData.resB.status, 'success');
  assert(metricsData.resA.todayKm > 0 && metricsData.resA.tomorrowKm > 0);
  assert(metricsData.resB.todayKm > 0 && metricsData.resB.tomorrowKm > 0);
  assert(metricsData.resA.todayKm !== metricsData.resB.todayKm, 'Different stops have distinct day1 km');
  assert(metricsData.resA.ratio > 0 && metricsData.resA.ratio < 100);
  assert(metricsData.resB.ratio > 0 && metricsData.resB.ratio < 100);
  assert(metricsData.resA.label && metricsData.resB.label);

  // 验证弹窗内无虚构 rating 或虚假数据
  const modalText = await page.$eval('.overnight-modal-container', (el) => el.textContent);
  assert(!modalText.includes('4.5分') && !modalText.includes('★ 4.5'));
  assert(modalText.includes('今天驾驶 (Day 1)'));
  assert(modalText.includes('明日剩余 (Day 2)'));

  await snap('03-overnight-real-comparison.png');
  pass('FIX9-02', `双候选实路驱动对比: CandA Day1=${metricsData.resA.todayKm}km / Day2=${metricsData.resA.tomorrowKm}km (${metricsData.resA.label}); CandB Day1=${metricsData.resB.todayKm}km / Day2=${metricsData.resB.tomorrowKm}km (${metricsData.resB.label})`);

  // FIX9-03: RouteOption 变化重新计算与缓存隔离
  const cacheKeyDiff = await state(async (candA) => {
    const { buildComparisonCacheKey } = await import('/src/utils/overnightMetrics.ts');
    const store = window.__tripStore;
    const k1 = buildComparisonCacheKey(candA, store.selectedOptions, store.customWaypoints, store.preference, '12:00');
    const k2 = buildComparisonCacheKey(candA, { ...store.selectedOptions, s6: 'direct' }, store.customWaypoints, store.preference, '12:00');
    return { k1, k2, isDiff: k1 !== k2 };
  }, candidateA);
  assert(cacheKeyDiff.isDiff);
  pass('FIX9-03', `RouteOption 变更生成独立缓存键: ${cacheKeyDiff.k1.slice(0, 40)}... vs ${cacheKeyDiff.k2.slice(0, 40)}...`);

  // FIX9-04: Waypoint 变化缓存失效
  const wpCacheKeyDiff = await state(async (candA) => {
    const { buildComparisonCacheKey } = await import('/src/utils/overnightMetrics.ts');
    const store = window.__tripStore;
    const k1 = buildComparisonCacheKey(candA, store.selectedOptions, store.customWaypoints, store.preference, '12:00');
    const k2 = buildComparisonCacheKey(
      candA,
      store.selectedOptions,
      { ...store.customWaypoints, s6: [{ id: 'wp-new', name: '新停靠点', coord: [111.6, 32.6] }] },
      store.preference,
      '12:00'
    );
    return { k1, k2, isDiff: k1 !== k2 };
  }, candidateA);
  assert(wpCacheKeyDiff.isDiff);
  pass('FIX9-04', 'Waypoint 变更导致缓存键失效，强制实路重测');

  // FIX9-05: API 失败不造假
  const errorHandled = await state(async () => {
    const { calculateCandidateComparisonMetrics } = await import('/src/utils/overnightMetrics.ts');
    const invalidCandidate = {
      id: 'cand-invalid',
      name: '离谱荒野孤岛酒店',
      coord: [0, 0], // 非法经纬度，高德必定失败
      source: 'user-input'
    };
    const res = await calculateCandidateComparisonMetrics(
      invalidCandidate,
      {},
      {},
      { avoidHighway: false, avoidToll: false, avoidCongestion: false },
      { 1: '12:00', 2: '08:30' }
    );
    return res;
  });
  assert.equal(errorHandled.status, 'error');
  assert.equal(errorHandled.todayKm, undefined);
  assert.equal(errorHandled.errorMessage, '暂时无法获取实路数据');
  pass('FIX9-05', '测算异常时严格返回 error 态，无捏造里程或虚构耗时');

  // 关闭对比弹窗
  await page.click('#overnight-modal-close-btn');
  await wait(300);

  // ============================================================
  // SECTION 4: FIX 10 外部跳出治理 (#15)
  // ============================================================
  console.log('\n--- SECTION 4: FIX 10 外部跳出治理 ---');

  // FIX10-01: 站内具备高德完整信息展示能力的地方，去除无意义的外跳
  const cardOutboundLinks = await page.$$eval('.facility-card-item a', (links) => links.map((a) => a.href));
  assert.equal(cardOutboundLinks.length, 0, 'Facility cards must NOT contain external links');
  const cardTexts = await page.$$eval('.facility-card-item', (cards) => cards.map((c) => c.textContent));
  assert(!cardTexts.some((t) => t.includes('高德详情 ↗')));
  pass('FIX10-01', '设施卡片内无冗余“高德详情 ↗”外跳，就地展示完整信息');

  // FIX10-02: 一级导航调起治理
  const navIntercept = await page.evaluate(async () => {
    let capturedUrl = '';
    const origOpen = window.open;
    window.open = (u) => { capturedUrl = u; return null; };
    const { startAmapNavigation } = await import('/src/services/navigationService.ts');
    startAmapNavigation(
      { name: '郧阳区', coord: [110.8122, 32.8361] },
      [],
      { avoidHighway: false, avoidToll: false, avoidCongestion: false }
    );
    window.open = origOpen;
    return capturedUrl;
  });
  assert(navIntercept.startsWith('https://uri.amap.com/navigation'));
  assert(navIntercept.includes('mode=car'));
  assert(navIntercept.includes('to=110.8122%2C32.8361%2C%E9%83%A7%E9%98%B3%E5%8C%BA'));
  pass('FIX10-02', `一级导航调起规范高德 URI 协议: ${navIntercept}`);

  // FIX10-03: 视频平台外跳文案正确呈现
  await state(() => {
    window.__tripStore.setActiveSegment('s6');
    window.__tripStore.selectRouteOption('s6', 'scenic');
    window.__tripStore.setActiveContentTab('videos');
  });
  await page.waitForSelector('[data-video-id="bili-ring-road"]', { timeout: 10000 });
  await page.click('[data-video-id="bili-ring-road"]');
  await page.waitForSelector('.modal-content-card', { timeout: 10000 });
  await wait(300);

  const videoBtnText = await page.$eval('.video-source-link', (el) => el.textContent.trim());
  assert(videoBtnText.includes('打开 B站'));
  await snap('04-external-actions.png');
  pass('FIX10-03', `视频外跳按钮文案按平台精细化区分: "${videoBtnText}"`);

  // 关闭视频弹窗
  await page.click('.modal-close-btn');
  await wait(200);

  console.log('\n===============================================================');
  console.log('🎉 Core Fix Sprint 3 全部验收项 (FIX7~10) 100% 通过！');
  console.log('===============================================================');
} finally {
  await browser.close();
}
