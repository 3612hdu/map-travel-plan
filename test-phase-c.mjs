import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5173/';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhaseCTest() {
  console.log('=== 开始 Phase C 沿路线走廊 POI 搜索系统自动化验证 ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

  try {
    console.log('1. 导航访问页面...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => typeof window.AMap !== 'undefined' && document.querySelector('#amap-root canvas'),
      { timeout: 20000 }
    );
    await sleep(4000);

    // 验证初始化全程规划成功
    const headerDistance = await page.$eval('.header-stats .stat-item .stat-val', el => el.textContent?.trim());
    console.log('初始全程实路里程:', headerDistance);

    // 2. 验证当前路段搜索 "酒店"
    console.log('2. 测试当前路段搜索 "酒店"...');
    await page.click('.search-input');
    await page.$eval('.search-input', (el) => (el.value = '酒店'));
    await page.type('.search-input', String.fromCharCode(13)); // Enter
    await sleep(2500);

    const segmentHotelCards = await page.$$eval('.facility-card-item', cards =>
      cards.slice(0, 3).map(c => ({
        name: c.querySelector('.facility-name')?.textContent?.trim(),
        dist: c.querySelector('.facility-distance-badge')?.textContent?.trim(),
        hasDetour: !!c.innerText.includes('预计绕行')
      }))
    );
    console.log('当前路段酒店搜索结果样例:', segmentHotelCards);

    // 截图当前路段搜索
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase-c-segment-hotel.png') });

    // 3. 验证切换作用域为 "全程走廊"
    console.log('3. 切换范围至 全程走廊 搜索...');
    await page.click('.scope-selector-btn');
    await sleep(400);
    // 点击 "全程走廊搜索"
    const scopeButtons = await page.$$('.search-corridor-wrapper ~ div button');
    for (const btn of scopeButtons) {
      const text = await (await btn.getProperty('textContent')).jsonValue();
      if (text && text.includes('全程')) {
        await btn.click();
        break;
      }
    }
    await sleep(3500);

    const tripHotelCount = await page.$$eval('.facility-card-item', cards => cards.length);
    const tripHotelSample = await page.$$eval('.facility-card-item', cards =>
      cards.slice(0, 4).map(c => ({
        name: c.querySelector('.facility-name')?.textContent?.trim(),
        dist: c.querySelector('.facility-distance-badge')?.textContent?.trim(),
        segmentTag: c.querySelector('span[style*="background: rgb(224, 231, 255)"]')?.textContent?.trim() || '无赛段标签'
      }))
    );
    console.log(`全程走廊检索到 ${tripHotelCount} 处顺路酒店:`, tripHotelSample);

    // 截图全程走廊搜索
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase-c-trip-corridor-hotel.png') });

    // 4. 测试快捷推荐词与分类切换 (例如 "特来电充电")
    console.log('4. 测试快捷推荐词 "特来电充电"...');
    const chipBtns = await page.$$('div button');
    for (const btn of chipBtns) {
      const text = await (await btn.getProperty('textContent')).jsonValue();
      if (text && text.includes('特来电')) {
        await btn.click();
        break;
      }
    }
    await sleep(2500);

    const evCards = await page.$$eval('.facility-card-item', cards =>
      cards.slice(0, 3).map(c => ({
        name: c.querySelector('.facility-name')?.textContent?.trim(),
        dist: c.querySelector('.facility-distance-badge')?.textContent?.trim()
      }))
    );
    console.log('特来电充电搜索结果样例:', evCards);

    // 5. 测试地图 Marker ↔ 卡片双向联动
    console.log('5. 测试卡片点击 -> 地图 InfoWindow 展开...');
    if (evCards.length > 0) {
      await page.click('.facility-card-item');
      await sleep(1000);

      const infoWindowContent = await page.evaluate(() => {
        const info = document.querySelector('.amap-info-content');
        return info ? info.textContent : null;
      });
      console.log('地图 InfoWindow 激活内容:', infoWindowContent ? '成功挂载且包含详情' : '未挂载');
    }

    // 6. 测试 "在地图上显示" 开关
    console.log('6. 测试 "在地图上显示" 取消勾选与恢复...');
    const markerCountBefore = await page.$$eval('.poi-custom-marker', ms => ms.length);
    await page.click('label input[type="checkbox"]');
    await sleep(500);
    const markerCountHidden = await page.$$eval('.poi-custom-marker', ms => ms.length);
    await page.click('label input[type="checkbox"]');
    await sleep(500);
    const markerCountRestored = await page.$$eval('.poi-custom-marker', ms => ms.length);

    console.log(`Marker 数量演变: 开启(${markerCountBefore}) -> 关闭(${markerCountHidden}) -> 恢复(${markerCountRestored})`);

    const errors = consoleLogs.filter(l => l.type === 'error');
    console.log('控制台错误数:', errors.length);

    console.log('=== Phase C 自动化验证完成！===');
  } catch (err) {
    console.error('测试异常:', err);
  } finally {
    await browser.close();
  }
}

runPhaseCTest();
