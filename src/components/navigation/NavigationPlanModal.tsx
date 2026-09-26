import React, { useState } from 'react';
import { X, Navigation, CheckCircle2, ChevronRight, MapPin, ArrowRight, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { buildTripNavigationPlan } from '../../utils/navigationPlan';
import { startLegNavigation } from '../../services/navigationService';
import { formatDistance, formatDuration } from '../../utils/geo';
import { NavigationLeg } from '../../types/navigationPlan';

interface NavigationPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLegIndex?: number;
}

export const NavigationPlanModal: React.FC<NavigationPlanModalProps> = ({
  isOpen,
  onClose,
  initialLegIndex = 0
}) => {
  const { segments, selectedOptions, routeResults, customWaypoints, preference } = useTripStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'step'>('overview');
  const [currentLegIndex, setCurrentLegIndex] = useState(initialLegIndex);
  const [completedLegIndices, setCompletedLegIndices] = useState<number[]>([]);

  if (!isOpen) return null;

  const plan = buildTripNavigationPlan(
    segments,
    selectedOptions,
    routeResults,
    customWaypoints,
    preference
  );

  const legs = plan.legs;
  const currentLeg: NavigationLeg | undefined = legs[currentLegIndex] || legs[0];
  const nextLeg: NavigationLeg | undefined = legs[currentLegIndex + 1];
  const prevLeg: NavigationLeg | undefined = legs[currentLegIndex - 1];

  const handleStartLeg = (leg: NavigationLeg) => {
    startLegNavigation(leg, preference);
  };

  const handleCompleteCurrentAndNext = () => {
    if (!completedLegIndices.includes(currentLegIndex)) {
      setCompletedLegIndices([...completedLegIndices, currentLegIndex]);
    }
    if (nextLeg) {
      setCurrentLegIndex(currentLegIndex + 1);
    }
  };

  const isCurrentCompleted = completedLegIndices.includes(currentLegIndex);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="全程自驾接力导航计划">
      <div
        className="modal-content-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '92vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.22)'
        }}
      >
        {/* 顶部标题栏 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Navigation size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.01em' }}>
                全程自驾接力导航计划
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                {plan.totalDays} 天行程 · 共 {legs.length} 段 · 总计 {formatDistance(plan.totalDistanceMeters)} · 预估驾驶 {formatDuration(plan.totalDurationSeconds)}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            style={{ color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="关闭导航计划"
          >
            <X size={20} />
          </button>
        </div>

        {/* 真实导航机制诚实说明条 (不伪装一键全线) */}
        <div
          style={{
            padding: '8px 16px',
            background: '#ecfdf5',
            borderBottom: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#065f46'
          }}
        >
          <ShieldAlert size={15} color="#059669" />
          <span>
            高德官方网页与 URI 协议限制单次调起多日多途经点。我们已为您编排 <strong>{legs.length} 段无缝接力导航</strong>，每跑完一段可一键开启下一段，确保方案与途经点 100% 准确执行。
          </span>
        </div>

        {/* 导航面板 Tab 切换 */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '4px 16px 0 16px'
          }}
        >
          <button
            type="button"
            id="tab-nav-overview"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: activeTab === 'overview' ? 700 : 500,
              color: activeTab === 'overview' ? '#059669' : '#64748b',
              borderBottom: activeTab === 'overview' ? '2.5px solid #059669' : '2.5px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            全程路线确认 ({legs.length}段)
          </button>
          <button
            type="button"
            id="tab-nav-step"
            onClick={() => setActiveTab('step')}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: activeTab === 'step' ? 700 : 500,
              color: activeTab === 'step' ? '#059669' : '#64748b',
              borderBottom: activeTab === 'step' ? '2.5px solid #059669' : '2.5px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            分段自驾接力导航 ({currentLegIndex + 1}/{legs.length})
          </button>
        </div>

        {/* 主体滚动区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'overview' ? (
            /* ========================================================
               TAB 1: 全程路线确认视图
               ======================================================== */
            <div>
              {/* 全程汇总统计卡 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>全程总里程</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {formatDistance(plan.totalDistanceMeters)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>预计总耗时</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {formatDuration(plan.totalDurationSeconds)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>预估路桥费</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    ¥{plan.totalTolls.toFixed(0)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>自驾节奏</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {plan.totalDays}天 · 不走高速
                  </div>
                </div>
              </div>

              {/* 逐段路线清单 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {legs.map((leg, idx) => {
                  const isFinished = completedLegIndices.includes(idx);
                  const isCurrent = currentLegIndex === idx;

                  return (
                    <div
                      key={leg.segmentId}
                      style={{
                        padding: '12px 14px',
                        background: isCurrent ? '#f0fdf4' : '#ffffff',
                        border: `1.5px solid ${isCurrent ? '#059669' : '#e2e8f0'}`,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isFinished ? '#059669' : isCurrent ? '#0284c7' : '#e2e8f0',
                            color: isFinished || isCurrent ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800
                          }}
                        >
                          {isFinished ? <CheckCircle2 size={16} /> : idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10.5px', background: leg.day === 1 ? '#ffedd5' : '#dcfce7', color: leg.day === 1 ? '#c2410c' : '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                              DAY {leg.day}
                            </span>
                            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                              {leg.title}
                            </span>
                            {leg.segmentId === 's6' && (
                              <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Sparkles size={10} /> 环库风景
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>方案: <strong>{leg.chosenOption.name}</strong></span>
                            <span>·</span>
                            <span>{formatDistance(leg.distanceMeters)}</span>
                            <span>·</span>
                            <span>{formatDuration(leg.durationSeconds)}</span>
                            {leg.orderedWaypoints.length > 0 && (
                              <>
                                <span>·</span>
                                <span style={{ color: '#0369a1' }}>
                                  途经: {leg.orderedWaypoints.map((w) => w.name).join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-leg-nav"
                          onClick={() => {
                            setCurrentLegIndex(idx);
                            setActiveTab('step');
                            handleStartLeg(leg);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Navigation size={12} />
                          <span>导航此段</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 底部启动接力导航按钮 */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  id="btn-start-relay-plan"
                  onClick={() => {
                    setActiveTab('step');
                    setCurrentLegIndex(0);
                    if (legs[0]) handleStartLeg(legs[0]);
                  }}
                  style={{
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 20px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.35)'
                  }}
                >
                  <Navigation size={15} />
                  <span>按顺序开始接力导航 (从第 1 段出发)</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================
               TAB 2: 分段自驾接力导航执行器
               ======================================================== */
            currentLeg && (
              <div>
                {/* 进度指示条 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                    当前: 第 {currentLegIndex + 1} / {legs.length} 段
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {legs.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentLegIndex(idx)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: 'none',
                          background: idx === currentLegIndex ? '#059669' : completedLegIndices.includes(idx) ? '#a7f3d0' : '#e2e8f0',
                          color: idx === currentLegIndex ? '#ffffff' : '#0f172a',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 当前段醒目执行卡片 */}
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '2px solid #059669',
                    borderRadius: '14px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                        DAY {currentLeg.day}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#064e3b' }}>
                        {currentLeg.title}
                      </h3>
                    </div>
                    {isCurrentCompleted && (
                      <span style={{ background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={12} /> 已完成本段
                      </span>
                    )}
                  </div>

                  {/* 起终点与途经路线 */}
                  <div style={{ marginTop: '14px', background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#059669', fontWeight: 800 }}>起点:</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentLeg.startStop.name}</span>
                      <ArrowRight size={14} color="#64748b" />
                      <span style={{ color: '#dc2626', fontWeight: 800 }}>终点:</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentLeg.endStop.name}</span>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569', display: 'flex', gap: '14px' }}>
                      <span>方案: <strong style={{ color: '#059669' }}>{currentLeg.chosenOption.name}</strong></span>
                      <span>实路里程: <strong>{formatDistance(currentLeg.distanceMeters)}</strong></span>
                      <span>预估耗时: <strong>{formatDuration(currentLeg.durationSeconds)}</strong></span>
                    </div>

                    {currentLeg.orderedWaypoints.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px' }}>
                        📍 途经控制点: {currentLeg.orderedWaypoints.map((w) => w.name).join(' → ')}
                      </div>
                    )}
                  </div>

                  {/* 大操作按钮：在高德开始当前段导航 */}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      id="btn-nav-current-amap"
                      onClick={() => handleStartLeg(currentLeg)}
                      style={{
                        flex: 1,
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 18px',
                        fontSize: '14px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.35)'
                      }}
                    >
                      <Navigation size={16} />
                      <span>在高德开始第 {currentLegIndex + 1} 段导航</span>
                    </button>
                  </div>
                </div>

                {/* 下一步与接力操作 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                  <button
                    type="button"
                    disabled={!prevLeg}
                    onClick={() => prevLeg && setCurrentLegIndex(currentLegIndex - 1)}
                    style={{
                      background: prevLeg ? '#f1f5f9' : '#f8fafc',
                      color: prevLeg ? '#0f172a' : '#cbd5e1',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: prevLeg ? 'pointer' : 'not-allowed'
                    }}
                  >
                    ← 返回上一段
                  </button>

                  {nextLeg ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>下一段预告</div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                          第 {currentLegIndex + 2} 段 · {nextLeg.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        id="btn-nav-next-leg"
                        onClick={() => {
                          handleCompleteCurrentAndNext();
                        }}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '9px 16px',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>导航下一段</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#059669', fontWeight: 800 }}>
                        🎉 已是最后一段，抵达终点：{currentLeg.endStop.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!completedLegIndices.includes(currentLegIndex)) {
                            setCompletedLegIndices([...completedLegIndices, currentLegIndex]);
                          }
                          onClose();
                        }}
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '9px 16px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        完成全程导航计划
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
