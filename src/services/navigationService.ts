import { Stop } from '../types/trip';
import { RoutePreference, DEFAULT_PREFERENCE, mapPreferenceToUriPolicy } from '../types/preference';
import { NavigationLeg } from '../types/navigationPlan';

/**
 * 生成高德导航 URI 链接字符串 (供桌面端 Web 实路导航与测试断言)
 */
export function generateAmapNavigationUrl(
  targetStop: Stop,
  waypoints: Stop[] = [],
  preference: RoutePreference = DEFAULT_PREFERENCE,
  startStop?: Stop
): string {
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const uriPolicy = mapPreferenceToUriPolicy(preference);

  if (isMobile) {
    const appUrl = new URL('amapuri://route/plan/');
    appUrl.searchParams.set('sourceApplication', 'RoutePlannerV2');
    if (startStop) {
      appUrl.searchParams.set('slat', String(startStop.coord[1]));
      appUrl.searchParams.set('slon', String(startStop.coord[0]));
      appUrl.searchParams.set('sname', startStop.name);
    }
    appUrl.searchParams.set('dlat', String(targetStop.coord[1]));
    appUrl.searchParams.set('dlon', String(targetStop.coord[0]));
    appUrl.searchParams.set('dname', targetStop.name);
    appUrl.searchParams.set('dev', '0');
    appUrl.searchParams.set('t', '0'); // 驾车
    if (waypoints.length > 0) {
      const viaParam = waypoints.map((w) => `${w.coord.join(',')},${w.name}`).join('|');
      appUrl.searchParams.set('via', viaParam);
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
  webUrl.searchParams.set('callnative', '1');
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
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
