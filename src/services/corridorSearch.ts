import { amapService } from './amapService';
import { RoutePoi, FacilityCategory } from '../types/poi';
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
  path: [number, number][];
}

// 走廊检索服务 (全线无死角动态抽样 + 高德官方 POI 分类码 + 顺路绕行估算)
export async function searchCorridorPois(
  keywordOrCategory: string,
  category: FacilityCategory,
  path: [number, number][],
  segmentId: string,
  allSegmentsInfo: SegmentPathInfo[] = []
): Promise<RoutePoi[]> {
  if (!path || path.length < 2) {
    return filterMockFacilities(keywordOrCategory, category, segmentId);
  }

  try {
    const api = await amapService.load();
    const catConfig = FACILITY_CATEGORIES[category] || FACILITY_CATEGORIES.all;

    const trimmedKeyword = keywordOrCategory ? keywordOrCategory.trim() : '';
    // 如果用户输入了具体词，则以具体词为准；否则使用官方分类建议词
    const searchWord = trimmedKeyword || (category !== 'all' ? catConfig.keywords.split('|')[0] : '加油站|充电站|酒店');

    // 沿道路抽样：每 16km 取一个中心点，最高允许 32 个点，配合 8km 半径实现连续走廊无死角全覆盖
    const centers = sampleCenters(path, 16000, 32);

    const placeSearchConfig: any = {
      pageSize: 10,
      extensions: 'base'
    };

    // 若无具体文本搜索词，优先传入高德官方分类编码 type
    if (!trimmedKeyword && catConfig.amapType) {
      placeSearchConfig.type = catConfig.amapType;
    }

    const placeSearch = new api.PlaceSearch(placeSearchConfig);

    // 分批并发控制（每批 4 个点，批次间隔 60ms 规避高德 QPS 限制）
    const batchSize = 4;
    const rawPois: any[] = [];

    for (let i = 0; i < centers.length; i += batchSize) {
      const batchCenters = centers.slice(i, i + batchSize);
      const batchPromises = batchCenters.map((center) => {
        return new Promise<any[]>((resolve) => {
          placeSearch.searchNearBy(searchWord, center, 8500, (status: string, result: any) => {
            if (status === 'complete' && result?.poiList?.pois) {
              resolve(result.poiList.pois);
            } else {
              resolve([]);
            }
          });
        });
      });

      const batchResults = await Promise.all(batchPromises);
      rawPois.push(...batchResults.flat());

      if (i + batchSize < centers.length) {
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    if (!rawPois || rawPois.length === 0) {
      return [];
    }

    const uniqueMap = new Map<string, RoutePoi>();

    for (const p of rawPois) {
      if (!p.location || !p.name) continue;
      const coord: [number, number] = [Number(p.location.lng), Number(p.location.lat)];
      if (isNaN(coord[0]) || isNaN(coord[1])) continue;

      // 计算该 POI 距离道路的最短垂直投影距离
      const distKm = pointToPolylineDistanceKm(coord, path);

      // 仅保留距离路线 12 km 以内的顺路地点
      if (distKm > 12) continue;

      const detectedCat = detectCategory(p.type || p.name, category);
      const id = p.id || `${p.name}-${coord.join(',')}`;

      // 全程模式下计算其最近归属的具体 Segment
      let matchedSegId = segmentId;
      let matchedSegTitle: string | undefined;

      if (allSegmentsInfo.length > 0) {
        let bestDist = Infinity;
        for (const segInfo of allSegmentsInfo) {
          if (segInfo.path && segInfo.path.length >= 2) {
            const segDist = pointToPolylineDistanceKm(coord, segInfo.path);
            if (segDist < bestDist) {
              bestDist = segDist;
              matchedSegId = segInfo.segmentId;
              matchedSegTitle = segInfo.segmentTitle;
            }
          }
        }
      }

      if (!uniqueMap.has(id)) {
        const detourDistance = estimateDetourKm(distKm);
        const detourGrade = classifyDetourGrade(distKm);

        uniqueMap.set(id, {
          id,
          name: p.name,
          category: detectedCat,
          categoryLabel: FACILITY_CATEGORIES[detectedCat]?.label || '设施',
          coord,
          address: p.address || p.cityname + p.adname || '沿线道路',
          distanceToRoute: distKm,
          detourDistance,
          detourGrade,
          rating: p.biz_ext?.rating ? Number(p.biz_ext.rating) : 4.5,
          tags: [
            detourGrade === 'direct' ? '路边顺路' : `绕行+${detourDistance}km`,
            detectedCat === 'gas' ? '92#/95#' : detectedCat === 'ev' ? '快充' : '推荐'
          ],
          status: '营业中',
          sourceSegmentId: matchedSegId,
          sourceSegmentTitle: matchedSegTitle,
          poiId: p.id
        });
      }
    }

    // 智能排序：优先按距路线垂直距离升序（越顺路越靠前），距离相近按评分降序
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const distDiff = a.distanceToRoute - b.distanceToRoute;
      if (Math.abs(distDiff) > 0.5) return distDiff;
      return (b.rating || 0) - (a.rating || 0);
    });
  } catch (err) {
    console.warn('高德走廊搜索失败:', err);
    return [];
  }
}

// 分类推测
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
  });
}

