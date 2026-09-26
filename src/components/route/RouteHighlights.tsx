import React from 'react';
import { Mountain } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';

export const RouteHighlights: React.FC = () => {
  const { segments, activeSegmentId, selectedOptions } = useTripStore();
  const currentSeg = segments.find((s) => s.id === activeSegmentId);

  // 获取当前所选 RouteOption 的亮点
  const activeOpt = currentSeg?.options.find((o) => o.id === (selectedOptions[activeSegmentId] || currentSeg.chosen))
    || currentSeg?.options[0];
  const highlights = activeOpt?.highlights || [];

  if (highlights.length === 0) return null;

  const handleFocusHighlight = (loc: [number, number]) => {
    amapService.panTo(loc, 14);
  };

  return (
    <div className="route-highlights-section">
      <div className="highlights-title-bar">
        <div className="highlights-title">
          <Mountain size={15} color="#059669" />
          <span>路线亮点</span>
        </div>
        <div className="highlights-sub">
          {activeOpt?.desc}
        </div>
      </div>

      <div className="highlights-grid">
        {highlights.map((item) => (
          <div
            key={item.id}
            className="highlight-thumb-card"
            onClick={() => handleFocusHighlight(item.location)}
            title="点击在地图上定位"
          >
            <div className="highlight-img-wrapper">
              <img src={item.image} alt={item.title} className="highlight-img" />
            </div>
            <div className="highlight-label">{item.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
