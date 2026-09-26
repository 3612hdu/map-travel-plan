// 路线规划偏好策略统一抽象

export interface RoutePreference {
  avoidHighway: boolean;    // 不走高速
  avoidToll: boolean;       // 尽量少收费
  avoidCongestion: boolean; // 躲避拥堵
}

export const DEFAULT_PREFERENCE: RoutePreference = {
  avoidHighway: true,
  avoidToll: true,
  avoidCongestion: false // 自驾走廊风景优先，避免因躲拥堵绕行不可控的未知小路
};

/**
 * 将业务偏好 RoutePreference 映射至高德 JS API 2.0 Driving policy 枚举值：
 * 0: 最快捷 (LEAST_TIME)
 * 1: 最经济，尽量避开收费 (LEAST_FEE)
 * 2: 最短距离 (LEAST_DISTANCE)
 * 4: 考虑实时路况 (REAL_TRAFFIC)
 * 5: 不走高速且避免收费 (NO_HIGHWAY)
 * 6: 不走高速且躲避拥堵 (AVOID_HIGHWAYS)
 * 7: 躲避收费且躲避拥堵 (AVOID_TOLL)
 * 8: 不走高速且躲避收费和拥堵 (AVOID_HIGHWAYS_AND_TOLL_AND_CONGESTION)
 */
export function mapPreferenceToAMapPolicy(pref: RoutePreference): number {
  if (pref.avoidHighway && pref.avoidToll && pref.avoidCongestion) {
    return 8;
  }
  if (pref.avoidHighway && pref.avoidToll) {
    return 5; // 核心自驾偏好：不走高速且避免收费
  }
  if (pref.avoidHighway && pref.avoidCongestion) {
    return 6;
  }
  if (pref.avoidHighway) {
    return 5;
  }
  if (pref.avoidToll && pref.avoidCongestion) {
    return 7;
  }
  if (pref.avoidToll) {
    return 1;
  }
  if (pref.avoidCongestion) {
    return 4;
  }
  return 0;
}
