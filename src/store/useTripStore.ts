import { create } from 'zustand';
import { Trip, Segment, Stop, RouteOption, OvernightStop } from '../types/trip';
import { RoutePoi, FacilityCategory } from '../types/poi';
import { VideoReference } from '../types/video';
import { RouteCalcResult } from '../types/map';
import { MapMode } from '../types/map';
import { initialSegments, tripMeta } from '../data/tripData';
import { initialVideos } from '../data/videoData';
import { RoutePreference, DEFAULT_PREFERENCE } from '../types/preference';
import { amapService } from '../services/amapService';
import { reconstructTripWithOvernight, buildDayPlans } from '../utils/tripReconstruction';
import { readSavedRecommendations, SAVED_RECOMMENDATIONS_KEY } from '../utils/recommendations';

export const defaultOvernightCandidates: OvernightStop[] = [];

interface TripStore {
  savedRecommendationIds: string[];
  favoritesPersisted: boolean;
  toggleSavedRecommendation: (id: string) => void;
  // 行程与段落
  trip: Trip;
  segments: Segment[];
  activeDay: number | 'all';
  activeSegmentId: string;
  mapMode: MapMode;
  viewportRevision: number;
  activeHighlightId: string | null;
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
  isNavigationPlanModalOpen: boolean;
  setIsNavigationPlanModalOpen: (open: boolean) => void;
  setOvernightStop: (stop: OvernightStop | null) => void;
  addOvernightCandidate: (candidate: OvernightStop) => void;
  removeOvernightCandidate: (candidateId: string) => void;

  // 高德算路缓存
  routeResults: Record<string, RouteCalcResult>;
  isRouting: boolean;

  // 共享面板状态
  activeContentTab: 'videos' | 'facilities';
  mobileActiveTab: 'map' | 'trip' | 'media' | 'facilities';
  setMobileActiveTab: (tab: 'map' | 'trip' | 'media' | 'facilities') => void;

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
  enterSegmentDetail: (id?: string) => void;
  exitSegmentDetail: () => void;
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
  focusHighlight: (id: string | null) => void;

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
    savedRecommendationIds: readSavedRecommendations(),
    favoritesPersisted: true,
    toggleSavedRecommendation: (id) => set((state) => {
      const savedRecommendationIds = state.savedRecommendationIds.includes(id)
        ? state.savedRecommendationIds.filter((saved) => saved !== id)
        : [...state.savedRecommendationIds, id];
      let favoritesPersisted = true;
      try {
        localStorage.setItem(SAVED_RECOMMENDATIONS_KEY, JSON.stringify(savedRecommendationIds));
      } catch {
        favoritesPersisted = false;
      }
      return { savedRecommendationIds, favoritesPersisted };
    }),
    trip: tripMeta,
    segments: initialSegments,
    activeDay: 'all', // 默认展示全程路线
    activeSegmentId: 's6', // 默认选中经典段 s6 丹江口 → 郧阳
    mapMode: 'trip-overview',
    viewportRevision: 0,
    activeHighlightId: null,
    selectedOptions: initialOptions,
    customWaypoints: {},

    // Phase D 状态
    dayStartTimes: { 1: '12:00', 2: '09:00' },
    overnightStop: null,
    overnightCandidates: defaultOvernightCandidates,
    isComparisonModalOpen: false,
    isNavigationPlanModalOpen: false,

    routeResults: {},
    isRouting: false,

    activeContentTab: 'videos', // 默认视频状态（对应图1）
    mobileActiveTab: 'map', // 移动端默认地图/方案视口

    searchQuery: '',
    searchVersion: 0,
    searchScope: 'segment', // 默认当前路段（对应图3）
    selectedCategory: 'all',
    facilities: [],
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
      set((state) => {
        const nextTimes = {
          ...state.dayStartTimes,
          [day]: time
        };
        const updatedDays = (state.trip.days || []).map((dp) =>
          dp.day === day ? { ...dp, startTime: time } : dp
        );
        return {
          dayStartTimes: nextTimes,
          trip: {
            ...state.trip,
            days: updatedDays
          }
        };
      }),

    setIsComparisonModalOpen: (open) => set({ isComparisonModalOpen: open }),
    setIsNavigationPlanModalOpen: (open) => set({ isNavigationPlanModalOpen: open }),

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
      stop = stop ? {
        ...stop,
        rating: stop.source === 'amap-search' ? stop.rating : undefined,
        todayDrivingKm: undefined, todayDrivingDurationSec: undefined, todayEta: undefined,
        tomorrowRemainingKm: undefined, tomorrowRemainingDurationSec: undefined,
        decisionTag: undefined, decisionLabel: undefined, decisionReason: undefined
      } : null;
      const state = get();
      const currentGen = amapService.nextOvernightGeneration();

      // 1. 更新或加入候选列表
      let updatedCandidates = state.overnightCandidates;
      if (stop) {
        const exists = state.overnightCandidates.some((c) => c.id === stop.id || c.name === stop.name);
        updatedCandidates = exists
          ? state.overnightCandidates.map((c) => (c.id === stop.id || c.name === stop.name ? stop : c))
          : [...state.overnightCandidates, stop];
      }

      // 2. 动态重构路段与多日日程 (彻底去除对固定 s3/s4 ID 的依赖)
      const { segments: reconstructedSegments, dayPlans } = reconstructTripWithOvernight(
        initialSegments,
        stop,
        {
          dayStartTimes: state.dayStartTimes,
          selectedOptions: state.selectedOptions,
          customWaypoints: state.customWaypoints
        }
      );

      // 3. 同步更新 Trip 核心数据模型中的 DayPlan[] 数组模型
      const updatedTrip: Trip = {
        ...state.trip,
        days: dayPlans
      };

      set({
        overnightStop: stop,
        overnightCandidates: updatedCandidates,
        segments: reconstructedSegments,
        trip: updatedTrip,
        routeResults: Object.fromEntries(Object.entries(state.routeResults).filter(([key]) => {
          const segmentId = key.split(':')[0];
          const changed = reconstructedSegments.find((seg) => seg.id === segmentId);
          return changed && !changed.customStartCoord && !changed.customEndCoord
            && (stop !== null || !['s2', 's3', 's4', 's5'].includes(segmentId));
        }))
      });

      // 4. 识别需要重新请求高德实路规划的路段 (端点坐标发生变更或新拆分的路段)
      const segmentsToPlan = stop
        ? reconstructedSegments.filter((seg) => !!seg.customStartCoord || !!seg.customEndCoord)
        : reconstructedSegments.filter((seg) => seg.id === 's3' || seg.id === 's4' || seg.id === 's2' || seg.id === 's5');

      // 5. 并发受控与代际拦截：平滑顺序发起算路，杜绝并发轰炸与旧结果覆盖最新选择
      segmentsToPlan.forEach((seg, idx) => {
        const optId = state.selectedOptions[seg.id] || seg.chosen;
        const opt = seg.options.find((o) => o.id === optId) || seg.options[0];
        const wp = state.customWaypoints[seg.id] || [];

        setTimeout(() => {
          // 代际校验：如果用户快速连续切换，丢弃旧代际任务
          if (!amapService.isCurrentOvernightGeneration(currentGen)) {
            return;
          }

          amapService
            .planSegment(seg, opt, wp, state.preference)
            .then((res) => {
              if (amapService.isCurrentOvernightGeneration(currentGen)) {
                get().setRouteResult(`${seg.id}:${opt.id}`, res);
              }
            })
            .catch((err) => {
              console.warn(`路段 ${seg.id} 动态算路失败:`, err);
            });
        }, idx * 60);
      });
    },

    setActiveDay: (day) => set((state) => {
      const firstSeg = day === 'all' ? null : state.segments.find((s) => s.day === day);
      return {
        activeDay: day,
        activeSegmentId: firstSeg?.id || state.activeSegmentId,
        mapMode: day === 'all' ? 'trip-overview' : 'day-overview',
        viewportRevision: state.viewportRevision + 1,
        activeHighlightId: null
      };
    }),

    setActiveSegment: (id) => set((state) => {
      const seg = state.segments.find((s) => s.id === id);
      return {
        activeSegmentId: id,
        activeDay: seg ? seg.day : state.activeDay,
        mapMode: state.mapMode === 'segment-focus' ? 'segment-focus' : 'segment-selected',
        viewportRevision: state.viewportRevision + 1,
        activeHighlightId: null
      };
    }),

    enterSegmentDetail: (id) => set((state) => {
      const seg = state.segments.find((s) => s.id === (id || state.activeSegmentId));
      if (!seg) return state;
      return {
        activeSegmentId: seg.id,
        activeDay: seg.day,
        mapMode: 'segment-focus',
        searchScope: 'segment',
        viewportRevision: state.viewportRevision + 1,
        activeHighlightId: null
      };
    }),

    exitSegmentDetail: () => set((state) => ({
      activeDay: 'all',
      mapMode: 'trip-overview',
      viewportRevision: state.viewportRevision + 1,
        activeHighlightId: null
    })),

    selectRouteOption: (segmentId, optionId) => {
      set((state) => ({
        selectedOptions: {
          ...state.selectedOptions,
          [segmentId]: optionId
        },
        viewportRevision: state.viewportRevision + 1,
        activeHighlightId: null
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
          },
          routeResults: Object.fromEntries(
            Object.entries(state.routeResults).filter(([key]) => !key.startsWith(`${segmentId}:`))
          )
        };
      });
    },

    removeWaypoint: (segmentId, stopId) => {
      set((state) => {
        const current = state.customWaypoints[segmentId] || [];
        if (!current.some((stop) => stop.id === stopId)) return state;
        return {
          customWaypoints: {
            ...state.customWaypoints,
            [segmentId]: current.filter((stop) => stop.id !== stopId)
          },
          routeResults: Object.fromEntries(
            Object.entries(state.routeResults).filter(([key]) => !key.startsWith(`${segmentId}:`))
          )
        };
      });
    },

    setActiveContentTab: (tab) => set((state) => ({
      activeContentTab: tab,
      mobileActiveTab: state.mobileActiveTab === 'media' || state.mobileActiveTab === 'facilities'
        ? tab === 'videos' ? 'media' : 'facilities'
        : state.mobileActiveTab
    })),
    setMobileActiveTab: (tab) => {
      set({ mobileActiveTab: tab });
      if (tab === 'media') {
        set({ activeContentTab: 'videos' });
      } else if (tab === 'facilities') {
        set({ activeContentTab: 'facilities' });
      }
    },
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
    focusHighlight: (id) => set({ activeHighlightId: id }),

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
