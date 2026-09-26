import React, { useMemo, useState } from 'react';
import { Bookmark, MapPin, Navigation, Camera, UtensilsCrossed, Bed } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { buildRouteRecommendations, RouteRecommendation } from '../../utils/recommendations';
import { amapService } from '../../services/amapService';
import { startAmapNavigation } from '../../services/navigationService';

export const RecommendationsPanel: React.FC<{ savedOnly?: boolean }> = ({ savedOnly = false }) => {
  const {
    segments, selectedOptions, activeDay, videos, savedRecommendationIds,
    toggleSavedRecommendation, favoritesPersisted, preference
  } = useTripStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'scenic' | 'town'>('all');
  const recommendations = useMemo(
    () => buildRouteRecommendations(segments, selectedOptions, savedOnly),
    [segments, selectedOptions, savedOnly]
  );
  const filtered = recommendations.filter((item) => {
    const matchesText = `${item.stop.name} ${item.segmentTitle}`.toLowerCase().includes(query.trim().toLowerCase());
    return (!savedOnly || savedRecommendationIds.includes(item.id))
      && (activeDay === 'all' || item.day === activeDay)
      && (category === 'all' || item.category === category) && matchesText;
  });

  const showPanel = (tab: 'map' | 'media' | 'facilities') => {
    if (window.matchMedia('(max-width: 1024px)').matches) useTripStore.getState().setMobileActiveTab(tab);
  };
  const viewMap = (item: RouteRecommendation) => {
    useTripStore.getState().enterSegmentDetail(item.segmentId);
    showPanel('map');
    window.setTimeout(() => amapService.showStop(item.stop), 100);
  };
  const viewMedia = (item: RouteRecommendation) => {
    const state = useTripStore.getState();
    state.enterSegmentDetail(item.segmentId);
    state.setActiveContentTab('videos');
    showPanel('media');
  };
  const viewFacilities = (item: RouteRecommendation, type: 'food' | 'hotel') => {
    const state = useTripStore.getState();
    state.setActiveSegment(item.segmentId);
    state.setSearchScope('segment');
    state.setSearchQuery('');
    state.setSelectedCategory(type);
    state.setActiveContentTab('facilities');
    showPanel('facilities');
  };

  return (
    <section className="recommendations-panel" aria-label={savedOnly ? '行程收藏' : '周边推荐'}>
      <div className="recommendations-intro">
        <h2>{savedOnly ? '收藏的停靠点' : '沿线停靠推荐'}</h2>
        <p>{savedOnly
          ? favoritesPersisted ? '收藏保存在当前浏览器，可随时回来查看。' : '浏览器未允许保存，收藏暂保留在本次访问中。'
          : '按当前路线整理沿线城镇与风景途经点，方便安排休息、补给与看景。'}</p>
      </div>
      <input className="recommendation-search" type="search" aria-label="搜索推荐地点" placeholder="搜索地点或路线" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="recommendation-filters" aria-label="推荐类型">
        {([['all', '全部'], ['scenic', '风景途经'], ['town', '城镇停靠']] as const).map(([key, label]) => (
          <button type="button" className={`filter-pill ${category === key ? 'active' : ''}`} key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>
        ))}
      </div>
      <div className="recommendation-count" role="status">{filtered.length} 个停靠参考点</div>
      {filtered.length === 0 && <p className="recommendation-empty">{savedOnly && savedRecommendationIds.length === 0
        ? '还没有收藏。到“周边推荐”点击收藏，即可在这里查看。'
        : '当前条件下没有地点，试试清空搜索、切换“全部”类型或“全程”。'}</p>}
      {filtered.map((item) => {
        const saved = savedRecommendationIds.includes(item.id);
        const photo = videos.find((media) => media.type === 'photo' && media.verificationStatus === 'verified'
          && media.coordinate?.[0] === item.stop.coord[0] && media.coordinate?.[1] === item.stop.coord[1]);
        return (
          <article className="recommendation-card" key={item.id} data-recommendation-id={item.id}>
            {photo?.cover && <figure className="recommendation-image">
              <img className="recommendation-cover" src={photo.cover} alt={photo.title} loading="lazy" />
              <figcaption>本路段参考影像</figcaption>
            </figure>}
            <div className="recommendation-card-body">
              <div className="recommendation-heading">
                <h3>{item.stop.name}</h3>
                <button type="button" className={`recommendation-save ${saved ? 'saved' : ''}`} aria-label={`${saved ? '取消收藏' : '收藏'}${item.stop.name}`} aria-pressed={saved} onClick={() => toggleSavedRecommendation(item.id)}>
                  <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="recommendation-meta">第 {item.day} 天 · {item.category === 'scenic' ? '风景途经镇' : '城镇停靠'}{!item.onSelectedRoute && ' · 备选途经点'}</div>
              <p>{item.reason}</p>
              <div className="recommendation-route">{item.segmentTitle}</div>
              <div className="recommendation-address">参考位置：{item.stop.address || item.stop.name}</div>
              <div className="recommendation-actions">
                <button type="button" onClick={() => viewMap(item)}><MapPin size={13} />地图定位</button>
                <button type="button" onClick={() => viewMedia(item)}><Camera size={13} />本段影像</button>
                <button type="button" onClick={() => viewFacilities(item, 'food')}><UtensilsCrossed size={13} />本段餐饮</button>
                <button type="button" onClick={() => viewFacilities(item, 'hotel')}><Bed size={13} />本段住宿</button>
                <button type="button" onClick={() => startAmapNavigation(item.stop, [], preference)}><Navigation size={13} />导航到参考点</button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
};
