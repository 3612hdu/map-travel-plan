import React, { useState } from 'react';
import { Clock, Navigation, MapPin, Coffee, Bed, Flag, Sparkles, ChevronDown, ChevronUp, Edit3, Check } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { generateTimelineItems } from '../../utils/timeline';
import { TimelineItem } from '../../types/trip';

interface TripTimelineProps {
  dayFilter?: number | 'all';
}

export const TripTimeline: React.FC<TripTimelineProps> = ({ dayFilter }) => {
  const {
    segments,
    selectedOptions,
    routeResults,
    customWaypoints,
    dayStartTimes,
    setDayStartTime,
    overnightStop,
    activeDay,
    setIsComparisonModalOpen
  } = useTripStore();

  const targetDay = dayFilter !== undefined ? dayFilter : activeDay;
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [tempTime, setTempTime] = useState(dayStartTimes[1] || '12:00');

  const timelineItems = generateTimelineItems(
    segments,
    selectedOptions,
    routeResults,
    customWaypoints,
    dayStartTimes,
    overnightStop,
    targetDay
  );

  const handleTimeSubmit = () => {
    if (tempTime) {
      setDayStartTime(1, tempTime);
    }
    setIsEditingTime(false);
  };

  const renderItemIcon = (item: TimelineItem) => {
    switch (item.type) {
      case 'departure':
        return <Navigation size={13} className="text-blue-500" />;
      case 'overnight':
        return <Bed size={14} className="text-indigo-600" />;
      case 'rest':
        return <Coffee size={12} className="text-amber-500" />;
      case 'waypoint':
        return <MapPin size={12} className="text-emerald-500" />;
      case 'segmentEnd':
        return item.id.includes('finish') ? (
          <Flag size={13} className="text-red-500" />
        ) : (
          <MapPin size={13} className="text-slate-500" />
        );
      default:
        return <MapPin size={12} className="text-slate-400" />;
    }
  };

  return (
    <div className="trip-timeline-container" style={{
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      padding: '12px 14px',
      margin: '8px 0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
    }}>
      {/* 头部：出发时间设置与状态 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '10px',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={15} color="#2563eb" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
            行程时间轴
          </span>
          <span style={{
            fontSize: '11px',
            color: '#64748b',
            background: '#f1f5f9',
            padding: '1px 6px',
            borderRadius: '4px'
          }}>
            {targetDay === 'all' ? '全程 2 天' : `DAY ${targetDay}`}
          </span>
        </div>

        {/* 出发时间调节 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {targetDay === 2 ? 'Day 2' : 'Day 1'}出发:
          </span>
          {isEditingTime ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                id="timeline-departure-time-input"
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                style={{
                  padding: '2px 5px',
                  fontSize: '11.5px',
                  borderRadius: '4px',
                  border: '1px solid #2563eb',
                  fontWeight: 700
                }}
              />
              <button
                type="button"
                id="timeline-departure-time-save"
                onClick={handleTimeSubmit}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="timeline-departure-time-btn"
              onClick={() => {
                setTempTime(dayStartTimes[targetDay === 2 ? 2 : 1] || '12:00');
                setIsEditingTime(true);
              }}
              style={{
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="点击调整出发时间，所有节点自动推算"
            >
              <span>{dayStartTimes[targetDay === 2 ? 2 : 1] || (targetDay === 2 ? '09:00' : '12:00')}</span>
              <Edit3 size={10} />
            </button>
          )}
        </div>
      </div>

      {/* 时间轴节点流 */}
      <div style={{ position: 'relative', paddingLeft: '8px' }}>
        {/* 贯穿垂直连接线 */}
        <div style={{
          position: 'absolute',
          left: '19px',
          top: '8px',
          bottom: '12px',
          width: '2px',
          background: '#e2e8f0',
          zIndex: 1
        }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {timelineItems.map((item) => {
            const isOvernight = item.type === 'overnight';
            const isPending = item.isPendingRoute;

            return (
              <div
                key={item.id}
                className={`timeline-item-row ${isOvernight ? 'timeline-overnight-node' : ''}`}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  background: isOvernight ? '#f5f3ff' : 'transparent',
                  padding: isOvernight ? '8px 10px' : '2px 0',
                  borderRadius: isOvernight ? '8px' : '0',
                  border: isOvernight ? '1px solid #ddd6fe' : 'none'
                }}
              >
                {/* 节点图标 */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isOvernight ? '#4338ca' : '#ffffff',
                  color: isOvernight ? '#ffffff' : '#0f172a',
                  border: `2px solid ${isOvernight ? '#4338ca' : '#cbd5e1'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                  {renderItemIcon(item)}
                </div>

                {/* 时间与内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* 时间标记 */}
                    <span
                      className="timeline-time-badge"
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: isPending ? '#d97706' : isOvernight ? '#4338ca' : '#1e293b',
                        background: isPending ? '#fef3c7' : isOvernight ? '#ede9fe' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.plannedTime}
                    </span>

                    {/* 节点标题 */}
                    <span
                      className="timeline-node-title"
                      style={{
                        fontSize: '12.5px',
                        fontWeight: isOvernight ? 800 : 700,
                        color: isOvernight ? '#4338ca' : '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.title}
                    </span>
                  </div>

                  {/* 副标题与说明 */}
                  {item.subTitle && (
                    <div style={{
                      fontSize: '11px',
                      color: '#64748b',
                      marginTop: '2px',
                      lineHeight: 1.3
                    }}>
                      {item.subTitle}
                    </div>
                  )}

                  {/* 住宿卡片特殊操作：决策比较按钮 */}
                  {isOvernight && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <button
                        type="button"
                        id="timeline-btn-compare-modal"
                        onClick={() => setIsComparisonModalOpen(true)}
                        style={{
                          background: '#4338ca',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 3px rgba(67, 56, 202, 0.3)'
                        }}
                      >
                        <Sparkles size={11} />
                        <span>🏨 住宿方案比较</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
