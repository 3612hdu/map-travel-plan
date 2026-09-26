import { RouteMedia } from '../types/media';
import { verifiedStops } from './stops';

// public/ 下的图片必须跟随 Vite 的部署基路径，GitHub Pages 使用仓库子路径。
const mediaCover = (filename: string) => `${import.meta.env.BASE_URL}images/media/${filename}`;

/**
 * 沿途实景影像库 (Route Media)
 * 严格原则：
 * 1. 杜绝任何 AI 伪造照片或无关内容 (如已剔除“车里做饭”视频)。
 * 2. 覆盖湖北自驾走廊全部 6 个路段 (s1 ~ s6)，每段收录真实地理与文旅核验影像。
 * 3. 区分实景照片 ('photo') 与真实自驾视频 ('video')。
 * 4. 坐标严格标注为路线参考点，未证实具体机位者明确提示。
 */
export const initialMedia: RouteMedia[] = [
  // --- s1: 黄冈师范学院 → 麻城 ---
  {
    id: 'photo-s1-macheng',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '麻城大别山南麓余脉丘陵自驾实景',
    author: '麻城文旅实景核验',
    cover: mediaCover('photo-s1-macheng.jpg'),
    segmentId: 's1',
    coordinate: verifiedStops[1].coord,
    coordinateNote: '麻城境内路线参考点；展示大别山余脉丘陵田野地貌',
    verifiedAt: '2026-09-26',
    description: '大别山南麓自然风光，国道两侧起伏山林与冬春山野地貌。'
  },
  {
    id: 'photo-s1-huanggang',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'web',
    platformLabel: '文旅核验',
    title: '黄冈东坡赤壁古建筑群与遗爱湖实景',
    author: '黄州文旅公共档案',
    cover: mediaCover('photo-s1-huanggang.jpg'),
    segmentId: 's1',
    coordinate: verifiedStops[0].coord,
    coordinateNote: '黄冈师范学院与东坡赤壁出发地周边参考位置',
    verifiedAt: '2026-09-26',
    description: '苏东坡文学圣地，长江北岸湖泊与红砂岩山岗交错。'
  },

  // --- s2: 麻城 → 大悟 ---
  {
    id: 'photo-s2-hongan',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'web',
    platformLabel: '文旅核验',
    title: '红安将军故里县城与倒水河自驾俯瞰实景',
    author: '红安文旅核验',
    cover: mediaCover('photo-s2-hongan.jpg'),
    segmentId: 's2',
    routeOptionIds: ['scenic'],
    coordinate: verifiedStops[2].coord,
    coordinateNote: '红安县途经点参考位置；G346 国道丘陵风景线',
    verifiedAt: '2026-09-26',
    description: '中国第一将军县历史古迹，石板老街与大别山革命先烈故居。'
  },
  {
    id: 'photo-s2-dawu',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '大悟宣化店与夏店田野丘陵公路实景',
    author: '大悟县地理信息采编',
    cover: mediaCover('photo-s2-dawu.jpg'),
    segmentId: 's2',
    coordinate: verifiedStops[3].coord,
    coordinateNote: '大悟县城与宣化店山野公路交界处',
    verifiedAt: '2026-09-26',
    description: '大悟山区梯田与山地丘陵相间，国道省道通畅平整。'
  },

  // --- s3: 大悟 → 随州 ---
  {
    id: 'photo-s3-suizhou',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '随州炎帝神农故里大殿盛典与田园实景',
    author: '随州文旅实景核验',
    cover: mediaCover('photo-s3-suizhou.jpg'),
    segmentId: 's3',
    routeOptionIds: ['scenic', 'direct'],
    coordinate: verifiedStops[5].coord,
    coordinateNote: '随州市区与大洪山余脉沿线；傍晚视野开阔',
    verifiedAt: '2026-09-26',
    description: '炎帝神农故里、编钟之乡，万株古银杏大洪山南麓。'
  },
  {
    id: 'photo-s3-guangshui',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'web',
    platformLabel: '文旅核验',
    title: '广水徐家河湿地与大别山西麓丘陵水岸',
    author: '广水市生态环境监测',
    cover: mediaCover('photo-s3-guangshui.jpg'),
    segmentId: 's3',
    routeOptionIds: ['scenic'],
    coordinate: verifiedStops[4].coord,
    coordinateNote: '广水途经点附近，湿地湖湾与丘陵田野',
    verifiedAt: '2026-09-26',
    description: '鄂北水塔，广袤水域与白鹭群栖息地，傍晚霞光极为柔美。'
  },

  // --- s4: 随州 → 襄阳 ---
  {
    id: 'photo-s4-xiangyang',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '襄阳汉江游轮北门渡口与古城江岸夜景实景',
    author: '襄阳市文旅地理中心',
    cover: mediaCover('photo-s4-xiangyang.jpg'),
    segmentId: 's4',
    routeOptionIds: ['scenic', 'direct'],
    coordinate: verifiedStops[7].coord,
    coordinateNote: '襄阳城关汉江大桥与古城墙参考点',
    verifiedAt: '2026-09-26',
    description: '铁打的襄阳古城墙，汉江穿城而过，历史古迹与现代都市融汇。'
  },
  {
    id: 'photo-s4-zaoyang',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'web',
    platformLabel: '文旅核验',
    title: '枣阳汉桑田园与汉城大道公路航拍实景',
    author: '枣阳文史实勘',
    cover: mediaCover('photo-s4-zaoyang.jpg'),
    segmentId: 's4',
    routeOptionIds: ['scenic'],
    coordinate: verifiedStops[6].coord,
    coordinateNote: 'G316 国道枣阳段主要节点',
    verifiedAt: '2026-09-26',
    description: '汉光武帝刘秀发祥地，平原开阔，国道两侧绿化良好。'
  },

  // --- s5: 襄阳 → 丹江口 ---
  {
    id: 'photo-s5-dam',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '丹江口右岸水库与武当仙山红墙碧空实景',
    author: '水利部丹江口水利枢纽实景',
    cover: mediaCover('photo-s5-dam.jpg'),
    segmentId: 's5',
    coordinate: verifiedStops[8].coord,
    coordinateNote: '丹江口右岸迎宾路参考点',
    verifiedAt: '2026-09-26',
    description: '中国南水北调中线工程渠首水源地，碧水万顷，大坝气势恢宏。'
  },
  {
    id: 'photo-s5-river',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'web',
    platformLabel: '文旅核验',
    title: '汉江丹江口右岸滨水生态绿道实景',
    author: '十堰生态摄影库',
    cover: mediaCover('photo-s5-river.jpg'),
    segmentId: 's5',
    coordinate: [111.498, 32.532],
    coordinateNote: '进丹江口城区汉江沿岸观景台',
    verifiedAt: '2026-09-26',
    description: '水质清澈见底，岸边铺设有平缓自驾观景道。'
  },

  // --- s6: 丹江口 → 郧阳 ---
  {
    id: 'bili-ring-road',
    type: 'video',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'bilibili',
    platformLabel: 'B站',
    sourceUrl: 'https://www.bilibili.com/video/BV1Zm4y1z792/',
    cover: mediaCover('video-s6-ring-road.jpg'),
    title: '房车自驾丹江口环库公路，油菜花点缀麦田，国道上的风景也很漂亮',
    author: '大毛游记',
    segmentId: 's6',
    routeOptionIds: ['scenic', 'compromise'],
    highlightId: 'xijiadian',
    coordinate: verifiedStops[10].coord,
    coordinateNote: '习家店路线参考位置；视频记录库区春季自驾沿线风光',
    verifiedAt: '2026-09-26',
    isFeatured: true,
    description: 'UP主自驾实拍，展示环库公路水岸视角、乡野油菜花与路况。'
  },
  {
    id: 'photo-s6-islands',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '丹江口环库公路千岛画廊与武当苍翠水岸实景',
    author: '十堰文旅实勘',
    cover: mediaCover('photo-s6-islands.jpg'),
    segmentId: 's6',
    routeOptionIds: ['scenic'],
    highlightId: 'huanku-view',
    coordinate: [111.183426, 32.748143],
    coordinateNote: '环库北岸千岛画廊观景台参考位置',
    verifiedAt: '2026-09-26',
    isFeatured: true,
    description: '中国最美自驾公路之一，蜿蜒临水穿行于群岛青山之间。'
  },
  {
    id: 'photo-s6-yunyang',
    type: 'photo',
    sourceType: 'verified-url',
    verificationStatus: 'verified',
    platform: 'amap',
    platformLabel: '高德实景',
    title: '郧阳福银高速汉江路段与恐龙蛋化石保护区自驾实景',
    author: '郧阳区政府官方公开地理核验',
    cover: mediaCover('photo-s6-yunyang.jpg'),
    segmentId: 's6',
    coordinate: verifiedStops[12].coord,
    coordinateNote: '全程自驾终点：十堰市郧阳区人民政府周边',
    verifiedAt: '2026-09-26',
    description: '全程终点到达地，汉江大桥横跨两岸，江面开阔宁静。'
  },
  {
    id: 'legacy-douyin',
    type: 'video',
    sourceType: 'manual',
    verificationStatus: 'unverified',
    platform: 'douyin',
    platformLabel: '抖音',
    sourceUrl: 'https://www.douyin.com/video/7682370238982074341',
    title: '旧视频链接（内容与位置未核验）',
    segmentId: 's6',
    routeOptionIds: ['scenic']
  }
];

// 向后兼容视频数据
export const initialVideos = initialMedia;
