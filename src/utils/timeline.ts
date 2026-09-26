import { Segment, RouteOption, Stop, OvernightStop, TimelineItem } from '../types/trip';
import { RouteCalcResult } from '../types/map';
import { verifiedStops } from '../data/stops';

/**
 * 将 "12:00" 格式的时间字符串解析为自当日零点起的分钟数
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 12 * 60;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 12 * 60;
  return hours * 60 + minutes;
}

/**
 * 将分钟数转换为 "HH:mm" 格式
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * 在给定时间字符串上累加分钟数
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const current = parseTimeToMinutes(timeStr);
  return formatMinutesToTime(current + minutesToAdd);
}

/**
 * 生成动态行程时间轴列表
 */
export function generateTimelineItems(
  segments: Segment[],
  selectedOptions: Record<string, string>,
  routeResults: Record<string, RouteCalcResult>,
  customWaypoints: Record<string, Stop[]>,
  dayStartTimes: Record<number, string> = { 1: '12:00', 2: '09:00' },
  overnightStop: OvernightStop | null = null,
  activeDay: number | 'all' = 'all'
): TimelineItem[] {
  const items: TimelineItem[] = [];

  const day1StartTime = dayStartTimes[1] || '12:00';
  const day2StartTime = dayStartTimes[2] || '09:00';

  // ==========================================
  // DAY 1 时间轴推算
  // ==========================================
  if (activeDay === 1 || activeDay === 'all') {
    const day1Segments = segments.filter((s) => s.day === 1);
    let currentMinutes = parseTimeToMinutes(day1StartTime);
    let isDay1Pending = false;

    // 1. Day 1 出发节点
    const firstSeg = day1Segments[0];
    const departureTitle = firstSeg?.customStartName || verifiedStops[firstSeg?.start]?.name || '黄冈师范学院';
    items.push({
      id: 'd1-departure',
      day: 1,
      type: 'departure',
      title: `${departureTitle}出发`,
      subTitle: '自驾启程 · 不走高速 · 平稳出城',
      plannedTime: formatMinutesToTime(currentMinutes),
      coord: firstSeg?.customStartCoord || verifiedStops[firstSeg?.start]?.coord,
      isPendingRoute: false
    });

    // 2. 依次推算 Day 1 各路段
    day1Segments.forEach((seg, idx) => {
      const optId = selectedOptions[seg.id] || seg.chosen;
      const res = routeResults[`${seg.id}:${optId}`];
      const isLastOfD1 = idx === day1Segments.length - 1;

      if (!res || !res.time || isDay1Pending) {
        isDay1Pending = true;
        // 等待数据状态
        const endName = isLastOfD1 && overnightStop
          ? overnightStop.name
          : seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();

        items.push({
          id: `d1-${seg.id}-end`,
          day: 1,
          type: isLastOfD1 ? 'overnight' : 'segmentEnd',
          title: isLastOfD1 ? `今晚住宿 · ${endName}` : endName,
          subTitle: isLastOfD1 ? '今日终点收车' : '等待高德路况数据',
          plannedTime: '等待路线数据',
          isOvernight: isLastOfD1,
          linkedSegmentId: seg.id,
          coord: isLastOfD1 && overnightStop ? overnightStop.coord : seg.customEndCoord || verifiedStops[seg.end]?.coord,
          isPendingRoute: true
        });
      } else {
        const segDurationMin = Math.round(res.time / 60);
        const segDistKm = Number((res.distance / 1000).toFixed(0));
        currentMinutes += segDurationMin;
        const arrivalTimeStr = formatMinutesToTime(currentMinutes);

        // 如果是路段自定义途经点
        const waypoints = customWaypoints[seg.id] || [];
        waypoints.forEach((wp, wpIdx) => {
          items.push({
            id: `d1-${seg.id}-wp-${wpIdx}`,
            day: 1,
            type: 'waypoint',
            title: `停靠点 · ${wp.name}`,
            subTitle: wp.address || '沿途途经停靠',
            plannedTime: arrivalTimeStr,
            durationMinutes: 10,
            linkedSegmentId: seg.id,
            linkedPoiId: wp.poi || wp.id,
            coord: wp.coord,
            isPendingRoute: false
          });
        });

        if (isLastOfD1) {
          // Day 1 最后一站：住宿点
          const hotelName = overnightStop ? overnightStop.name : (seg.customEndName || '随州市区 (默认规划)');
          const hotelCity = overnightStop?.targetCityOrArea || overnightStop?.city || '随州市';
          items.push({
            id: 'd1-overnight-stop',
            day: 1,
            type: 'overnight',
            title: `今晚住宿 · ${hotelName}`,
            subTitle: `今日收车 (${hotelCity}) · 预计 ${arrivalTimeStr} 抵达 · 今日开行 ${segDistKm} km`,
            plannedTime: arrivalTimeStr,
            durationMinutes: segDurationMin,
            distanceKm: segDistKm,
            isOvernight: true,
            linkedSegmentId: seg.id,
            linkedPoiId: overnightStop?.poiId || overnightStop?.id,
            coord: overnightStop ? overnightStop.coord : seg.customEndCoord || verifiedStops[seg.end]?.coord,
            isPendingRoute: false
          });
        } else {
          // 常规路段终点
          const endName = seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();
          items.push({
            id: `d1-${seg.id}-end`,
            day: 1,
            type: 'segmentEnd',
            title: endName,
            subTitle: `已行驶约 ${segDistKm} km · 用时 ${segDurationMin} 分钟`,
            plannedTime: arrivalTimeStr,
            durationMinutes: segDurationMin,
            distanceKm: segDistKm,
            linkedSegmentId: seg.id,
            coord: seg.customEndCoord || verifiedStops[seg.end]?.coord,
            isPendingRoute: false
          });

          // 默认路段间休息 15 分钟
          items.push({
            id: `d1-${seg.id}-rest`,
            day: 1,
            type: 'rest',
            title: `${endName}休整补给`,
            subTitle: '下车活动、加油补电与简餐',
            plannedTime: arrivalTimeStr,
            durationMinutes: 15,
            linkedSegmentId: seg.id,
            isPendingRoute: false
          });
          currentMinutes += 15;
        }
      }
    });
  }

  // ==========================================
  // DAY 2 时间轴推算
  // ==========================================
  if (activeDay === 2 || activeDay === 'all') {
    const day2Segments = segments.filter((s) => s.day === 2);
    let currentMinutes = parseTimeToMinutes(day2StartTime);
    let isDay2Pending = false;

    // 1. Day 2 出发节点 (从住宿点出发)
    const firstD2Seg = day2Segments[0];
    const departurePlace = overnightStop
      ? overnightStop.name
      : firstD2Seg?.customStartName || verifiedStops[firstD2Seg?.start]?.name || '随州市区';

    items.push({
      id: 'd2-departure',
      day: 2,
      type: 'departure',
      title: `${departurePlace}出发`,
      subTitle: '第二日自驾启程 · 满电/满油出发',
      plannedTime: formatMinutesToTime(currentMinutes),
      coord: overnightStop ? overnightStop.coord : firstD2Seg?.customStartCoord || verifiedStops[firstD2Seg?.start]?.coord,
      isPendingRoute: false
    });

    // 2. 依次推算 Day 2 各路段
    day2Segments.forEach((seg, idx) => {
      const optId = selectedOptions[seg.id] || seg.chosen;
      const res = routeResults[`${seg.id}:${optId}`];
      const isLastOfTrip = idx === day2Segments.length - 1;

      if (!res || !res.time || isDay2Pending) {
        isDay2Pending = true;
        const endName = seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();

        items.push({
          id: `d2-${seg.id}-end`,
          day: 2,
          type: isLastOfTrip ? 'segmentEnd' : 'segmentEnd',
          title: isLastOfTrip ? `终点抵达 · ${endName}` : endName,
          subTitle: isLastOfTrip ? '两日自驾圆满完成' : '等待高德路况数据',
          plannedTime: '等待路线数据',
          linkedSegmentId: seg.id,
          coord: seg.customEndCoord || verifiedStops[seg.end]?.coord,
          isPendingRoute: true
        });
      } else {
        const segDurationMin = Math.round(res.time / 60);
        const segDistKm = Number((res.distance / 1000).toFixed(0));
        currentMinutes += segDurationMin;
        const arrivalTimeStr = formatMinutesToTime(currentMinutes);

        // 自定义途经点
        const waypoints = customWaypoints[seg.id] || [];
        waypoints.forEach((wp, wpIdx) => {
          items.push({
            id: `d2-${seg.id}-wp-${wpIdx}`,
            day: 2,
            type: 'waypoint',
            title: `停靠点 · ${wp.name}`,
            subTitle: wp.address || '沿途风景打卡',
            plannedTime: arrivalTimeStr,
            durationMinutes: 15,
            linkedSegmentId: seg.id,
            linkedPoiId: wp.poi || wp.id,
            coord: wp.coord,
            isPendingRoute: false
          });
        });

        if (isLastOfTrip) {
          // 全程终点
          const endName = seg.customEndName || verifiedStops[seg.end]?.name || '郧阳区人民政府';
          items.push({
            id: 'd2-trip-finish',
            day: 2,
            type: 'segmentEnd',
            title: `终点抵达 · ${endName}`,
            subTitle: `湖北两日自驾圆满完成！今日开行 ${segDistKm} km · 用时 ${segDurationMin} 分钟`,
            plannedTime: arrivalTimeStr,
            durationMinutes: segDurationMin,
            distanceKm: segDistKm,
            linkedSegmentId: seg.id,
            coord: seg.customEndCoord || verifiedStops[seg.end]?.coord,
            isPendingRoute: false
          });
        } else {
          // 常规路段终点
          const endName = seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();
          items.push({
            id: `d2-${seg.id}-end`,
            day: 2,
            type: 'segmentEnd',
            title: endName,
            subTitle: `已行驶约 ${segDistKm} km · 用时 ${segDurationMin} 分钟`,
            plannedTime: arrivalTimeStr,
            durationMinutes: segDurationMin,
            distanceKm: segDistKm,
            linkedSegmentId: seg.id,
            coord: seg.customEndCoord || verifiedStops[seg.end]?.coord,
            isPendingRoute: false
          });

          // 休息 15 分钟
          items.push({
            id: `d2-${seg.id}-rest`,
            day: 2,
            type: 'rest',
            title: `${endName}休整补给`,
            subTitle: '下车观景活动、充电加油',
            plannedTime: arrivalTimeStr,
            durationMinutes: 15,
            linkedSegmentId: seg.id,
            isPendingRoute: false
          });
          currentMinutes += 15;
        }
      }
    });
  }

  return items;
}

/**
 * 计算住宿候选方案的决策对比指标
 */
export function calculateOvernightDecision(
  candidate: OvernightStop,
  day1BaseDistanceKm: number, // s1 + s2 里程
  day1BaseDurationSec: number, // s1 + s2 耗时
  day2BaseDistanceKm: number, // s5 + s6 里程
  day2BaseDurationSec: number, // s5 + s6 耗时
  day1StartTime = '12:00'
): OvernightStop {
  // 根据候选所属城市/区域估算或实测 s3 与 s4
  const isGuangshui = candidate.targetCityOrArea?.includes('广水') || candidate.name.includes('广水');
  const isSuizhou = candidate.targetCityOrArea?.includes('随州') || candidate.name.includes('随州');

  let s3Km = 78;
  let s3Sec = 5400; // 1.5h
  let s4Km = 145;
  let s4Sec = 9600; // 2h40m

  if (isGuangshui) {
    // 广水在大悟到随州中间 (大悟 -> 广水约 32km, 40min; 广水 -> 襄阳约 190km, 3.5h)
    s3Km = 32;
    s3Sec = 2400;
    s4Km = 191;
    s4Sec = 12600;
  } else if (isSuizhou) {
    // 随州在 s3 终点 (大悟 -> 随州约 78km, 1.5h; 随州 -> 襄阳约 145km, 2.6h)
    s3Km = 78;
    s3Sec = 5400;
    s4Km = 145;
    s4Sec = 9600;
  }

  const todayDrivingKm = Math.round(day1BaseDistanceKm + s3Km);
  const todayDrivingDurationSec = day1BaseDurationSec + s3Sec;
  const tomorrowRemainingKm = Math.round(s4Km + day2BaseDistanceKm);
  const tomorrowRemainingDurationSec = s4Sec + day2BaseDurationSec;

  // 推算今天到达时间
  const startMin = parseTimeToMinutes(day1StartTime);
  const totalMin = startMin + Math.round(todayDrivingDurationSec / 60) + 30; // 含中途休整 30 分钟
  const todayEta = formatMinutesToTime(totalMin);

  // 决策推荐打标 (更均衡 / 今天更轻松 / 明天更轻松)
  const durationDiffHours = (todayDrivingDurationSec - tomorrowRemainingDurationSec) / 3600;
  let decisionTag: 'more_balanced' | 'today_relaxed' | 'tomorrow_relaxed' = 'more_balanced';
  let decisionLabel = '更均衡';
  let decisionReason = '两日驾驶时间分布相对均匀，节奏舒适。';

  if (durationDiffHours < -1.2) {
    decisionTag = 'today_relaxed';
    decisionLabel = '今天更轻松';
    decisionReason = `第一天行车约 ${Math.round(todayDrivingDurationSec / 3600)} 小时，傍晚 ${todayEta} 左右即可早早收车休整；次日驾驶负担略重。`;
  } else if (durationDiffHours > 1.2) {
    decisionTag = 'tomorrow_relaxed';
    decisionLabel = '明天更轻松';
    decisionReason = `第一天多开一段直抵市区，第二天去往丹江口和郧阳更从容，风景路段游玩时间更充裕。`;
  } else {
    decisionTag = 'more_balanced';
    decisionLabel = '更均衡';
    decisionReason = `两日行车强度最均衡 (今日约 ${(todayDrivingDurationSec / 3600).toFixed(1)}h · 明日约 ${(tomorrowRemainingDurationSec / 3600).toFixed(1)}h)，不易疲劳。`;
  }

  return {
    ...candidate,
    todayDrivingKm,
    todayDrivingDurationSec,
    todayEta,
    tomorrowRemainingKm,
    tomorrowRemainingDurationSec,
    decisionTag,
    decisionLabel,
    decisionReason
  };
}
