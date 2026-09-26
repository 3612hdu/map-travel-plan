import { RouteCalcResult } from '../types/map';
import { geoDistance, projectPointOntoRoute } from './geo';

export interface RouteDifference {
  distanceDifferenceMeters: number;
  durationDifferenceSeconds: number;
  geometryAverageSeparationMeters: number;
  geometryOverlapRatio: number;
  majorRoadSequenceDifference: number;
  basicallySame: boolean;
}

function samplePath(path: [number, number][], sampleCount = 24): [number, number][] {
  if (path.length < 2) return path;
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(cumulative[i - 1] + geoDistance(path[i - 1], path[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (!total) return [path[0]];
  const samples: [number, number][] = [];
  let segment = 0;
  for (let i = 0; i < sampleCount; i++) {
    const target = (total * i) / (sampleCount - 1);
    while (segment < cumulative.length - 2 && cumulative[segment + 1] < target) segment++;
    const leg = cumulative[segment + 1] - cumulative[segment];
    const t = leg ? (target - cumulative[segment]) / leg : 0;
    samples.push([
      path[segment][0] + t * (path[segment + 1][0] - path[segment][0]),
      path[segment][1] + t * (path[segment + 1][1] - path[segment][1])
    ]);
  }
  return samples;
}

function roadSequenceDifference(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0; // 缺数据时交给实路几何判断
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

export function compareRouteResults(a: RouteCalcResult, b: RouteCalcResult): RouteDifference {
  const samplesA = samplePath(a.path);
  const samplesB = samplePath(b.path);
  const separations = [
    ...samplesA.map((point) => projectPointOntoRoute(point, b.path).distanceToRouteMeters),
    ...samplesB.map((point) => projectPointOntoRoute(point, a.path).distanceToRouteMeters)
  ];
  const geometryAverageSeparationMeters = separations.length
    ? separations.reduce((sum, d) => sum + d, 0) / separations.length
    : Infinity;
  const geometryOverlapRatio = separations.length
    ? separations.filter((d) => d <= 150).length / separations.length
    : 0;
  const distanceDifferenceMeters = Math.abs(a.distance - b.distance);
  const durationDifferenceSeconds = Math.abs(a.time - b.time);
  const majorRoadSequenceDifference = roadSequenceDifference(a.roads, b.roads);
  const basicallySame = distanceDifferenceMeters < 2000
    && durationDifferenceSeconds < 360
    && geometryAverageSeparationMeters < 250
    && geometryOverlapRatio > 0.8
    && majorRoadSequenceDifference < 0.35;
  return {
    distanceDifferenceMeters,
    durationDifferenceSeconds,
    geometryAverageSeparationMeters,
    geometryOverlapRatio,
    majorRoadSequenceDifference,
    basicallySame
  };
}
