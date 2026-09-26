import React, { useEffect, useRef } from 'react';
import { MapPin, Maximize2, Navigation, ArrowLeft } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';
import { TrafficLegend } from '../map/TrafficLegend';
import { RouteOptionCards } from '../route/RouteOptionCards';
import { RouteHighlights } from '../route/RouteHighlights';
import { verifiedStops } from '../../data/stops';
import { startAmapNavigation } from '../../services/navigationService';
import { compileTripNodes } from '../../utils/tripNodes';

export const CenterMapArea: React.FC = () => {
  const mapMountedRef = useRef(false);
  const {
    segments,
    activeSegmentId,
    activeDay,
    mapMode,
    viewportRevision,
    activeHighlightId,
    setActiveDay,
    enterSegmentDetail,
    exitSegmentDetail,
    selectedOptions,
    routeResults,
    customWaypoints,
    setRouteResult,
    facilities,
    selectedCategory,
    selectedPoiId,
    focusPoi,
    setActiveContentTab,
    addWaypoint,
    preference,
    showFacilitiesOnMap,
    overnightStop,
    dayStartTimes,
    setSearchQuery,
    setIsNavigationPlanModalOpen
  } = useTripStore();

  const currentSeg = segments.find((s) => s.id === activeSegmentId);
  const appliedViewportRevision = useRef(-1);
  const appliedHighlightId = useRef<string | null>(null);

  // 初始化高德地图
  useEffect(() => {
    if (mapMountedRef.current) return;
    mapMountedRef.current = true;

    amapService.initMap('amap-root').then(async () => {
      // 1. 优先算路当前激活路段（默认 s6 丹江口），确保用户第一屏立刻呈现
      const activeSeg = segments.find((s) => s.id === activeSegmentId) || segments[0];
      const activeChosenOpt = activeSeg.options.find((o) => o.id === activeSeg.chosen) || activeSeg.options[0];
      try {
        const res = await amapService.planSegment(
          activeSeg,
          activeChosenOpt,
          customWaypoints[activeSeg.id] || [],
          preference
        );
        setRouteResult(`${activeSeg.id}:${activeChosenOpt.id}`, res);
      } catch (err) {
        console.warn(`初始路段 ${activeSeg.id} 算路重试中:`, err);
      }

      // 预先规划当前激活路段的备选方案（用于 3 卡对比）
      if (activeSeg.options.length > 1) {
        for (const opt of activeSeg.options) {
          if (opt.id !== activeChosenOpt.id) {
            await new Promise((r) => setTimeout(r, 150));
            try {
              const res = await amapService.planSegment(
                activeSeg,
                opt,
                customWaypoints[activeSeg.id] || [],
                preference
              );
              setRouteResult(`${activeSeg.id}:${opt.id}`, res);
            } catch {}
          }
        }
      }

      // 2. 依次平滑规划其他路段（间隔 150ms 规避高德 QPS 限制）
      for (const seg of segments) {
        if (seg.id === activeSeg.id) continue;
        await new Promise((r) => setTimeout(r, 150));
        const chosenOpt = seg.options.find((o) => o.id === seg.chosen) || seg.options[0];
        try {
          const res = await amapService.planSegment(
            seg,
            chosenOpt,
            customWaypoints[seg.id] || [],
            preference
          );
          setRouteResult(`${seg.id}:${chosenOpt.id}`, res);
        } catch (err) {
          console.warn(`路段 ${seg.id} 算路失败:`, err);
        }
      }
    });
  }, []);

  // 只有视角意图（viewportRevision）变化时才自动 fit。结果/Marker 后续更新只重绘，
  // 不夺走用户在 Detail 模式里通过 POI、视频等主动选择的地图位置。
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    amapService.renderRoutes(
      segments,
      selectedOptions,
      routeResults,
      activeSegmentId,
      activeDay,
      mapMode,
      overnightStop,
      activeHighlightId
    );

    if (activeHighlightId !== appliedHighlightId.current) {
      appliedHighlightId.current = activeHighlightId;
      if (activeHighlightId && amapService.fitToHighlight()) {
        appliedViewportRevision.current = viewportRevision;
        return;
      }
    }

    if (appliedViewportRevision.current === viewportRevision) return;
    const targetSegments = mapMode === 'trip-overview'
      ? segments
      : mapMode === 'day-overview'
      ? segments.filter((seg) => seg.day === activeDay)
      : segments.filter((seg) => seg.id === activeSegmentId);
    const ready = targetSegments.length > 0 && targetSegments.every((seg) => {
      const selected = selectedOptions[seg.id] || seg.chosen;
      return (routeResults[`${seg.id}:${selected}`]?.path?.length || 0) >= 2;
    });
    if (!ready) return;

    const fitted = mapMode === 'trip-overview'
      ? amapService.fitToAll()
      : mapMode === 'day-overview' && typeof activeDay === 'number'
      ? amapService.fitToDay(activeDay, segments)
      : amapService.fitToSegment(activeSegmentId);
    if (fitted) appliedViewportRevision.current = viewportRevision;
  }, [segments, selectedOptions, routeResults, activeSegmentId, activeDay, mapMode, viewportRevision, overnightStop, activeHighlightId]);

  // 当设施 POIs 变化、选中分类或选中状态变化时，渲染地图 POI Marker
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    if (!showFacilitiesOnMap) {
      amapService.clearPoiMarkers();
      return;
    }

    const visiblePois = selectedCategory === 'all'
      ? facilities
      : facilities.filter((p) => p.category === selectedCategory);

    amapService.renderPoiMarkers(
      visiblePois,
      selectedPoiId,
      (poi) => {
        // FIX 8 Marker → List 双向联动:
        // 1. 获取稳定 POI ID (poi.id)
        // 2. 自动切换右侧到：沿途设施
        setActiveContentTab('facilities');
        // 3. 必要时切换对应分类，保证列表可见
        const state = useTripStore.getState();
        if (state.selectedCategory !== 'all' && state.selectedCategory !== poi.category) {
          state.setSelectedCategory('all');
        }
        // 4. 聚焦该 POI (触发 Card scrollIntoView 与卡片高亮)
        focusPoi(poi.id);
      },
      (poi) => {
        const state = useTripStore.getState();
        const targetSeg = state.segments.find((seg) => seg.id === poi.sourceSegmentId)
          || state.segments.find((seg) => seg.id === state.activeSegmentId);
        if (targetSeg) {
          if ((state.customWaypoints[targetSeg.id] || []).some((stop) => stop.id === poi.id || stop.name === poi.name)) return;
          const detectedCity = poi.address.match(/(.+?[市区县])/)?.[1] || verifiedStops[targetSeg.end]?.city || '湖北';
          const newStop = {
            id: poi.id,
            name: poi.name,
            coord: poi.coord,
            poi: poi.poiId || '',
            city: detectedCity,
            address: poi.address
          };
          const nextWaypoints = [...(state.customWaypoints[targetSeg.id] || []), newStop];
          addWaypoint(targetSeg.id, newStop);
          const opt =
            targetSeg.options.find((o) => o.id === (state.selectedOptions[targetSeg.id] || targetSeg.chosen))
            || targetSeg.options[0];
          amapService
            .planSegment(targetSeg, opt, nextWaypoints, state.preference)
            .then((res) => {
              const latest = useTripStore.getState();
              const ids = (latest.customWaypoints[targetSeg.id] || []).map((stop) => stop.id);
              if (ids.join('|') === nextWaypoints.map((stop) => stop.id).join('|')
                && (latest.selectedOptions[targetSeg.id] || targetSeg.chosen) === opt.id
                && latest.preference === state.preference) {
                latest.setRouteResult(`${targetSeg.id}:${opt.id}`, res);
              }
            })
            .catch((error) => console.warn('地图停靠点重算失败:', error));
        }
      }
    );
  }, [facilities, selectedCategory, selectedPoiId, currentSeg, customWaypoints, preference, showFacilitiesOnMap]);

  // 渲染 7 个核心城镇与起终点可交互地点卡 Marker
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    const tripNodes = compileTripNodes(
      segments,
      selectedOptions,
      routeResults,
      customWaypoints,
      dayStartTimes,
      overnightStop
    );

    amapService.renderTripNodeMarkers(
      tripNodes,
      (targetSegmentId) => {
        enterSegmentDetail(targetSegmentId);
      },
      (stopName) => {
        setSearchQuery(stopName);
        setActiveContentTab('facilities');
      }
    );
  }, [segments, selectedOptions, routeResults, customWaypoints, dayStartTimes, overnightStop]);

  const handleFitAll = () => {
    setActiveDay('all');
  };

  const handleStartNav = () => {
    if (!currentSeg) return;
    const targetStop = verifiedStops[currentSeg.end];
    const waypoints = customWaypoints[currentSeg.id] || [];
    startAmapNavigation(targetStop, waypoints, preference);
  };

  return (
    <main className={`center-map-area ${mapMode === 'segment-focus' ? 'detail-mode' : ''}`} aria-label="高德实路交互地图">
      {/* 地图渲染容器 */}
      <div className="map-canvas-container">
        <div id="amap-root"></div>

        {/* 地图左上角控制药丸 (对齐图 01, 02) */}
        <div className="map-floating-top-left">
          <div className="map-control-pill map-pill-engine">
            <Navigation size={13} color="#1875ff" />
            <span>高德实路引擎</span>
          </div>

          {currentSeg && (
            <div className="map-control-pill">
              <span>第{currentSeg.day}天: {currentSeg.title}</span>
            </div>
          )}

          <button
            type="button"
            className="map-control-pill"
            onClick={mapMode === 'segment-focus' ? exitSegmentDetail : handleFitAll}
            title="查看完整湖北两日自驾走廊"
          >
            {mapMode === 'segment-focus' ? <ArrowLeft size={13} /> : <Maximize2 size={13} />}
            <span>{mapMode === 'segment-focus' ? '返回全程' : '全景总览'}</span>
          </button>
        </div>

        {mapMode === 'segment-focus' && currentSeg && (
          <div className="map-detail-status">
            <strong>路段详细查看 · {currentSeg.title}</strong>
            <span>蓝色实线：当前路线 · 灰色虚线：普通 · 绿色虚线：环库 · 琥珀虚线：折中</span>
          </div>
        )}

        {/* 地图右上角实时路况与图层控制 */}
        <TrafficLegend />
      </div>

      {/* 地图下方：所选路段详情、3卡方案对比、路线亮点 */}
      <div className="center-bottom-panel">
        {currentSeg && (
          <>
            <div className="segment-active-header">
              <div>
                <div className="segment-name-highlight">
                  <MapPin size={17} color="#1875ff" />
                  <span>{currentSeg.title}</span>
                  {currentSeg.id === 's6' && currentSeg.options.find((opt) => opt.id === (selectedOptions[currentSeg.id] || currentSeg.chosen))?.isRecommended && (
                    <span className="badge-tag-scenic">推荐风景路线</span>
                  )}
                </div>
                <div className="segment-sub-desc">
                  第{currentSeg.day}天 · {currentSeg.note}
                </div>
              </div>

              <div className="segment-header-actions">
                <button
                  type="button"
                  className="segment-detail-action"
                  onClick={mapMode === 'segment-focus' ? exitSegmentDetail : () => enterSegmentDetail(currentSeg.id)}
                >
                  {mapMode === 'segment-focus' ? '← 返回全程' : '详细查看'}
                </button>
                <button
                  type="button"
                  id="btn-start-nav-plan"
                  className="btn-opt-select primary-active"
                  style={{ maxWidth: '140px', padding: '7px 14px', borderRadius: '10px', background: '#059669', color: '#ffffff' }}
                  onClick={() => setIsNavigationPlanModalOpen(true)}
                  title="查看并启动全程自驾接力导航计划"
                >
                  <Navigation size={14} />
                  <span>开始导航计划</span>
                </button>
              </div>
            </div>

            {/* 路线方案 3 卡 */}
            <RouteOptionCards />

            {/* 路线亮点横向图文 */}
            <RouteHighlights />
          </>
        )}
      </div>
    </main>
  );
};
