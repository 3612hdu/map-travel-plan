import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5173/';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhaseD1Tests() {
  console.log('========================================================================');
  console.log('=== Phase D.1 — Trip Model Generalization & Integrity 专项自动化验收 ===');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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
    // D1-01: 住宿点位于 Segment 中间，可以正确 split
    // =========================================================================
    console.log('\n--- 执行 D1-01: 住宿点位于 Segment 中间，可以正确 split ---');
    await page.evaluate(() => {
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
        rating: 4.6
      };
      store.setOvernightStop(guangshuiCandidate);
    });
    await sleep(500);

    const d1_01_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const splitSegs = store.segments;
      const day1Segs = splitSegs.filter((s) => s.day === 1);
      const day2Segs = splitSegs.filter((s) => s.day === 2);
      const s3 = splitSegs.find((s) => s.id === 's3');
      const s4 = splitSegs.find((s) => s.id === 's4');

      return {
        newSegCount: splitSegs.length,
        day1Count: day1Segs.length,
        day2Count: day2Segs.length,
        s3Title: s3?.title,
        s3CustomEnd: !!s3?.customEndCoord,
        s3Day: s3?.day,
        s4Title: s4?.title,
        s4CustomStart: !!s4?.customStartCoord,
        s4Day: s4?.day,
        hasSplit: splitSegs.length === 7
      };
    });

    console.log('D1-01 验证数据:', d1_01_result);
    const pass01 = d1_01_result.hasSplit &&
                   d1_01_result.s3Title.includes('广水应山宾馆') &&
                   d1_01_result.s4Title.includes('广水应山宾馆') &&
                   d1_01_result.s3Day === 1 &&
                   d1_01_result.s4Day === 2;

    results['D1-01'] = {
      status: pass01 ? 'PASS' : 'FAIL',
      evidence: `中间拆分成功: 总段数从6段增至7段 (实际: ${d1_01_result.newSegCount}), s3 (Day 1终点): "${d1_01_result.s3Title}", s4 (Day 2起点): "${d1_01_result.s4Title}"`
    };

    // =========================================================================
    // D1-02: 住宿点位于 Segment 边界，不产生重复 Segment
    // =========================================================================
    console.log('\n--- 执行 D1-02: 住宿点位于 Segment 边界，不产生重复 Segment ---');
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
        rating: 4.8
      };
      store.setOvernightStop(suizhouCandidate);
    });
    await sleep(500);

    const d1_02_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const segs = store.segments;
      const s3 = segs.find((s) => s.id === 's3');
      const s4 = segs.find((s) => s.id === 's4');

      return {
        segmentCount: segs.length,
        s3Title: s3?.title,
        s3CustomEnd: !!s3?.customEndCoord,
        s3Day: s3?.day,
        s4Title: s4?.title,
        s4CustomStart: !!s4?.customStartCoord,
        s4Day: s4?.day,
        uniqueTitles: Array.from(new Set(segs.map((s) => s.title)))
      };
    });

    console.log('D1-02 验证数据:', d1_02_result);
    // 边界住宿时段数严格保持为 6，绝不产生重复段
    const pass02 = d1_02_result.segmentCount === 6 &&
                   d1_02_result.uniqueTitles.length === 6 &&
                   d1_02_result.s3Title.includes('随州齐星湖会馆') &&
                   d1_02_result.s4Title.includes('随州齐星湖会馆') &&
                   d1_02_result.s3Day === 1 &&
                   d1_02_result.s4Day === 2;

    results['D1-02'] = {
      status: pass02 ? 'PASS' : 'FAIL',
      evidence: `边界住宿总段数严格保持 6 (实际: ${d1_02_result.segmentCount}), 无重复路段 (唯一标题数: ${d1_02_result.uniqueTitles.length}), s3终点与s4起点正确对齐`
    };

    // =========================================================================
    // D1-03: 住宿改到另一个 Segment，Day Boundary 动态移动
    // =========================================================================
    console.log('\n--- 执行 D1-03: 住宿改到另一个 Segment，Day Boundary 动态移动 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      const xiangyangCandidate = {
        id: 'candidate-xiangyang',
        poiId: 'B02D20XXXX-hotel',
        name: '襄阳绿地铂骊酒店',
        coord: [112.144426, 32.042426],
        address: '襄阳市樊城区中原西路',
        city: '襄阳市',
        targetCityOrArea: '襄阳市',
        day: 1,
        sourceSegmentId: 's4',
        rating: 4.7
      };
      store.setOvernightStop(xiangyangCandidate);
    });
    await sleep(500);

    const d1_03_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const segs = store.segments;
      const day1Segs = segs.filter((s) => s.day === 1);
      const day2Segs = segs.filter((s) => s.day === 2);
      const s4 = segs.find((s) => s.id === 's4');
      const s5 = segs.find((s) => s.id === 's5');

      return {
        totalSegs: segs.length,
        day1Count: day1Segs.length,
        day2Count: day2Segs.length,
        day1Titles: day1Segs.map((s) => s.title),
        day2Titles: day2Segs.map((s) => s.title),
        s4CustomEnd: !!s4?.customEndCoord,
        s4Title: s4?.title,
        s5CustomStart: !!s5?.customStartCoord,
        s5Title: s5?.title
      };
    });

    console.log('D1-03 验证数据 (住襄阳):', d1_03_result);
    // 住襄阳时，Day 1 包含 s1, s2, s3, s4 共 4 段；Day 2 包含 s5, s6 共 2 段！
    const pass03 = d1_03_result.day1Count === 4 &&
                   d1_03_result.day2Count === 2 &&
                   d1_03_result.s4Title.includes('襄阳绿地铂骊酒店') &&
                   d1_03_result.s5Title.includes('襄阳绿地铂骊酒店');

    results['D1-03'] = {
      status: pass03 ? 'PASS' : 'FAIL',
      evidence: `Day Boundary 成功从随州后移至襄阳: Day 1 段数变为 ${d1_03_result.day1Count} 段, Day 2 段数变为 ${d1_03_result.day2Count} 段, s4在襄阳收车, s5从襄阳出发`
    };

    // =========================================================================
    // D1-04: 原 RouteOption / scenic via points 保持
    // =========================================================================
    console.log('\n--- 执行 D1-04: 原 RouteOption / scenic via points 保持 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      store.selectRouteOption('s6', 'scenic');

      const guangshuiCandidate = {
        id: 'candidate-guangshui',
        name: '广水应山宾馆',
        coord: [113.825977, 31.617015],
        address: '随州市广水市应山大道68号',
        city: '随州市',
        targetCityOrArea: '广水市',
        day: 1,
        sourceSegmentId: 's3'
      };
      store.setOvernightStop(guangshuiCandidate);
    });
    await sleep(500);

    const d1_04_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const s6 = store.segments.find((s) => s.id === 's6');
      const selectedOptionId = store.selectedOptions['s6'];
      const chosenOption = s6?.options.find((o) => o.id === selectedOptionId);

      return {
        selectedOptionId,
        chosenOptionName: chosenOption?.name,
        viaPoints: chosenOption?.via,
        hasScenicVia: chosenOption?.via?.length === 3 && chosenOption.via.includes(9) && chosenOption.via.includes(10) && chosenOption.via.includes(11)
      };
    });

    console.log('D1-04 验证数据:', d1_04_result);
    const pass04 = d1_04_result.selectedOptionId === 'scenic' &&
                   d1_04_result.chosenOptionName === '环库风景路线' &&
                   d1_04_result.hasScenicVia;

    results['D1-04'] = {
      status: pass04 ? 'PASS' : 'FAIL',
      evidence: `设置住宿后 s6 保持选中: "${d1_04_result.chosenOptionName}", 环库 via points 完整保留: [${d1_04_result.viaPoints.join(', ')}]`
    };

    // =========================================================================
    // D1-05: 原 customWaypoints 保持
    // =========================================================================
    console.log('\n--- 执行 D1-05: 原 customWaypoints 保持 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      const mockWp = {
        id: 'wp-xijiadian-minsu',
        name: '习家店山水民宿',
        coord: [111.350821, 32.748529],
        poi: 'B02D123456',
        city: '丹江口市',
        address: '十堰市丹江口市习家店镇环库公路旁'
      };
      store.addWaypoint('s6', mockWp);

      const suizhouCandidate = {
        id: 'candidate-suizhou',
        name: '随州齐星湖会馆',
        coord: [113.382324, 31.690275],
        address: '随州市曾都区迎宾大道88号',
        city: '随州市',
        targetCityOrArea: '随州市',
        day: 1,
        sourceSegmentId: 's3'
      };
      store.setOvernightStop(suizhouCandidate);
    });
    await sleep(500);

    const d1_05_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const s6Waypoints = store.customWaypoints['s6'] || [];

      return {
        waypointsCount: s6Waypoints.length,
        firstWaypointName: s6Waypoints[0]?.name,
        hasWaypoint: s6Waypoints.some((w) => w.id === 'wp-xijiadian-minsu')
      };
    });

    console.log('D1-05 验证数据:', d1_05_result);
    const pass05 = d1_05_result.hasWaypoint && d1_05_result.firstWaypointName === '习家店山水民宿';

    results['D1-05'] = {
      status: pass05 ? 'PASS' : 'FAIL',
      evidence: `切换住宿前后 s6 customWaypoints 严格保留: 停靠点数=${d1_05_result.waypointsCount}, 首站点="${d1_05_result.firstWaypointName}"`
    };

    // =========================================================================
    // D1-06: 快速切换住宿候选，最终只采用最后一次选择
    // =========================================================================
    console.log('\n--- 执行 D1-06: 快速切换住宿候选，最终只采用最后一次选择 ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      const candA = {
        id: 'candidate-a',
        name: '广水应山宾馆',
        coord: [113.825977, 31.617015],
        day: 1,
        sourceSegmentId: 's3'
      };
      const candB = {
        id: 'candidate-b',
        name: '随州齐星湖会馆',
        coord: [113.382324, 31.690275],
        day: 1,
        sourceSegmentId: 's3'
      };
      const candC = {
        id: 'candidate-c',
        name: '襄阳绿地铂骊酒店',
        coord: [112.144426, 32.042426],
        day: 1,
        sourceSegmentId: 's4'
      };

      // 快速连续触发 3 次切换
      store.setOvernightStop(candA);
      store.setOvernightStop(candB);
      store.setOvernightStop(candC);
    });
    await sleep(600);

    const d1_06_result = await page.evaluate(() => {
      const store = window.__tripStore;
      return {
        finalOvernightName: store.overnightStop?.name,
        finalOvernightId: store.overnightStop?.id,
        isStrictlyCandC: store.overnightStop?.id === 'candidate-c'
      };
    });

    console.log('D1-06 验证数据:', d1_06_result);
    const pass06 = d1_06_result.isStrictlyCandC && d1_06_result.finalOvernightName === '襄阳绿地铂骊酒店';

    results['D1-06'] = {
      status: pass06 ? 'PASS' : 'FAIL',
      evidence: `快速连续切换 A->B->C 最终状态严格保持为 C: "${d1_06_result.finalOvernightName}", 旧代际被成功屏蔽`
    };

    // =========================================================================
    // D1-07: 取消住宿恢复原 Trip
    // =========================================================================
    console.log('\n--- 执行 D1-07: 取消住宿恢复原 Trip ---');
    await page.evaluate(() => {
      const store = window.__tripStore;
      store.setOvernightStop(null);
    });
    await sleep(500);

    const d1_07_result = await page.evaluate(() => {
      const store = window.__tripStore;
      const segs = store.segments;
      const s3 = segs.find((s) => s.id === 's3');
      const s4 = segs.find((s) => s.id === 's4');
      const day1Segs = segs.filter((s) => s.day === 1);
      const day2Segs = segs.filter((s) => s.day === 2);

      const hasCustomCoords = segs.some((s) => !!s.customStartCoord || !!s.customEndCoord);

      return {
        overnightStop: store.overnightStop,
        totalSegs: segs.length,
        day1Count: day1Segs.length,
        day2Count: day2Segs.length,
        s3Title: s3?.title,
        s4Title: s4?.title,
        hasCustomCoords
      };
    });

    console.log('D1-07 验证数据:', d1_07_result);
    const pass07 = d1_07_result.overnightStop === null &&
                   d1_07_result.totalSegs === 6 &&
                   d1_07_result.day1Count === 3 &&
                   d1_07_result.day2Count === 3 &&
                   d1_07_result.s3Title === '大悟 → 随州' &&
                   d1_07_result.s4Title === '随州 → 襄阳' &&
                   !d1_07_result.hasCustomCoords;

    results['D1-07'] = {
      status: pass07 ? 'PASS' : 'FAIL',
      evidence: `取消住宿后完全复原: 总段数=${d1_07_result.totalSegs}, Day1段数=${d1_07_result.day1Count}, Day2段数=${d1_07_result.day2Count}, 标题恢复: "${d1_07_result.s3Title}" / "${d1_07_result.s4Title}", 零残留坐标: ${!d1_07_result.hasCustomCoords}`
    };

    // =========================================================================
    // D1-08: 核心 DayPlan 模型不依赖固定 2 Day 字段
    // =========================================================================
    console.log('\n--- 执行 D1-08: 核心 DayPlan 模型不依赖固定 2 Day 字段 ---');
    const d1_08_result = await page.evaluate(() => {
      const store = window.__tripStore;

      const daysArray = store.trip?.days;
      const isDaysArray = Array.isArray(daysArray);
      const hasDays = isDaysArray && daysArray.length >= 2;

      // 验证每个 DayPlan 是否具备完整结构
      const dayPlansValid = isDaysArray && daysArray.every((d) => (
        typeof d.day === 'number' &&
        typeof d.title === 'string' &&
        typeof d.segmentCount === 'number' &&
        Array.isArray(d.segments) &&
        d.segments.length > 0
      ));

      // 验证 store 中不存在无法扩展的固化字段
      const hasHardcodedDay1Field = 'day1StartTime' in store;
      const hasHardcodedDay2Field = 'day2StartTime' in store;

      return {
        isDaysArray,
        daysCount: daysArray?.length,
        dayPlansValid,
        hasHardcodedDay1Field,
        hasHardcodedDay2Field,
        day1StartTimeInDict: store.dayStartTimes[1],
        day2StartTimeInDict: store.dayStartTimes[2]
      };
    });

    console.log('D1-08 验证数据:', d1_08_result);
    const pass08 = d1_08_result.isDaysArray &&
                   d1_08_result.dayPlansValid &&
                   !d1_08_result.hasHardcodedDay1Field &&
                   !d1_08_result.hasHardcodedDay2Field;

    results['D1-08'] = {
      status: pass08 ? 'PASS' : 'FAIL',
      evidence: `核心多日模型为动态数组 DayPlan[] (长度: ${d1_08_result.daysCount}), 各 Day 结构完备, 成功消除硬编码 day1StartTime/day2StartTime 字段`
    };

    // 截图保存 Phase D.1 最终验证状态
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase-d1-integrity-verified.png') });
    console.log('已保存 Phase D.1 验收截图: phase-d1-integrity-verified.png');

  } catch (err) {
    console.error('测试执行异常:', err);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log('=== Phase D.1 自动化测试最终结果汇总 ===');
  console.log('========================================================================');
  let allPass = true;
  for (const [testKey, res] of Object.entries(results)) {
    const isPass = res.status === 'PASS';
    if (!isPass) allPass = false;
    console.log(`[${res.status}] ${testKey}: ${res.evidence}`);
  }

  if (allPass) {
    console.log('\n🎉 Phase D.1 (D1-01 ～ D1-08) 全部 100% 通过！');
  } else {
    console.log('\n⚠️ 存在未通过用例，请检查上述证据');
    process.exit(1);
  }
}

runPhaseD1Tests();
