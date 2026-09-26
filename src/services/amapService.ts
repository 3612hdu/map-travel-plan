import AMapLoader from '@amap/amap-jsapi-loader';
import { AMAP_CONFIG, initAMapSecurity } from '../config/amap';
import { Stop, Segment, RouteOption } from '../types/trip';
import { RoutePoi } from '../types/poi';
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
    preference: RoutePreference = DEFAULT_PREFERENCE
  ): Promise<RouteCalcResult> {
    const api = await this.load();
    const startStop = verifiedStops[segment.start];
    const endStop = verifiedStops[segment.end];

    // 合并方案固有途经点与用户自定义添加的停靠点
    const defaultWaypoints = option.via.map((idx) => verifiedStops[idx].coord);
    const customCoords = customWaypoints.map((w) => w.coord);
    const waypoints = [...defaultWaypoints, ...customCoords];
    const aMapPolicy = mapPreferenceToAMapPolicy(preference);

    return new Promise((resolve, reject) => {
      try {
        const driving = new api.Driving({
          policy: aMapPolicy,
          extensions: 'all',
          ferry: 1
        });

        driving.search(
          startStop.coord,
          endStop.coord,
          { waypoints },
          (status: string, result: any) => {
            if (status !== 'complete' || !result?.routes?.[0]) {
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
        reject(err);
      }
    });
  }

  // 渲染所有路段的 Polyline
  renderRoutes(
    segments: Segment[],
    selectedOptions: Record<string, string>,
    routeResults: Record<string, RouteCalcResult>,
    activeSegmentId: string
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
      const color = isActive
        ? '#1875ff'
        : seg.day === 1
        ? '#ea580c'
        : '#059669';

      const polyline = new this.api.Polyline({
        path: res.path,
        strokeColor: color,
        strokeWeight: isActive ? 9 : 5,
        strokeOpacity: isActive ? 0.95 : 0.65,
        isOutline: true,
        outlineColor: '#ffffff',
        borderWeight: isActive ? 2.5 : 1.5,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: isActive ? 80 : 40,
        cursor: 'pointer'
      });

      this.map.add(polyline);
      this.routeLayers.set(seg.id, [polyline]);
      allPolylines.push(polyline);

      if (isActive) {
        activePolylines.push(polyline);
      }
    });

    return { allPolylines, activePolylines };
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

  // 渲染沿线设施与停靠点 Markers
  renderPoiMarkers(
    pois: RoutePoi[],
    selectedPoiId: string | null,
    onSelectPoi: (poi: RoutePoi) => void,
    onAddWaypoint?: (poi: RoutePoi) => void
  ) {
    if (!this.map || !this.api) return;

    // 清空现有 Marker
    if (this.markerLayers.length > 0) {
      this.map.remove(this.markerLayers);
      this.markerLayers = [];
    }

    pois.forEach((poi) => {
      const isSelected = poi.id === selectedPoiId;

      // 类别图标映射
      const iconMap: Record<string, string> = {
        hotel: '🏨',
        food: '🍴',
        gas: '⛽',
        ev: '⚡',
        toilet: '🚾',
        parking: '🅿️'
      };
      const emoji = iconMap[poi.category] || '📍';

      const content = document.createElement('div');
      content.className = `poi-custom-marker ${isSelected ? 'marker-selected' : ''}`;
      content.style.cssText = `
        background: ${isSelected ? '#1875ff' : '#ffffff'};
        color: ${isSelected ? '#ffffff' : '#0f172a'};
        border: 2px solid ${isSelected ? '#ffffff' : '#1875ff'};
        border-radius: 99px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 3px 10px rgba(0,0,0,0.18);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transform: translate(-50%, -50%);
        transition: transform 0.15s;
      `;
      content.innerHTML = `<span>${emoji}</span><span>${poi.name.slice(0, 7)}</span>`;

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

  // 打开 POI 详细气泡
  openPoiInfoWindow(poi: RoutePoi, onAddWaypoint?: (poi: RoutePoi) => void) {
    if (!this.map || !this.api || !this.infoWindow) return;

    const html = `
      <div style="padding: 10px; font-family: system-ui; max-width: 260px;">
        <div style="font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 4px;">
          ${poi.name}
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 6px;">
          ${poi.address || '暂无详细地址'}
        </div>
        <div style="display: flex; gap: 6px; font-size: 11px; color: #059669; font-weight: 700; margin-bottom: 8px;">
          <span>距路线约 ${poi.distanceToRoute} km</span>
          ${poi.rating ? `<span>★ ${poi.rating}</span>` : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-info-add-waypoint" style="
            background: #059669; color: white; border: none; border-radius: 6px;
            padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;
          ">
            + 加入停靠点
          </button>
          <a href="https://uri.amap.com/marker?position=${poi.coord.join(',')}&name=${encodeURIComponent(poi.name)}"
             target="_blank" rel="noopener noreferrer" style="
            background: #f1f5f9; color: #334155; text-decoration: none; border-radius: 6px;
            padding: 4px 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center;
          ">
            高德详情 ↗
          </a>
        </div>
      </div>
    `;

    this.infoWindow.setContent(html);
    this.infoWindow.open(this.map, poi.coord);

    // 绑定内部加入停靠点事件
    setTimeout(() => {
      const btn = document.getElementById('btn-info-add-waypoint');
      if (btn && onAddWaypoint) {
        btn.onclick = () => onAddWaypoint(poi);
      }
    }, 100);
  }

  // 平移居中到指定坐标
  panTo(coord: [number, number], zoom = 14) {
    if (!this.map) return;
    this.map.setZoomAndCenter(zoom, coord);
  }
}

export const amapService = new AMapService();
