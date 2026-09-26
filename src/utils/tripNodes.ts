import { Segment, Stop, OvernightStop, TripNodeInfo } from '../types/trip';
import { RouteCalcResult } from '../types/map';
import { verifiedStops } from '../data/stops';
import { initialMedia } from '../data/mediaData';
import { generateTimelineItems } from './timeline';

/**
 * 编译生成两日自驾走廊的 7 个核心节点信息卡数据 (TripNodeInfo[])
 * 用于地图起终点交互、地点卡片弹出与路段/设施快速跳转
 */
export function compileTripNodes(
  segments: Segment[],
  selectedOptions: Record<string, string>,
  routeResults: Record<string, RouteCalcResult>,
  customWaypoints: Record<string, Stop[]>,
  dayStartTimes: Record<number, string> = { 1: '12:00', 2: '09:00' },
  overnightStop: OvernightStop | null = null
): TripNodeInfo[] {
  // 生成动态时间轴，获取各节点的精准算路推演时刻
  const timelineItems = generateTimelineItems(
    segments,
    selectedOptions,
    routeResults,
    customWaypoints,
    dayStartTimes,
    overnightStop
  );

  const getTimeForKeyword = (keyword: string): string | undefined => {
    const found = timelineItems.find((it) => it.title.includes(keyword) || (it.subTitle && it.subTitle.includes(keyword)));
    return found?.plannedTime;
  };

  const getMediaForKeyword = (keyword: string) => {
    return initialMedia.find((m) => m.title.includes(keyword) || (m.author && m.author.includes(keyword)));
  };

  const nodes: TripNodeInfo[] = [
    {
      id: 'node-huanggang',
      name: '黄冈师范学院',
      coord: verifiedStops[0].coord,
      role: 'tripStart',
      roleLabel: '全程起点',
      dayText: 'DAY 1 · 第 1 段起点',
      segmentId: 's1',
      etaText: `计划出发: ${dayStartTimes[1] || '12:00'}`,
      photoTitle: getMediaForKeyword('黄冈')?.title || '黄冈东坡赤壁与遗爱湖公园',
      photoUrl: getMediaForKeyword('黄冈')?.cover,
      address: verifiedStops[0].address || '黄冈市黄州区开发区新港二路146号',
      desc: '自驾启程地，避开高速，沿国道向西北平稳出城。'
    },
    {
      id: 'node-macheng',
      name: '麻城市',
      coord: verifiedStops[1].coord,
      role: 'viaNode',
      roleLabel: '途经换乘节点',
      dayText: 'DAY 1 · s1 终点 / s2 起点',
      segmentId: 's2',
      etaText: getTimeForKeyword('麻城') ? `预计抵达: ${getTimeForKeyword('麻城')}` : undefined,
      photoTitle: getMediaForKeyword('麻城')?.title || '麻城龟峰山杜鹃花海实景',
      photoUrl: getMediaForKeyword('麻城')?.cover,
      address: verifiedStops[1].address || '黄冈市麻城市金桥大道',
      desc: '大别山南麓咽喉，由此向西进入将军故里红安。'
    },
    {
      id: 'node-dawu',
      name: '大悟县',
      coord: verifiedStops[3].coord,
      role: 'viaNode',
      roleLabel: '途经换乘节点',
      dayText: 'DAY 1 · s2 终点 / s3 起点',
      segmentId: 's3',
      etaText: getTimeForKeyword('大悟') ? `预计抵达: ${getTimeForKeyword('大悟')}` : undefined,
      photoTitle: getMediaForKeyword('大悟')?.title || '大悟宣化店丘陵山道实景',
      photoUrl: getMediaForKeyword('大悟')?.cover,
      address: verifiedStops[3].address || '孝感市大悟县长征南路',
      desc: '丘陵与田野风光交界，傍晚向西经广水前往随州。'
    },
    {
      id: 'node-suizhou',
      name: overnightStop ? overnightStop.name : '随州市',
      coord: overnightStop ? overnightStop.coord : verifiedStops[5].coord,
      role: 'dayEnd',
      roleLabel: overnightStop ? '第一晚选定住宿点' : 'Day 1 收车终点',
      dayText: 'DAY 1 终点 · DAY 2 出发点',
      segmentId: 's4',
      etaText: getTimeForKeyword('随州') ? `预计抵达: ${getTimeForKeyword('随州')}` : '预计傍晚 18:30 前收车',
      photoTitle: getMediaForKeyword('随州')?.title || '随州大洪山古银杏群',
      photoUrl: getMediaForKeyword('随州')?.cover,
      address: overnightStop?.address || verifiedStops[5].address || '随州市曾都区迎宾大道',
      desc: '编钟乐都，第一晚休整充能；次日早晨 09:00 出发向西北前往襄阳。'
    },
    {
      id: 'node-xiangyang',
      name: '襄阳市',
      coord: verifiedStops[7].coord,
      role: 'viaNode',
      roleLabel: '途经换乘节点',
      dayText: 'DAY 2 · s4 终点 / s5 起点',
      segmentId: 's5',
      etaText: getTimeForKeyword('襄阳') ? `预计抵达: ${getTimeForKeyword('襄阳')}` : undefined,
      photoTitle: getMediaForKeyword('襄阳')?.title || '襄阳古城临汉门与汉江水岸',
      photoUrl: getMediaForKeyword('襄阳')?.cover,
      address: verifiedStops[7].address || '襄阳市襄城区檀溪路',
      desc: '铁打古城，汉江穿城而过；建议在此补充油电与午餐休整。'
    },
    {
      id: 'node-danjiangkou',
      name: '丹江口市',
      coord: verifiedStops[8].coord,
      role: 'viaNode',
      roleLabel: '途经节点 · 环库起点',
      dayText: 'DAY 2 · s5 终点 / s6 环库起点',
      segmentId: 's6',
      etaText: getTimeForKeyword('丹江口') ? `预计抵达: ${getTimeForKeyword('丹江口')}` : undefined,
      photoTitle: getMediaForKeyword('丹江口')?.title || '丹江口大坝水利枢纽工程',
      photoUrl: getMediaForKeyword('丹江口')?.cover,
      address: verifiedStops[8].address || '十堰市丹江口市右岸迎宾路',
      desc: '南水北调源头水都，自驾环库最美公路北岸起点。'
    },
    {
      id: 'node-yunyang',
      name: '郧阳区人民政府',
      coord: verifiedStops[12].coord,
      role: 'tripEnd',
      roleLabel: '全程自驾终点',
      dayText: 'DAY 2 · 第 6 段终点',
      segmentId: 's6',
      etaText: getTimeForKeyword('郧阳') ? `预计抵达: ${getTimeForKeyword('郧阳')}` : undefined,
      photoTitle: getMediaForKeyword('郧阳')?.title || '郧阳汉江二桥与沧浪绿道',
      photoUrl: getMediaForKeyword('郧阳')?.cover,
      address: verifiedStops[12].address || '十堰市郧阳区城关镇',
      desc: '两日自驾完美收官地，横跨汉江，青山绿水。'
    }
  ];

  return nodes;
}
