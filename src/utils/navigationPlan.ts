import { Segment, Stop, RouteOption } from '../types/trip';
import { RoutePreference } from '../types/preference';
import { RouteCalcResult } from '../types/map';
import { NavigationLeg, TripNavigationPlan } from '../types/navigationPlan';
import { verifiedStops } from '../data/stops';
import { orderPointsAlongRoute } from './geo';

/**
 * 编译整趟自驾行程为按序执行的全程导航计划 (TripNavigationPlan)
 * 严格保留：
 * - 每一段实际选定的走法 (RouteOption: scenic, direct, compromise 等)
 * - 用户追加的自定义停靠点与风景途经点 (按沿路实际顺序排布)
 * - 起终点 (支持住宿拆分重置后的自定义起终点)
 * - 实时高德实路算路里程与耗时
 */
export function buildTripNavigationPlan(
  segments: Segment[],
  selectedOptions: Record<string, string>,
  routeResults: Record<string, RouteCalcResult>,
  customWaypoints: Record<string, Stop[]>,
  preference: RoutePreference
): TripNavigationPlan {
  const legs: NavigationLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalTolls = 0;

  segments.forEach((seg, index) => {
    const optId = selectedOptions[seg.id] || seg.chosen;
    const option = seg.options.find((o) => o.id === optId) || seg.options[0];
    const res = routeResults[`${seg.id}:${optId}`];

    // 起点解析
    const startStop: Stop = seg.customStartCoord
      ? {
          id: `start-${seg.id}`,
          name: seg.customStartName || '自定义起点',
          coord: seg.customStartCoord,
          poi: '',
          city: verifiedStops[seg.start]?.city || '湖北'
        }
      : verifiedStops[seg.start] || {
          id: `start-${seg.id}`,
          name: seg.title.split('→')[0]?.trim() || '起点',
          coord: [114.927342, 30.449045],
          poi: '',
          city: '湖北'
        };

    // 终点解析
    const endStop: Stop = seg.customEndCoord
      ? {
          id: `end-${seg.id}`,
          name: seg.customEndName || '自定义终点',
          coord: seg.customEndCoord,
          poi: '',
          city: verifiedStops[seg.end]?.city || '湖北'
        }
      : verifiedStops[seg.end] || {
          id: `end-${seg.id}`,
          name: seg.title.split('→')[1]?.trim() || '终点',
          coord: [110.813261, 32.835532],
          poi: '',
          city: '湖北'
        };

    // 风景途经点解析
    const scenicStops: Stop[] = (option.via || [])
      .map((idx) => verifiedStops[idx])
      .filter((s): s is Stop => Boolean(s));

    // 用户追加停靠点
    const userCustomStops = customWaypoints[seg.id] || [];

    // 合并并沿路线几何投影排序，杜绝回头路
    const combinedWaypoints = [...scenicStops, ...userCustomStops];
    let orderedWaypoints: Stop[] = combinedWaypoints;
    if (res?.path && res.path.length >= 2 && combinedWaypoints.length > 1) {
      orderedWaypoints = orderPointsAlongRoute(combinedWaypoints, res.path);
    }

    const dist = res?.distance || 0;
    const dur = res?.time || 0;
    const tolls = res?.tolls || 0;

    totalDistanceMeters += dist;
    totalDurationSeconds += dur;
    totalTolls += tolls;

    legs.push({
      legIndex: index + 1,
      segmentId: seg.id,
      day: seg.day,
      title: seg.title,
      startStop,
      endStop,
      chosenOption: option,
      orderedWaypoints,
      distanceMeters: dist,
      durationSeconds: dur,
      tolls,
      roads: res?.roads || []
    });
  });

  const uniqueDays = Array.from(new Set(segments.map((s) => s.day))).length;

  return {
    legs,
    totalDistanceMeters,
    totalDurationSeconds,
    totalTolls,
    totalDays: uniqueDays || 2,
    preference,
    generatedAt: new Date().toISOString()
  };
}
