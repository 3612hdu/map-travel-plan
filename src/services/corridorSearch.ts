import { amapService } from './amapService';
import { RoutePoi, FacilityCategory, RealDetourResult } from '../types/poi';
import { Segment } from '../types/trip';
import {
  sampleCenters,
  pointToPolylineDistanceKm,
  estimateDetourKm,
  classifyDetourGrade
} from '../utils/geo';
import { initialFacilities } from '../data/mockAmenities';
import { FACILITY_CATEGORIES } from '../config/poiTypes';

export interface SegmentPathInfo {
  segmentId: string;
  segmentTitle: string;
  day?: number;
  path: [number, number][];
}

// =========================================================================
// 1. 请求治理机制与状态指标 (Request Governance & Metrics)
// =========================================================================

// 最大并发请求数限制 (严控在 2 个并发，配合间隔延迟杜绝高德 QPS 溢出)
export const MAX_SEARCH_CONCURRENCY = 2;
// 批次间隔延迟 (ms)
export const TASK_SPACING_MS = 40;
// 缓存有效期 (5 分钟)
export const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  data: RoutePoi[];
}

// 内存搜索缓存 (key -> entry)
const searchCache = new Map<string, CacheEntry>();

// 进行中的重复搜索 Promise 去重表 (key -> Promise)
const inFlightRequests = new Map<string, Promise<RoutePoi[]>>();

// 当前活动的搜索 Generation 序号 (用于 Abort / 取消旧搜索)
let activeSearchGeneration = 0;

// 并发与性能统计指标 (供自动化测试与监控审计)
export const corridorSearchStats = {
  totalSearches: 0,
  cacheHits: 0,
  networkSearches: 0,
  peakConcurrency: 0,
  currentInFlight: 0,
  discardedGenerations: 0,
  cacheSize: 0
};

// 暴露到全局 window 供测试断言
if (typeof window !== 'undefined') {
  (window as any).__corridorSearchStats = corridorSearchStats;
  (window as any).__clearCorridorCache = () => {
    searchCache.clear();
    corridorSearchStats.cacheSize = 0;
    const oldItems = globalQueue;
    globalQueue = [];
    oldItems.forEach((it) => it.resolve([]));
  };
}

export function getCorridorSearchStats() {
  corridorSearchStats.cacheSize = searchCache.size;
  return { ...corridorSearchStats };
}

export function clearCorridorSearchCache() {
  searchCache.clear();
  corridorSearchStats.cacheSize = 0;
}

// =========================================================================
// 2. 综合相关度打分 (Relevance Score Algorithm)
// =========================================================================
export function calculateRelevanceScore(
  poi: {
    distanceToRoute: number;
    rating?: number;
    category: FacilityCategory;
    sourceSegmentId: string;
    reviewCount?: number;
  },
  targetCategory: FacilityCategory,
  activeSegmentId: string
): number {
  let score = 0;

  // 1. 距路线垂直距离 (0 ~ 50 分，越顺路得分越高)
  const dist = poi.distanceToRoute;
  if (dist <= 0.5) score += 50;
  else if (dist <= 1.0) score += 45;
  else if (dist <= 2.0) score += 38;
  else if (dist <= 3.5) score += 30;
  else if (dist <= 6.0) score += 20;
  else if (dist <= 10.0) score += 10;
  else score += 2;

  // 2. POI 官方评分 (0 ~ 30 分)
  const rating = poi.rating ?? 4.2;
  score += Math.min(30, Math.round(rating * 6));

  // 3. 是否位于当前激活选中的 Segment (0 或 15 分，给予用户正在查看的路段明确权重倾向)
  if (poi.sourceSegmentId === activeSegmentId) {
    score += 15;
  }

  // 4. 类别精确匹配度 (0 或 5 分)
  if (targetCategory !== 'all' && poi.category === targetCategory) {
    score += 5;
  }

  return score;
}

// 生成缓存唯一指纹
function buildCacheKey(
  path: [number, number][],
  scope: string,
  category: string,
  searchWord: string,
  activeSegmentId: string
): string {
  const pathFingerprint = path.length > 0
    ? `${path.length}-${path[0][0].toFixed(3)},${path[0][1].toFixed(3)}-${path[path.length - 1][0].toFixed(3)},${path[path.length - 1][1].toFixed(3)}`
    : 'empty';
  return `${activeSegmentId}_${pathFingerprint}_${scope}_${category}_${searchWord.trim().toLowerCase()}`;
}

// =========================================================================
// 3. 全局并发受控请求队列与调度器 (Global Concurrency Queue & Scheduler)
// =========================================================================
interface GlobalQueueItem {
  id: number;
  generation: number;
  task: () => Promise<any[]>;
  resolve: (res: any[]) => void;
}

let globalQueue: GlobalQueueItem[] = [];
let activeGlobalWorkers = 0;
let queueTaskId = 0;

function scheduleGlobalQueue() {
  while (activeGlobalWorkers < MAX_SEARCH_CONCURRENCY && globalQueue.length > 0) {
    const item = globalQueue.shift();
    if (!item) break;

    // 若任务属于已被取代的旧代际，直接丢弃返回空数组，避免消耗网络与配额
    if (item.generation !== activeSearchGeneration) {
      item.resolve([]);
      continue;
    }

    activeGlobalWorkers++;
    corridorSearchStats.currentInFlight = activeGlobalWorkers;
    if (activeGlobalWorkers > corridorSearchStats.peakConcurrency) {
      corridorSearchStats.peakConcurrency = activeGlobalWorkers;
    }

    (async () => {
      try {
        if (item.generation !== activeSearchGeneration) {
          item.resolve([]);
        } else {
          const res = await item.task();
          item.resolve(res || []);
        }
      } catch (err) {
        item.resolve([]);
      } finally {
        activeGlobalWorkers--;
        corridorSearchStats.currentInFlight = activeGlobalWorkers;
        if (TASK_SPACING_MS > 0) {
          setTimeout(scheduleGlobalQueue, TASK_SPACING_MS);
        } else {
          scheduleGlobalQueue();
        }
      }
    })();
  }
}

function enqueueGlobalTask(generation: number, task: () => Promise<any[]>): Promise<any[]> {
  return new Promise<any[]>((resolve) => {
    globalQueue.push({
      id: ++queueTaskId,
      generation,
      task,
      resolve
    });
    scheduleGlobalQueue();
  });
}

// =========================================================================
// 4. 主搜索函数 (searchCorridorPois)
// =========================================================================
export async function searchCorridorPois(
  keywordOrCategory: string,
  category: FacilityCategory,
  path: [number, number][],
  segmentId: string,
  allSegmentsInfo: SegmentPathInfo[] = [],
  scope: 'trip' | 'segment' = 'segment'
): Promise<RoutePoi[]> {
  if (!path || path.length < 2) {
    return filterMockFacilities(keywordOrCategory, category, segmentId);
  }

  const catConfig = FACILITY_CATEGORIES[category] || FACILITY_CATEGORIES.all;
  const trimmedKeyword = keywordOrCategory ? keywordOrCategory.trim() : '';
  const searchWord = trimmedKeyword || (category !== 'all' ? catConfig.keywords.split('|')[0] : '加油站|充电站|酒店');

  const cacheKey = buildCacheKey(path, scope, category, searchWord, segmentId);

  // 1. 检查缓存：短时间重复相同搜索优先使用缓存
  const cached = searchCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    corridorSearchStats.cacheHits++;
    // 根据当前选中的 segmentId 重新计算相关度微调并排序
    return cached.data.map((poi) => ({
      ...poi,
      relevanceScore: calculateRelevanceScore(poi, category, segmentId)
    })).sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  }

  // 2. 避免进行中重复请求 (In-flight Duplicate Request Prevention)
  // 如果相同参数的搜索正在执行中，直接复用其 Promise，严禁打断它
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 3. 不同搜索触发：Generation Token 递增，使之前的其他旧搜索失效并丢弃
  const generationToken = ++activeSearchGeneration;
  const isCancelled = () => generationToken !== activeSearchGeneration;

  // 立即清理全局队列中属于旧代际的待办任务并直接 resolve([])
  const outdatedItems = globalQueue.filter((item) => item.generation < generationToken);
  globalQueue = globalQueue.filter((item) => item.generation >= generationToken);
  outdatedItems.forEach((item) => item.resolve([]));

  corridorSearchStats.totalSearches++;
  corridorSearchStats.networkSearches++;

  // 执行核心网络检索流程
  const executionPromise = (async () => {
    try {
      const api = await amapService.load();
      if (isCancelled()) {
        corridorSearchStats.discardedGenerations++;
        return [];
      }

      // 沿道路抽样：每 16km 取一个中心点，最高允许 36 个点，配合 8.5km 半径形成重叠走廊
      const centers = sampleCenters(path, 16000, 36);

      const placeSearchConfig: any = {
        pageSize: 10,
        extensions: 'base'
      };

      if (!trimmedKeyword && catConfig.amapType) {
        placeSearchConfig.type = catConfig.amapType;
      }

      // 并发队列治理：锚点检索任务分发至全局队列，受控调度，严禁超频
      const taskPromises = centers.map((center) => {
        return enqueueGlobalTask(generationToken, () =>
          new Promise<any[]>((resolve) => {
            if (isCancelled()) {
              resolve([]);
              return;
            }
            const placeSearch = new api.PlaceSearch(placeSearchConfig);
            let finished = false;
            const timer = setTimeout(() => {
              if (!finished) {
                finished = true;
                resolve([]);
              }
            }, 3500);

            placeSearch.searchNearBy(searchWord, center, 8500, (status: string, result: any) => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              if (isCancelled()) {
                resolve([]);
                return;
              }
              if (status === 'complete' && result?.poiList?.pois) {
                resolve(result.poiList.pois);
              } else {
                resolve([]);
              }
            });
          })
        );
      });

      const batchResults = await Promise.all(taskPromises);

      // 再次检查是否已被新搜索取消
      if (isCancelled()) {
        corridorSearchStats.discardedGenerations++;
        return [];
      }

      const rawPois = batchResults.flat();
      if (!rawPois || rawPois.length === 0) {
        searchCache.set(cacheKey, { timestamp: now, data: [] });
        return [];
      }

      const uniqueMap = new Map<string, RoutePoi>();

      for (const p of rawPois) {
        if (!p.location || !p.name) continue;
        const coord: [number, number] = [Number(p.location.lng), Number(p.location.lat)];
        if (isNaN(coord[0]) || isNaN(coord[1])) continue;

        // 计算该 POI 距离道路的最短垂直投影距离 (几何估计)
        const distKm = pointToPolylineDistanceKm(coord, path);

        // 仅保留距离路线 12 km 以内的顺路地点
        if (distKm > 12) continue;

        const detectedCat = detectCategory(p.type || p.name, category);
        const id = p.id || `${p.name}-${coord.join(',')}`;

        // 全程模式下计算其最近归属的具体 Segment 及 Day
        let matchedSegId = segmentId;
        let matchedSegTitle: string | undefined;
        let matchedDay: number | undefined;

        if (allSegmentsInfo.length > 0) {
          let bestDist = Infinity;
          for (const segInfo of allSegmentsInfo) {
            if (segInfo.path && segInfo.path.length >= 2) {
              const segDist = pointToPolylineDistanceKm(coord, segInfo.path);
              if (segDist < bestDist) {
                bestDist = segDist;
                matchedSegId = segInfo.segmentId;
                matchedSegTitle = segInfo.segmentTitle;
                matchedDay = segInfo.day;
              }
            }
          }
        }

        if (!uniqueMap.has(id)) {
          const estimatedDetourKmVal = estimateDetourKm(distKm);
          const detourGrade = classifyDetourGrade(distKm);
          const ratingVal = p.biz_ext?.rating ? Number(p.biz_ext.rating) : 4.5;

          const relevanceScore = calculateRelevanceScore(
            {
              distanceToRoute: distKm,
              rating: ratingVal,
              category: detectedCat,
              sourceSegmentId: matchedSegId
            },
            category,
            segmentId
          );

          uniqueMap.set(id, {
            id,
            name: p.name,
            category: detectedCat,
            categoryLabel: FACILITY_CATEGORIES[detectedCat]?.label || '设施',
            coord,
            address: p.address || (p.cityname ? p.cityname + (p.adname || '') : '') || '湖北省自驾走廊',
            distanceToRoute: distKm,
            // 语义纠正：明确为几何估算值，严禁冒充实际道路绕行距离
            estimatedDetourKm: estimatedDetourKmVal,
            detourDistance: estimatedDetourKmVal, // 保持旧字段兼容
            detourGrade,
            rating: ratingVal,
            relevanceScore,
            tags: [
              detourGrade === 'direct' ? '路边顺路' : `预计绕行约 +${estimatedDetourKmVal}km`,
              detectedCat === 'gas' ? '92#/95#' : detectedCat === 'ev' ? '快充' : '推荐'
            ],
            status: '营业中',
            sourceSegmentId: matchedSegId,
            sourceSegmentTitle: matchedSegTitle,
            sourceDay: matchedDay,
            poiId: p.id
          });
        }
      }

      if (isCancelled()) {
        corridorSearchStats.discardedGenerations++;
        return [];
      }

      // 智能排序：按综合相关度评分降序，得分相近按距路线垂距升序
      const sortedResults = Array.from(uniqueMap.values()).sort((a, b) => {
        const scoreDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.distanceToRoute - b.distanceToRoute;
      });

      // 写入缓存
      searchCache.set(cacheKey, { timestamp: now, data: sortedResults });
      corridorSearchStats.cacheSize = searchCache.size;

      return sortedResults;
    } catch (err) {
      console.warn('高德走廊搜索失败:', err);
      return [];
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, executionPromise);
  return executionPromise;
}

// =========================================================================
// 5. 预留真实绕行计算接口 (calculateRealDetour)
// =========================================================================
/**
 * 计算重点 POI 的真实高德道路绕行距离与时间增量
 * 仅在用户查看重点 POI 或点击主动测算时按需触发，避免批量全量请求造成 API 爆炸
 */
export async function calculateRealDetour(
  poi: RoutePoi,
  segment: Segment
): Promise<RealDetourResult> {
  return amapService.calculateRealDetour(poi, segment);
}

// =========================================================================
// 6. 辅助分类识别与 Mock 回退
// =========================================================================
function detectCategory(rawText: string, fallback: FacilityCategory): FacilityCategory {
  if (fallback !== 'all') return fallback;
  if (/酒店|宾馆|民宿|客栈|度假|居|公寓/.test(rawText)) return 'hotel';
  if (/餐|饭店|菜|农家|小吃|美食|面|酒楼/.test(rawText)) return 'food';
  if (/油|石化|石油|加气|壳牌/.test(rawText)) return 'gas';
  if (/电|桩|特来电|充电|新能源|超充/.test(rawText)) return 'ev';
  if (/厕|洗手间|公厕|WC/.test(rawText)) return 'toilet';
  if (/停|车位|停车场|停车区/.test(rawText)) return 'parking';
  return 'hotel';
}

function filterMockFacilities(
  query: string,
  category: FacilityCategory,
  segmentId: string
): RoutePoi[] {
  return initialFacilities.filter((p) => {
    const matchCategory = category === 'all' || p.category === category;
    const matchQuery = !query || p.name.includes(query) || p.address.includes(query);
    return matchCategory && matchQuery;
  }).map((poi) => ({
    ...poi,
    relevanceScore: calculateRelevanceScore(poi, category, segmentId)
  })).sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
}
