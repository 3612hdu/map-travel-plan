import React from 'react';
import { Check, Star, GitCompare, Edit3 } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { formatDuration } from '../../utils/geo';
import { amapService } from '../../services/amapService';

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
          setRouteResult(resKey, res);
        } catch (e) {
          console.warn('方案算路失败:', e);
        }
      }
    }
    // 重新高亮路线并聚焦
    const map = amapService.getMap();
    if (map) {
      amapService.fitToSegment(currentSeg.id);
    }
  };

  return (
    <div className="route-options-grid">
      {currentSeg.options.map((opt) => {
        const isChosen = currentChosenOptionId === opt.id;
        const resKey = `${currentSeg.id}:${opt.id}`;
        const calcRes = routeResults[resKey];

        const isRecommend = opt.isRecommended;

        // 里程与时间（优先使用高德实际算路值）
        const kmText = calcRes
          ? `${(calcRes.distance / 1000).toFixed(0)} km`
          : opt.id === 'scenic'
          ? '136 km'
          : opt.id === 'compromise'
          ? '121 km'
          : '105 km';

        const timeText = calcRes
          ? formatDuration(calcRes.time)
          : opt.id === 'scenic'
          ? '3h08m'
          : opt.id === 'compromise'
          ? '2h43m'
          : '2h21m';

        const tollText = calcRes ? `¥${calcRes.tolls}` : '¥0';

        // 真实动态计算相对基准路线的增量（不再机械硬编码）
        let deltaText = '';
        if (opt.id !== baseOption.id) {
          if (calcRes && baseRes) {
            const kmDelta = (calcRes.distance - baseRes.distance) / 1000;
            const timeDeltaMin = Math.round((calcRes.time - baseRes.time) / 60);
            const kmSign = kmDelta >= 0 ? '+' : '';
            const timeSign = timeDeltaMin >= 0 ? '+' : '';
            deltaText = `${kmSign}${kmDelta.toFixed(0)} km · ${timeSign}${timeDeltaMin} min`;
          } else if (opt.comparisonNote) {
            deltaText = opt.comparisonNote;
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
