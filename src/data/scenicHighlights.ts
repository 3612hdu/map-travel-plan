import { RouteHighlight } from '../types/trip';
import { verifiedStops } from './stops';

// 途经镇采用已有核对坐标；亮点范围在运行时投影到当前方案的真实路线。
export const segment6Highlights: RouteHighlight[] = [
  { id: 'liangshuihe', segmentId: 's6', routeOptionIds: ['scenic'], title: '凉水河途经路段', desc: '环库方案经凉水河镇；所示范围来自当前实际道路。临水体验需以现场为准。', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80', anchor: verifiedStops[9].coord, tags: ['途经镇', '路线参考'] },
  { id: 'xijiadian', segmentId: 's6', routeOptionIds: ['scenic', 'compromise'], title: '习家店途经路段', desc: '环库与折中方案均经过习家店镇；高亮当前路线中对应的一段。', image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80', anchor: verifiedStops[10].coord, tags: ['途经镇', '路线参考'] },
  { id: 'anyang', segmentId: 's6', routeOptionIds: ['scenic'], title: '安阳途经路段', desc: '环库方案经安阳镇；高亮当前实际道路中的相邻区间。', image: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=400&q=80', anchor: verifiedStops[11].coord, tags: ['途经镇', '路线参考'] }
];
