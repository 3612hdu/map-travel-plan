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
  detourDistance?: number; // 预估绕行距离 km
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  status?: string; // 如 '营业中', '快充 4 / 慢充 2'
  priceLevel?: string;
  sourceSegmentId: string;
  poiId?: string;
}

export interface SearchScope {
  type: 'trip' | 'segment';
  label: string;
  segmentId?: string;
}
