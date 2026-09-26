import React from 'react';
import { Navigation, Sun } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { CorridorSearchBox } from '../search/CorridorSearchBox';
import { formatDuration } from '../../utils/geo';

export const Header: React.FC = () => {
  const { segments, selectedOptions, routeResults } = useTripStore();

  // 聚合所有已选路线的高德实时算路数据
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalTolls = 0;
  let plannedCount = 0;

  segments.forEach((seg) => {
    const optId = selectedOptions[seg.id] || seg.chosen;
    const res = routeResults[`${seg.id}:${optId}`];
    if (res && res.distance > 0) {
      totalDistanceMeters += res.distance;
      totalDurationSeconds += res.time;
      totalTolls += res.tolls || 0;
      plannedCount++;
    }
  });

  const isAllPlanned = plannedCount === segments.length;

  const displayDistance =
    totalDistanceMeters > 0
      ? `${(totalDistanceMeters / 1000).toFixed(0)} km`
      : '计算中…';

  const displayDuration =
    totalDurationSeconds > 0
      ? formatDuration(totalDurationSeconds)
      : '计算中…';

  const displayToll = totalDistanceMeters > 0 ? `¥${totalTolls.toFixed(0)}` : '¥0';
  const scenicSeg = segments.find((seg) => seg.id === 's6');
  const scenicOptId = scenicSeg ? (selectedOptions[scenicSeg.id] || scenicSeg.chosen) : '';
  const scenicRes = scenicSeg ? routeResults[`${scenicSeg.id}:${scenicOptId}`] : undefined;

  return (
    <header className="app-header">
      {/* 左侧品牌 */}
      <div className="header-brand">
        <div className="brand-icon-wrapper">
          <Navigation size={20} strokeWidth={2.4} />
        </div>
        <div>
          <div className="brand-title">
            <span>可交互自驾路线规划器</span>
            <span className="brand-badge">v2</span>
          </div>
          <div className="brand-sub">
            黄冈师范学院 → 郧阳区 · 两天自驾 · 不走高速 · 少收费 · 风景优先
          </div>
        </div>
      </div>

      {/* 顶部路线走廊搜索框 (对齐图 03) */}
      <CorridorSearchBox />

      {/* 右侧统计信息与真实状态 */}
      <div className="header-stats">
        <div className="stat-item">
          <span className="stat-label">
            {isAllPlanned ? '全程实路总里程' : `已规划 (${plannedCount}/${segments.length}段)`}
          </span>
          <span className="stat-val">{displayDistance}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">预计驾驶</span>
          <span className="stat-val">{displayDuration}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">预估收费</span>
          <span className="stat-val">{displayToll}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">风景路段</span>
          <span className="stat-val scenic-val">{scenicRes ? `${(scenicRes.distance / 1000).toFixed(0)} km` : '计算中…'}</span>
        </div>

        <div className="header-banner-badge">
          <Sun size={14} color="#eab308" />
          <span>一路山水 两天刚好</span>
        </div>
      </div>
    </header>
  );
};
