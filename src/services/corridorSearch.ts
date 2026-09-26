import { amapService } from './amapService';
import { RoutePoi, FacilityCategory } from '../types/poi';
import { sampleCenters, pointToPolylineDistanceKm } from '../utils/geo';
import { initialFacilities } from '../data/mockAmenities';

// 类别中文关键词映射
const CATEGORY_KEYWORDS: Record<FacilityCategory, string> = {
  all: '酒店|餐饮|加油站|充电站|厕所|停车场',
  hotel: '酒店|宾馆|民宿|客栈',
  food: '餐厅|农家乐|美食|饭店',
  gas: '加油站|中国石化|中国石油',
  ev: '充电站|新能源充电|国家电网充电桩',
  toilet: '公共厕所|洗手间|公厕',
  parking: '停车场|停车区|停车点'
};

export async function searchCorridorPois(
  keywordOrCategory: string,
  category: FacilityCategory,
  path: [number, number][],
  segmentId: string
): Promise<RoutePoi[]> {
  if (!path || path.length < 2) {
    // 降级使用本地初始设施
    return filterMockFacilities(keywordOrCategory, category, segmentId);
  }

  try {
    const api = await amapService.load();
    const searchWord =
      keywordOrCategory && keywordOrCategory.trim()
        ? keywordOrCategory.trim()
        : CATEGORY_KEYWORDS[category] || '加油站|充电站|酒店';

    // 沿道路抽样（每 20km 取一个中心点，最多 8 个采样点）
    const centers = sampleCenters(path, 20000);
    const placeSearch = new api.PlaceSearch({
      pageSize: 8,
      extensions: 'base'
    });

    const searchPromises = centers.map((center) => {
      return new Promise<any[]>((resolve) => {
        placeSearch.searchNearBy(searchWord, center, 8000, (status: string, result: any) => {
          if (status === 'complete' && result?.poiList?.pois) {
            resolve(result.poiList.pois);
          } else {
            resolve([]);
          }
        });
      });
    });

    const resultsArray = await Promise.all(searchPromises);
    const rawPois = resultsArray.flat();

    if (!rawPois || rawPois.length === 0) {
      return [];
    }

    const uniqueMap = new Map<string, RoutePoi>();

    for (const p of rawPois) {
      if (!p.location || !p.name) continue;
      const coord: [number, number] = [p.location.lng, p.location.lat];
      const distKm = pointToPolylineDistanceKm(coord, path);

      // 仅保留距离路线 12 km 以内的顺路地点
      if (distKm > 12) continue;

      const detectedCat = detectCategory(p.type || p.name, category);
      const id = p.id || `${p.name}-${coord.join(',')}`;

      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, {
          id,
          name: p.name,
          category: detectedCat,
          categoryLabel: getCategoryLabel(detectedCat),
          coord,
          address: p.address || p.cityname + p.adname || '沿线道路',
          distanceToRoute: distKm,
          detourDistance: Number((distKm * 0.4).toFixed(1)),
          rating: p.biz_ext?.rating ? Number(p.biz_ext.rating) : 4.5,
          tags: [detectedCat === 'gas' ? '92#/95#' : '顺路推荐'],
          status: '营业中',
          sourceSegmentId: segmentId,
          poiId: p.id
        });
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => a.distanceToRoute - b.distanceToRoute);
  } catch (err) {
    console.warn('高德走廊搜索失败:', err);
    return [];
  }
}

// 分类推测
function detectCategory(rawText: string, fallback: FacilityCategory): FacilityCategory {
  if (fallback !== 'all') return fallback;
  if (/酒店|宾馆|民宿|客栈|公寓/.test(rawText)) return 'hotel';
  if (/餐|饭店|菜|农家|小吃|美食/.test(rawText)) return 'food';
  if (/油|化|中石化|中石油/.test(rawText)) return 'gas';
  if (/电|桩|特来电|充电/.test(rawText)) return 'ev';
  if (/厕|洗手间|WC/.test(rawText)) return 'toilet';
  if (/停|车位|库/.test(rawText)) return 'parking';
  return 'hotel';
}

function getCategoryLabel(cat: FacilityCategory): string {
  const map: Record<FacilityCategory, string> = {
    all: '全部',
    hotel: '酒店/民宿',
    food: '餐饮',
    gas: '加油站',
    ev: '充电站',
    toilet: '公共厕所',
    parking: '停车场'
  };
  return map[cat] || '设施';
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
