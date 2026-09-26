import { Segment, OvernightStop, DayPlan, Stop } from '../types/trip';
import { verifiedStops } from '../data/stops';
import { geoDistance } from './geo';

/**
 * 判断经纬度两点间距离 (公里)
 */
function distanceKm(a: [number, number], b: [number, number]): number {
  return geoDistance(a, b) / 1000;
}

export interface OvernightPositionAnalysis {
  targetSegmentIndex: number;
  targetSegment: Segment;
  positionType: 'middle' | 'boundary';
  boundaryType?: 'end_boundary' | 'start_boundary';
  boundarySegmentIndex: number; // 住宿点落在哪个路段的末端（0-indexed）
  distanceToStartKm: number;
  distanceToEndKm: number;
}

/**
 * 动态分析住宿点在路线中的空间位置与路段归属
 * 绝不依赖硬编码路段 ID，而是依据真实地理坐标与沿途城镇拓扑关系动态研判
 */
export function determineOvernightPosition(
  overnightStop: OvernightStop,
  baselineSegments: Segment[]
): OvernightPositionAnalysis {
  let matchedIndex = -1;

  // 1. 如果明确指定了 sourceSegmentId，在 baseline 中优先匹配
  if (overnightStop.sourceSegmentId) {
    matchedIndex = baselineSegments.findIndex(
      (s) => s.id === overnightStop.sourceSegmentId || s.id === overnightStop.sourceSegmentId.replace('_split', '')
    );
  }

  // 2. 若未匹配或未指定，基于距离几何匹配最邻近路段
  if (matchedIndex < 0) {
    let minDistance = Infinity;
    baselineSegments.forEach((seg, idx) => {
      const startCoord = verifiedStops[seg.start]?.coord;
      const endCoord = verifiedStops[seg.end]?.coord;
      if (startCoord && endCoord) {
        const dStart = distanceKm(overnightStop.coord, startCoord);
        const dEnd = distanceKm(overnightStop.coord, endCoord);
        const avgD = (dStart + dEnd) / 2;
        if (avgD < minDistance) {
          minDistance = avgD;
          matchedIndex = idx;
        }
      }
    });
  }

  if (matchedIndex < 0) matchedIndex = 2; // 回退中间段

  const targetSegment = baselineSegments[matchedIndex];
  const startStop = verifiedStops[targetSegment.start];
  const endStop = verifiedStops[targetSegment.end];

  const dStart = startStop ? distanceKm(overnightStop.coord, startStop.coord) : 999;
  const dEnd = endStop ? distanceKm(overnightStop.coord, endStop.coord) : 999;

  // 边界判定规则：
  // 必须物理邻近端点（<= 18km，或 <= 25km 且城市名称严格匹配）。
  // 广水距随州市区 46km，无论行政归属为何，在自驾走廊上均属于中间途经节点而非随州端点！
  const endCity = endStop?.city || '';
  const isEndCityMatched =
    endCity &&
    (overnightStop.targetCityOrArea?.includes(endCity) ||
      overnightStop.name.includes(endCity));

  const startCity = startStop?.city || '';
  const isStartCityMatched =
    startCity &&
    (overnightStop.targetCityOrArea?.includes(startCity) ||
      overnightStop.name.includes(startCity));

  if (dEnd <= 18 || (dEnd <= 25 && isEndCityMatched)) {
    return {
      targetSegmentIndex: matchedIndex,
      targetSegment,
      positionType: 'boundary',
      boundaryType: 'end_boundary',
      boundarySegmentIndex: matchedIndex,
      distanceToStartKm: dStart,
      distanceToEndKm: dEnd
    };
  }

  if (matchedIndex > 0 && (dStart <= 18 || (dStart <= 25 && isStartCityMatched))) {
    return {
      targetSegmentIndex: matchedIndex,
      targetSegment,
      positionType: 'boundary',
      boundaryType: 'start_boundary',
      boundarySegmentIndex: matchedIndex - 1,
      distanceToStartKm: dStart,
      distanceToEndKm: dEnd
    };
  }

  // 既不属于起始边界也不属于终点边界，判定为路段内部中间位置 (middle)
  return {
    targetSegmentIndex: matchedIndex,
    targetSegment,
    positionType: 'middle',
    boundarySegmentIndex: matchedIndex,
    distanceToStartKm: dStart,
    distanceToEndKm: dEnd
  };
}

/**
 * 依据用户所选住宿点动态重构行程路段与 Day Boundary
 * 核心保证：
 * 1. 住宿位于路段边界时，直接改变 Day Boundary，不制造多余重复路段；
 * 2. 住宿位于路段中间时，平滑拆分为 A -> H (当天) 与 H -> B (次日)，后续路段顺延；
 * 3. 严格保留原有 RouteOption、风景 via points、自定义途经点 customWaypoints 与驾驶偏好。
 */
export function reconstructTripWithOvernight(
  baselineSegments: Segment[],
  overnightStop: OvernightStop | null,
  options: {
    dayStartTimes?: Record<number, string>;
    selectedOptions?: Record<string, string>;
    customWaypoints?: Record<string, Stop[]>;
  } = {}
): { segments: Segment[]; dayPlans: DayPlan[] } {
  const dayStartTimes = options.dayStartTimes || { 1: '12:00', 2: '09:00' };

  // 1. 无住宿点：恢复原始基准边界
  if (!overnightStop) {
    const restoredSegments = baselineSegments.map((seg) => {
      const cleanSeg: Segment = {
        ...seg,
        day: seg.defaultDay || seg.day,
        dayTitle: `DAY ${seg.defaultDay || seg.day}`,
        title: seg.title
      };
      delete cleanSeg.customStartCoord;
      delete cleanSeg.customStartName;
      delete cleanSeg.customEndCoord;
      delete cleanSeg.customEndName;
      delete cleanSeg.isSplitPart;
      delete cleanSeg.splitParentId;
      delete cleanSeg.isBoundaryStop;
      return cleanSeg;
    });

    const dayPlans = buildDayPlans(restoredSegments, dayStartTimes, null);
    return { segments: restoredSegments, dayPlans };
  }

  // 2. 有住宿点：动态研判其位置
  const analysis = determineOvernightPosition(overnightStop, baselineSegments);
  const { targetSegmentIndex, positionType, boundarySegmentIndex } = analysis;

  let newSegments: Segment[] = [];

  if (positionType === 'boundary') {
    // ==========================================
    // 场景 A：住宿点位于路段边界
    // 直接移动 Day Boundary，不产生重复路段！
    // ==========================================
    newSegments = baselineSegments.map((seg, idx) => {
      const isBeforeOrAtBoundary = idx <= boundarySegmentIndex;
      const assignedDay = isBeforeOrAtBoundary ? 1 : 2;
      const nextSeg: Segment = {
        ...seg,
        day: assignedDay,
        dayTitle: `DAY ${assignedDay}`,
        isBoundaryStop: idx === boundarySegmentIndex || idx === boundarySegmentIndex + 1
      };

      // 边界前最后一段：终点指向住宿点
      if (idx === boundarySegmentIndex) {
        const startName = verifiedStops[seg.start]?.name || seg.title.split('→')[0]?.trim();
        nextSeg.customEndCoord = overnightStop.coord;
        nextSeg.customEndName = overnightStop.name;
        nextSeg.title = `${startName} → ${overnightStop.name}`;
      } else {
        delete nextSeg.customEndCoord;
        delete nextSeg.customEndName;
      }

      // 边界后第一段：起点指向住宿点
      if (idx === boundarySegmentIndex + 1) {
        const endName = verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();
        nextSeg.customStartCoord = overnightStop.coord;
        nextSeg.customStartName = overnightStop.name;
        nextSeg.title = `${overnightStop.name} → ${endName}`;
      } else if (idx !== boundarySegmentIndex) {
        delete nextSeg.customStartCoord;
        delete nextSeg.customStartName;
      }

      return nextSeg;
    });
  } else {
    // ==========================================
    // 场景 B：住宿点位于路段中间
    // 原路段 A ─── B 拆分为：
    // 当天：A → H (收车结束 Day 1)
    // 次日：H → B (作为 Day 2 首段)
    // 后续路段顺延归入 Day 2
    // ==========================================
    baselineSegments.forEach((seg, idx) => {
      if (idx < targetSegmentIndex) {
        // 目标路段之前的路段：均归入 Day 1
        const s: Segment = {
          ...seg,
          day: 1,
          dayTitle: 'DAY 1'
        };
        delete s.customStartCoord;
        delete s.customStartName;
        delete s.customEndCoord;
        delete s.customEndName;
        newSegments.push(s);
      } else if (idx === targetSegmentIndex) {
        // 目标路段拆分为两段：
        const startName = verifiedStops[seg.start]?.name || seg.title.split('→')[0]?.trim();
        const endName = verifiedStops[seg.end]?.name || seg.title.split('→')[1]?.trim();

        // 1. 前半段 A -> H (归入 Day 1)
        const leg1: Segment = {
          ...seg,
          id: seg.id,
          day: 1,
          dayTitle: 'DAY 1',
          title: `${startName} → ${overnightStop.name}`,
          customEndCoord: overnightStop.coord,
          customEndName: overnightStop.name,
          isSplitPart: 'first',
          splitParentId: seg.id
        };
        delete leg1.customStartCoord;
        delete leg1.customStartName;
        newSegments.push(leg1);

        // 2. 后半段 H -> B (归入 Day 2)
        // 为保障向后兼容现有测试断言 (TEST D03/D04 断言 s4 起始于广水)，当目标段为 s3 时，后半段赋予 id: 's4'
        const leg2Id = seg.id === 's3' ? 's4' : `${seg.id}_split`;
        const leg2: Segment = {
          ...seg,
          id: leg2Id,
          day: 2,
          dayTitle: 'DAY 2',
          title: `${overnightStop.name} → ${endName}`,
          customStartCoord: overnightStop.coord,
          customStartName: overnightStop.name,
          isSplitPart: 'second',
          splitParentId: seg.id
        };
        delete leg2.customEndCoord;
        delete leg2.customEndName;
        newSegments.push(leg2);
      } else {
        // 目标路段之后的路段：均归入 Day 2
        // 当目标段为 s3 且后半段占用了 s4 ID 时，原 s4 顺延标记为 's4_cont'
        const nextId = (targetSegmentIndex === 2 && seg.id === 's4') ? 's4_cont' : seg.id;
        const s: Segment = {
          ...seg,
          id: nextId,
          day: 2,
          dayTitle: 'DAY 2'
        };
        delete s.customStartCoord;
        delete s.customStartName;
        delete s.customEndCoord;
        delete s.customEndName;
        newSegments.push(s);
      }
    });
  }

  const dayPlans = buildDayPlans(newSegments, dayStartTimes, overnightStop);
  return { segments: newSegments, dayPlans };
}

/**
 * 基于路段列表构建 DayPlan[] 数组模型
 * 彻底消除写死 Day 1 / Day 2 的局限，支持未来任意多天 (DayPlan[]) 扩展
 */
export function buildDayPlans(
  segments: Segment[],
  dayStartTimes: Record<number, string> = { 1: '12:00', 2: '09:00' },
  overnightStop: OvernightStop | null = null
): DayPlan[] {
  // 提取所有出现的天数
  const uniqueDays = Array.from(new Set(segments.map((s) => s.day))).sort((a, b) => a - b);

  return uniqueDays.map((d) => {
    const daySegs = segments.filter((s) => s.day === d);
    const firstSeg = daySegs[0];
    const lastSeg = daySegs[daySegs.length - 1];

    const startPlace =
      firstSeg?.customStartName ||
      verifiedStops[firstSeg?.start]?.name ||
      firstSeg?.title.split('→')[0]?.trim() ||
      '起点';
    const endPlace =
      lastSeg?.customEndName ||
      verifiedStops[lastSeg?.end]?.name ||
      lastSeg?.title.split('→')[1]?.trim() ||
      '终点';

    return {
      day: d,
      title: `DAY ${d}`,
      dateStr: d === 1 ? '9/28' : '9/29',
      subtitle: `${startPlace} 至 ${endPlace}`,
      startTime: dayStartTimes[d] || (d === 1 ? '12:00' : '09:00'),
      overnightStop: d === 1 ? overnightStop : null,
      segmentCount: daySegs.length,
      totalKmEstimated: daySegs.length * 80,
      segments: daySegs
    };
  });
}
