import { FacilityCategory } from '../types/poi';

// 高德官方 POI 分类码 (type) 与分类配置
export interface CategoryConfig {
  key: FacilityCategory;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  keywords: string;
  amapType: string; // 高德官方分类编码
}

export const FACILITY_CATEGORIES: Record<FacilityCategory, CategoryConfig> = {
  all: {
    key: 'all',
    label: '全部',
    emoji: '📍',
    color: '#0f172a',
    bgColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    keywords: '酒店|民宿|餐饮|加油站|充电站|厕所|停车场',
    amapType: '100000|050000|010100|011100|200300|150900'
  },
  hotel: {
    key: 'hotel',
    label: '酒店',
    emoji: '🏨',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
    keywords: '酒店|宾馆|度假村',
    amapType: '100000|100100|100200'
  },
  homestay: {
    key: 'homestay',
    label: '民宿',
    emoji: '🏡',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
    keywords: '民宿|客栈|旅馆|农家乐住宿',
    amapType: '100105|100200|100201'
  },
  food: {
    key: 'food',
    label: '餐饮',
    emoji: '🍴',
    color: '#e11d48',
    bgColor: '#fff1f2',
    borderColor: '#fca5a5',
    keywords: '餐厅|农家乐|饭店|特色小吃',
    amapType: '050000|050100|050200|050300|050400'
  },
  gas: {
    key: 'gas',
    label: '加油站',
    emoji: '⛽',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    keywords: '加油站|中国石化|中国石油|壳牌',
    amapType: '010100|010101|010102'
  },
  ev: {
    key: 'ev',
    label: '充电站',
    emoji: '⚡',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    keywords: '充电站|特来电|国家电网充电桩|星星充电|新能源充电',
    amapType: '011100|011101'
  },
  toilet: {
    key: 'toilet',
    label: '厕所',
    emoji: '🚾',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#7dd3fc',
    keywords: '公共厕所|洗手间|公厕',
    amapType: '200300|200301|200302'
  },
  parking: {
    key: 'parking',
    label: '停车场',
    emoji: '🅿️',
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    keywords: '停车场|停车区|停车点',
    amapType: '150900|150904|150905|150906'
  }
};

// 快捷搜索热词推荐
export const QUICK_SEARCH_CHIPS = [
  { label: '湖景民宿', query: '湖景民宿' },
  { label: '特来电充电', query: '特来电' },
  { label: '中石化加油', query: '中国石化' },
  { label: '临水农家乐', query: '农家乐' },
  { label: '观景台', query: '观景台' }
];
