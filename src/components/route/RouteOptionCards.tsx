import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { formatDuration } from '../../utils/geo';
import { amapService } from '../../services/amapService';
import { compareRouteResults } from '../../utils/routeComparison';

export const RouteOptionCards: React.FC = () => {
  const {
    segments,
    activeSegmentId,
    selectedOptions,
    selectRouteOption,
    routeResults,
    setRouteResult,
    customWaypoints,
    preference
  } = useTripStore();

  const currentSeg = segments.find((s) => s.id === activeSegmentId);
  const currentWaypoints = currentSeg ? customWaypoints[currentSeg.id] || [] : [];

  // 途经点变化会清除本段所有旧方案；重新计算三张卡片，保持比较数据一致。
  useEffect(() => {
    if (!currentSeg) return;
    let cancelled = false;
    const waypointIds = currentWaypoints.map((stop) => stop.id).join('|');

    const refreshOptions = async () => {
      for (const opt of currentSeg.options) {
        if (cancelled) return;
        const key = `${currentSeg.id}:${opt.id}`;
        if (useTripStore.getState().routeResults[key]) continue;
        try {
          const res = await amapService.planSegment(currentSeg, opt, currentWaypoints, preference);
          if (cancelled) return;
          const latest = useTripStore.getState();
          const latestSeg = latest.segments.find((seg) => seg.id === currentSeg.id);
          const sameEndpoints = latestSeg?.customStartCoord?.join(',') === currentSeg.customStartCoord?.join(',')
            && latestSeg?.customEndCoord?.join(',') === currentSeg.customEndCoord?.join(',');
          if (latestSeg && sameEndpoints
            && (latest.customWaypoints[currentSeg.id] || []).map((stop) => stop.id).join('|') === waypointIds
            && latest.preference === preference) {
            latest.setRouteResult(key, res);
          }
        } catch (error) {
          console.warn(`方案 ${currentSeg.id}:${opt.id} 算路失败:`, error);
        }
      }
    };

    refreshOptions();
    return () => { cancelled = true; };
  }, [currentSeg, customWaypoints, preference]);

  if (!currentSeg) return null;

  const currentChosenOptionId =
    selectedOptions[currentSeg.id] || currentSeg.chosen;

  const baseOption =
    currentSeg.options.find((o) => o.id === 'direct' || o.id === 'main') ||
    currentSeg.options[0];
  const baseResKey = `${currentSeg.id}:${baseOption.id}`;
  const baseRes = routeResults[baseResKey];

  const handleChooseOption = async (optionId: string) => {
    selectRouteOption(currentSeg.id, optionId);
    const resKey = `${currentSeg.id}:${optionId}`;
    if (!routeResults[resKey]) {
      const opt = currentSeg.options.find((o) => o.id === optionId);
      if (opt) {
        try {
          const res = await amapService.planSegment(
            currentSeg,
            opt,
            customWaypoints[currentSeg.id] || [],
            preference
          );
          const latest = useTripStore.getState();
          const latestSeg = latest.segments.find((seg) => seg.id === currentSeg.id);
          const sameEndpoints = latestSeg?.customStartCoord?.join(',') === currentSeg.customStartCoord?.join(',')
            && latestSeg?.customEndCoord?.join(',') === currentSeg.customEndCoord?.join(',');
          const sameWaypoints = (latest.customWaypoints[currentSeg.id] || []).map((stop) => stop.id).join('|')
            === (customWaypoints[currentSeg.id] || []).map((stop) => stop.id).join('|');
          if (latestSeg && sameEndpoints && sameWaypoints && latest.preference === preference) setRouteResult(resKey, res);
        } catch (e) {
          console.warn('方案算路失败:', e);
        }
      }
    }
  };

  return (
    <div className="route-options-grid">
      {currentSeg.options.map((opt) => {
        const isChosen = currentChosenOptionId === opt.id;
        const resKey = `${currentSeg.id}:${opt.id}`;
        const calcRes = routeResults[resKey];

        const isRecommend = opt.isRecommended;

        const kmText = calcRes ? `${(calcRes.distance / 1000).toFixed(0)} km` : '计算中…';
        const timeText = calcRes ? formatDuration(calcRes.time) : '计算中…';
        const tollText = calcRes ? `¥${calcRes.tolls}` : '计算中…';
        const overlappingOptions = calcRes
          ? currentSeg.options.filter((other) => {
              if (other.id === opt.id) return false;
              const otherRes = routeResults[`${currentSeg.id}:${other.id}`];
              return otherRes && compareRouteResults(calcRes, otherRes).basicallySame;
            })
          : [];

        // 真实动态计算相对基准路线的增量（不再机械硬编码）
        let deltaText = '';
        if (opt.id !== baseOption.id) {
          if (calcRes && baseRes) {
            const kmDelta = (calcRes.distance - baseRes.distance) / 1000;
            const timeDeltaMin = Math.round((calcRes.time - baseRes.time) / 60);
            const kmSign = kmDelta >= 0 ? '+' : '';
            const timeSign = timeDeltaMin >= 0 ? '+' : '';
            deltaText = `${kmSign}${kmDelta.toFixed(0)} km · ${timeSign}${timeDeltaMin} min`;
          }
        }

        return (
          <div
            key={opt.id}
            className={`route-option-card ${isChosen ? 'chosen' : ''} ${
              isRecommend ? 'recommended-card' : ''
            }`}
          >
            <div>
              <div className="option-head">
                <div className="option-title">
                  <span>{opt.name}</span>
                  {isRecommend && (
                    <span className="tag-mini-recommend">★ 推荐</span>
                  )}
                </div>
              </div>

              <div className="option-metrics">
                <span>
                  {kmText} · {timeText} · {tollText}
                </span>
                {deltaText && (
                  <span className="option-delta">{deltaText}</span>
                )}
              </div>

              <div className="option-feature-pills">
                {opt.features.map((feat, idx) => (
                  <span key={idx} className="feature-pill">
                    {feat}
                  </span>
                ))}
              </div>

              <p className="option-desc">{opt.desc}</p>
              {overlappingOptions.length > 0 && (
                <p className="option-overlap-warning">当前与「{overlappingOptions.map((other) => other.name).join('、')}」的实际道路基本一致，请按里程与耗时选择。</p>
              )}
            </div>

            <div className="option-actions">
              <button
                type="button"
                className={`btn-opt-select ${
                  isChosen
                    ? isRecommend
                      ? 'active'
                      : 'primary-active'
                    : ''
                }`}
                onClick={() => handleChooseOption(opt.id)}
              >
                {isChosen ? (
                  <>
                    <Check size={14} />
                    <span>已选择此路线</span>
                  </>
                ) : (
                  <span>选择此路线</span>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
