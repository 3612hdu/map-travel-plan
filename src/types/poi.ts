// 设施与 POI 数据类型

export type FacilityCategory = 'all' | 'hotel' | 'food' | 'gas' | 'ev' | 'toilet' | 'parking';

export interface RoutePoi {
  id: string;
  name: string;
  category: FacilityCategory;
  categoryLabel: string;
  coord: [number, number]; // [lng, lat]
  address: string;
  distanceToRoute: number; // km（点到路线的最短垂距）

  /**
   * 几何估算绕行增量 (km)
   * 注意：此字段为基于点到折线垂距的理论几何估算值，仅用于初筛和快速排序，绝非高德 Driving 实测真实道路绕行里程。
   */
  estimatedDetourKm: number;

  /** @deprecated 兼容旧字段，请使用 estimatedDetourKm */
  detourDistance?: number;

  detourGrade?: 'direct' | 'minimal' | 'moderate' | 'deep'; // 顺路评级
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  status?: string; // 如 '营业中', '快充 4 / 慢充 2'
  priceLevel?: string;
  sourceSegmentId: string;
  sourceSegmentTitle?: string; // 赛段标题（如 '丹江口 → 郧阳'），用于全程搜索清晰定位
  sourceDay?: number; // 所属天数 (1 | 2，用于全程搜索分组)
  poiId?: string;

  /** 综合相关度得分 (结合距线距离、评分、当前路段匹配、起终点位置、分类等维度) */
  relevanceScore?: number;

  /** 是否已执行真实 Driving 绕行测算 */
  isRealDetour?: boolean;
  /** 真实高德 Driving 算出的新增里程 km */
  realDetourKm?: number;
  /** 真实高德 Driving 算出的新增耗时秒数 */
  realDetourDurationSec?: number;
}

export interface RealDetourResult {
  poiId: string;
  realDetourKm: number; // 真实道路新增里程 km
  realDetourDurationSec: number; // 真实道路新增耗时秒
  originalDistanceMeters: number;
  newDistanceMeters: number;
  originalDurationSeconds: number;
  newDurationSeconds: number;
}

export interface SearchScope {
  type: 'trip' | 'segment';
  label: string;
  segmentId?: string;
}


