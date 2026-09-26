import { Stop } from '../types/trip';
import { RoutePreference, DEFAULT_PREFERENCE, mapPreferenceToUriPolicy, mapPreferenceToMobileAppPolicy } from '../types/preference';
import { NavigationLeg } from '../types/navigationPlan';

export function detectMobileMapPlatform(): 'ios' | 'android' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android|HarmonyOS/i.test(userAgent)) return 'android';
  return 'web';
}

/** 生成已填入起终点和全部途经点的高德路线规划链接。 */
export function generateAmapNavigationUrl(
  targetStop: Stop,
  waypoints: Stop[] = [],
  preference: RoutePreference = DEFAULT_PREFERENCE,
  startStop?: Stop
): string {
  const platform = detectMobileMapPlatform();
  const uriPolicy = mapPreferenceToUriPolicy(preference);

  if (platform !== 'web') {
    const appUrl = new URL(platform === 'ios' ? 'iosamap://path' : 'amapuri://route/plan/');
    appUrl.searchParams.set('sourceApplication', 'MapTravelPlan');
    if (startStop) {
      appUrl.searchParams.set('slat', String(startStop.coord[1]));
      appUrl.searchParams.set('slon', String(startStop.coord[0]));
      appUrl.searchParams.set('sname', startStop.name);
      if (startStop.poi) appUrl.searchParams.set('sid', startStop.poi);
    }
    appUrl.searchParams.set('dlat', String(targetStop.coord[1]));
    appUrl.searchParams.set('dlon', String(targetStop.coord[0]));
    appUrl.searchParams.set('dname', targetStop.name);
    if (targetStop.poi) appUrl.searchParams.set('did', targetStop.poi);
    appUrl.searchParams.set('dev', '0');
    appUrl.searchParams.set('t', '0'); // 驾车
    appUrl.searchParams.set('m', mapPreferenceToMobileAppPolicy(preference));
    if (waypoints.length > 0) {
      appUrl.searchParams.set('vian', String(waypoints.length));
      appUrl.searchParams.set('vialons', waypoints.map((stop) => stop.coord[0]).join('|'));
      appUrl.searchParams.set('vialats', waypoints.map((stop) => stop.coord[1]).join('|'));
      appUrl.searchParams.set('vianames', waypoints.map((stop) => stop.name.replaceAll('|', ' ')).join('|'));
    }
    return appUrl.href;
  }

  // 桌面端官方实路导航
  const webUrl = new URL('https://uri.amap.com/navigation');
  if (startStop) {
    webUrl.searchParams.set('from', `${startStop.coord.join(',')},${startStop.name}`);
  }
  webUrl.searchParams.set('to', `${targetStop.coord.join(',')},${targetStop.name}`);
  if (waypoints.length > 0) {
    // 桌面端取关键主要途经点
    webUrl.searchParams.set('via', `${waypoints[0].coord.join(',')},${waypoints[0].name}`);
  }
  webUrl.searchParams.set('mode', 'car');
  webUrl.searchParams.set('policy', uriPolicy);
  webUrl.searchParams.set('src', 'route-planner-v2');
  webUrl.searchParams.set('callnative', '0');
  return webUrl.href;
}

/**
 * 调起单个目的地的高德导航
 */
export function startAmapNavigation(
  targetStop: Stop,
  waypoints: Stop[] = [],
  preference: RoutePreference = DEFAULT_PREFERENCE,
  startStop?: Stop
) {
  const url = generateAmapNavigationUrl(targetStop, waypoints, preference, startStop);
  const isMobile = detectMobileMapPlatform() !== 'web';

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * 调起导航计划中的具体某一 Leg (路段)
 */
export function startLegNavigation(
  leg: NavigationLeg,
  preference: RoutePreference = DEFAULT_PREFERENCE
) {
  startAmapNavigation(leg.endStop, leg.orderedWaypoints, preference, leg.startStop);
}
