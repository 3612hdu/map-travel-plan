import { create } from 'zustand';
import { Trip, Segment, Stop, RouteOption, OvernightStop } from '../types/trip';
import { RoutePoi, FacilityCategory } from '../types/poi';
import { VideoReference } from '../types/video';
import { RouteCalcResult } from '../types/map';
import { initialSegments, tripMeta } from '../data/tripData';
import { initialFacilities } from '../data/mockAmenities';
import { initialVideos } from '../data/videoData';
import { RoutePreference, DEFAULT_PREFERENCE } from '../types/preference';
import { amapService } from '../services/amapService';

export const defaultOvernightCandidates: OvernightStop[] = [
  {
    id: 'candidate-guangshui',
    name: '广水应山宾馆 (广水市)',
    coord: [113.825977, 31.617015],
    address: '随州市广水市应山大道68号',
    city: '随州市',
    targetCityOrArea: '广水市',
    day: 1,
    sourceSegmentId: 's3',
    rating: 4.6,
    todayDrivingKm: 182,
    todayDrivingDurationSec: 13500, // 3h45m
    todayEta: '16:45',
    tomorrowRemainingKm: 354,
    tomorrowRemainingDurationSec: 23400, // 6h30m
    decisionTag: 'today_relaxed',
    decisionLabel: '今天更轻松',
    decisionReason: '第一天开行约 3.8 小时，傍晚 16:45 前即可收车休整，避开夜路；次日还剩 354 km 需早出发。'
  },
  {
    id: 'candidate-suizhou',
    name: '随州齐星湖会馆 (随州市区)',
    coord: [113.382324, 31.690275],
    address: '随州市曾都区迎宾大道88号',
    city: '随州市',
    targetCityOrArea: '随州市',
    day: 1,
    sourceSegmentId: 's3',
    rating: 4.8,
    todayDrivingKm: 258,
    todayDrivingDurationSec: 18600, // 5h10m
    todayEta: '18:35',
    tomorrowRemainingKm: 278,
    tomorrowRemainingDurationSec: 18300, // 5h05m
    decisionTag: 'more_balanced',
    decisionLabel: '更均衡',
    decisionReason: '两日驾驶时长最均衡 (今日 5.1h · 明日 5.0h)，体感平稳不易疲劳，市区商业与餐饮补给条件更优。'
  }
];

interface TripStore {
  // 行程与段落
  trip: Trip;
  segments: Segment[];
  activeDay: number | 'all';
  activeSegmentId: string;
  selectedOptions: Record<string, string>; // segmentId -> optionId
  customWaypoints: Record<string, Stop[]>; // segmentId -> Stop[]

  // Phase D: 出发时间与时间轴
  dayStartTimes: Record<number, string>; // day -> "12:00"
  setDayStartTime: (day: number, time: string) => void;

  // Phase D: 住宿停靠与决策比较
  overnightStop: OvernightStop | null;
  overnightCandidates: OvernightStop[];
  isComparisonModalOpen: boolean;
  setIsComparisonModalOpen: (open: boolean) => void;
  setOvernightStop: (stop: OvernightStop | null) => void;
  addOvernightCandidate: (candidate: OvernightStop) => void;
  removeOvernightCandidate: (candidateId: string) => void;

  // 高德算路缓存
  routeResults: Record<string, RouteCalcResult>;
  isRouting: boolean;

  // 共享面板状态
  activeContentTab: 'videos' | 'facilities';

  // 搜索与设施过滤
  searchQuery: string;
  searchVersion: number;
  searchScope: 'trip' | 'segment';
  selectedCategory: FacilityCategory;
  facilities: RoutePoi[];
  isSearching: boolean;
  showFacilitiesOnMap: boolean;

  // 视频列表与当前播放
  videos: VideoReference[];
  activeVideo: VideoReference | null;

  // 地图交互高亮与图层
  selectedPoiId: string | null;
  hoveredPoiId: string | null;
  isTrafficEnabled: boolean;
  isSatelliteEnabled: boolean;
  preference: RoutePreference;

  // Actions
  setActiveDay: (day: number | 'all') => void;
  setActiveSegment: (id: string) => void;
  selectRouteOption: (segmentId: string, optionId: string) => void;
  addWaypoint: (segmentId: string, stop: Stop) => void;
  removeWaypoint: (segmentId: string, stopId: string) => void;
  setPreference: (pref: Partial<RoutePreference>) => void;

  setActiveContentTab: (tab: 'videos' | 'facilities') => void;
  setSearchQuery: (query: string) => void;
  setSearchScope: (scope: 'trip' | 'segment') => void;
  setSelectedCategory: (category: FacilityCategory) => void;
  setFacilities: (list: RoutePoi[]) => void;
  setShowFacilitiesOnMap: (show: boolean) => void;

  focusPoi: (id: string | null) => void;
  hoverPoi: (id: string | null) => void;
  openVideo: (video: VideoReference | null) => void;

  toggleTraffic: () => void;
  toggleSatellite: () => void;
  setRouteResult: (key: string, res: RouteCalcResult) => void;
  setIsRouting: (loading: boolean) => void;
}

export const useTripStore = create<TripStore>((set, get) => {
  // 初始化已选择的走法
  const initialOptions: Record<string, string> = {};
  initialSegments.forEach((s) => {
    initialOptions[s.id] = s.chosen;
  });

  return {
    trip: tripMeta,
    segments: initialSegments,
    activeDay: 2, // 默认进入 Day 2 聚焦经典丹江口段
    activeSegmentId: 's6', // 默认选中经典段 s6 丹江口 → 郧阳
    selectedOptions: initialOptions,
    customWaypoints: {},

    // Phase D 状态
    dayStartTimes: { 1: '12:00', 2: '09:00' },
    overnightStop: null,
    overnightCandidates: defaultOvernightCandidates,
    isComparisonModalOpen: false,

    routeResults: {},
    isRouting: false,

    activeContentTab: 'videos', // 默认视频状态（对应图1）

    searchQuery: '',
    searchVersion: 0,
    searchScope: 'segment', // 默认当前路段（对应图3）
    selectedCategory: 'all',
    facilities: initialFacilities,
    isSearching: false,
    showFacilitiesOnMap: true,

    videos: initialVideos,
    activeVideo: null,

    selectedPoiId: null,
    hoveredPoiId: null,
    isTrafficEnabled: true,
    isSatelliteEnabled: false,
    preference: DEFAULT_PREFERENCE,

    setPreference: (pref) =>
      set((state) => ({ preference: { ...state.preference, ...pref } })),

    setDayStartTime: (day, time) =>
      set((state) => ({
        dayStartTimes: {
          ...state.dayStartTimes,
          [day]: time
        }
      })),

    setIsComparisonModalOpen: (open) => set({ isComparisonModalOpen: open }),

    addOvernightCandidate: (candidate) =>
      set((state) => {
        if (state.overnightCandidates.some((c) => c.id === candidate.id || c.name === candidate.name)) {
          return state;
        }
        return {
          overnightCandidates: [...state.overnightCandidates, candidate]
        };
      }),

    removeOvernightCandidate: (candidateId) =>
      set((state) => ({
        overnightCandidates: state.overnightCandidates.filter((c) => c.id !== candidateId)
      })),

    setOvernightStop: (stop) => {
      const state = get();
      if (stop) {
        // 更新或加入候选列表
        const exists = state.overnightCandidates.some((c) => c.id === stop.id || c.name === stop.name);
        const updatedCandidates = exists
          ? state.overnightCandidates.map((c) => (c.id === stop.id || c.name === stop.name ? stop : c))
          : [...state.overnightCandidates, stop];

        const updatedSegments = state.segments.map((seg) => {
          if (seg.id === 's3') {
            return {
              ...seg,
              customEndCoord: stop.coord,
              customEndName: stop.name,
              title: `大悟 → ${stop.name}`
            };
          }
          if (seg.id === 's4') {
            return {
              ...seg,
              customStartCoord: stop.coord,
              customStartName: stop.name,
              title: `${stop.name} → 襄阳`
            };
          }
          return seg;
        });

        set({
          overnightStop: stop,
          overnightCandidates: updatedCandidates,
          segments: updatedSegments
        });

        // 重新规划 s3 与 s4
        const s3 = updatedSegments.find((s) => s.id === 's3');
        const s4 = updatedSegments.find((s) => s.id === 's4');
        if (s3) {
          const opt = s3.options.find((o) => o.id === (state.selectedOptions['s3'] || s3.chosen)) || s3.options[0];
          amapService
            .planSegment(s3, opt, state.customWaypoints['s3'] || [], state.preference)
            .then((res) => get().setRouteResult(`s3:${opt.id}`, res))
            .catch((err) => console.warn('s3 重新算路失败:', err));
        }
        if (s4) {
          const opt = s4.options.find((o) => o.id === (state.selectedOptions['s4'] || s4.chosen)) || s4.options[0];
          amapService
            .planSegment(s4, opt, state.customWaypoints['s4'] || [], state.preference)
            .then((res) => get().setRouteResult(`s4:${opt.id}`, res))
            .catch((err) => console.warn('s4 重新算路失败:', err));
        }
      } else {
        // 取消住宿，恢复原始 Day 边界
        const updatedSegments = state.segments.map((seg) => {
          if (seg.id === 's3') {
            const next = { ...seg };
            delete next.customEndCoord;
            delete next.customEndName;
            next.title = '大悟 → 随州';
            return next;
          }
          if (seg.id === 's4') {
            const next = { ...seg };
            delete next.customStartCoord;
            delete next.customStartName;
            next.title = '随州 → 襄阳';
            return next;
          }
          return seg;
        });

        set({
          overnightStop: null,
          segments: updatedSegments
        });

        const s3 = updatedSegments.find((s) => s.id === 's3');
        const s4 = updatedSegments.find((s) => s.id === 's4');
        if (s3) {
          const opt = s3.options.find((o) => o.id === (state.selectedOptions['s3'] || s3.chosen)) || s3.options[0];
          amapService
            .planSegment(s3, opt, state.customWaypoints['s3'] || [], state.preference)
            .then((res) => get().setRouteResult(`s3:${opt.id}`, res))
            .catch((err) => console.warn('s3 恢复算路失败:', err));
        }
        if (s4) {
          const opt = s4.options.find((o) => o.id === (state.selectedOptions['s4'] || s4.chosen)) || s4.options[0];
          amapService
            .planSegment(s4, opt, state.customWaypoints['s4'] || [], state.preference)
            .then((res) => get().setRouteResult(`s4:${opt.id}`, res))
            .catch((err) => console.warn('s4 恢复算路失败:', err));
        }
      }
    },

    setActiveDay: (day) => {
      set({ activeDay: day });
      // 如果切到具体 day，自动将当前激活段切到该 day 的第一段
      if (day !== 'all') {
        const seg = get().segments.find((s) => s.day === day);
        if (seg) {
          set({ activeSegmentId: seg.id });
        }
      }
    },

    setActiveSegment: (id) => {
      const seg = get().segments.find((s) => s.id === id);
      set({
        activeSegmentId: id,
        activeDay: seg ? seg.day : get().activeDay
      });
    },

    selectRouteOption: (segmentId, optionId) => {
      set((state) => ({
        selectedOptions: {
          ...state.selectedOptions,
          [segmentId]: optionId
        }
      }));
    },

    addWaypoint: (segmentId, stop) => {
      set((state) => {
        const current = state.customWaypoints[segmentId] || [];
        // 去重
        if (current.some((w) => w.id === stop.id || w.name === stop.name)) {
          return state;
        }
        return {
          customWaypoints: {
            ...state.customWaypoints,
            [segmentId]: [...current, stop]
          }
        };
      });
    },

    removeWaypoint: (segmentId, stopId) => {
      set((state) => ({
        customWaypoints: {
          ...state.customWaypoints,
          [segmentId]: (state.customWaypoints[segmentId] || []).filter((w) => w.id !== stopId)
        }
      }));
    },

    setActiveContentTab: (tab) => set({ activeContentTab: tab }),
    setSearchQuery: (query) =>
      set((state) => ({
        searchQuery: query,
        searchVersion: (state.searchVersion || 0) + 1
      })),
    setSearchScope: (scope) => set({ searchScope: scope }),
    setSelectedCategory: (category) => set({ selectedCategory: category }),
    setFacilities: (facilities) => set({ facilities }),
    setShowFacilitiesOnMap: (show) => set({ showFacilitiesOnMap: show }),

    focusPoi: (id) => set({ selectedPoiId: id }),
    hoverPoi: (id) => set({ hoveredPoiId: id }),
    openVideo: (video) => set({ activeVideo: video }),

    toggleTraffic: () => set((state) => ({ isTrafficEnabled: !state.isTrafficEnabled })),
    toggleSatellite: () => set((state) => ({ isSatelliteEnabled: !state.isSatelliteEnabled })),
    setRouteResult: (key, res) =>
      set((state) => ({
        routeResults: {
          ...state.routeResults,
          [key]: res
        }
      })),
    setIsRouting: (isRouting) => set({ isRouting })
  };
});
