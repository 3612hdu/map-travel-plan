import { Stop } from '../types/trip';
import { RoutePreference, DEFAULT_PREFERENCE, mapPreferenceToUriPolicy } from '../types/preference';

// 高德官方导航调起服务
export function startAmapNavigation(
  targetStop: Stop,
  waypoints: Stop[] = [],
  preference: RoutePreference = DEFAULT_PREFERENCE
) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const viaParam = waypoints.map((w) => `${w.coord.join(',')},${w.name}`).join('|');
  const uriPolicy = mapPreferenceToUriPolicy(preference);

  if (isMobile) {
    // 调起移动端高德地图 App 导航
    const appUrl = new URL('amapuri://route/plan/');
    appUrl.searchParams.set('sourceApplication', 'RoutePlannerV2');
    appUrl.searchParams.set('dlat', String(targetStop.coord[1]));
    appUrl.searchParams.set('dlon', String(targetStop.coord[0]));
    appUrl.searchParams.set('dname', targetStop.name);
    appUrl.searchParams.set('dev', '0');
    appUrl.searchParams.set('t', '0'); // 驾车
    if (waypoints.length > 0) {
      appUrl.searchParams.set('via', viaParam);
    }
    window.location.href = appUrl.href;
  } else {
    // 桌面端使用高德官方网页实路导航
    const webUrl = new URL('https://uri.amap.com/navigation');
    webUrl.searchParams.set('to', `${targetStop.coord.join(',')},${targetStop.name}`);
    if (waypoints.length > 0) {
      webUrl.searchParams.set('via', `${waypoints[0].coord.join(',')},${waypoints[0].name}`);
    }
    webUrl.searchParams.set('mode', 'car');
    webUrl.searchParams.set('policy', uriPolicy); // 官方 URI API policy (3: 避高速, 2: 避收费, 1: 避拥堵)
    webUrl.searchParams.set('src', 'route-planner-v2');
    webUrl.searchParams.set('callnative', '1');
    window.open(webUrl.href, '_blank', 'noopener,noreferrer');
  }
}
