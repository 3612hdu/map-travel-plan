// 空间几何与坐标计算工具

// 大圆距离公式（米）
export function geoDistance(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(x)));
}

// 格式化时间
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0分钟';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}

// 格式化距离 (km)
export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return '0 km';
  return `${(meters / 1000).toFixed(1)} km`;
}

// 沿折线等距抽样锚点（用于走廊搜索 PlaceSearch）
// intervalMeters: 默认 16000m (配合 PlaceSearch 8000m 半径形成连续重叠走廊)
export function sampleCenters(
  path: [number, number][],
  intervalMeters = 16000,
  maxSamples = 36
): [number, number][] {
  if (!path || path.length < 2) return path || [];

  const distances: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    distances.push(distances[i - 1] + geoDistance(path[i - 1], path[i]));
  }

  const total = distances[distances.length - 1];
  if (total <= 0) return [path[0]];

  // 保证长路段与全程无截断覆盖，采样点上限扩展至 maxSamples (36)
  const count = Math.min(maxSamples, Math.max(3, Math.ceil(total / intervalMeters) + 1));
  const samples: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    let idx = distances.findIndex((d) => d >= target);
    if (idx < 0) idx = path.length - 1;
    samples.push(path[idx]);
  }

  return samples;
}

// 点到线段的最短距离（米）
export function pointToSegmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dAB = geoDistance(a, b);
  if (dAB === 0) return geoDistance(p, a);

  // 投影比例 t
  const cosLat = Math.cos((p[1] * Math.PI) / 180);
  const dx = (b[0] - a[0]) * cosLat;
  const dy = b[1] - a[1];
  const px = (p[0] - a[0]) * cosLat;
  const py = p[1] - a[1];

  let t = (px * dx + py * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projPoint: [number, number] = [
    a[0] + (t * (b[0] - a[0])),
    a[1] + (t * (b[1] - a[1]))
  ];

  return geoDistance(p, projPoint);
}

// 点到整条折线的最短垂直距离（公里）
export function pointToPolylineDistanceKm(
  p: [number, number],
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length === 0) return 999;
  if (polyline.length === 1) return geoDistance(p, polyline[0]) / 1000;

  let minDistanceMeters = Infinity;
  // 经纬度外包框快速粗筛 (约 0.15度 ≈ 15km)
  const roughThresholdDeg = 0.15;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    const minLng = Math.min(a[0], b[0]) - roughThresholdDeg;
    const maxLng = Math.max(a[0], b[0]) + roughThresholdDeg;
    const minLat = Math.min(a[1], b[1]) - roughThresholdDeg;
    const maxLat = Math.max(a[1], b[1]) + roughThresholdDeg;

    if (p[0] < minLng || p[0] > maxLng || p[1] < minLat || p[1] > maxLat) {
      continue;
    }

    const d = pointToSegmentDistance(p, a, b);
    if (d < minDistanceMeters) {
      minDistanceMeters = d;
    }
  }

  // 若快速粗筛未命中，进行全线兜底
  if (minDistanceMeters === Infinity) {
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = pointToSegmentDistance(p, polyline[i], polyline[i + 1]);
      if (d < minDistanceMeters) minDistanceMeters = d;
    }
  }

  return Number((minDistanceMeters / 1000).toFixed(1));
}

export interface RouteProjection {
  distanceAlongRouteMeters: number;
  distanceToRouteMeters: number;
  segmentIndex: number;
  fraction: number;
}

// 用同一条已规划路线给风景控制点与用户停靠点排序，避免追加的点造成回头路。
export function projectPointOntoRoute(
  point: [number, number],
  path: [number, number][]
): RouteProjection {
  if (path.length < 2) {
    return { distanceAlongRouteMeters: 0, distanceToRouteMeters: Infinity, segmentIndex: 0, fraction: 0 };
  }

  let traveled = 0;
  let best: RouteProjection = {
    distanceAlongRouteMeters: 0,
    distanceToRouteMeters: Infinity,
    segmentIndex: 0,
    fraction: 0
  };

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segmentMeters = geoDistance(a, b);
    if (segmentMeters === 0) continue;

    const cosLat = Math.cos((point[1] * Math.PI) / 180);
    const dx = (b[0] - a[0]) * cosLat;
    const dy = b[1] - a[1];
    const px = (point[0] - a[0]) * cosLat;
    const py = point[1] - a[1];
    const fraction = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    const projection: [number, number] = [
      a[0] + fraction * (b[0] - a[0]),
      a[1] + fraction * (b[1] - a[1])
    ];
    const distanceToRouteMeters = geoDistance(point, projection);
    if (distanceToRouteMeters < best.distanceToRouteMeters) {
      best = {
        distanceAlongRouteMeters: traveled + fraction * segmentMeters,
        distanceToRouteMeters,
        segmentIndex: i,
        fraction
      };
    }
    traveled += segmentMeters;
  }
  return best;
}

export function orderPointsAlongRoute<T extends { coord: [number, number] }>(
  points: T[],
  path: [number, number][]
): Array<T & RouteProjection> {
  return points
    .map((point, index) => ({ ...point, ...projectPointOntoRoute(point.coord, path), originalIndex: index }))
    .sort((a, b) => a.distanceAlongRouteMeters - b.distanceAlongRouteMeters || a.originalIndex - b.originalIndex)
    .map(({ originalIndex: _originalIndex, ...point }) => point as T & RouteProjection);
}

/**
 * 根据垂直距离估算往返绕行增加里程 (km)
 * 重要语义声明：
 * 此函数为基于点到折线垂直距离的理论几何估算值（折返系数估算约 1.8 倍），
 * 仅用于列表快速初筛与排序打分，绝非高德 Driving 实测真实道路绕行距离。
 */
export function estimateDetourKm(perpendicularDistanceKm: number): number {
  if (perpendicularDistanceKm <= 0.1) return 0.2;
  // 实际道路迂回系数约 1.8 ~ 2.0 倍垂距
  return Number((perpendicularDistanceKm * 1.8).toFixed(1));
}

// 顺路等级评定
export function classifyDetourGrade(
  distanceKm: number
): 'direct' | 'minimal' | 'moderate' | 'deep' {
  if (distanceKm <= 1.0) return 'direct';
  if (distanceKm <= 3.0) return 'minimal';
  if (distanceKm <= 6.0) return 'moderate';
  return 'deep';
}
