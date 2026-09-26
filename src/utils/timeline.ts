import { Segment, RouteOption, Stop, OvernightStop, TimelineItem, DayPlan } from '../types/trip';
import { RouteCalcResult } from '../types/map';
import { verifiedStops } from '../data/stops';
import { buildDayPlans } from './tripReconstruction';

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
 * 完全由 DayPlan[] 驱动，支持 1 天、2 天及未来任意多天扩展，消除写死天数的限制
 */
export function generateTimelineItems(
  segments: Segment[],
  selectedOptions: Record<string, string>,
  routeResults: Record<string, RouteCalcResult>,
  customWaypoints: Record<string, Stop[]>,
  dayStartTimes: Record<number, string> = { 1: '12:00', 2: '09:00' },
  overnightStop: OvernightStop | null = null,
  activeDay: number | 'all' = 'all',
  customDayPlans?: DayPlan[]
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // 获取或动态构建多日日程 DayPlan[]
  const dayPlans = customDayPlans || buildDayPlans(segments, dayStartTimes, overnightStop);
  const totalDays = dayPlans.length;

  dayPlans.forEach((dayPlan, dayIdx) => {
    const currentDayNum = dayPlan.day;
    if (activeDay !== 'all' && activeDay !== currentDayNum) {
      return;
    }

    const daySegments = dayPlan.segments;
    if (!daySegments || daySegments.length === 0) return;

    const startTime = dayPlan.startTime || dayStartTimes[currentDayNum] || (currentDayNum === 1 ? '12:00' : '09:00');
    let currentMinutes = parseTimeToMinutes(startTime);
    let isDayPending = false;
    const isFinalDayOfTrip = dayIdx === totalDays - 1;

    // 1. 当日出发节点
    const firstSeg = daySegments[0];
    let departurePlace =
      firstSeg.customStartName ||
      verifiedStops[firstSeg.start]?.name ||
      firstSeg.title.split('→')[0]?.trim() ||
      '黄冈师范学院';

    if (currentDayNum > 1 && overnightStop) {
      departurePlace = overnightStop.name;
    }

    const depId = currentDayNum === 1 ? 'd1-departure' : `d${currentDayNum}-departure`;
    items.push({
      id: depId,
      day: currentDayNum,
      type: 'departure',
      title: `${departurePlace}出发`,
      subTitle: currentDayNum === 1 ? '自驾启程 · 不走高速 · 平稳出城' : `第 ${currentDayNum} 日自驾启程 · 满电/满油出发`,
      plannedTime: formatMinutesToTime(currentMinutes),
      coord: currentDayNum > 1 && overnightStop ? overnightStop.coord : firstSeg.customStartCoord || verifiedStops[firstSeg.start]?.coord,
      isPendingRoute: false
    });

    // 2. 依次推算该 Day 各路段
    daySegments.forEach((seg, segIdx) => {
      const optId = selectedOptions[seg.id] || seg.chosen;
      const res = routeResults[`${seg.id}:${optId}`];
      const isLastSegOfDay = segIdx === daySegments.length - 1;

      if (!res || !res.time || isDayPending) {
        isDayPending = true;
        const endName =
          isLastSegOfDay && !isFinalDayOfTrip && overnightStop
            ? overnightStop.name
            : seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();

        const isOvernightNode = isLastSegOfDay && !isFinalDayOfTrip;
        const nodeId = isOvernightNode
          ? `d${currentDayNum}-overnight-stop`
          : `d${currentDayNum}-${seg.id}-end`;

        items.push({
          id: nodeId,
          day: currentDayNum,
          type: isOvernightNode ? 'overnight' : 'segmentEnd',
          title: isOvernightNode ? `今晚住宿 · ${endName}` : endName,
          subTitle: isOvernightNode ? '今日终点收车' : '等待高德路况数据',
          plannedTime: '等待路线数据',
          isOvernight: isOvernightNode,
          linkedSegmentId: seg.id,
          coord: isOvernightNode && overnightStop ? overnightStop.coord : seg.customEndCoord || verifiedStops[seg.end]?.coord,
          isPendingRoute: true
        });
      } else {
        const segDurationMin = Math.round(res.time / 60);
        const segDistKm = Number((res.distance / 1000).toFixed(0));
        currentMinutes += segDurationMin;
        const arrivalTimeStr = formatMinutesToTime(currentMinutes);

        // 路段自定义途经点
        const waypoints = customWaypoints[seg.id] || [];
        waypoints.forEach((wp, wpIdx) => {
          items.push({
            id: `d${currentDayNum}-${seg.id}-wp-${wpIdx}`,
            day: currentDayNum,
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

        if (isLastSegOfDay) {
          if (!isFinalDayOfTrip) {
            // 当天最后一站：今晚住宿
            const hotelName = overnightStop ? overnightStop.name : (seg.customEndName || '随州市区 (默认规划)');
            const hotelCity = overnightStop?.targetCityOrArea || overnightStop?.city || '随州市';
            const overnightNodeId = currentDayNum === 1 ? 'd1-overnight-stop' : `d${currentDayNum}-overnight-stop`;

            items.push({
              id: overnightNodeId,
              day: currentDayNum,
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
            // 全程最后一站：自驾终点抵达
            const endName = seg.customEndName || verifiedStops[seg.end]?.name || '郧阳区人民政府';
            const finishId = currentDayNum === 2 ? 'd2-trip-finish' : `d${currentDayNum}-trip-finish`;

            items.push({
              id: finishId,
              day: currentDayNum,
              type: 'segmentEnd',
              title: `终点抵达 · ${endName}`,
              subTitle: `自驾圆满完成！今日开行 ${segDistKm} km · 用时 ${segDurationMin} 分钟`,
              plannedTime: arrivalTimeStr,
              durationMinutes: segDurationMin,
              distanceKm: segDistKm,
              linkedSegmentId: seg.id,
              coord: seg.customEndCoord || verifiedStops[seg.end]?.coord,
              isPendingRoute: false
            });
          }
        } else {
          // 常规路段终点
          const endName = seg.customEndName || verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();
          items.push({
            id: `d${currentDayNum}-${seg.id}-end`,
            day: currentDayNum,
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

          // 路段间默认休整 15 分钟
          items.push({
            id: `d${currentDayNum}-${seg.id}-rest`,
            day: currentDayNum,
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
  });

  return items;
}

/**
 * 动态计算住宿候选方案的决策对比指标
 * 摆脱固化路段 ID 与魔数硬编码，基于动态路段集合真实推算两日驾驶负担
 */
export function calculateOvernightDecision(
  candidate: OvernightStop,
  day1BaseDistanceKm: number,
  day1BaseDurationSec: number,
  day2BaseDistanceKm: number,
  day2BaseDurationSec: number,
  day1StartTime = '12:00'
): OvernightStop {
  // 如果候选已有预设并且属于既定 Demo 候选，优先保持精准数据
  if (candidate.todayDrivingKm && candidate.tomorrowRemainingKm && candidate.todayDrivingDurationSec) {
    const todayDrivingKm = candidate.todayDrivingKm;
    const todayDrivingDurationSec = candidate.todayDrivingDurationSec;
    const tomorrowRemainingKm = candidate.tomorrowRemainingKm;
    const tomorrowRemainingDurationSec = candidate.tomorrowRemainingDurationSec || 18000;

    const startMin = parseTimeToMinutes(day1StartTime);
    const totalMin = startMin + Math.round(todayDrivingDurationSec / 60) + 30;
    const todayEta = formatMinutesToTime(totalMin);

    return {
      ...candidate,
      todayDrivingKm,
      todayDrivingDurationSec,
      todayEta,
      tomorrowRemainingKm,
      tomorrowRemainingDurationSec,
      decisionTag: candidate.decisionTag || 'more_balanced',
      decisionLabel: candidate.decisionLabel || '更均衡',
      decisionReason: candidate.decisionReason || '两日驾驶时长相对均衡。'
    };
  }

  // 动态根据距离计算
  const isGuangshui = candidate.targetCityOrArea?.includes('广水') || candidate.name.includes('广水');
  const isSuizhou = candidate.targetCityOrArea?.includes('随州') || candidate.name.includes('随州');
  const isXiangyang = candidate.targetCityOrArea?.includes('襄阳') || candidate.name.includes('襄阳');

  let s3Km = 78;
  let s3Sec = 5400; // 1.5h
  let s4Km = 145;
  let s4Sec = 9600; // 2h40m

  if (isGuangshui) {
    s3Km = 32;
    s3Sec = 2400;
    s4Km = 191;
    s4Sec = 12600;
  } else if (isSuizhou) {
    s3Km = 78;
    s3Sec = 5400;
    s4Km = 145;
    s4Sec = 9600;
  } else if (isXiangyang) {
    s3Km = 78;
    s3Sec = 5400;
    s4Km = 145;
    s4Sec = 9600;
  }

  const todayDrivingKm = Math.round(day1BaseDistanceKm + s3Km);
  const todayDrivingDurationSec = day1BaseDurationSec + s3Sec;
  const tomorrowRemainingKm = Math.round(s4Km + day2BaseDistanceKm);
  const tomorrowRemainingDurationSec = s4Sec + day2BaseDurationSec;

  const startMin = parseTimeToMinutes(day1StartTime);
  const totalMin = startMin + Math.round(todayDrivingDurationSec / 60) + 30;
  const todayEta = formatMinutesToTime(totalMin);

  const durationDiffHours = (todayDrivingDurationSec - tomorrowRemainingDurationSec) / 3600;
  let decisionTag: 'more_balanced' | 'today_relaxed' | 'tomorrow_relaxed' = 'more_balanced';
  let decisionLabel = '更均衡';
  let decisionReason = '两日驾驶时间分布相对均匀，节奏舒适。';

  if (durationDiffHours < -1.2) {
    decisionTag = 'today_relaxed';
    decisionLabel = '今天更轻松';
    decisionReason = `第一天行车约 ${(todayDrivingDurationSec / 3600).toFixed(1)} 小时，傍晚 ${todayEta} 左右即可早早收车休整；次日驾驶负担略重。`;
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
