import React, { useState } from 'react';
import { Calendar, Compass, Bookmark, Save, Share2, Star } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';
import { formatDuration } from '../../utils/geo';

export const SidebarLeft: React.FC = () => {
  const {
    segments,
    activeDay,
    setActiveDay,
    activeSegmentId,
    setActiveSegment,
    selectedOptions,
    routeResults
  } = useTripStore();

  const [activeNavTab, setActiveNavTab] = useState<'plan' | 'recommend' | 'saved'>('plan');

  const day1Segments = segments.filter((s) => s.day === 1);
  const day2Segments = segments.filter((s) => s.day === 2);

  const handleSelectSegment = (segId: string) => {
    setActiveSegment(segId);
    amapService.fitToSegment(segId);
  };

  const renderSegmentItem = (seg: any, globalIdx: number) => {
    const isActive = seg.id === activeSegmentId;
    const optId = selectedOptions[seg.id] || seg.chosen;
    const res = routeResults[`${seg.id}:${optId}`];

    // 默认或已算路距离
    const distanceText = res
      ? `${(res.distance / 1000).toFixed(0)} km`
      : seg.id === 's6'
      ? '136 km'
      : '约 80 km';

    const durationText = res
      ? formatDuration(res.time)
      : seg.id === 's6'
      ? '3h08m'
      : '约 2h';

    const isStarSegment = seg.id === 's6';

    return (
      <div
        key={seg.id}
        className={`segment-card ${isActive ? 'active' : ''}`}
        onClick={() => handleSelectSegment(seg.id)}
      >
        <div className="segment-card-top">
          <div className="segment-idx">{globalIdx}</div>
          <div className="segment-info">
            <div className="segment-title">
              {isStarSegment && <Star size={13} fill="#f59e0b" color="#f59e0b" />}
              <span>{seg.title}</span>
              {isStarSegment && <Star size={13} fill="#f59e0b" color="#f59e0b" />}
            </div>
            <div className="segment-stats">
              约 {distanceText} · {durationText}
            </div>
          </div>
        </div>

        <div className="segment-tags-row">
          {seg.tags.map((tag: string, i: number) => (
            <span
              key={i}
              className={`segment-tag-pill ${
                tag.includes('推荐') || tag.includes('水') ? 'recommend' : ''
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside className="sidebar-left" aria-label="自驾行程分段">
      {/* 顶部标签 */}
      <div className="sidebar-nav-tabs">
        <button
          type="button"
          className={`nav-tab-btn ${activeNavTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('plan')}
        >
          <Calendar size={13} />
          <span>行程规划</span>
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeNavTab === 'recommend' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('recommend')}
        >
          <Compass size={13} />
          <span>沿途推荐</span>
        </button>
        <button
          type="button"
          className={`nav-tab-btn ${activeNavTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('saved')}
        >
          <Bookmark size={13} />
          <span>行程收藏</span>
        </button>
      </div>

      {/* 行程分天与分段列表 */}
      <div className="sidebar-content-scroll">
        {/* DAY 1 */}
        <div className="day-block-header">
          <div className="day-badge-title">
            <span className="day-tag">DAY 1</span>
            <span className="day-meta-text">3段 · 约 258 km</span>
          </div>
        </div>
        {day1Segments.map((seg, idx) => renderSegmentItem(seg, idx + 1))}

        {/* DAY 2 */}
        <div className="day-block-header" style={{ marginTop: '16px' }}>
          <div className="day-badge-title">
            <span className="day-tag">DAY 2</span>
            <span className="day-meta-text">3段 · 约 278 km</span>
          </div>
        </div>
        {day2Segments.map((seg, idx) => renderSegmentItem(seg, idx + 4))}
      </div>

      {/* 底部保存与分享操作 */}
      <div className="sidebar-footer-actions">
        <button
          type="button"
          className="btn-sidebar-action"
          onClick={() => alert('自驾规划已自动保存到本地！')}
        >
          <Save size={14} />
          <span>保存行程</span>
        </button>
        <button
          type="button"
          className="btn-sidebar-action outline"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            alert('行程链接已复制到剪贴板！');
          }}
        >
          <Share2 size={14} />
          <span>分享路线</span>
        </button>
      </div>
    </aside>
  );
};
