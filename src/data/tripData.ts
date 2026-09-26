import { Trip, Segment } from '../types/trip';
import { segment6Highlights } from './scenicHighlights';

export const initialSegments: Segment[] = [
  {
    id: 's1',
    day: 1,
    dayTitle: 'DAY 1',
    title: '黄冈师范学院 → 麻城',
    start: 0, // 黄冈师范学院
    end: 1,   // 麻城市
    chosen: 'main',
    note: '中午出发先稳妥出城，不加景区绕行，沿国道平稳北上。',
    tags: ['丘陵田野', '国道省道', '少城区'],
    options: [
      {
        id: 'main',
        name: '普通道路直达',
        tagTitle: '普通路线',
        isRecommended: true,
        desc: '高德避高速规划，途经新洲、麻城，道路平整，穿镇有序。',
        via: [],
        features: ['时间最短', '路况稳', '车流适中'],
        highlights: []
      }
    ]
  },
  {
    id: 's2',
    day: 1,
    dayTitle: 'DAY 1',
    title: '麻城 → 大悟',
    start: 1, // 麻城市
    end: 3,   // 大悟县
    chosen: 'scenic',
    note: '经红安核对 G346；五城线不是本次固定必经点。',
    tags: ['红色文化', '山林乡镇'],
    options: [
      {
        id: 'scenic',
        name: '经红安 · G346 方向',
        tagTitle: '推荐文化风景线',
        isRecommended: true,
        desc: '已固定红安县途经点，穿行将军故里丘陵林道，路况通畅。',
        via: [2], // 红安县
        features: ['历史人文', '丘陵起伏', '避开快车'],
        highlights: []
      },
      {
        id: 'direct',
        name: '普通直达备选',
        tagTitle: '赶路备选',
        isRecommended: false,
        desc: '当天普通道路直达，根据路况可能与经红安方案重合。',
        via: [],
        features: ['时间最短', '少途经点'],
        highlights: []
      }
    ]
  },
  {
    id: 's3',
    day: 1,
    dayTitle: 'DAY 1',
    title: '大悟 → 随州',
    start: 3, // 大悟县
    end: 5,   // 随州市
    chosen: 'scenic',
    note: '经广水。若 18:30 到广水仍疲劳，就在广水收车住宿，不疲劳驾驶。',
    tags: ['田园风光', '路况较好'],
    options: [
      {
        id: 'scenic',
        name: '经广水 · 田野方向',
        tagTitle: '推荐田园线',
        isRecommended: true,
        desc: '固定广水途经点；穿越大悟与随州之间的田野缓坡，日落时分景色宜人。',
        via: [4], // 广水市
        features: ['田园视野', '途经城镇补能便利'],
        highlights: []
      },
      {
        id: 'direct',
        name: '普通道路直达',
        tagTitle: '直达路线',
        isRecommended: false,
        desc: '由高德选择普通道路直达随州市区。',
        via: [],
        features: ['里程最短'],
        highlights: []
      }
    ]
  },
  {
    id: 's4',
    day: 2,
    dayTitle: 'DAY 2',
    title: '随州 → 襄阳',
    start: 5, // 随州市
    end: 7,   // 襄阳市
    chosen: 'scenic',
    note: '早出发，经枣阳核对 G316 方向；进襄阳城区前补油补电。',
    tags: ['平原丘陵', '穿镇较多'],
    options: [
      {
        id: 'scenic',
        name: '经枣阳 · G316 方向',
        tagTitle: '推荐国道线',
        isRecommended: true,
        desc: '固定枣阳节点，沿经典 G316 国道行驶，车道宽阔，补给点充沛。',
        via: [6], // 枣阳市
        features: ['补能便利', '国道主干线', '平原坦荡'],
        highlights: []
      },
      {
        id: 'direct',
        name: '当天直达路线',
        tagTitle: '普通路线',
        isRecommended: false,
        desc: '当天普通公路直通襄阳。',
        via: [],
        features: ['点对点规划'],
        highlights: []
      }
    ]
  },
  {
    id: 's5',
    day: 2,
    dayTitle: 'DAY 2',
    title: '襄阳 → 丹江口',
    start: 7, // 襄阳市
    end: 8,   // 丹江口市
    chosen: 'main',
    note: '在襄阳判断天气、施工和体力；必要时直达郧阳，不进山路。',
    tags: ['汉江风光', '路况良好'],
    options: [
      {
        id: 'main',
        name: '按计划到丹江口',
        tagTitle: '推荐主线',
        isRecommended: true,
        desc: '沿汉江平原向西北进发，直达丹江口城区，沿途可见大江大坝外围风光。',
        via: [],
        features: ['路况极佳', '铺装完善', '水利枢纽之都'],
        highlights: []
      }
    ]
  },
  {
    id: 's6',
    day: 2,
    dayTitle: 'DAY 2',
    title: '丹江口 → 郧阳',
    start: 8,  // 丹江口市
    end: 12,  // 郧阳区人民政府
    chosen: 'scenic',
    note: '白天经凉水河、习家店、安阳看库区；路况差就在丹江口停下或走高德当天可通行路线。',
    tags: ['库区风景', '临水公路', '强烈推荐'],
    options: [
      {
        id: 'direct',
        name: '普通路线',
        tagTitle: '普通路线',
        isRecommended: false,
        desc: '以国道和县道为主，路况较好，适合尽快抵达。',
        via: [],
        features: ['时间最短', '路况稳', '穿镇较多'],
        comparisonNote: '基准路线',
        highlights: []
      },
      {
        id: 'scenic',
        name: '环库风景路线',
        tagTitle: '环库风景路线',
        isRecommended: true,
        desc: '沿丹江口水库北岸行驶，连续临水视野，风景最佳，推荐白天通过。',
        via: [9, 10, 11], // 凉水河镇, 习家店镇, 安阳镇
        features: ['临水', '山景', '拍照', '慢生活'],
        comparisonNote: '+31 km · +47 min',
        highlights: segment6Highlights
      },
      {
        id: 'compromise',
        name: '风景折中路线',
        tagTitle: '风景折中路线',
        isRecommended: false,
        desc: '兼顾风景与用时，部分路段靠近水库适合大多数游客。',
        via: [9, 10], // 凉水河镇, 习家店镇
        features: ['兼顾时间', '部分临水', '适合赶时间'],
        comparisonNote: '+16 km · +22 min',
        highlights: segment6Highlights.slice(0, 2)
      }
    ]
  }
];

export const tripMeta: Trip = {
  id: 'huanggang-yunyang-trip',
  title: '黄冈师范学院 → 郧阳区',
  dateRange: '9月28—29日 · 两天自驾',
  departureNote: '插混车 · 中午左右出发 · 第一晚优先随州',
  preferences: ['不走高速', '少收费', '风景优先', '少人', '两天'],
  days: [
    {
      day: 1,
      title: 'DAY 1',
      dateStr: '9/28',
      subtitle: '黄冈至随州',
      segmentCount: 3,
      totalKmEstimated: 258,
      segments: initialSegments.filter(s => s.day === 1)
    },
    {
      day: 2,
      title: 'DAY 2',
      dateStr: '9/29',
      subtitle: '随州至郧阳',
      segmentCount: 3,
      totalKmEstimated: 278,
      segments: initialSegments.filter(s => s.day === 2)
    }
  ]
};
