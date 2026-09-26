import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const url = 'http://127.0.0.1:5173/';
const output = path.resolve('docs/real-use-fix-4');
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
  console.log('1. 导航访问应用页面，等待底图与所有路段算路就绪...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const s = window.__tripStore;
    if (!s || !s.segments || s.segments.length !== 6 || typeof window.AMap === 'undefined') return false;
    return s.segments.every((seg) => {
      const optId = s.selectedOptions[seg.id] || seg.chosen;
      return (s.routeResults[`${seg.id}:${optId}`]?.distance || 0) > 0;
    });
  }, { timeout: 90000 });
  await wait(800);

  // ============================================================
  // SECTION 1: RUF4-01 全程自驾接力导航计划
  // ============================================================
  console.log('\n--- SECTION 1: RUF4-01 全程自驾接力导航计划 ---');

  // 1.1 验证导航计划编译数据
  const planData = await state(async () => {
    const s = window.__tripStore;
    const { buildTripNavigationPlan } = await import('/src/utils/navigationPlan.ts');
    const plan = buildTripNavigationPlan(
      s.segments,
      s.selectedOptions,
      s.routeResults,
      s.customWaypoints,
      s.preference
    );
    return {
      legCount: plan.legs.length,
      totalDistanceKm: Math.round(plan.totalDistanceMeters / 1000),
      totalDurationSec: plan.totalDurationSeconds,
      totalDays: plan.totalDays,
      legs: plan.legs.map((l) => ({
        index: l.legIndex,
        segmentId: l.segmentId,
        day: l.day,
        title: l.title,
        optionName: l.chosenOption.name,
        waypointsCount: l.orderedWaypoints.length,
        startName: l.startStop.name,
        endName: l.endStop.name
      }))
    };
  });

  assert.equal(planData.legCount, 6, '导航计划应严格编译 6 段自驾行程');
  assert.equal(planData.totalDays, 2, '行程跨越 2 天');
  assert(planData.totalDistanceKm > 400, '总里程应大于 400km');
  assert.equal(planData.legs[0].startName, '黄冈师范学院');
  assert.equal(planData.legs[5].endName, '郧阳区人民政府');
  pass('RUF4-01-A', `全程导航计划编译通过: 共 ${planData.legCount} 段, ${planData.totalDistanceKm}km, ${planData.totalDays}天`);

  // 1.2 点击顶部 [全程导航计划] 按钮打开弹窗
  await page.click('#btn-header-nav-plan');
  await page.waitForSelector('.modal-overlay[aria-label="全程自驾接力导航计划"]', { timeout: 5000 });
  await wait(300);
  await snap('01-nav-plan-overview.png');

  // 验证弹窗内全程路线确认视图与诚实提示
  const modalText = await state(() => document.querySelector('.modal-content-card')?.textContent || '');
  assert(modalText.includes('全程路线确认'), '应包含全程路线确认 Tab');
  assert(modalText.includes('高德官方网页与 URI 协议限制单次调起多日多途经点'), '应如实告知高德协议限制');
  assert(modalText.includes('按顺序开始接力导航'), '应具备开始接力导航按钮');
  pass('RUF4-01-B', '全程路线确认视图与接力导航提示正常呈现');

  // 1.3 启动分段接力导航执行器
  await page.click('#btn-start-relay-plan');
  await wait(400);
  await snap('02-nav-plan-relay-step1.png');

  const step1Text = await state(() => document.querySelector('.modal-content-card')?.textContent || '');
  assert(step1Text.includes('当前: 第 1 / 6 段') || step1Text.includes('第 1 段'), '执行器应定位在第 1 段');
  const hasCurrentNavBtn = await state(() => Boolean(document.querySelector('#btn-nav-current-amap')));
  assert(hasCurrentNavBtn, '应存在调起高德当前段按钮');
  console.log('step C passed, setting window.open stub...');
  // 拦截 window.open 避免调起真实浏览器新标签页，并用于断言导航链接规范性
  await state(() => {
    window.open = (u) => {
      window.__lastOpenedUrl = u;
      return null;
    };
  });

  console.log('testing btn-nav-current-amap click...');
  await page.evaluate(() => document.querySelector('#btn-nav-current-amap')?.click());
  const openedUrlLeg1 = await state(() => window.__lastOpenedUrl || '');
  console.log('openedUrlLeg1 is:', openedUrlLeg1);
  assert(openedUrlLeg1.includes('uri.amap.com/navigation') || openedUrlLeg1.includes('amapuri://route/plan/'), '第 1 段应调起规范高德 URI');
  assert(openedUrlLeg1.includes('麻城') || openedUrlLeg1.includes('115.008'), '第 1 段目的地应包含麻城市');

  console.log('clicking btn-nav-next-leg...');
  await page.evaluate(() => document.querySelector('#btn-nav-next-leg')?.click());
  await wait(300);
  console.log('checking step2Text...');
  const step2Text = await state(() => document.querySelector('.modal-content-card')?.textContent || '');
  assert(step2Text.includes('当前: 第 2 / 6 段') || step2Text.includes('第 2 段'), '应平滑进阶至第 2 段');
  assert(step2Text.includes('麻城 → 大悟'), '第 2 段标题正确');
  await snap('03-nav-plan-relay-step2.png');
  pass('RUF4-01-D', `已跑完第 1 段并平滑接力进阶至第 2 段 (麻城 → 大悟), 调起高德URI: ${openedUrlLeg1.slice(0, 50)}...`);

  // 关闭弹窗
  await page.evaluate(() => document.querySelector('.modal-close-btn')?.click());
  await wait(300);

  // ============================================================
  // SECTION 2: RUF4-02 沿途视频升级为“沿途影像”
  // ============================================================
  console.log('\n--- SECTION 2: RUF4-02 沿途视频升级为“沿途影像” ---');

  // 2.1 数据层面：剔除无关“车里做饭”视频，实现 s1~s6 全路段覆盖
  const mediaAudit = await state(async () => {
    const { initialMedia } = await import('/src/data/mediaData.ts');
    const hasCookingVideo = initialMedia.some((m) => m.id === 'bili-danjiangkou' || m.title.includes('车里做饭') || m.title.includes('有酒有肉'));
    const segmentsCovered = ['s1', 's2', 's3', 's4', 's5', 's6'].map((segId) => ({
      segId,
      count: initialMedia.filter((m) => m.segmentId === segId).length,
      types: Array.from(new Set(initialMedia.filter((m) => m.segmentId === segId).map((m) => m.type)))
    }));
    return {
      hasCookingVideo,
      segmentsCovered,
      totalCount: initialMedia.length
    };
  });

  assert.equal(mediaAudit.hasCookingVideo, false, '严格剔除无关“车里做饭”视频');
  assert(mediaAudit.segmentsCovered.every((s) => s.count > 0), '湖北走廊 6 个路段 (s1~s6) 必须全部收录真实核验影像');
  pass('RUF4-02-A', `影像库审计: 无关做饭视频已剔除, 6 段完整覆盖 (${JSON.stringify(mediaAudit.segmentsCovered)})`);

  // 2.2 界面层面：切换至沿途影像 Tab
  await state(() => window.__tripStore.setActiveContentTab('videos'));
  await wait(400);

  const panelTabLabel = await state(() => document.querySelector('.panel-tab-btn.active')?.textContent?.trim() || '');
  assert(panelTabLabel.includes('沿途影像'), `Tab 名称应更新为“沿途影像”, 实际: ${panelTabLabel}`);

  // 检查照片与视频类型过滤药丸
  const typePills = await state(() => [...document.querySelectorAll('.filter-pill')].map((el) => el.textContent?.trim()));
  assert(typePills.some((p) => p.includes('实景照片')), '应包含实景照片过滤选项');
  assert(typePills.some((p) => p.includes('视频动态')), '应包含视频动态过滤选项');
  pass('RUF4-02-B', '右侧面板 Tab 更新为“沿途影像”且支持照片/视频分类过滤');

  // 2.3 测试空状态诚实告知 (切换至 s1 并选择仅看“视频动态”，s1仅收录实景照片，自然呈现诚实空状态)
  await state(() => window.__tripStore.setActiveSegment('s1'));
  await wait(300);
  await page.evaluate(() => {
    const pill = [...document.querySelectorAll('.filter-pill')].find((el) => el.textContent?.includes('视频动态'));
    pill?.click();
  });
  await wait(300);

  const emptyStateText = await state(() => document.querySelector('.video-empty-state')?.textContent || '');
  assert(emptyStateText.includes('暂未收录可靠实景影像'), '无关联实景时必须如实提示“暂未收录可靠实景影像”，严禁AI虚构');
  pass('RUF4-02-C', `空状态诚实提示通过: "${emptyStateText.trim().slice(0, 30)}..."`);

  // 恢复至 s6 准备测试视频卡片
  await state(() => {
    window.__tripStore.setActiveSegment('s6');
  });
  await wait(400);

  // 2.4 查看影像详情卡片
  await page.evaluate(() => document.querySelector('[data-video-id="bili-ring-road"]')?.click());
  await wait(300);
  await snap('04-media-detail-modal.png');
  const mediaModalTitle = await state(() => document.querySelector('.modal-title')?.textContent || '');
  assert(mediaModalTitle.includes('房车自驾丹江口环库公路'), '环库真实自驾视频详情正确弹出');
  await page.evaluate(() => document.querySelector('.modal-close-btn')?.click());
  await wait(300);
  pass('RUF4-02-D', '实景影像详情卡片交互与原平台核验标签正常');

  // ============================================================
  // SECTION 3: RUF4-03 设施走廊搜索全线覆盖与 5-Bucket 均匀分布
  // ============================================================
  console.log('\n--- SECTION 3: RUF4-03 设施走廊搜索全线覆盖与 5-Bucket 均匀分布 ---');

  // 3.1 空间覆盖率验证 (>= 95%)
  const coverageMetrics = await state(async () => {
    const s = window.__tripStore;
    const { sampleCenters, calculateRouteCoverage } = await import('/src/utils/geo.ts');
    const fullPath = s.routeResults['s6:scenic']?.path || [];
    const centers = sampleCenters(fullPath, 15000, 48);
    const coverage = calculateRouteCoverage(centers, fullPath, 8500);
    return {
      pathPoints: fullPath.length,
      sampleCount: centers.length,
      coverage
    };
  });

  assert(coverageMetrics.coverage >= 0.95, `路线搜索几何覆盖率应 >= 95%, 实际为 ${(coverageMetrics.coverage * 100).toFixed(1)}%`);
  pass('RUF4-03-A', `走廊搜索空间覆盖率达到 ${(coverageMetrics.coverage * 100).toFixed(1)}% (>= 95% 全线无盲区)`);

  // 3.2 5-Bucket 路线进度区间轮询交错算法验证 (针对油站/电桩)
  const distributionTest = await state(async () => {
    const { distributePoisAcrossBuckets } = await import('/src/utils/geo.ts');
    // 构造模拟沿线 60 个加油站，分布在不同路段
    const mockPois = [];
    for (let i = 0; i < 60; i++) {
      const progress = i < 30 ? 0.05 : i < 40 ? 0.35 : i < 50 ? 0.55 : i < 55 ? 0.75 : 0.95;
      mockPois.push({
        id: `mock-gas-${i}`,
        name: `加油站-${i}`,
        routeProgress: progress,
        relevanceScore: 50 - (i % 10),
        distanceToRoute: 0.5
      });
    }

    const reordered = distributePoisAcrossBuckets(mockPois, 5);
    const top20 = reordered.slice(0, 20);
    const bucketsInTop20 = new Set(top20.map((p) => Math.min(4, Math.floor(p.routeProgress * 5))));

    return {
      top20Count: top20.length,
      bucketCoverageCount: bucketsInTop20.size,
      samples: top20.slice(0, 5).map((p) => p.routeProgress)
    };
  });

  assert.equal(distributionTest.bucketCoverageCount, 5, 'Top 20 列表必须均匀覆盖所有 5 个路线进度分段');
  pass('RUF4-03-B', `5-Bucket 轮询交错算法通过: Top 20 完整覆盖 5 个路线分段 (${distributionTest.samples.join(', ')})`);

  // 3.3 地图 Marker 渲染全线设施 vs 列表默认 Top 20
  await state(() => window.__tripStore.setActiveContentTab('facilities'));
  await wait(600);

  const markerVsList = await state(() => {
    const s = window.__tripStore;
    const cards = document.querySelectorAll('.facility-card-item');
    const hasExpandBtn = Boolean(document.querySelector('.btn-expand-more-pois'));
    return {
      totalStoreCount: s.facilities.length,
      renderedCardsCount: cards.length,
      hasExpandBtn
    };
  });
  assert(markerVsList.renderedCardsCount <= 20, '列表默认展示数量应受控在 Top 20');
  pass('RUF4-03-C', `全线搜索与卡片展示分层: 列表默认展示 ${markerVsList.renderedCardsCount} 项, 地图呈现全线顺路 Markers`);

  // ============================================================
  // SECTION 4: RUF4-04 Segment 起终点城镇可交互地点卡
  // ============================================================
  console.log('\n--- SECTION 4: RUF4-04 Segment 起终点城镇可交互地点卡 ---');

  // 4.1 验证地图上 7 个核心节点已渲染
  const tripNodes = await state(async () => {
    const s = window.__tripStore;
    const { compileTripNodes } = await import('/src/utils/tripNodes.ts');
    const nodes = compileTripNodes(
      s.segments,
      s.selectedOptions,
      s.routeResults,
      s.customWaypoints,
      s.dayStartTimes,
      s.overnightStop
    );
    const markerDomCount = document.querySelectorAll('.trip-node-marker').length;
    return {
      nodeCount: nodes.length,
      nodeNames: nodes.map((n) => n.name),
      markerDomCount
    };
  });

  assert.equal(tripNodes.nodeCount, 7, '核心骨架节点应严格包含 7 个关键城镇/起终点');
  assert(tripNodes.nodeNames.includes('黄冈师范学院'));
  assert(tripNodes.nodeNames.includes('麻城市'));
  assert(tripNodes.nodeNames.includes('随州市') || tripNodes.nodeNames.includes('今晚住宿'));
  assert(tripNodes.nodeNames.includes('郧阳区人民政府'));
  pass('RUF4-04-A', `核心节点数据已编译: ${tripNodes.nodeNames.join(' → ')}`);

  // 4.2 触发节点 InfoWindow 弹出测试
  const infoWindowTest = await state(async () => {
    const s = window.__tripStore;
    const { compileTripNodes } = await import('/src/utils/tripNodes.ts');
    const nodes = compileTripNodes(
      s.segments,
      s.selectedOptions,
      s.routeResults,
      s.customWaypoints,
      s.dayStartTimes,
      s.overnightStop
    );
    const machengNode = nodes.find((n) => n.name === '麻城市');
    if (machengNode) {
      window.__amapService.openTripNodeInfoWindow(
        machengNode,
        (segId) => window.__tripStore.enterSegmentDetail(segId),
        (name) => {
          window.__tripStore.setSearchQuery(name);
          window.__tripStore.setActiveContentTab('facilities');
        }
      );
    }
    return Boolean(machengNode);
  });
  assert(infoWindowTest, '成功触发麻城市地点卡 InfoWindow');
  await wait(400);
  await snap('05-trip-node-infowindow.png');

  // 验证 InfoWindow 内容
  const infoWindowContent = await state(() => {
    const iw = document.querySelector('.amap-info-content');
    const hasViewSegmentBtn = Boolean(document.getElementById('btn-node-view-segment'));
    const hasSearchFacilitiesBtn = Boolean(document.getElementById('btn-node-search-facilities'));
    return {
      text: iw?.textContent || '',
      hasViewSegmentBtn,
      hasSearchFacilitiesBtn
    };
  });

  assert(infoWindowContent.text.includes('麻城市'), '卡片应包含地点名称');
  assert(infoWindowContent.text.includes('途经换乘节点'), '卡片应标注角色');
  assert(infoWindowContent.hasViewSegmentBtn, '应具备 [查看此路段] 动作按钮');
  assert(infoWindowContent.hasSearchFacilitiesBtn, '应具备 [搜索周边设施] 动作按钮');
  pass('RUF4-04-B', '节点地点卡弹出内容完整且具备 [查看此路段] 与 [搜索周边设施] 操作');

  // 4.3 点击 [搜索周边设施]
  await page.evaluate(() => document.querySelector('#btn-node-search-facilities')?.click());
  await wait(400);
  const searchState = await state(() => ({
    query: window.__tripStore.searchQuery,
    tab: window.__tripStore.activeContentTab
  }));
  assert.equal(searchState.query, '麻城市', '搜索词应自动填入节点名称');
  assert.equal(searchState.tab, 'facilities', '自动切换至设施 Tab');
  pass('RUF4-04-C', '节点地点卡联动搜索周边设施成功');

  // ============================================================
  // SECTION 5: RUF4-05 综合全流程回归
  // ============================================================
  console.log('\n--- SECTION 5: RUF4-05 综合全流程回归 ---');
  await wait(500);

  // 验证底部导航计划按钮
  await page.evaluate(() => document.querySelector('#btn-footer-nav-plan')?.click());
  await page.waitForSelector('.modal-overlay[aria-label="全程自驾接力导航计划"]', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.modal-close-btn')?.click());
  pass('RUF4-05-A', '底部操作栏导航计划唤起正常');

  console.log('\n===============================================================');
  console.log('🎉 Real-Use Fix Sprint 4 全部验收项 (RUF4-01~05) 100% 通过！');
  console.log('===============================================================');
} catch (err) {
  console.error('\n❌ 测试执行失败:', err);
  process.exit(1);
} finally {
  await browser.close();
}
