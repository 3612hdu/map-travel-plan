import { Segment, Stop } from '../types/trip';
import { verifiedStops } from '../data/stops';

export interface RouteRecommendation {
  id: string;
  stop: Stop;
  segmentId: string;
  segmentTitle: string;
  day: number;
  category: 'scenic' | 'town';
  reason: string;
  onSelectedRoute: boolean;
}

// 推荐来自当前行程的真实途经节点；不把路线参考点当成景区入口。
export function buildRouteRecommendations(
  segments: Segment[],
  selectedOptions: Record<string, string>,
  includeAlternatives = false
): RouteRecommendation[] {
  const items = new Map<string, RouteRecommendation>();
  for (const segment of segments) {
    const chosen = selectedOptions[segment.id] || segment.chosen;
    const options = [...segment.options].sort((a, b) => Number(b.id === chosen) - Number(a.id === chosen));
    for (const option of options) {
      const onSelectedRoute = option.id === chosen;
      if (!includeAlternatives && !onSelectedRoute) continue;
      const endpoint = (side: 'start' | 'end'): Stop | undefined => {
        const original = verifiedStops[segment[side]];
        const coord = side === 'start' ? segment.customStartCoord : segment.customEndCoord;
        const name = side === 'start' ? segment.customStartName : segment.customEndName;
        return coord ? {
          id: `custom-${coord.join(',')}`, name: name || '行程停靠点', coord,
          poi: '', city: original?.city || '', address: ''
        } : original;
      };
      const stops = [endpoint('start'), ...option.via.map((index) => verifiedStops[index]), endpoint('end')];
      for (const stop of stops) {
        if (!stop) continue;
        const existing = items.get(stop.id);
        if (existing && (existing.onSelectedRoute || !onSelectedRoute)) continue;
        const highlight = option.highlights.find((item) => item.anchor[0] === stop.coord[0] && item.anchor[1] === stop.coord[1]);
        items.set(stop.id, {
          id: stop.id, stop, segmentId: segment.id, segmentTitle: segment.title,
          day: segment.day, category: highlight ? 'scenic' : 'town',
          reason: highlight?.desc || segment.note, onSelectedRoute
        });
      }
    }
  }
  return [...items.values()];
}

export const SAVED_RECOMMENDATIONS_KEY = 'map-travel-plan:saved-recommendations:v1';

export function readSavedRecommendations(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_RECOMMENDATIONS_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))].slice(0, 100) : [];
  } catch {
    return [];
  }
}
