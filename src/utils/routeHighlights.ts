import { RouteHighlight } from '../types/trip';
import { projectPointOntoRoute, routeLength } from './geo';

export function bindHighlightsToRoute(highlights: RouteHighlight[], segmentId: string, optionId: string, path?: [number, number][]): RouteHighlight[] {
  if (!path || path.length < 2) return [];
  const total = routeLength(path);
  if (!total) return [];
  return highlights.flatMap((highlight) => {
    if (highlight.segmentId !== segmentId || !highlight.routeOptionIds.includes(optionId)) return [];
    const projected = projectPointOntoRoute(highlight.anchor, path);
    // 途经点远离实路时不宣称它属于这条路线。
    if (projected.distanceToRouteMeters > 2000) return [];
    const progress = projected.distanceAlongRouteMeters / total;
    const halfWidth = Math.min(0.065, 5000 / total);
    return [{ ...highlight, startProgress: Math.max(0, progress - halfWidth), endProgress: Math.min(1, progress + halfWidth) }];
  });
}
