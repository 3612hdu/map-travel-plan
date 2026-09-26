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
  detourDistance?: number; // 预估绕行增加里程 km
  detourGrade?: 'direct' | 'minimal' | 'moderate' | 'deep'; // 顺路评级
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  status?: string; // 如 '营业中', '快充 4 / 慢充 2'
  priceLevel?: string;
  sourceSegmentId: string;
  sourceSegmentTitle?: string; // 赛段标题（如 '丹江口 → 郧阳'），用于全程搜索清晰定位
  poiId?: string;
}

export interface SearchScope {
  type: 'trip' | 'segment';
  label: string;
  segmentId?: string;
}

