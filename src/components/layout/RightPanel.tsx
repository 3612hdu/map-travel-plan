import React from 'react';
import { PlayCircle, Fuel } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { VideoTab } from '../video/VideoTab';
import { FacilityTab } from '../facilities/FacilityTab';

export const RightPanel: React.FC = () => {
  const { activeContentTab, setActiveContentTab, mapMode, activeSegmentId, segments } = useTripStore();
  const detailSegment = segments.find((seg) => seg.id === activeSegmentId);

  return (
    <aside className="right-panel-shared" aria-label="沿途视频与沿途设施">
      {/* 共享面板顶部双 Tab 切换 (严格对齐图 01, 02 规范) */}
      <div className="right-tab-header">
        <button
          type="button"
          className={`panel-tab-btn ${activeContentTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveContentTab('videos')}
        >
          <PlayCircle size={16} />
          <span>沿途视频</span>
        </button>
        <button
          type="button"
          className={`panel-tab-btn ${activeContentTab === 'facilities' ? 'active' : ''}`}
          onClick={() => setActiveContentTab('facilities')}
        >
          <Fuel size={16} />
          <span>沿途设施</span>
        </button>
      </div>

      {mapMode === 'segment-focus' && detailSegment && (
        <div className="right-panel-detail-context">本段详细查看 · {detailSegment.title}</div>
      )}

      {/* 切换展示内容 */}
      {activeContentTab === 'videos' ? <VideoTab /> : <FacilityTab />}
    </aside>
  );
};
