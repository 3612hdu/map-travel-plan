import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5173/';
const SCREENSHOT_DIR = path.resolve('docs/mobile');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifyMobile() {
  console.log('=== 开始移动端适配自动化验收 (390x844 iPhone Viewport) ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  // iPhone 13/14 尺寸
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const results = {};

  try {
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));

    // 1. 检查底部导航栏
    const bottomNavExists = await page.$('.mobile-bottom-nav');
    const bottomNavVisible = await page.$eval('.mobile-bottom-nav', (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    console.log('底部导航栏可见性:', bottomNavVisible);
    results['MOBILE_BOTTOM_NAV'] = bottomNavVisible ? 'PASS' : 'FAIL';

    // 2. 检查默认 tab: map 视图
    const mapVisible = await page.$eval('.center-map-area', (el) => window.getComputedStyle(el).display !== 'none');
    const sidebarHidden = await page.$eval('.sidebar-left', (el) => window.getComputedStyle(el).display === 'none');
    const rightPanelHidden = await page.$eval('.right-panel-shared', (el) => window.getComputedStyle(el).display === 'none');

    // 检查路线卡片横向滚动
    const optionsGridDisplay = await page.$eval('.route-options-grid', (el) => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        overflowX: style.overflowX
      };
    });
    console.log('路线卡片网格样式:', optionsGridDisplay);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-mobile-map-view.png') });
    results['MOBILE_MAP_VIEW'] = (mapVisible && sidebarHidden && rightPanelHidden) ? 'PASS' : 'FAIL';

    // 3. 点击「行程分段」Tab
    await page.click('#btn-mobile-nav-trip');
    await new Promise((r) => setTimeout(r, 800));

    const tripSidebarVisible = await page.$eval('.sidebar-left', (el) => window.getComputedStyle(el).display !== 'none');
    const tripMapHidden = await page.$eval('.center-map-area', (el) => window.getComputedStyle(el).display === 'none');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-mobile-trip-view.png') });
    results['MOBILE_TRIP_VIEW'] = (tripSidebarVisible && tripMapHidden) ? 'PASS' : 'FAIL';

    // 4. 在行程分段中点击一个路段卡片（例如第 1 段 s1），测试自动切回地图查看
    const segmentCards = await page.$$('.segment-card');
    if (segmentCards.length > 0) {
      await segmentCards[0].click();
      await new Promise((r) => setTimeout(r, 800));
    }
    const autoSwitchedToMap = await page.$eval('.center-map-area', (el) => window.getComputedStyle(el).display !== 'none');
    results['MOBILE_SEGMENT_CLICK_TO_MAP'] = autoSwitchedToMap ? 'PASS' : 'FAIL';
    console.log('点击行程卡片后自动切回地图查看:', autoSwitchedToMap);

    // 5. 点击「沿途影像」Tab
    await page.click('#btn-mobile-nav-media');
    await new Promise((r) => setTimeout(r, 800));

    const mediaPanelVisible = await page.$eval('.right-panel-shared', (el) => window.getComputedStyle(el).display !== 'none');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-mobile-media-view.png') });
    results['MOBILE_MEDIA_VIEW'] = mediaPanelVisible ? 'PASS' : 'FAIL';

    // 6. 点击「沿途设施」Tab
    await page.click('#btn-mobile-nav-facilities');
    await new Promise((r) => setTimeout(r, 800));

    const facilitiesVisible = await page.$eval('.right-panel-shared', (el) => window.getComputedStyle(el).display !== 'none');
    const categoryBarScrollable = await page.$eval('.category-filter-bar', (el) => {
      const style = window.getComputedStyle(el);
      return style.overflowX === 'auto';
    });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-mobile-facilities-view.png') });
    results['MOBILE_FACILITIES_VIEW'] = (facilitiesVisible && categoryBarScrollable) ? 'PASS' : 'FAIL';

    // 7. 测试移动端启动「全程导航计划」模态框
    const navPlanBtn = await page.$('#btn-header-nav-plan');
    if (navPlanBtn) {
      await navPlanBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const modalVisible = await page.$('.navigation-plan-modal-container, .modal-content-card');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-mobile-nav-modal.png') });
      results['MOBILE_NAV_MODAL'] = !!modalVisible ? 'PASS' : 'FAIL';
    }

  } catch (err) {
    console.error('移动端测试执行异常:', err);
  } finally {
    await browser.close();
  }

  console.log('=== 移动端测试结果汇总 ===');
  console.log(JSON.stringify(results, null, 2));
}

verifyMobile();
