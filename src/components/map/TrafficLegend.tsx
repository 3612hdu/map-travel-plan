import React from 'react';
import { Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';

export const TrafficLegend: React.FC = () => {
  const { isTrafficEnabled, toggleTraffic, isSatelliteEnabled, toggleSatellite } = useTripStore();

  const handleToggleTraffic = () => {
    toggleTraffic();
    amapService.setTrafficVisible(!isTrafficEnabled);
  };

  const handleToggleSatellite = () => {
    toggleSatellite();
    amapService.setSatelliteVisible(!isSatelliteEnabled);
  };

  const handleZoomIn = () => {
    const map = amapService.getMap();
    if (map) map.zoomIn();
  };

  const handleZoomOut = () => {
    const map = amapService.getMap();
    if (map) map.zoomOut();
  };

  return (
    <div className="map-floating-top-right">
      {/* 实时路况卡片 (对齐图 01, 02) */}
      <div className="traffic-legend-card">
        <div className="traffic-legend-title">
          <span>实时路况</span>
          <button
            type="button"
            onClick={handleToggleTraffic}
            style={{
              fontSize: '10.5px',
              color: isTrafficEnabled ? '#10b981' : '#94a3b8',
              fontWeight: 700
            }}
          >
            {isTrafficEnabled ? '已开启' : '已关闭'}
          </button>
        </div>
        <div className="traffic-legend-items">
          <div className="traffic-item">
            <span className="traffic-bar green"></span>
            <span>畅通</span>
          </div>
          <div className="traffic-item">
            <span className="traffic-bar orange"></span>
            <span>缓行</span>
          </div>
          <div className="traffic-item">
            <span className="traffic-bar red"></span>
            <span>拥堵</span>
          </div>
        </div>
      </div>

      {/* 悬浮小工具按钮 */}
      <div className="map-icon-btns">
        <button
          type="button"
          className="map-icon-btn"
          title={isSatelliteEnabled ? '切换标准底图' : '切换卫星影像'}
          onClick={handleToggleSatellite}
        >
          <Layers size={16} color={isSatelliteEnabled ? '#1875ff' : '#334155'} />
        </button>
        <button
          type="button"
          className="map-icon-btn"
          title="放大地图"
          onClick={handleZoomIn}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className="map-icon-btn"
          title="缩小地图"
          onClick={handleZoomOut}
        >
          <ZoomOut size={16} />
        </button>
      </div>
    </div>
  );
};
