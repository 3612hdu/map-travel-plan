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
  segmentId: string;
  routeOptionIds: string[];
  title: string;
  desc: string;
  image: string;
  anchor: [number, number];
  startProgress?: number;
  endProgress?: number;
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
  customStartCoord?: [number, number]; // 住宿点重置起点
  customStartName?: string;
  customEndCoord?: [number, number]; // 住宿点重置终点
  customEndName?: string;
  defaultDay?: number; // 原始默认所属天数
  isSplitPart?: 'first' | 'second'; // 是否为中间拆分生成的路段
  splitParentId?: string; // 拆分来源的原路段 ID
  isBoundaryStop?: boolean; // 是否处于路段边界
}

export interface OvernightStop {
  id: string;
  poiId?: string;
  name: string;
  coord: [number, number];
  address?: string;
  city?: string;
  day: number; // 结束的天数 (通常为 Day 1)
  sourceSegmentId: string;
  targetCityOrArea?: string; // 如 "广水市" / "随州市"
  rating?: number;
  source?: 'amap-search' | 'user-input';
  positionType?: 'middle' | 'boundary'; // 处于路段中间还是边界

  // 动态路线测算数据
  todayDrivingKm?: number;
  todayDrivingDurationSec?: number;
  todayEta?: string; // 如 "17:25"
  tomorrowRemainingKm?: number;
  tomorrowRemainingDurationSec?: number;

  // 决策推荐属性
  decisionTag?: 'more_balanced' | 'today_relaxed' | 'tomorrow_relaxed';
  decisionLabel?: string; // "更均衡" | "今天更轻松" | "明天更轻松"
  decisionReason?: string;
}

export type TimelineItemType =
  | 'departure'
  | 'segmentStart'
  | 'segmentEnd'
  | 'waypoint'
  | 'overnight'
  | 'rest'
  | 'meal';

export interface TimelineItem {
  id: string;
  day: number;
  type: TimelineItemType;
  title: string;
  subTitle?: string;
  plannedTime: string; // "12:00" | "13:45" | "等待路线数据"
  durationMinutes?: number;
  distanceKm?: number;
  isOvernight?: boolean;
  linkedSegmentId?: string;
  linkedPoiId?: string;
  coord?: [number, number];
  isPendingRoute?: boolean; // 是否处于等待路线数据态
}

export interface DayPlan {
  day: number;
  title: string;
  dateStr: string; // '9/28'
  subtitle: string;
  startTime?: string; // 如 "12:00"
  overnightStop?: OvernightStop | null;
  segmentCount: number;
  totalKmEstimated: number;
  plannedDrivingDuration?: number; // 秒
  plannedDistance?: number; // 米
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

export interface TripNodeInfo {
  id: string;
  name: string;
  coord: [number, number];
  role: 'tripStart' | 'viaNode' | 'dayEnd' | 'tripEnd';
  roleLabel: string;
  dayText: string;
  segmentId: string;
  etaText?: string;
  photoUrl?: string;
  photoTitle?: string;
  address?: string;
  desc?: string;
}

