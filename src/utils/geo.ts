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
export function sampleCenters(path: [number, number][], intervalMeters = 25000): [number, number][] {
  if (!path || path.length < 2) return path || [];

  const distances: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    distances.push(distances[i - 1] + geoDistance(path[i - 1], path[i]));
  }

  const total = distances[distances.length - 1];
  if (total <= 0) return [path[0]];

  const count = Math.min(12, Math.max(3, Math.ceil(total / intervalMeters) + 1));
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
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistance(p, polyline[i], polyline[i + 1]);
    if (d < minDistanceMeters) {
      minDistanceMeters = d;
    }
  }

  return Number((minDistanceMeters / 1000).toFixed(1));
}
