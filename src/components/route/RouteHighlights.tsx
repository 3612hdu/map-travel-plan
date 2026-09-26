import React from 'react';
import { Mountain } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { bindHighlightsToRoute } from '../../utils/routeHighlights';

export const RouteHighlights: React.FC = () => {
  const { segments, activeSegmentId, selectedOptions, routeResults, activeHighlightId, focusHighlight, setActiveContentTab } = useTripStore();
  const currentSeg = segments.find((s) => s.id === activeSegmentId);
  const optionId = selectedOptions[activeSegmentId] || currentSeg?.chosen || '';
  const activeOpt = currentSeg?.options.find((o) => o.id === optionId);
  const path = routeResults[`${activeSegmentId}:${optionId}`]?.path;
  const highlights = bindHighlightsToRoute(activeOpt?.highlights || [], activeSegmentId, optionId, path);
  if (!highlights.length) return null;

  return (
    <div className="route-highlights-section">
      <div className="highlights-title-bar">
        <div className="highlights-title"><Mountain size={15} color="#059669" /><span>路线亮点 · 当前实路区间</span></div>
        <div className="highlights-sub">点击查看橙色高亮的实际道路范围</div>
      </div>
      <div className="highlights-grid">
        {highlights.map((item) => (
          <button type="button" key={item.id} data-highlight-id={item.id}
            className={`highlight-thumb-card ${activeHighlightId === item.id ? 'selected' : ''}`}
            onClick={() => { focusHighlight(item.id); setActiveContentTab('videos'); }} title={item.desc}>
            <div className="highlight-img-wrapper"><img src={item.image} alt="路线示意图，非实景核验" className="highlight-img" /><span className="highlight-illustration-label">示意图</span></div>
            <div className="highlight-label">{item.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
