import AMapLoader from '@amap/amap-jsapi-loader';
import { AMAP_CONFIG, initAMapSecurity } from '../config/amap';
import { Stop, Segment, RouteOption, OvernightStop } from '../types/trip';
import { RoutePoi, RealDetourResult } from '../types/poi';
import { RouteCalcResult } from '../types/map';
import { verifiedStops } from '../data/stops';
import { RoutePreference, DEFAULT_PREFERENCE, mapPreferenceToAMapPolicy } from '../types/preference';

// 高德地图单例服务管理
class AMapService {
  private api: any = null;
  private map: any = null;
  private trafficLayer: any = null;
  private satelliteLayer: any = null;
  private routeLayers: Map<string, any[]> = new Map();
  private markerLayers: any[] = [];
  private overnightMarker: any = null;
  private infoWindow: any = null;
  private isLoaded = false;
  private loadPromise: Promise<any> | null = null;

  // 异步加载并初始化高德 JS API
  async load(): Promise<any> {
    if (this.isLoaded && this.api) return this.api;
    if (this.loadPromise) return this.loadPromise;

    initAMapSecurity();

    this.loadPromise = AMapLoader.load({
      key: AMAP_CONFIG.key,
      version: AMAP_CONFIG.version,
      plugins: AMAP_CONFIG.plugins
    })
      .then((api) => {
        this.api = api;
        this.isLoaded = true;
        return api;
      })
      .catch((err) => {
        this.loadPromise = null;
        console.error('高德 JS API 加载失败:', err);
        throw err;
      });

    return this.loadPromise;
  }

  // 挂载地图到指定 DOM 元素
  async initMap(containerId: string): Promise<any> {
    const api = await this.load();
    if (this.map) {
      try {
        this.map.destroy();
      } catch {}
    }

    this.map = new api.Map(containerId, {
      viewMode: '2D',
      zoom: 8,
      center: [112.9, 31.75], // 湖北中北部（黄冈至郧阳走廊中心）
      mapStyle: 'amap://styles/normal'
    });

    // 创建实时路况图层
    this.trafficLayer = new api.TileLayer.Traffic({
      zIndex: 10,
      autoRefresh: true,
      interval: 180
    });
    this.map.add(this.trafficLayer);

    // 创建卫星图层（默认不显示）
    this.satelliteLayer = new api.TileLayer.Satellite();

    // 创建全局通用气泡窗
    this.infoWindow = new api.InfoWindow({
      offset: new api.Pixel(0, -30),
      isCustom: false
    });

    return this.map;
  }

  getMap() {
    return this.map;
  }

  getApi() {
    return this.api;
  }

  // 切换实时路况图层
  setTrafficVisible(visible: boolean) {
    if (!this.map || !this.trafficLayer) return;
    if (visible) {
      this.trafficLayer.show();
    } else {
      this.trafficLayer.hide();
    }
  }

  // 切换卫星底图
  setSatelliteVisible(visible: boolean) {
    if (!this.map || !this.satelliteLayer) return;
    if (visible) {
      this.map.add(this.satelliteLayer);
    } else {
      this.map.remove(this.satelliteLayer);
    }
  }

  // 规划某一路段的高德实路（统一由 RoutePreference 驱动）
  async planSegment(
    segment: Segment,
    option: RouteOption,
    customWaypoints: Stop[] = [],
    preference: RoutePreference = DEFAULT_PREFERENCE,
    maxRetries = 2
  ): Promise<RouteCalcResult> {
    const api = await this.load();
    const startStop = verifiedStops[segment.start];
    const endStop = verifiedStops[segment.end];
    const startCoord = segment.customStartCoord || startStop?.coord;
    const endCoord = segment.customEndCoord || endStop?.coord;

    // 合并方案固有途经点与用户自定义添加的停靠点
    const defaultWaypoints = option.via.map((idx) => verifiedStops[idx].coord);
    const customCoords = customWaypoints.map((w) => w.coord);
    const waypoints = [...defaultWaypoints, ...customCoords];
    const aMapPolicy = mapPreferenceToAMapPolicy(preference);

    const executeSearch = (attempt: number): Promise<RouteCalcResult> => {
      return new Promise((resolve, reject) => {
        try {
          const driving = new api.Driving({
            policy: aMapPolicy,
            extensions: 'all',
            ferry: 1
          });

          driving.search(
            startCoord,
            endCoord,
            { waypoints },
            async (status: string, result: any) => {
              if (status !== 'complete' || !result?.routes?.[0]) {
                if (attempt < maxRetries) {
                  // 指数退避重试 (解决高德并发 QPS 频率限制)
                  await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                  return resolve(executeSearch(attempt + 1));
                }
                reject(new Error(`高德算路未返回路线: ${status}`));
                return;
              }

              const route = result.routes[0];
              const path: [number, number][] = [];

              // 提取平滑 polyline 坐标序列
              for (const step of route.steps || []) {
                for (const p of step.path || []) {
                  const lng = typeof p.getLng === 'function' ? p.getLng() : p.lng || p[0];
                  const lat = typeof p.getLat === 'function' ? p.getLat() : p.lat || p[1];
                  if (lng && lat) path.push([lng, lat]);
                }
              }

              const roads = Array.from(
                new Set(
                  (route.steps || [])
                    .map((x: any) => x.road)
                    .filter(Boolean)
                )
              ).slice(0, 10) as string[];

              resolve({
                path,
                distance: Number(route.distance) || 0,
                time: Number(route.time) || 0,
                tolls: route.tolls != null ? Number(route.tolls) : 0,
                roads
              });
            }
          );
        } catch (err) {
          if (attempt < maxRetries) {
            setTimeout(() => resolve(executeSearch(attempt + 1)), 400 * (attempt + 1));
          } else {
            reject(err);
          }
        }
      });
    };

    return executeSearch(0);
  }

  // 渲染所有路段的 Polyline (支持 Day 1 / Day 2 聚焦与高亮模式)
  renderRoutes(
    segments: Segment[],
    selectedOptions: Record<string, string>,
    routeResults: Record<string, RouteCalcResult>,
    activeSegmentId: string,
    activeDay: number | 'all' = 'all',
    overnightStop: OvernightStop | null = null
  ) {
    if (!this.map || !this.api) return;

    // 清空现有路线
    this.routeLayers.forEach((layers) => {
      this.map.remove(layers);
    });
    this.routeLayers.clear();

    const allPolylines: any[] = [];
    const activePolylines: any[] = [];

    segments.forEach((seg) => {
      const optId = selectedOptions[seg.id] || seg.chosen;
      const key = `${seg.id}:${optId}`;
      const res = routeResults[key];
      if (!res || !res.path || res.path.length < 2) return;

      const isActive = seg.id === activeSegmentId;
      const isDayMatched = activeDay === 'all' || seg.day === activeDay;

      // 颜色与透明度：根据 Day 聚焦与激活路段设定
      const color = isActive
        ? '#1875ff'
        : seg.day === 1
        ? '#ea580c'
        : '#059669';

      const weight = isActive ? 9 : isDayMatched ? 5.5 : 3.5;
      const opacity = isActive ? 0.95 : isDayMatched ? 0.75 : 0.22;
      const zIndex = isActive ? 90 : isDayMatched ? (seg.day === 1 ? 50 : 45) : 20;

      const polyline = new this.api.Polyline({
        path: res.path,
        strokeColor: color,
        strokeWeight: weight,
        strokeOpacity: opacity,
        isOutline: true,
        outlineColor: '#ffffff',
        borderWeight: isActive ? 2.5 : isDayMatched ? 1.5 : 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex,
        cursor: 'pointer'
      });

      this.map.add(polyline);
      this.routeLayers.set(seg.id, [polyline]);
      allPolylines.push(polyline);

      if (isActive) {
        activePolylines.push(polyline);
      }
    });

    // 联动渲染住宿点专属标记
    this.renderOvernightMarker(overnightStop);

    return { allPolylines, activePolylines };
  }

  // 聚焦到具体某一天的路线
  fitToDay(day: number, segments: Segment[]) {
    if (!this.map) return;
    const daySegIds = segments.filter((s) => s.day === day).map((s) => s.id);
    const dayLayers: any[] = [];
    daySegIds.forEach((id) => {
      const layers = this.routeLayers.get(id);
      if (layers) dayLayers.push(...layers);
    });
    if (dayLayers.length > 0) {
      this.map.setFitView(dayLayers, false, [60, 60, 60, 60]);
    }
  }

  // 渲染 Overnight Stop 专属床图标 Marker
  renderOvernightMarker(
    overnightStop: OvernightStop | null,
    onClick?: (stop: OvernightStop) => void
  ) {
    if (!this.map || !this.api) return;

    if (this.overnightMarker) {
      this.map.remove(this.overnightMarker);
      this.overnightMarker = null;
    }

    if (!overnightStop || !overnightStop.coord) return;

    const content = document.createElement('div');
    content.className = 'overnight-custom-marker';
    content.style.cssText = `
      background: #4338ca;
      color: #ffffff;
      border: 2.5px solid #ffffff;
      border-radius: 99px;
      padding: 4px 11px;
      font-size: 11.5px;
      font-weight: 800;
      box-shadow: 0 4px 16px rgba(67, 56, 202, 0.45);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      transform: translate(-50%, -50%);
      z-index: 210;
    `;
    content.innerHTML = `
      <span style="font-size: 13.5px;">🛏</span>
      <span>今晚住宿 · ${overnightStop.name}</span>
      <span style="background: rgba(255,255,255,0.22); padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">
        ${overnightStop.todayEta || '今晚'}
      </span>
    `;

    const marker = new this.api.Marker({
      position: overnightStop.coord,
      content,
      zIndex: 220
    });

    marker.on('click', () => {
      if (onClick) onClick(overnightStop);
      this.openOvernightInfoWindow(overnightStop);
    });

    this.map.add(marker);
    this.overnightMarker = marker;
  }

  openOvernightInfoWindow(overnightStop: OvernightStop) {
    if (!this.map || !this.api || !this.infoWindow) return;
    const html = `
      <div style="padding: 10px; font-family: system-ui, -apple-system, sans-serif; max-width: 280px;">
        <div style="font-size: 10.5px; color: #4338ca; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px; font-weight: 700;">
          🛏 第一晚收车住宿
        </div>
        <div style="font-weight: 800; font-size: 14.5px; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">
          ${overnightStop.name}
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 8px;">
          ${overnightStop.address || overnightStop.city || '湖北省自驾走廊'}
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px; font-size: 11px; background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">今日驾驶:</span>
            <strong style="color: #0f172a;">${overnightStop.todayDrivingKm || '约 200'} km · 预计 ${overnightStop.todayEta || '17:30'} 抵达</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">明日剩余:</span>
            <strong style="color: #059669;">${overnightStop.tomorrowRemainingKm || '约 300'} km</strong>
          </div>
          ${overnightStop.decisionLabel ? `
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span style="color: #64748b;">节奏特性:</span>
              <span style="color: #4338ca; font-weight: 700;">${overnightStop.decisionLabel}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    this.infoWindow.setContent(html);
    this.infoWindow.open(this.map, overnightStop.coord);
  }

  // 聚焦到指定路段或全程
  fitToSegment(activeSegmentId: string) {
    if (!this.map) return;
    const layers = this.routeLayers.get(activeSegmentId);
    if (layers && layers.length > 0) {
      this.map.setFitView(layers, false, [60, 60, 60, 60]);
    }
  }

  fitToAll() {
    if (!this.map) return;
    const allLayers: any[] = [];
    this.routeLayers.forEach((layers) => allLayers.push(...layers));
    if (allLayers.length > 0) {
      this.map.setFitView(allLayers, false, [50, 50, 50, 50]);
    }
  }

  // 清空沿线设施 Markers
  clearPoiMarkers() {
    if (!this.map) return;
    if (this.markerLayers.length > 0) {
      this.map.remove(this.markerLayers);
      this.markerLayers = [];
    }
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  // 渲染沿线设施与停靠点 Markers (支持分类色彩、顺路微标签与双向聚焦)
  renderPoiMarkers(
    pois: RoutePoi[],
    selectedPoiId: string | null,
    onSelectPoi: (poi: RoutePoi) => void,
    onAddWaypoint?: (poi: RoutePoi) => void
  ) {
    if (!this.map || !this.api) return;

    // 清空现有 Marker
    this.clearPoiMarkers();

    // 分类样式配置
    const categoryTheme: Record<string, { emoji: string; color: string; bg: string }> = {
      hotel: { emoji: '🏨', color: '#1d4ed8', bg: '#eff6ff' },
      food: { emoji: '🍴', color: '#e11d48', bg: '#fff1f2' },
      gas: { emoji: '⛽', color: '#d97706', bg: '#fffbeb' },
      ev: { emoji: '⚡', color: '#059669', bg: '#ecfdf5' },
      toilet: { emoji: '🚾', color: '#0284c7', bg: '#f0f9ff' },
      parking: { emoji: '🅿️', color: '#475569', bg: '#f8fafc' }
    };

    pois.forEach((poi) => {
      const isSelected = poi.id === selectedPoiId;
      const theme = categoryTheme[poi.category] || { emoji: '📍', color: '#1875ff', bg: '#eff6ff' };
      const detourKm = poi.distanceToRoute;

      const content = document.createElement('div');
      content.className = `poi-custom-marker ${isSelected ? 'marker-selected' : ''}`;
      content.style.cssText = `
        background: ${isSelected ? theme.color : '#ffffff'};
        color: ${isSelected ? '#ffffff' : '#0f172a'};
        border: 2px solid ${theme.color};
        border-radius: 99px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(0,0,0,0.16);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transform: translate(-50%, -50%) ${isSelected ? 'scale(1.12)' : 'scale(1)'};
        transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: ${isSelected ? '999' : '50'};
      `;
      content.innerHTML = `
        <span>${theme.emoji}</span>
        <span>${poi.name.slice(0, 6)}</span>
        <span style="font-size: 9.5px; opacity: 0.85; margin-left: 2px;">${detourKm}km</span>
      `;

      const marker = new this.api.Marker({
        position: poi.coord,
        content,
        zIndex: isSelected ? 120 : 60
      });

      marker.on('click', () => {
        onSelectPoi(poi);
        this.openPoiInfoWindow(poi, onAddWaypoint);
      });

      this.map.add(marker);
      this.markerLayers.push(marker);

      if (isSelected) {
        this.openPoiInfoWindow(poi, onAddWaypoint);
      }
    });
  }

  // 预留真实绕行测算接口: 计算 当前路线 -> POI -> 返回路线后的真实新增距离和时间
  async calculateRealDetour(
    poi: RoutePoi,
    segment: Segment,
    option?: RouteOption,
    customWaypoints: Stop[] = [],
    preference: RoutePreference = DEFAULT_PREFERENCE
  ): Promise<RealDetourResult> {
    const opt = option || segment.options.find((o) => o.id === segment.chosen) || segment.options[0];

    // 1. 基准路线规划 (不含该 POI)
    const baseResult = await this.planSegment(segment, opt, customWaypoints, preference);

    // 2. 插入 POI 后的新路线规划
    const detectedCity =
      poi.address.match(/(.+?[市区县])/)?.[1] || segment.title.split('→')[1]?.trim() || '湖北';
    const poiStop: Stop = {
      id: `detour-${poi.id}`,
      name: poi.name,
      coord: poi.coord,
      poi: poi.poiId || '',
      city: detectedCity,
      address: poi.address
    };

    const newResult = await this.planSegment(segment, opt, [...customWaypoints, poiStop], preference);

    const origDist = baseResult.distance;
    const newDist = newResult.distance;
    const origTime = baseResult.time;
    const newTime = newResult.time;

    const realDetourKm = Math.max(0, Number(((newDist - origDist) / 1000).toFixed(1)));
    const realDetourDurationSec = Math.max(0, newTime - origTime);

    return {
      poiId: poi.id,
      realDetourKm,
      realDetourDurationSec,
      originalDistanceMeters: origDist,
      newDistanceMeters: newDist,
      originalDurationSeconds: origTime,
      newDurationSeconds: newTime
    };
  }

  // 打开 POI 详细气泡
  openPoiInfoWindow(poi: RoutePoi, onAddWaypoint?: (poi: RoutePoi) => void) {
    if (!this.map || !this.api || !this.infoWindow) return;

    const segmentTag = poi.sourceSegmentTitle ? `
      <div style="font-size: 10.5px; color: #4338ca; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px; font-weight: 700;">
        📍 归属路段: ${poi.sourceSegmentTitle}
      </div>
    ` : '';

    const detourBadgeHtml = poi.isRealDetour && poi.realDetourKm != null
      ? `<span style="background: #ecfdf5; color: #059669; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
           真实道路绕行 +${poi.realDetourKm} km${poi.realDetourDurationSec ? ` (${Math.round(poi.realDetourDurationSec / 60)}分钟)` : ''}
         </span>`
      : `<span style="background: #f8fafc; color: #475569; font-weight: 600; padding: 2px 6px; border-radius: 4px;">
           预计绕行约 +${poi.estimatedDetourKm ?? poi.detourDistance ?? 0.5} km
         </span>`;

    const html = `
      <div style="padding: 10px; font-family: system-ui, -apple-system, sans-serif; max-width: 270px;">
        ${segmentTag}
        <div style="font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 3px; line-height: 1.3;">
          ${poi.name}
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 8px;">
          ${poi.address || '湖北省自驾走廊沿线'}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; margin-bottom: 10px;">
          <span style="background: #ecfdf5; color: #059669; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
            距路线 ${poi.distanceToRoute} km
          </span>
          ${detourBadgeHtml}
          ${poi.rating ? `<span style="color: #f59e0b; font-weight: 700;">★ ${poi.rating}</span>` : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-info-add-waypoint" style="
            flex: 1; background: #059669; color: white; border: none; border-radius: 6px;
            padding: 5px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            box-shadow: 0 1px 3px rgba(5,150,105,0.3);
          ">
            + 加入此站为停靠点
          </button>
        </div>
      </div>
    `;

    this.infoWindow.setContent(html);
    this.infoWindow.open(this.map, poi.coord);

    // 绑定内部加入停靠点事件
    setTimeout(() => {
      const btn = document.getElementById('btn-info-add-waypoint');
      if (btn && onAddWaypoint) {
        btn.onclick = () => {
          onAddWaypoint(poi);
          this.infoWindow.close();
        };
      }
    }, 80);
  }

  // 平移居中到指定坐标
  panTo(coord: [number, number], zoom = 14) {
    if (!this.map) return;
    this.map.setZoomAndCenter(zoom, coord);
  }
}

export const amapService = new AMapService();
