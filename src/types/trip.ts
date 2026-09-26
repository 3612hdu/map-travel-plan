// 行程核心数据模型

export interface Stop {
  id: string;
  name: string;
  coord: [number, number]; // [lng, lat]
  poi: string;
  city: string;
  address?: string;
  desc?: string;
}

export interface RouteHighlight {
  id: string;
  title: string;
  desc: string;
  image: string;
  location: [number, number];
  tags?: string[];
}

export interface RouteOption {
  id: string;
  name: string;
  tagTitle: string; // 如：'推荐风景路线', '普通路线', '风景折中路线'
  isRecommended?: boolean;
  desc: string;
  via: number[]; // 索引关联 stops 列表
  features: string[]; // 如：['临水', '山景', '拍照', '慢生活']
  comparisonNote?: string; // 如：'+31 km · +47 min'
  highlights: RouteHighlight[];
  // 规划后缓存数据
  path?: [number, number][];
  distance?: number; // 米
  time?: number; // 秒
  tolls?: number; // 元
  roads?: string[];
}

export interface Segment {
  id: string;
  day: number;
  dayTitle: string; // 'DAY 1'
  title: string;
  start: number; // 关联 stops[start]
  end: number; // 关联 stops[end]
  chosen: string; // 默认选中的 RouteOption ID
  note: string;
  tags: string[]; // 如 ['丘陵田野', '国道省道', '少城区']
  options: RouteOption[];
  customWaypoints?: Stop[]; // 用户动态加入的停靠点
}

export interface DayPlan {
  day: number;
  title: string;
  dateStr: string; // '9/28'
  subtitle: string;
  segmentCount: number;
  totalKmEstimated: number;
  segments: Segment[];
}

export interface Trip {
  id: string;
  title: string;
  dateRange: string;
  departureNote: string;
  preferences: string[];
  days: DayPlan[];
}
