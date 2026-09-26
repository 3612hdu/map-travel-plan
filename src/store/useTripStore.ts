import { create } from 'zustand';
import { Trip, Segment, Stop, RouteOption } from '../types/trip';
import { RoutePoi, FacilityCategory } from '../types/poi';
import { VideoReference } from '../types/video';
import { RouteCalcResult } from '../types/map';
import { initialSegments, tripMeta } from '../data/tripData';
import { initialFacilities } from '../data/mockAmenities';
import { initialVideos } from '../data/videoData';
import { RoutePreference, DEFAULT_PREFERENCE } from '../types/preference';

interface TripStore {
  // 行程与段落
  trip: Trip;
  segments: Segment[];
  activeDay: number | 'all';
  activeSegmentId: string;
  selectedOptions: Record<string, string>; // segmentId -> optionId
  customWaypoints: Record<string, Stop[]>; // segmentId -> Stop[]

  // 高德算路缓存
  routeResults: Record<string, RouteCalcResult>;
  isRouting: boolean;

  // 共享面板状态
  activeContentTab: 'videos' | 'facilities';

  // 搜索与设施过滤
  searchQuery: string;
  searchScope: 'trip' | 'segment';
  selectedCategory: FacilityCategory;
  facilities: RoutePoi[];
  isSearching: boolean;

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

    routeResults: {},
    isRouting: false,

    activeContentTab: 'videos', // 默认视频状态（对应图1）

    searchQuery: '',
    searchScope: 'segment', // 默认当前路段（对应图3）
    selectedCategory: 'all',
    facilities: initialFacilities,
    isSearching: false,

    videos: initialVideos,
    activeVideo: null,

    selectedPoiId: null,
    hoveredPoiId: null,
    isTrafficEnabled: true,
    isSatelliteEnabled: false,
    preference: DEFAULT_PREFERENCE,

    setPreference: (pref) =>
      set((state) => ({ preference: { ...state.preference, ...pref } })),

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
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchScope: (scope) => set({ searchScope: scope }),
    setSelectedCategory: (category) => set({ selectedCategory: category }),
    setFacilities: (facilities) => set({ facilities }),

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
