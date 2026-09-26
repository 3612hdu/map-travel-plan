import { OvernightStop, Segment } from '../types/trip';
import { RouteCalcResult } from '../types/map';

export function getOvernightMetrics(candidate: OvernightStop, selected: OvernightStop | null,
  segments: Segment[], selectedOptions: Record<string, string>, routes: Record<string, RouteCalcResult>,
  dayStartTimes: Record<number, string>) {
  if (!selected || selected.id !== candidate.id) return null;
  let todayKm = 0, tomorrowKm = 0, todaySeconds = 0, tomorrowSeconds = 0;
  for (const segment of segments) {
    const option = selectedOptions[segment.id] || segment.chosen;
    const route = routes[`${segment.id}:${option}`];
    if (!route?.path?.length || !route.distance || !route.time) return null;
    if (segment.day === 1) { todayKm += route.distance / 1000; todaySeconds += route.time; }
    else { tomorrowKm += route.distance / 1000; tomorrowSeconds += route.time; }
  }
  const [hour, minute] = (dayStartTimes[1] || '12:00').split(':').map(Number);
  const etaMinute = (hour * 60 + minute + Math.round(todaySeconds / 60)) % 1440;
  const eta = `${String(Math.floor(etaMinute / 60)).padStart(2, '0')}:${String(etaMinute % 60).padStart(2, '0')}`;
  const ratio = Math.round(todayKm / (todayKm + tomorrowKm) * 100);
  const label = Math.abs(todaySeconds - tomorrowSeconds) <= 3600 ? '更均衡' : todaySeconds < tomorrowSeconds ? '今天更轻松' : '明天更轻松';
  return { todayKm: Math.round(todayKm), tomorrowKm: Math.round(tomorrowKm), todaySeconds, tomorrowSeconds, eta, ratio, label };
}
