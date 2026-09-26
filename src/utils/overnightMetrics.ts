import { OvernightStop, Segment, Stop } from '../types/trip';
import { RouteCalcResult } from '../types/map';
import { RoutePreference } from '../types/preference';
import { initialSegments } from '../data/tripData';
import { reconstructTripWithOvernight } from './tripReconstruction';
import { amapService } from '../services/amapService';

export interface CandidateComparisonMetrics {
  candidateId: string;
  status: 'loading' | 'success' | 'error';
  errorMessage?: string;
  todayKm?: number;
  tomorrowKm?: number;
  todaySeconds?: number;
  tomorrowSeconds?: number;
  eta?: string;
  ratio?: number;
  label?: '更均衡' | '今天更轻松' | '明天更轻松';
  reason?: string;
}

// 内存比较缓存与在途请求去重表 (10分钟 TTL)
const comparisonCache = new Map<string, { metrics: CandidateComparisonMetrics; timestamp: number }>();
const inFlightComparisons = new Map<string, Promise<CandidateComparisonMetrics>>();

export function buildComparisonCacheKey(
  candidate: OvernightStop,
  selectedOptions: Record<string, string>,
  customWaypoints: Record<string, Stop[]>,
  preference: RoutePreference,
  dayStartTime: string
): string {
  const optPart = Object.entries(selectedOptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
  const wpPart = Object.entries(customWaypoints)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, stops]) => `${k}:${stops.map((s) => s.id).join(';')}`)
    .join('|');
  const prefPart = `${preference.avoidHighway ? 1 : 0}-${preference.avoidToll ? 1 : 0}-${preference.avoidCongestion ? 1 : 0}`;
  const coordPart = candidate.coord ? `${candidate.coord[0].toFixed(4)},${candidate.coord[1].toFixed(4)}` : '';
  return `cand:${candidate.id || candidate.name}_${coordPart}_opts:${optPart}_wps:${wpPart}_pref:${prefPart}_start:${dayStartTime}`;
}

export function clearComparisonCache(): void {
  comparisonCache.clear();
  inFlightComparisons.clear();
}

/**
 * 实时获取或异步计算住宿候选两日真实实路数据
 */
export async function calculateCandidateComparisonMetrics(
  candidate: OvernightStop,
  selectedOptions: Record<string, string>,
  customWaypoints: Record<string, Stop[]>,
  preference: RoutePreference,
  dayStartTimes: Record<number, string>,
  currentRoutes: Record<string, RouteCalcResult> = {}
): Promise<CandidateComparisonMetrics> {
  const dayStartTime = dayStartTimes[1] || '12:00';
  const cacheKey = buildComparisonCacheKey(candidate, selectedOptions, customWaypoints, preference, dayStartTime);

  // 1. 检查缓存
  const cached = comparisonCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.metrics;
  }

  // 2. 检查在途 Promise
  if (inFlightComparisons.has(cacheKey)) {
    return inFlightComparisons.get(cacheKey)!;
  }

  const calculationPromise = (async (): Promise<CandidateComparisonMetrics> => {
    try {
      // 动态重构该候选对应的行程与天边界
      const { segments: candidateSegments } = reconstructTripWithOvernight(
        initialSegments,
        candidate,
        {
          dayStartTimes,
          selectedOptions,
          customWaypoints
        }
      );

      let todayMeters = 0;
      let tomorrowMeters = 0;
      let todaySec = 0;
      let tomorrowSec = 0;

      for (const seg of candidateSegments) {
        const optId = selectedOptions[seg.id] || seg.chosen;
        const opt = seg.options.find((o) => o.id === optId) || seg.options[0];
        const wp = customWaypoints[seg.id] || [];

        let calcResult: RouteCalcResult | null = null;

        // 如果是未修改端点的段，且当前主路线已有结果，直接复用以节约网络
        if (!seg.customStartCoord && !seg.customEndCoord) {
          const existing = currentRoutes[`${seg.id}:${optId}`];
          if (existing && existing.distance > 0 && existing.time > 0) {
            calcResult = existing;
          }
        }

        // 若无现成结果或属于受住宿点影响修改端点的段，发起真实高德 Driving 算路
        if (!calcResult) {
          calcResult = await amapService.planSegment(seg, opt, wp, preference);
        }

        if (!calcResult || !calcResult.distance || !calcResult.time) {
          throw new Error(`路段 ${seg.id} 实路数据未返回`);
        }

        if (seg.day === 1) {
          todayMeters += calcResult.distance;
          todaySec += calcResult.time;
        } else {
          tomorrowMeters += calcResult.distance;
          tomorrowSec += calcResult.time;
        }
      }

      const todayKm = Math.round(todayMeters / 1000);
      const tomorrowKm = Math.round(tomorrowMeters / 1000);
      const [hour, minute] = dayStartTime.split(':').map(Number);
      const etaMinute = (hour * 60 + minute + Math.round(todaySec / 60)) % 1440;
      const eta = `${String(Math.floor(etaMinute / 60)).padStart(2, '0')}:${String(etaMinute % 60).padStart(2, '0')}`;
      const ratio = Math.round(todayKm / (todayKm + tomorrowKm) * 100);
      const label = Math.abs(todaySec - tomorrowSec) <= 3600
        ? '更均衡'
        : todaySec < tomorrowSec
        ? '今天更轻松'
        : '明天更轻松';

      const reason = label === '更均衡'
        ? '两日行车时长接近 1:1，整体行车节奏更均衡。'
        : label === '今天更轻松'
        ? '第一天行驶强度较小，可更早入住休整。'
        : '第一天多赶路，次日前往郧阳更轻松。';

      const successMetrics: CandidateComparisonMetrics = {
        candidateId: candidate.id,
        status: 'success',
        todayKm,
        tomorrowKm,
        todaySeconds: todaySec,
        tomorrowSeconds: tomorrowSec,
        eta,
        ratio,
        label,
        reason
      };

      comparisonCache.set(cacheKey, { metrics: successMetrics, timestamp: Date.now() });
      return successMetrics;
    } catch (err) {
      console.warn(`住宿候选 ${candidate.name} 真实算路失败:`, err);
      const errorMetrics: CandidateComparisonMetrics = {
        candidateId: candidate.id,
        status: 'error',
        errorMessage: '暂时无法获取实路数据'
      };
      return errorMetrics;
    } finally {
      inFlightComparisons.delete(cacheKey);
    }
  })();

  inFlightComparisons.set(cacheKey, calculationPromise);
  return calculationPromise;
}

// 同步获取（优先从缓存取，若无则返回 null）
export function getCachedCandidateComparisonMetrics(
  candidate: OvernightStop,
  selectedOptions: Record<string, string>,
  customWaypoints: Record<string, Stop[]>,
  preference: RoutePreference,
  dayStartTime: string
): CandidateComparisonMetrics | null {
  const cacheKey = buildComparisonCacheKey(candidate, selectedOptions, customWaypoints, preference, dayStartTime);
  const cached = comparisonCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.metrics;
  }
  return null;
}

// 兼容旧接口 getOvernightMetrics（当已有同步数据时回退）
export function getOvernightMetrics(
  candidate: OvernightStop,
  selected: OvernightStop | null,
  segments: Segment[],
  selectedOptions: Record<string, string>,
  routes: Record<string, RouteCalcResult>,
  dayStartTimes: Record<number, string>,
  customWaypoints: Record<string, Stop[]> = {},
  preference?: RoutePreference
): CandidateComparisonMetrics | null {
  const dayStartTime = dayStartTimes[1] || '12:00';
  if (preference) {
    const cached = getCachedCandidateComparisonMetrics(candidate, selectedOptions, customWaypoints, preference, dayStartTime);
    if (cached) {
      return cached;
    }
  }

  // 若当前已选中的是该 candidate，且路由完整，同步计算
  if (selected && (selected.id === candidate.id || selected.name === candidate.name)) {
    let todayKm = 0, tomorrowKm = 0, todaySeconds = 0, tomorrowSeconds = 0;
    for (const segment of segments) {
      const option = selectedOptions[segment.id] || segment.chosen;
      const route = routes[`${segment.id}:${option}`];
      if (!route?.path?.length || !route.distance || !route.time) return null;
      if (segment.day === 1) { todayKm += route.distance / 1000; todaySeconds += route.time; }
      else { tomorrowKm += route.distance / 1000; tomorrowSeconds += route.time; }
    }
    const [hour, minute] = dayStartTime.split(':').map(Number);
    const etaMinute = (hour * 60 + minute + Math.round(todaySeconds / 60)) % 1440;
    const eta = `${String(Math.floor(etaMinute / 60)).padStart(2, '0')}:${String(etaMinute % 60).padStart(2, '0')}`;
    const ratio = Math.round(todayKm / (todayKm + tomorrowKm) * 100);
    const label = Math.abs(todaySeconds - tomorrowSeconds) <= 3600 ? '更均衡' : todaySeconds < tomorrowSeconds ? '今天更轻松' : '明天更轻松';
    return {
      candidateId: candidate.id,
      status: 'success',
      todayKm: Math.round(todayKm),
      tomorrowKm: Math.round(tomorrowKm),
      todaySeconds,
      tomorrowSeconds,
      eta,
      ratio,
      label,
      reason: label === '更均衡'
        ? '两日行车时长接近 1:1，整体行车节奏更均衡。'
        : label === '今天更轻松'
        ? '第一天行驶强度较小，可更早入住休整。'
        : '第一天多赶路，次日前往郧阳更轻松。'
    };
  }

  return null;
}

if (typeof window !== 'undefined') {
  (window as any).__calculateCandidateComparisonMetrics = calculateCandidateComparisonMetrics;
  (window as any).__clearComparisonCache = clearComparisonCache;
  (window as any).__getCachedCandidateComparisonMetrics = getCachedCandidateComparisonMetrics;
}
