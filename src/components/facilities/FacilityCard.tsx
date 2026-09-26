import React from 'react';
import { Bed, Fuel, Zap, UtensilsCrossed, Bath, SquareParking, Star, Plus, Check } from 'lucide-react';
import { RoutePoi } from '../../types/poi';
import { useTripStore } from '../../store/useTripStore';
import { amapService } from '../../services/amapService';

interface FacilityCardProps {
  poi: RoutePoi;
  isSelected: boolean;
  onSelect: () => void;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({ poi, isSelected, onSelect }) => {
  const {
    activeSegmentId,
    customWaypoints,
    addWaypoint,
    removeWaypoint,
    segments,
    selectedOptions,
    setRouteResult,
    setActiveSegment,
    preference
  } = useTripStore();

  const targetSegId = poi.sourceSegmentId || activeSegmentId;
  const targetSeg = segments.find((s) => s.id === targetSegId) || segments.find((s) => s.id === activeSegmentId);
  const waypoints = customWaypoints[targetSegId] || [];
  const isAlreadyAdded = waypoints.some((w) => w.id === poi.id || w.name === poi.name);

  // 分类图标
  const renderCategoryIcon = () => {
    switch (poi.category) {
      case 'hotel':
        return <Bed size={15} />;
      case 'gas':
        return <Fuel size={15} />;
      case 'ev':
        return <Zap size={15} />;
      case 'food':
        return <UtensilsCrossed size={15} />;
      case 'toilet':
        return <Bath size={15} />;
      case 'parking':
        return <SquareParking size={15} />;
      default:
        return <Bed size={15} />;
    }
  };

  const handleToggleWaypoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!targetSeg) return;

    if (isAlreadyAdded) {
      removeWaypoint(targetSeg.id, poi.id);
      const remainingWaypoints = waypoints.filter((w) => w.id !== poi.id && w.name !== poi.name);
      const opt =
        targetSeg.options.find(
          (o) => o.id === (selectedOptions[targetSeg.id] || targetSeg.chosen)
        ) || targetSeg.options[0];

      amapService
        .planSegment(targetSeg, opt, remainingWaypoints, preference)
        .then((res) => {
          setRouteResult(`${targetSeg.id}:${opt.id}`, res);
        });
    } else {
      const detectedCity = poi.address.match(/(.+?[市区县])/)?.[1] || targetSeg.title.split('→')[1]?.trim() || '湖北';
      const stop = {
        id: poi.id,
        name: poi.name,
        coord: poi.coord,
        poi: poi.poiId || '',
        city: detectedCity,
        address: poi.address
      };
      addWaypoint(targetSeg.id, stop);

      // 重新触发高德实时算路
      const opt =
        targetSeg.options.find(
          (o) => o.id === (selectedOptions[targetSeg.id] || targetSeg.chosen)
        ) || targetSeg.options[0];

      amapService
        .planSegment(targetSeg, opt, [...waypoints, stop], preference)
        .then((res) => {
          setRouteResult(`${targetSeg.id}:${opt.id}`, res);
        });
    }
  };

  const handleCardClick = () => {
    onSelect();
    if (targetSeg && targetSeg.id !== activeSegmentId) {
      setActiveSegment(targetSeg.id);
    }
    amapService.panTo(poi.coord, 14);
    amapService.openPoiInfoWindow(poi, () => {
      if (targetSeg) {
        handleToggleWaypoint({ stopPropagation: () => {} } as any);
      }
    });
  };

  return (
    <div
      id={`facility-card-${poi.id}`}
      className={`facility-card-item ${isSelected ? 'selected' : ''}`}
      onClick={handleCardClick}
    >
      <div className="facility-head">
        <div className="facility-title-box">
          <div className={`facility-cat-icon ${poi.category}`}>
            {renderCategoryIcon()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="facility-name">{poi.name}</div>
              {poi.sourceSegmentTitle && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#4338ca',
                    background: '#e0e7ff',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {poi.sourceSegmentTitle}
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {poi.address || poi.status}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="facility-distance-badge" style={{
            background: poi.distanceToRoute <= 1.0 ? '#ecfdf5' : '#eff6ff',
            color: poi.distanceToRoute <= 1.0 ? '#059669' : '#1d4ed8',
            borderColor: poi.distanceToRoute <= 1.0 ? '#a7f3d0' : '#bfdbfe'
          }}>
            距路线 {poi.distanceToRoute} km
          </div>
          {poi.detourDistance != null && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
              预计绕行 +{poi.detourDistance} km
            </div>
          )}
        </div>
      </div>

      <div className="facility-details-row">
        {poi.rating && (
          <span className="rating-star">
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span>{poi.rating}</span>
            {poi.reviewCount && <span>({poi.reviewCount}条评价)</span>}
          </span>
        )}
        {poi.status && <span>{poi.status}</span>}
      </div>

      <div className="facility-card-bottom">
        <div className="facility-tags">
          {poi.distanceToRoute <= 1.0 && (
            <span
              className="feature-pill"
              style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}
            >
              ★ 极度顺路
            </span>
          )}
          {(poi.tags || []).slice(0, 3).map((tag, idx) => (
            <span key={idx} className="feature-pill">
              {tag}
            </span>
          ))}
        </div>

        <div className="btn-group-facility">
          <button
            type="button"
            className={`btn-facility-action ${isAlreadyAdded ? 'primary' : 'secondary'}`}
            onClick={handleToggleWaypoint}
            title={isAlreadyAdded ? '点击取消加入途经点' : '把该地点加入自驾路线中重算'}
          >
            {isAlreadyAdded ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Check size={12} />
                <span>已加入停靠点</span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Plus size={12} />
                <span>加入停靠点</span>
              </span>
            )}
          </button>

          <a
            href={`https://uri.amap.com/marker?position=${poi.coord.join(',')}&name=${encodeURIComponent(poi.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-facility-action secondary"
            onClick={(e) => e.stopPropagation()}
            style={{ textDecoration: 'none' }}
          >
            高德详情 ↗
          </a>
        </div>
      </div>
    </div>
  );
};
