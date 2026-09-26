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
    selectedOptions,
    routeResults,
    customWaypoints,
    setRouteResult,
    facilities,
    selectedPoiId,
    focusPoi,
    addWaypoint,
    preference
  } = useTripStore();

  const currentSeg = segments.find((s) => s.id === activeSegmentId);

  // 初始化高德地图
  useEffect(() => {
    if (mapMountedRef.current) return;
    mapMountedRef.current = true;

    amapService.initMap('amap-root').then(() => {
      // 初始规划所有选中的路线，并预规划重点段(s6)的全部备选方案
      segments.forEach((seg) => {
        // 先规划当前已选方案
        const chosenOpt = seg.options.find((o) => o.id === seg.chosen) || seg.options[0];
        amapService
          .planSegment(seg, chosenOpt, customWaypoints[seg.id] || [], preference)
          .then((res) => {
            setRouteResult(`${seg.id}:${chosenOpt.id}`, res);
          })
          .catch((err) => {
            console.warn(`路段 ${seg.id} 算路失败:`, err);
          });

        // 重点路段（多走法对比）预先算路其余走法
        if (seg.options.length > 1) {
          seg.options.forEach((opt) => {
            if (opt.id !== chosenOpt.id) {
              amapService
                .planSegment(seg, opt, customWaypoints[seg.id] || [], preference)
                .then((res) => {
                  setRouteResult(`${seg.id}:${opt.id}`, res);
                })
                .catch(() => {});
            }
          });
        }
      });
    });
  }, []);

  // 当 routeResults、selectedOptions 或 activeSegmentId 变化时重绘路线
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    amapService.renderRoutes(
      segments,
      selectedOptions,
      routeResults,
      activeSegmentId
    );

    // 聚焦到当前路段
    amapService.fitToSegment(activeSegmentId);
  }, [segments, selectedOptions, routeResults, activeSegmentId]);

  // 当设施 POIs 变化或选中状态变化时，渲染地图 POI Marker
  useEffect(() => {
    const map = amapService.getMap();
    if (!map) return;

    amapService.renderPoiMarkers(
      facilities,
      selectedPoiId,
      (poi) => {
        focusPoi(poi.id);
      },
      (poi) => {
        if (currentSeg) {
          const newStop = {
            id: poi.id,
            name: poi.name,
            coord: poi.coord,
            poi: poi.poiId || '',
            city: '十堰市',
            address: poi.address
          };
          addWaypoint(currentSeg.id, newStop);
          // 重新发起高德算路
          const opt =
            currentSeg.options.find(
              (o) => o.id === (selectedOptions[currentSeg.id] || currentSeg.chosen)
            ) || currentSeg.options[0];
          amapService
            .planSegment(currentSeg, opt, [
              ...(customWaypoints[currentSeg.id] || []),
              newStop
            ])
            .then((res) => {
              setRouteResult(`${currentSeg.id}:${opt.id}`, res);
            });
        }
      }
    );
  }, [facilities, selectedPoiId, currentSeg, customWaypoints]);

  const handleFitAll = () => {
    amapService.fitToAll();
  };

  const handleStartNav = () => {
    if (!currentSeg) return;
    const targetStop = verifiedStops[currentSeg.end];
    const waypoints = customWaypoints[currentSeg.id] || [];
    startAmapNavigation(targetStop, waypoints);
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
