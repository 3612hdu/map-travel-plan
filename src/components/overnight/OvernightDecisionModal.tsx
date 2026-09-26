import React from 'react';
import { X, Bed, Check, Sparkles, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { formatDuration } from '../../utils/geo';
import { OvernightStop } from '../../types/trip';
import { getOvernightMetrics } from '../../utils/overnightMetrics';

export const OvernightDecisionModal: React.FC = () => {
  const {
    isComparisonModalOpen,
    setIsComparisonModalOpen,
    overnightCandidates,
    overnightStop,
    setOvernightStop,
    removeOvernightCandidate,
    segments,
    selectedOptions,
    routeResults,
    dayStartTimes
  } = useTripStore();

  if (!isComparisonModalOpen) return null;

  const handleSelectCandidate = (candidate: OvernightStop) => {
    setOvernightStop(candidate);
  };

  const handleClearOvernight = () => {
    setOvernightStop(null);
  };

  const getTagBadgeStyle = (tag?: string) => {
    switch (tag) {
      case 'today_relaxed':
        return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
      case 'tomorrow_relaxed':
        return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
      case 'more_balanced':
      default:
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    }
  };

  return (
    <div
      className="overnight-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => setIsComparisonModalOpen(false)}
    >
      <div
        className="overnight-modal-container"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal 标题 */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: '#4338ca',
                color: '#ffffff',
                padding: '5px',
                borderRadius: '8px',
                display: 'flex'
              }}>
                <Bed size={18} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                湖北两日自驾 · 住宿位置决策比较
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 32px' }}>
              重点比较“住在哪个位置”对两日驾驶强度与节奏的影响。提前停车意味着什么，继续多开意味着什么。
            </p>
          </div>

          <button
            type="button"
            id="overnight-modal-close-btn"
            onClick={() => setIsComparisonModalOpen(false)}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 候选卡片列表 */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {overnightCandidates.length === 0 && <div>暂无住宿候选。请从当前高德酒店搜索结果中点击“对比”。</div>}
          {overnightCandidates.map((candidate) => {
            const isCurrentChosen = overnightStop?.id === candidate.id || overnightStop?.name === candidate.name;
            const metrics = getOvernightMetrics(candidate, overnightStop, segments, selectedOptions, routeResults, dayStartTimes);
            const badgeStyle = getTagBadgeStyle(metrics?.label === '今天更轻松' ? 'today_relaxed' : metrics?.label === '明天更轻松' ? 'tomorrow_relaxed' : 'more_balanced');
            const day1Ratio = metrics?.ratio ?? 50;

            return (
              <div
                key={candidate.id}
                id={`overnight-candidate-card-${candidate.id}`}
                className={`overnight-candidate-card ${isCurrentChosen ? 'chosen' : ''}`}
                style={{
                  border: isCurrentChosen ? '2px solid #4338ca' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: isCurrentChosen ? '#f5f3ff' : '#ffffff',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  boxShadow: isCurrentChosen ? '0 10px 25px -5px rgba(67, 56, 202, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {/* 候选卡头部 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#4338ca',
                      background: '#ede9fe',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {candidate.targetCityOrArea || candidate.city || '随州市'}
                    </span>

                    {/* 可解释决策标签 */}
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: badgeStyle.color,
                      background: badgeStyle.bg,
                      border: `1px solid ${badgeStyle.border}`,
                      padding: '2px 8px',
                      borderRadius: '99px'
                    }}>
                      {metrics?.label || '等待实路测算'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
                    {candidate.name}
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {candidate.address || '自驾走廊途经酒店'}
                  </div>
                </div>

                {/* 决策解释 */}
                <div style={{
                  fontSize: '11.5px',
                  color: '#475569',
                  background: isCurrentChosen ? '#ffffff' : '#f8fafc',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  lineHeight: 1.4,
                  border: '1px solid #f1f5f9'
                }}>
                  {candidate.source === 'amap-search' ? '候选来自当前高德酒店搜索。' : '候选由用户提供，酒店元数据未核验。'}{metrics ? '以下里程与时长来自当前实路。' : '选择后将测算两日实路。'}
                </div>

                {/* 今日与明日驾驶数据对比 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: isCurrentChosen ? '#ffffff' : '#f8fafc',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  {/* 今日 */}
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                      今天驾驶 (Day 1)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {metrics ? `${metrics.todayKm} km` : '等待路线数据'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '1px' }}>
                      {metrics ? formatDuration(metrics.todaySeconds) : '等待路线数据'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#4338ca', marginTop: '2px', fontWeight: 700 }}>
                      预计 {metrics ? `${metrics.eta} 抵达（仅含驾驶）` : '抵达时间待测算'}
                    </div>
                  </div>

                  {/* 明日 */}
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                      明日剩余 (Day 2)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {metrics ? `${metrics.tomorrowKm} km` : '等待路线数据'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '1px' }}>
                      {metrics ? formatDuration(metrics.tomorrowSeconds) : '等待路线数据'}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      终点: 郧阳区
                    </div>
                  </div>
                </div>

                {/* 两日节奏比例条 */}
                {metrics && <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>
                    <span>Day 1 ({day1Ratio}%)</span>
                    <span>Day 2 ({100 - day1Ratio}%)</span>
                  </div>
                  <div style={{ display: 'flex', height: '6px', borderRadius: '99px', overflow: 'hidden', background: '#e2e8f0' }}>
                    <div style={{ width: `${day1Ratio}%`, background: '#ea580c' }} />
                    <div style={{ width: `${100 - day1Ratio}%`, background: '#059669' }} />
                  </div>
                </div>}

                {/* 选用按钮 */}
                <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                  {isCurrentChosen ? (
                    <button
                      type="button"
                      disabled
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        background: '#4338ca',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: 'default'
                      }}
                    >
                      <Check size={14} />
                      <span>当前选用此方案</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-select-overnight"
                      onClick={() => handleSelectCandidate(candidate)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: '#4338ca',
                        border: '1.5px solid #4338ca',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>选用此住宿方案</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部恢复默认与关闭 */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {overnightStop ? (
            <button
              type="button"
              id="overnight-modal-clear-btn"
              onClick={handleClearOvernight}
              style={{
                background: 'transparent',
                color: '#dc2626',
                border: 'none',
                fontSize: '12px',
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} />
              <span>取消今晚住宿，恢复默认 Day 边界 (随州市区)</span>
            </button>
          ) : (
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              当前使用默认规划 (随州市区作为 Day 1 终点与 Day 2 起点)
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsComparisonModalOpen(false)}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
