// 地图交互状态类型

export type MapMode =
  | 'trip-overview'    // 全程总览
  | 'day-overview'     // 某一天总览
  | 'segment-selected' // 选中某一路段
  | 'segment-focus'    // 详细聚焦某一路段
  | 'poi-search';      // 设施搜索模式

export interface RouteCalcResult {
  path: [number, number][];
  distance: number; // 米
  time: number; // 秒
  tolls: number; // 元
  roads: string[];
  orderedWaypointIds?: string[]; // 实际传给 Driving 的控制点顺序，供路线完整性核验
}
