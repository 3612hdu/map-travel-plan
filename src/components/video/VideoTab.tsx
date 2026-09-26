import React, { useEffect, useState } from 'react';
import { useTripStore } from '../../store/useTripStore';
import { VideoPlatform, VideoReference } from '../../types/video';
import { amapService } from '../../services/amapService';
import { VideoModal } from './VideoModal';

export const VideoTab: React.FC = () => {
  const { videos, activeSegmentId, selectedOptions, segments, mapMode, activeHighlightId, focusHighlight } = useTripStore();
  const [selectedPlatform, setSelectedPlatform] = useState<VideoPlatform>('all');
  const [activeModalVideo, setActiveModalVideo] = useState<VideoReference | null>(null);
  const segment = segments.find((item) => item.id === activeSegmentId);
  const optionId = selectedOptions[activeSegmentId] || segment?.chosen;
  useEffect(() => setSelectedPlatform('all'), [activeSegmentId, optionId, activeHighlightId]);
  const scoped = videos.filter((video) => video.segmentId === activeSegmentId
    && (!video.routeOptionIds || (optionId && video.routeOptionIds.includes(optionId)))
    && (!activeHighlightId || video.highlightId === activeHighlightId));
  const filteredVideos = scoped.filter((video) => selectedPlatform === 'all' || video.platform === selectedPlatform);
  const platformName: Record<VideoPlatform, string> = { all: '全部', xiaohongshu: '小红书', douyin: '抖音', bilibili: 'B站' };

  const handleVideoClick = (video: VideoReference) => {
    if (video.highlightId) focusHighlight(video.highlightId);
    if (video.coordinate) {
      // 与亮点关联时让地图先完成区间高亮，然后落到标注的路线参考坐标。
      setTimeout(() => amapService.panTo(video.coordinate!, 13), 80);
    } else if (!video.highlightId && mapMode !== 'segment-focus') {
      useTripStore.getState().enterSegmentDetail(video.segmentId);
    }
    setActiveModalVideo(video);
  };

  return (
    <div className="right-tab-content">
      <div className="category-filter-bar">
        {(Object.keys(platformName) as VideoPlatform[]).map((platform) => (
          <button key={platform} type="button" className={`filter-pill ${selectedPlatform === platform ? 'active' : ''}`}
            onClick={() => setSelectedPlatform(platform)}>
            {platformName[platform]} ({platform === 'all' ? scoped.length : scoped.filter((video) => video.platform === platform).length})
          </button>
        ))}
      </div>
      <div className="video-content-wrapper">
        <div className="video-notice-banner">仅展示当前路段与当前方案关联内容；位置是路线参考点，未经证实为拍摄地。</div>
        {!filteredVideos.length && <div className="video-empty-state">当前路线范围暂无关联视频</div>}
        {filteredVideos.map((video, index) => (
          <button type="button" key={video.id} data-video-id={video.id}
            className={index === 0 ? 'video-featured-card' : 'video-sub-card'}
            onClick={() => handleVideoClick(video)}>
            <div className={index === 0 ? 'video-cover-container' : 'video-sub-cover'}>
              {video.cover ? <img src={video.cover} alt={video.title} className="video-cover-img" /> : <div className="video-cover-placeholder">{video.platformLabel} · 原平台内容</div>}
              <span className={`platform-pill-badge ${video.platform}`}>{video.platformLabel}</span>
            </div>
            <div className={index === 0 ? 'video-info-box' : 'video-sub-info'}>
              <div className={index === 0 ? 'video-title' : 'video-sub-title'}>{video.title}</div>
              <div className="video-author-row"><span>{video.author || '作者未核验'}</span><span>{video.verificationStatus === 'verified' ? '来源已核验' : video.verificationStatus === 'unavailable' ? '链接不可用' : '内容未核验'}</span></div>
              {video.coordinateNote && <div className="video-location-note">{video.coordinateNote}</div>}
            </div>
          </button>
        ))}
      </div>
      <VideoModal video={activeModalVideo} onClose={() => setActiveModalVideo(null)} />
    </div>
  );
};
