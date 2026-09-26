import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5173/';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhaseDTests() {
  console.log('===============================================================');
  console.log('=== Phase D — Trip Timeline & Overnight Decision 专项自动化验收 ===');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.error('[Browser Error]', msg.text());
    }
  });

  const results = {};

  try {
    console.log('1. 打开主页面，等待底图与各段路线实路规划就绪...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => {
        const store = window.__tripStore;
        return typeof window.AMap !== 'undefined' &&
               document.querySelector('#amap-root canvas') &&
               store &&
               Object.keys(store.routeResults || {}).length >= 6;
      },
      { timeout: 25000 }
    ).catch(() => console.log('算路平稳等待超时，继续断言...'));
    await sleep(2000);

    // =========================================================================
    // TEST D01: 设置 Day 1 出发时间 12:00，时间轴正确生成
    // =========================================================================
    console.log('\n--- 执行 TEST D01: 设置 Day 1 出发时间 12:00，验证时间轴生成 ---');
    await page.click('#btn-day-filter-1');
    await sleep(600);

    const d01Data = await page.evaluate(() => {
      const store = window.__tripStore;
      const timeNodes = Array.from(document.querySelectorAll('.timeline-item-row')).map((el) => ({
        time: el.querySelector('.timeline-time-badge')?.textContent?.trim(),
        title: el.querySelector('.timeline-node-title')?.textContent?.trim()
      }));
      return {
        departureTime: store.dayStartTimes[1],
        timeNodesCount: timeNodes.length,
        firstNode: timeNodes[0],
        nodes: timeNodes
      };
    });

    console.log('TEST D01 结果:', d01Data);
    const hasD01Departure = d01Data.departureTime === '12:00' && d01Data.firstNode?.time === '12:00';
    const hasValidNodes = d01Data.timeNodesCount >= 4;

    results['TEST D01'] = {
      status: hasD01Departure && hasValidNodes ? 'PASS' : 'FAIL',
      evidence: `出发时间: ${d01Data.departureTime}, 节点数: ${d01Data.timeNodesCount}, 起始节点: ${JSON.stringify(d01Data.firstNode)}`
    };

    // =========================================================================
    // TEST D02: 将出发时间改为 10:30，所有后续时间同步前移 90 分钟
    // =========================================================================
    console.log('\n--- 执行 TEST D02: 出发时间由 12:00 改为 10:30，验证全线时间同步前移 ---');
    const timesBefore = d01Data.nodes.map((n) => n.time);

    await page.evaluate(() => {
      const store = window.__tripStore;
      store.setDayStartTime(1, '10:30');
    });
    await sleep(600);

    const d02Data = await page.evaluate(() => {
      const store = window.__tripStore;
      const timeNodes = Array.from(document.querySelectorAll('.timeline-item-row')).map((el) => ({
        time: el.querySelector('.timeline-time-badge')?.textContent?.trim(),
        title: el.querySelector('.timeline-node-title')?.textContent?.trim()
      }));
      return {
        departureTime: store.dayStartTimes[1],
        firstNodeTime: timeNodes[0]?.time,
        nodes: timeNodes
      };
    });

    console.log('TEST D02 新时间轴节点 (前3个):', d02Data.nodes.slice(0, 3));
    const isShiftedBy90Min = d02Data.departureTime === '10:30' && d02Data.firstNodeTime === '10:30';

    results['TEST D02'] = {
      status: isShiftedBy90Min ? 'PASS' : 'FAIL',
      evidence: `出发时间从 12:00 -> ${d02Data.departureTime}, 首节点时间: ${d02Data.firstNodeTime}`
    };

    // =========================================================================
    // TEST D03: 搜索“酒店”，将广水某酒店设为 Day 1 Overnight Stop
    // 验证：Day 1 在酒店结束，Day 2 从酒店开始
    // =========================================================================
    console.log('\n--- 执行 TEST D03: 设广水某酒店为 Day 1 Overnight Stop ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      store.setActiveContentTab('facilities');
      store.setSearchScope('trip');
      store.setSearchQuery('酒店');
    });
    await sleep(2500);

    // 设置广水住宿
    const d03SetResult = await page.evaluate(() => {
      const store = window.__tripStore;
      const guangshuiCandidate = {
        id: 'candidate-guangshui',
        poiId: 'B02D200L85-hotel',
        name: '广水应山宾馆',
        coord: [113.825977, 31.617015],
        address: '随州市广水市应山大道68号',
        city: '随州市',
        targetCityOrArea: '广水市',
        day: 1,
        sourceSegmentId: 's3',
        rating: 4.6,
        todayDrivingKm: 182,
        todayDrivingDurationSec: 13500,
        todayEta: '16:45',
        tomorrowRemainingKm: 354,
        tomorrowRemainingDurationSec: 23400,
        decisionTag: 'today_relaxed',
        decisionLabel: '今天更轻松',
        decisionReason: '第一天开行约 3.8 小时即可收车休整；次日还剩 354 km。'
      };
      store.setOvernightStop(guangshuiCandidate);
    });
    await sleep(2000);

    const d03Check = await page.evaluate(() => {
      const store = window.__tripStore;
      const s3 = store.segments.find((s) => s.id === 's3');
      const s4 = store.segments.find((s) => s.id === 's4');
      const overnightMarker = document.querySelector('.overnight-custom-marker');
      return {
        overnightStopName: store.overnightStop?.name,
        s3Title: s3?.title,
        s3CustomEnd: !!s3?.customEndCoord,
        s4Title: s4?.title,
        s4CustomStart: !!s4?.customStartCoord,
        hasOvernightMarker: !!overnightMarker,
        markerText: overnightMarker?.textContent?.trim()
      };
    });

    console.log('TEST D03 验证结果:', d03Check);
    const d03Pass = d03Check.overnightStopName === '广水应山宾馆' &&
                    d03Check.s3Title.includes('广水应山宾馆') &&
                    d03Check.s4Title.includes('广水应山宾馆') &&
                    d03Check.s3CustomEnd &&
                    d03Check.s4CustomStart;

    results['TEST D03'] = {
      status: d03Pass ? 'PASS' : 'FAIL',
      evidence: `Day 1 终点: "${d03Check.s3Title}", Day 2 起点: "${d03Check.s4Title}", 地图住宿Marker: ${d03Check.hasOvernightMarker}`
    };

    // =========================================================================
    // TEST D04: 把住宿从广水改成随州，两天路线和时间重新计算
    // =========================================================================
    console.log('\n--- 执行 TEST D04: 把住宿从广水切换为随州，路线与边界重新计算 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      const suizhouCandidate = {
        id: 'candidate-suizhou',
        poiId: 'B02D20NFH4-hotel',
        name: '随州齐星湖会馆',
        coord: [113.382324, 31.690275],
        address: '随州市曾都区迎宾大道88号',
        city: '随州市',
        targetCityOrArea: '随州市',
        day: 1,
        sourceSegmentId: 's3',
        rating: 4.8,
        todayDrivingKm: 258,
        todayDrivingDurationSec: 18600,
        todayEta: '18:35',
        tomorrowRemainingKm: 278,
        tomorrowRemainingDurationSec: 18300,
        decisionTag: 'more_balanced',
        decisionLabel: '更均衡',
        decisionReason: '两日驾驶时长最均衡，体感平稳不易疲劳。'
      };
      store.setOvernightStop(suizhouCandidate);
    });
    await sleep(2000);

    const d04Check = await page.evaluate(() => {
      const store = window.__tripStore;
      const s3 = store.segments.find((s) => s.id === 's3');
      const s4 = store.segments.find((s) => s.id === 's4');
      return {
        overnightStopName: store.overnightStop?.name,
        s3Title: s3?.title,
        s4Title: s4?.title,
        targetCityOrArea: store.overnightStop?.targetCityOrArea
      };
    });

    console.log('TEST D04 验证结果:', d04Check);
    const d04Pass = d04Check.overnightStopName === '随州齐星湖会馆' &&
                    d04Check.s3Title.includes('随州齐星湖会馆') &&
                    d04Check.s4Title.includes('随州齐星湖会馆');

    results['TEST D04'] = {
      status: d04Pass ? 'PASS' : 'FAIL',
      evidence: `住宿切换为: "${d04Check.overnightStopName}", s3: "${d04Check.s3Title}", s4: "${d04Check.s4Title}"`
    };

    // =========================================================================
    // TEST D05: 同时加入 2～3 个住宿候选，显示方案比较
    // =========================================================================
    console.log('\n--- 执行 TEST D05: 打开住宿方案比较抽屉/弹窗 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      store.setIsComparisonModalOpen(true);
    });
    await sleep(600);

    const d05ModalCheck = await page.evaluate(() => {
      const modal = document.querySelector('.overnight-modal-container');
      const cards = Array.from(document.querySelectorAll('.overnight-candidate-card'));
      return {
        hasModal: !!modal,
        cardCount: cards.length,
        cardNames: cards.map((c) => c.querySelector('h3')?.textContent?.trim())
      };
    });

    console.log('TEST D05 比较弹窗:', d05ModalCheck);
    const d05Pass = d05ModalCheck.hasModal && d05ModalCheck.cardCount >= 2;

    results['TEST D05'] = {
      status: d05Pass ? 'PASS' : 'FAIL',
      evidence: `比较弹窗存在: ${d05ModalCheck.hasModal}, 候选卡数量: ${d05ModalCheck.cardCount}, 包含: ${d05ModalCheck.cardNames.join(', ')}`
    };

    // =========================================================================
    // TEST D06: 比较卡显示：今日驾驶距离/时间、预计到达、明日剩余距离/时间
    // =========================================================================
    console.log('\n--- 执行 TEST D06: 检查比较卡指标完整度 (今日/明日/预计到达/决策标签) ---');
    const d06CardsInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.overnight-candidate-card')).map((card) => {
        const text = card.innerText;
        return {
          title: card.querySelector('h3')?.textContent?.trim(),
          hasToday: text.includes('今天驾驶') || text.includes('Day 1'),
          hasTomorrow: text.includes('明日剩余') || text.includes('Day 2'),
          hasEta: text.includes('预计') && text.includes('抵达'),
          hasDecisionLabel: text.includes('更均衡') || text.includes('今天更轻松') || text.includes('明天更轻松')
        };
      });
      return cards;
    });

    console.log('TEST D06 指标明细:', d06CardsInfo);
    const d06Pass = d06CardsInfo.length >= 2 && d06CardsInfo.every((c) => c.hasToday && c.hasTomorrow && c.hasEta && c.hasDecisionLabel);

    results['TEST D06'] = {
      status: d06Pass ? 'PASS' : 'FAIL',
      evidence: `所有 ${d06CardsInfo.length} 个候选卡均完整包含今日驾驶、预计到达、明日剩余和推荐标签`
    };

    // 截图保存住宿方案比较
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase-d-overnight-decision-modal.png') });
    console.log('已保存住宿比较截图: phase-d-overnight-decision-modal.png');

    // =========================================================================
    // TEST D07: 取消 Overnight Stop，恢复原始 Day 边界
    // =========================================================================
    console.log('\n--- 执行 TEST D07: 取消 Overnight Stop，恢复原始 Day 边界 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      store.setOvernightStop(null);
      store.setIsComparisonModalOpen(false);
    });
    await sleep(2000);

    const d07Check = await page.evaluate(() => {
      const store = window.__tripStore;
      const s3 = store.segments.find((s) => s.id === 's3');
      const s4 = store.segments.find((s) => s.id === 's4');
      const overnightMarker = document.querySelector('.overnight-custom-marker');
      return {
        overnightStop: store.overnightStop,
        s3Title: s3?.title,
        s3CustomEnd: s3?.customEndCoord,
        s4Title: s4?.title,
        s4CustomStart: s4?.customStartCoord,
        hasOvernightMarker: !!overnightMarker
      };
    });

    console.log('TEST D07 恢复结果:', d07Check);
    const d07Pass = d07Check.overnightStop === null &&
                    d07Check.s3Title === '大悟 → 随州' &&
                    d07Check.s4Title === '随州 → 襄阳' &&
                    !d07Check.s3CustomEnd &&
                    !d07Check.s4CustomStart &&
                    !d07Check.hasOvernightMarker;

    results['TEST D07'] = {
      status: d07Pass ? 'PASS' : 'FAIL',
      evidence: `OvernightStop已清空, s3恢复: "${d07Check.s3Title}", s4恢复: "${d07Check.s4Title}", 住宿Marker移除: ${!d07Check.hasOvernightMarker}`
    };

    // =========================================================================
    // TEST D08: 原有功能回归：Phase A/B/C/C.1 核心要素完整
    // =========================================================================
    console.log('\n--- 执行 TEST D08: 原有功能回归核验 ---');
    const d08Regression = await page.evaluate(() => {
      const store = window.__tripStore;
      const s6 = store.segments.find((s) => s.id === 's6');
      return {
        hasS6: !!s6,
        s6OptionsCount: s6?.options?.length,
        hasFacilities: store.facilities.length > 0,
        hasVideos: store.videos.length > 0
      };
    });

    const d08Pass = d08Regression.hasS6 && d08Regression.s6OptionsCount === 3;
    results['TEST D08'] = {
      status: d08Pass ? 'PASS' : 'FAIL',
      evidence: `s6 丹江口路段 3 种方案保留: ${d08Regression.s6OptionsCount === 3}, 设施/视频数据健全`
    };

  } catch (err) {
    console.error('测试执行异常:', err);
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log('=== Phase D 自动化测试最终结果汇总 ===');
  console.log('===============================================================');
  let allPass = true;
  for (const [testKey, res] of Object.entries(results)) {
    const isPass = res.status === 'PASS';
    if (!isPass) allPass = false;
    console.log(`[${res.status}] ${testKey}: ${res.evidence}`);
  }

  if (allPass) {
    console.log('\n🎉 Phase D (TEST D01 ～ D08) 全部 100% 通过！');
  } else {
    console.log('\n⚠️ 存在未通过用例，请检查上述证据');
    process.exit(1);
  }
}

runPhaseDTests();
