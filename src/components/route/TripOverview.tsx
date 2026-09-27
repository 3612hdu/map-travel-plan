import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { verifiedStops } from '../../data/stops';
import { formatDuration } from '../../utils/geo';

export const TripOverview: React.FC = () => {
  const {
    trip, segments, activeDay, mapMode, selectedOptions, routeResults,
    dayStartTimes, overnightStop, preference, setActiveSegment,
    setIsNavigationPlanModalOpen,
  } = useTripStore();
  const isFullTrip = mapMode === 'trip-overview';
  const visibleSegments = isFullTrip ? segments : segments.filter((seg) => seg.day === activeDay);
  const firstSegment = visibleSegments[0];
  const lastSegment = visibleSegments[visibleSegments.length - 1];
  const scopeTitle = isFullTrip ? trip.title : firstSegment && lastSegment
    ? `${firstSegment.customStartName || verifiedStops[firstSegment.start]?.name} → ${lastSegment.customEndName || verifiedStops[lastSegment.end]?.name}`
    : '暂无路段';
  const days = [...new Set(visibleSegments.map((seg) => seg.day))].sort((a, b) => a - b);
  const results = visibleSegments.flatMap((seg) => {
    const result = routeResults[`${seg.id}:${selectedOptions[seg.id] || seg.chosen}`];
    return result && result.distance > 0 ? [result] : [];
  });
  const isComplete = visibleSegments.length > 0 && results.length === visibleSegments.length;
  const totals = results.reduce((sum, result) => ({
    distance: sum.distance + result.distance,
    time: sum.time + result.time,
    tolls: sum.tolls + (result.tolls || 0),
  }), { distance: 0, time: 0, tolls: 0 });
  const pending = '待算路完成';
  const preferences = [
    preference.avoidHighway && '不走高速',
    preference.avoidToll && '少收费',
    preference.avoidCongestion && '躲避拥堵',
  ].filter(Boolean);

  return (
    <section className="trip-overview" aria-label={isFullTrip ? '全程基本信息' : `第${activeDay}天基本信息`}>
      <div className="segment-active-header trip-overview-header">
        <div>
          <h2 className="segment-name-highlight">
            <MapPin size={17} color="#1875ff" />
            <span>{isFullTrip ? '全程概览' : `第${activeDay}天概览`}</span>
          </h2>
          <p className="trip-overview-route">{scopeTitle}</p>
          <p className="segment-sub-desc">{trip.dateRange}{preferences.length > 0 && ` · ${preferences.join(' · ')}`}</p>
        </div>
        <button type="button" id="btn-start-nav-plan" className="trip-overview-nav"
          onClick={() => setIsNavigationPlanModalOpen(true)}>
          <Navigation size={14} />开始导航计划
        </button>
      </div>

      <dl className="trip-overview-stats">
        <div><dt>行程安排</dt><dd>{days.length} 天 · {visibleSegments.length} 段</dd></div>
        <div><dt>{isFullTrip ? '全程总里程' : '当天总里程'}</dt><dd>{isComplete ? `${Math.round(totals.distance / 1000)} km` : pending}</dd></div>
        <div><dt>预计驾驶</dt><dd>{isComplete ? formatDuration(totals.time) : pending}</dd></div>
        <div><dt>预估收费</dt><dd>{isComplete ? `¥${Math.round(totals.tolls)}` : pending}</dd></div>
      </dl>
      <p className="trip-overview-note" role="status">
        {isComplete ? '按各段已选路线汇总，驾驶时间不含停留与休息。' : `已完成 ${results.length}/${visibleSegments.length} 段算路，完成后显示总里程、驾驶时间和收费。`}
      </p>

      <div className="trip-overview-days">
        {days.map((day) => {
          const daySegments = visibleSegments.filter((seg) => seg.day === day);
          const first = daySegments[0];
          const last = daySegments[daySegments.length - 1];
          const start = first.customStartName || verifiedStops[first.start]?.name;
          const end = last.customEndName || verifiedStops[last.end]?.name;
          return (
            <div className="trip-overview-day" key={day}>
              <div className="trip-overview-day-heading">
                <strong>第 {day} 天</strong>
                <span>{dayStartTimes[day] ? `${dayStartTimes[day]} 出发 · ` : ''}{daySegments.length} 段</span>
              </div>
              <p className="trip-overview-day-route">{start} → {end}</p>
              <div className="trip-overview-segments">
                {daySegments.map((seg) => (
                  <button type="button" key={seg.id} onClick={() => setActiveSegment(seg.id)}
                    aria-label={`查看路段：${seg.title}`}>
                    {seg.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="trip-overview-note">
        {overnightStop ? `住宿：第 ${overnightStop.day} 晚 · ${overnightStop.name}` : '住宿待定，可在行程规划中选择。'}
        {' '}点击路段查看路线方案与沿途亮点。
      </p>
    </section>
  );
};
