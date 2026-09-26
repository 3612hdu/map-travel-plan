import React, { useEffect, useRef, useState } from 'react';
import { Camera, Video } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { RouteMedia, MediaPlatform, MediaType } from '../../types/media';
import { amapService } from '../../services/amapService';
import { VideoModal } from './VideoModal';

export const VideoTab: React.FC = () => {
  const { videos, activeSegmentId, activeDay, selectedOptions, segments, mapMode, activeHighlightId, focusHighlight } = useTripStore();
  const [selectedPlatform, setSelectedPlatform] = useState<MediaPlatform>('all');
  const [selectedType, setSelectedType] = useState<MediaType>('all');
  const [activeModalVideo, setActiveModalVideo] = useState<RouteMedia | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const segment = segments.find((item) => item.id === activeSegmentId);
  const optionId = selectedOptions[activeSegmentId] || segment?.chosen;

  useEffect(() => {
    setSelectedPlatform('all');
    setSelectedType('all');
  }, [activeSegmentId, optionId, activeHighlightId, mapMode, activeDay]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeSegmentId, optionId, activeHighlightId, mapMode, activeDay, selectedPlatform, selectedType]);

  // 按路段、所选方案、高亮亮点范围过滤
  const routeMedia = (videos as RouteMedia[]).filter((item) => {
    const itemSegment = segments.find((seg) => seg.id === item.segmentId);
    if (!itemSegment || item.verificationStatus !== 'verified') return false;
    const selectedOption = selectedOptions[itemSegment.id] || itemSegment.chosen;
    const inScope = mapMode === 'trip-overview'
      || (mapMode === 'day-overview' ? itemSegment.day === activeDay : item.segmentId === activeSegmentId);
    return inScope && (!item.routeOptionIds || item.routeOptionIds.includes(selectedOption));
  });
  const highlightMedia = activeHighlightId
    ? routeMedia.filter((item) => item.highlightId === activeHighlightId)
    : [];
  const scoped = highlightMedia.length > 0 ? highlightMedia : routeMedia;

  const filteredVideos = scoped.filter((item) => {
    const platformMatch = selectedPlatform === 'all' || item.platform === selectedPlatform;
    const typeMatch = selectedType === 'all' || item.type === selectedType;
    return platformMatch && typeMatch;
  });

  const platformName: Record<MediaPlatform, string> = {
    all: '全部平台',
    bilibili: 'B站',
    amap: '高德实景',
    web: '文旅核验',
    xiaohongshu: '小红书',
    douyin: '抖音'
  };

  const handleVideoClick = (video: RouteMedia) => {
    if (video.highlightId && video.segmentId === activeSegmentId
      && mapMode !== 'trip-overview' && mapMode !== 'day-overview') focusHighlight(video.highlightId);
    if (video.coordinate) {
      setTimeout(() => amapService.panTo(video.coordinate!, 13), 80);
    } else if (!video.highlightId && mapMode !== 'segment-focus') {
      useTripStore.getState().enterSegmentDetail(video.segmentId);
    }
    setActiveModalVideo(video);
  };

  return (
    <div className="right-tab-content media-tab-content">
      <div className="media-scope-summary">
        {mapMode === 'trip-overview' ? '全程影像' : mapMode === 'day-overview' ? `第 ${activeDay} 天影像` : segment?.title}
        {' · '}{scoped.length} 条
      </div>
      {/* 媒体类型过滤栏 (全部 / 实景照片 / 视频动态) */}
      <div className="category-filter-bar" style={{ paddingBottom: '4px' }}>
        <button
          type="button"
          className={`filter-pill ${selectedType === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedType('all')}
        >
          全部影像 ({scoped.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${selectedType === 'photo' ? 'active' : ''}`}
          onClick={() => setSelectedType('photo')}
        >
          📷 实景照片 ({scoped.filter((m) => m.type === 'photo').length})
        </button>
        <button
          type="button"
          className={`filter-pill ${selectedType === 'video' ? 'active' : ''}`}
          onClick={() => setSelectedType('video')}
        >
          🎬 视频动态 ({scoped.filter((m) => m.type === 'video').length})
        </button>
      </div>

      {/* 平台过滤药丸 */}
      <div className="category-filter-bar" style={{ paddingTop: '2px', borderTop: 'none' }}>
        {(['all', 'bilibili', 'amap', 'web'] as MediaPlatform[]).map((platform) => {
          const count = platform === 'all' ? scoped.length : scoped.filter((v) => v.platform === platform).length;
          if (count === 0 && platform !== 'all') return null;
          return (
            <button
              key={platform}
              type="button"
              className={`filter-pill ${selectedPlatform === platform ? 'active' : ''}`}
              onClick={() => setSelectedPlatform(platform)}
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              {platformName[platform]} ({count})
            </button>
          );
        })}
      </div>

      <div className="video-content-wrapper" ref={contentRef} tabIndex={0} aria-label="沿途影像列表">
        <div className="video-notice-banner">
          {activeHighlightId && highlightMedia.length === 0
            ? '当前亮点暂无专属影像，先展示本路段已核验素材。'
            : '仅展示路线沿途核验实景照片与真实自驾影像；未经证实地点绝不虚标。'}
        </div>

        {/* 诚实空状态提示 (杜绝假照片/无关视频) */}
        {!filteredVideos.length && (
          <div className="video-empty-state">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
              暂未收录可靠实景影像
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              我们坚持人工核验真实影像，绝不使用 AI 伪造照片或无关视频充数
            </div>
          </div>
        )}

        {/* 影像列表 */}
        {filteredVideos.map((item, index) => {
          const isPhoto = item.type === 'photo';

          return (
            <button
              type="button"
              key={item.id}
              data-video-id={item.id}
              data-media-id={item.id}
              className={index === 0 ? 'video-featured-card' : 'video-sub-card'}
              onClick={() => handleVideoClick(item)}
            >
              <div className={index === 0 ? 'video-cover-container' : 'video-sub-cover'}>
                {item.cover ? (
                  <img src={item.cover} alt={item.title} className="video-cover-img" />
                ) : (
                  <div
                    className="video-cover-placeholder"
                    style={{
                      background: isPhoto ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {isPhoto ? <Camera size={22} color="#ffffff" /> : <Video size={22} color="#ffffff" />}
                    <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 700 }}>
                      {item.platformLabel} · {isPhoto ? '实景核验' : '自驾实录'}
                    </span>
                  </div>
                )}
                <span className={`platform-pill-badge ${item.platform}`}>{item.platformLabel}</span>
              </div>

              <div className={index === 0 ? 'video-info-box' : 'video-sub-info'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      background: isPhoto ? '#e0f2fe' : '#ffe4e6',
                      color: isPhoto ? '#0369a1' : '#be123c',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 800
                    }}
                  >
                    {isPhoto ? '照片' : '视频'}
                  </span>
                  <div className={index === 0 ? 'video-title' : 'video-sub-title'} style={{ margin: 0 }}>
                    {item.title}
                  </div>
                </div>

                <div className="video-author-row">
                  <span>{item.author || '来源未核验'}</span>
                  <span>
                    {item.verificationStatus === 'verified'
                      ? '来源已核验'
                      : item.verificationStatus === 'unavailable'
                      ? '链接不可用'
                      : '内容未核验'}
                  </span>
                </div>

                {item.coordinateNote && <div className="video-location-note">{item.coordinateNote}</div>}
              </div>
            </button>
          );
        })}
      </div>

      <VideoModal video={activeModalVideo} onClose={() => setActiveModalVideo(null)} />
    </div>
  );
};
