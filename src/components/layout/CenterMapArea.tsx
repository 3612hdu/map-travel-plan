import React, { useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Maximize2, Star, Navigation } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';
import { TrafficLegend } from '../map/TrafficLegend';
import { RouteOptionCards } from '../route/RouteOptionCards';
import { RouteHighlights } from '../route/RouteHighlights';
import { verifiedStops } from '../../data/stops';
import { startAmapNavigation } from '../../services/navigationService';

export const CenterMapArea: React.FC = () => {
  const mapMountedRef = useRef(false);
  const {
    segments,
    activeSegmentId,
    activeDay,
    selectedOptions,
    routeResults,
    customWaypoints,
    setRouteResult,
    facilities,
    selectedPoiId,
    focusPoi,
    addWaypoint,
    preference,
    showFacilitiesOnMap,
    overnightStop
  } = useTripStore();

  const currentSeg = segments.find((s) => s.id === activeSegmentId);

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

  // 当 routeResults、selectedOptions、activeSegmentId、activeDay 或 overnightStop 变化时重绘路线
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    amapService.renderRoutes(
      segments,
      selectedOptions,
      routeResults,
      activeSegmentId,
      activeDay,
      overnightStop
    );

    // 聚焦策略
    if (activeDay === 1 || activeDay === 2) {
      amapService.fitToDay(activeDay, segments);
    } else {
      amapService.fitToSegment(activeSegmentId);
    }
  }, [segments, selectedOptions, routeResults, activeSegmentId, activeDay, overnightStop]);

  // 当设施 POIs 变化或选中状态变化时，渲染地图 POI Marker
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    if (!showFacilitiesOnMap) {
      amapService.clearPoiMarkers();
      return;
    }

    amapService.renderPoiMarkers(
      facilities,
      selectedPoiId,
      (poi) => {
        focusPoi(poi.id);
      },
      (poi) => {
        if (currentSeg) {
          const detectedCity = poi.address.match(/(.+?[市区县])/)?.[1] || verifiedStops[currentSeg.end]?.city || '湖北';
          const newStop = {
            id: poi.id,
            name: poi.name,
            coord: poi.coord,
            poi: poi.poiId || '',
            city: detectedCity,
            address: poi.address
          };
          addWaypoint(currentSeg.id, newStop);
          // 重新发起高德算路
          const opt =
            currentSeg.options.find(
              (o) => o.id === (selectedOptions[currentSeg.id] || currentSeg.chosen)
            ) || currentSeg.options[0];
          amapService
            .planSegment(
              currentSeg,
              opt,
              [...(customWaypoints[currentSeg.id] || []), newStop],
              preference
            )
            .then((res) => {
              setRouteResult(`${currentSeg.id}:${opt.id}`, res);
            });
        }
      }
    );
  }, [facilities, selectedPoiId, currentSeg, customWaypoints, preference, showFacilitiesOnMap]);

  const handleFitAll = () => {
    amapService.fitToAll();
  };

  const handleStartNav = () => {
    if (!currentSeg) return;
    const targetStop = verifiedStops[currentSeg.end];
    const waypoints = customWaypoints[currentSeg.id] || [];
    startAmapNavigation(targetStop, waypoints, preference);
  };

  return (
    <main className="center-map-area" aria-label="高德实路交互地图">
      {/* 地图渲染容器 */}
      <div className="map-canvas-container">
        <div id="amap-root"></div>

        {/* 地图左上角控制药丸 (对齐图 01, 02) */}
        <div className="map-floating-top-left">
          <div className="map-control-pill">
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
            onClick={handleFitAll}
            title="查看完整湖北两日自驾走廊"
          >
            <Maximize2 size={13} />
            <span>全景总览</span>
          </button>
        </div>

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
                  {currentSeg.id === 's6' && (
                    <span className="badge-tag-scenic">推荐风景路线</span>
                  )}
                </div>
                <div className="segment-sub-desc">
                  第{currentSeg.day}天 · {currentSeg.note}
                </div>
              </div>

              <button
                type="button"
                className="btn-opt-select primary-active"
                style={{
                  maxWidth: '130px',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  background: '#059669',
                  color: '#ffffff'
                }}
                onClick={handleStartNav}
                title="调起高德分段导航"
              >
                <Navigation size={14} />
                <span>开始导航</span>
              </button>
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
