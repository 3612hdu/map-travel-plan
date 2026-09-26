// 路线规划偏好策略统一抽象

export interface RoutePreference {
  avoidHighway: boolean;    // 不走高速 (核心偏好 1)
  avoidToll: boolean;       // 尽量少收费 (核心偏好 2)
  avoidCongestion: boolean; // 躲避拥堵 (可选偏好 3)
}

export const DEFAULT_PREFERENCE: RoutePreference = {
  avoidHighway: true,
  avoidToll: true,
  avoidCongestion: false // 自驾走廊风景优先，避免因躲拥堵绕行不可控的未知小道
};

/**
 * 1. AMap JS API 2.0 DrivingPolicy 策略适配器
 * 真实枚举值 (经过 2026-09-26 真实浏览器实测与 window.AMap.DrivingPolicy 校验):
 * 0: LEAST_TIME (最快捷)
 * 1: LEAST_FEE (最经济/少收费)
 * 2: LEAST_DISTANCE (最短距离)
 * 4: REAL_TRAFFIC (考虑实时路况/避拥堵)
 * 5: MULTI_POLICIES (多策略返回，包含高速)
 * 6: HIGHWAY (不走高速)
 * 7: FEE_HIGHWAY (不走高速且避免收费)
 * 8: FEE_TRAFFIC (避免收费且躲避拥堵)
 * 9: TRAFFIC_HIGHWAY (不走高速且躲避拥堵)
 *
 * 注：JS API 2.0 无三合一（不走高速+少收费+躲拥堵）枚举。
 * 当用户同时勾选三项时，以不走高速且少收费(7)为基础，优先保证自驾不走高速的核心诉求。
 */
export function mapPreferenceToAMapJsApiPolicy(pref: RoutePreference): number {
  if (pref.avoidHighway && pref.avoidToll && pref.avoidCongestion) {
    // JS API 2.0 无法原生表达三者组合，降级为 7 (不走高速且避免收费)
    return 7;
  }
  if (pref.avoidHighway && pref.avoidToll) {
    return 7; // 不走高速且避免收费
  }
  if (pref.avoidHighway && pref.avoidCongestion) {
    return 9; // 不走高速且躲避拥堵
  }
  if (pref.avoidHighway) {
    return 6; // 不走高速
  }
  if (pref.avoidToll && pref.avoidCongestion) {
    return 8; // 避免收费且躲避拥堵
  }
  if (pref.avoidToll) {
    return 1; // 最经济/少收费
  }
  if (pref.avoidCongestion) {
    return 4; // 考虑实时路况/躲避拥堵
  }
  return 0; // 最快捷
}

// 保持向前兼容导出
export const mapPreferenceToAMapPolicy = mapPreferenceToAMapJsApiPolicy;

/**
 * 2. 高德 Web Service 路径规划 2.0 (/v5/direction/driving) strategy 适配器
 * 官方标准定义：
 * 32: 默认高德推荐
 * 33: 躲避拥堵
 * 34: 高速优先
 * 35: 不走高速
 * 36: 少收费
 * 37: 大路优先
 * 38: 速度最快
 * 39: 躲避拥堵 + 高速优先
 * 40: 躲避拥堵 + 不走高速
 * 41: 躲避拥堵 + 少收费
 * 42: 少收费 + 不走高速
 * 43: 躲避拥堵 + 少收费 + 不走高速 (完美支持三合一组合)
 */
export function mapPreferenceToWebServiceStrategy(pref: RoutePreference): number {
  if (pref.avoidHighway && pref.avoidToll && pref.avoidCongestion) {
    return 43; // 躲避拥堵 + 少收费 + 不走高速
  }
  if (pref.avoidHighway && pref.avoidToll) {
    return 42; // 少收费 + 不走高速
  }
  if (pref.avoidHighway && pref.avoidCongestion) {
    return 40; // 躲避拥堵 + 不走高速
  }
  if (pref.avoidHighway) {
    return 35; // 不走高速
  }
  if (pref.avoidToll && pref.avoidCongestion) {
    return 41; // 躲避拥堵 + 少收费
  }
  if (pref.avoidToll) {
    return 36; // 少收费
  }
  if (pref.avoidCongestion) {
    return 33; // 躲避拥堵
  }
  return 32; // 默认推荐
}

/**
 * 3. 高德 URI API (https://uri.amap.com/navigation) policy 适配器
 * 官方驾车模式 (mode=car) policy 参数：
 * 0: 推荐策略 (默认)
 * 1: 避免拥堵
 * 2: 避免收费
 * 3: 不走高速 (优先移动端)
 */
export function mapPreferenceToUriPolicy(pref: RoutePreference): string {
  if (pref.avoidHighway) {
    return '3'; // 不走高速
  }
  if (pref.avoidToll) {
    return '2'; // 避免收费
  }
  if (pref.avoidCongestion) {
    return '1'; // 避免拥堵
  }
  return '0'; // 默认
}
