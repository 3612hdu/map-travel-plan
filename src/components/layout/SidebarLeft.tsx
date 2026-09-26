import React, { useState } from 'react';
import { Calendar, Compass, Bookmark, Save, Share2, Star, Layers, Bed, Clock, Navigation } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { formatDuration } from '../../utils/geo';
import { TripTimeline } from '../timeline/TripTimeline';

export const SidebarLeft: React.FC = () => {
  const {
    segments,
    activeDay,
    setActiveDay,
    activeSegmentId,
    setActiveSegment,
    selectedOptions,
    routeResults,
    overnightStop,
    setIsComparisonModalOpen,
    setIsNavigationPlanModalOpen
  } = useTripStore();

  const [activeNavTab, setActiveNavTab] = useState<'plan' | 'recommend' | 'saved'>('plan');

  const day1Segments = segments.filter((s) => s.day === 1);
  const day2Segments = segments.filter((s) => s.day === 2);

  const handleSelectSegment = (segId: string) => {
    setActiveSegment(segId);
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      useTripStore.getState().setMobileActiveTab('map');
    }
  };

  const handleDayTabClick = (day: number | 'all') => {
    setActiveDay(day);
  };

  const renderSegmentItem = (seg: any, globalIdx: number) => {
    const isActive = seg.id === activeSegmentId;
    const optId = selectedOptions[seg.id] || seg.chosen;
    const res = routeResults[`${seg.id}:${optId}`];

    const distanceText = res ? `${(res.distance / 1000).toFixed(0)} km` : '计算中…';
    const durationText = res ? formatDuration(res.time) : '计算中…';

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
              {distanceText} · {durationText}
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

      {/* Day 模式切换栏 (全程 / DAY 1 / DAY 2) */}
      <div
        className="day-mode-filter-bar"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <button
          type="button"
          id="btn-day-filter-all"
          className={`filter-pill ${activeDay === 'all' ? 'active' : ''}`}
          onClick={() => handleDayTabClick('all')}
          style={{ flex: 1, padding: '4px 0', fontSize: '11.5px', justifyContent: 'center' }}
        >
          <Layers size={12} />
          <span>全程</span>
        </button>
        <button
          type="button"
          id="btn-day-filter-1"
          className={`filter-pill ${activeDay === 1 ? 'active' : ''}`}
          onClick={() => handleDayTabClick(1)}
          style={{ flex: 1, padding: '4px 0', fontSize: '11.5px', justifyContent: 'center' }}
        >
          <span>DAY 1</span>
        </button>
        <button
          type="button"
          id="btn-day-filter-2"
          className={`filter-pill ${activeDay === 2 ? 'active' : ''}`}
          onClick={() => handleDayTabClick(2)}
          style={{ flex: 1, padding: '4px 0', fontSize: '11.5px', justifyContent: 'center' }}
        >
          <span>DAY 2</span>
        </button>
      </div>

      {/* 行程分天与分段列表 */}
      <div className="sidebar-content-scroll">
        {/* 行程时间轴卡片 */}
        <TripTimeline dayFilter={activeDay} />

        {/* 行程分天与分段列表 */}
        {(() => {
          let globalCounter = 1;
          const uniqueDays = Array.from(new Set(segments.map((s) => s.day))).sort((a, b) => a - b);

          return uniqueDays.map((d) => {
            const daySegments = segments.filter((s) => s.day === d);
            const plannedDaySegments = daySegments.filter((s) => {
              const optId = selectedOptions[s.id] || s.chosen;
              return Boolean(routeResults[`${s.id}:${optId}`]);
            });
            const totalKm = plannedDaySegments.reduce((sum, s) => {
              const optId = selectedOptions[s.id] || s.chosen;
              const res = routeResults[`${s.id}:${optId}`];
              return sum + (res ? res.distance / 1000 : 0);
            }, 0);

            return (
              <div key={d} style={{ marginBottom: d < uniqueDays.length ? '16px' : '0' }}>
                <div className={`day-block-header ${activeDay === d ? 'active-day-block' : ''}`}>
                  <div className="day-badge-title">
                    <span className="day-tag">DAY {d}</span>
                    <span className="day-meta-text">{daySegments.length}段 · {plannedDaySegments.length === daySegments.length ? `${Math.round(totalKm)} km` : `已规划 ${plannedDaySegments.length}/${daySegments.length} 段`}</span>
                  </div>
                </div>
                {daySegments.map((seg) => renderSegmentItem(seg, globalCounter++))}

                {/* 住宿决策提示卡 (展示在第 1 天收车位置) */}
                {d === 1 && (
                  <div
                    id="sidebar-overnight-summary-card"
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      background: overnightStop ? '#f5f3ff' : '#f8fafc',
                      border: `1.5px solid ${overnightStop ? '#c7d2fe' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bed size={14} color={overnightStop ? '#4338ca' : '#64748b'} />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                          {overnightStop ? `今晚住宿 · ${overnightStop.name}` : '第一晚住宿: 随州市区 (默认)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        id="btn-sidebar-compare-modal"
                        onClick={() => setIsComparisonModalOpen(true)}
                        style={{
                          background: '#4338ca',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        方案比较
                      </button>
                    </div>
                    {overnightStop && (
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>抵达时间以路线测算为准</span>
                        <span style={{ color: '#4338ca', fontWeight: 700 }}>已选用</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* 底部保存与分享操作 */}
      <div className="sidebar-footer-actions">
        <button
          type="button"
          id="btn-footer-nav-plan"
          className="btn-sidebar-action"
          onClick={() => setIsNavigationPlanModalOpen(true)}
          style={{ background: '#059669', color: '#ffffff' }}
        >
          <Navigation size={14} />
          <span>全程导航</span>
        </button>
        <button
          type="button"
          id="btn-footer-compare-modal"
          className="btn-sidebar-action"
          onClick={() => setIsComparisonModalOpen(true)}
          style={{ background: '#4338ca', color: '#ffffff' }}
        >
          <Bed size={14} />
          <span>住宿比较</span>
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
          <span>分享</span>
        </button>
      </div>
    </aside>
  );
};
