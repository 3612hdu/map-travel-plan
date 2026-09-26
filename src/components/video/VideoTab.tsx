import React, { useState } from 'react';
import { Play, Heart, ChevronRight, Video } from 'lucide-react';
import { useTripStore } from '../../store/useTripStore';
import { VideoPlatform, VideoReference } from '../../types/video';
import { amapService } from '../../services/amapService';
import { VideoModal } from './VideoModal';

export const VideoTab: React.FC = () => {
  const { videos, activeSegmentId, mapMode } = useTripStore();
  const [selectedPlatform, setSelectedPlatform] = useState<VideoPlatform>('all');
  const [activeModalVideo, setActiveModalVideo] = useState<VideoReference | null>(null);

  // 优先过滤当前路段关联视频
  const currentSegVideos = videos.filter(
    (v) => v.segmentId === activeSegmentId || !v.segmentId
  );
  const displaySource = mapMode === 'segment-focus'
    ? currentSegVideos.filter((video) => video.segmentId === activeSegmentId)
    : currentSegVideos.length > 0 ? currentSegVideos : videos;

  // 平台过滤
  const filteredVideos = displaySource.filter((v) => {
    if (selectedPlatform === 'all') return true;
    return v.platform === selectedPlatform;
  });

  const featuredVideo = filteredVideos.find((v) => v.isFeatured) || filteredVideos[0];
  const secondaryVideos = filteredVideos.filter((v) => v.id !== featuredVideo?.id);

  const handleVideoClick = (video: VideoReference) => {
    // 地图定位到视频实际拍摄位置
    if (video.coord) {
      amapService.panTo(video.coord, 13);
    }
    setActiveModalVideo(video);
  };

  const getPlatformCount = (p: VideoPlatform) => {
    if (p === 'all') return displaySource.length;
    return displaySource.filter((v) => v.platform === p).length;
  };

  return (
    <div className="right-tab-content">
      {/* 平台分类过滤药丸 */}
      <div className="category-filter-bar">
        <button
          type="button"
          className={`filter-pill ${selectedPlatform === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedPlatform('all')}
        >
          全部 ({getPlatformCount('all')})
        </button>
        <button
          type="button"
          className={`filter-pill ${selectedPlatform === 'xiaohongshu' ? 'active' : ''}`}
          onClick={() => setSelectedPlatform('xiaohongshu')}
        >
          小红书 ({getPlatformCount('xiaohongshu')})
        </button>
        <button
          type="button"
          className={`filter-pill ${selectedPlatform === 'douyin' ? 'active' : ''}`}
          onClick={() => setSelectedPlatform('douyin')}
        >
          抖音 ({getPlatformCount('douyin')})
        </button>
        <button
          type="button"
          className={`filter-pill ${selectedPlatform === 'bilibili' ? 'active' : ''}`}
          onClick={() => setSelectedPlatform('bilibili')}
        >
          B站 ({getPlatformCount('bilibili')})
        </button>
      </div>

      <div className="video-content-wrapper">
        {mapMode === 'segment-focus' && filteredVideos.length === 0 && (
          <div className="video-empty-state">本段暂无关联视频</div>
        )}
        <div className="video-notice-banner">
          <span>真实用户的实拍分享，帮你提前了解沿途风景与路况体验</span>
        </div>

        {/* 主推荐大卡 (对齐图 01) */}
        {featuredVideo && (
          <div
            className="video-featured-card"
            onClick={() => handleVideoClick(featuredVideo)}
          >
            <div className="video-cover-container">
              <img
                src={featuredVideo.coverImage}
                alt={featuredVideo.title}
                className="video-cover-img"
              />
              <span className={`platform-pill-badge ${featuredVideo.platform}`}>
                {featuredVideo.platformLabel}
              </span>
              <div className="video-play-btn-circle">
                <Play size={20} fill="white" color="white" />
              </div>
              <div className="video-time-badge">{featuredVideo.duration}</div>
            </div>

            <div className="video-info-box">
              <div className="video-title">{featuredVideo.title}</div>
              <div className="video-author-row">
                <span>{featuredVideo.author}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Heart size={12} color="#f43f5e" fill="#f43f5e" />
                  <span>{featuredVideo.likes}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 次级视频两列网格 */}
        <div className="video-sub-grid">
          {secondaryVideos.map((video) => (
            <div
              key={video.id}
              className="video-sub-card"
              onClick={() => handleVideoClick(video)}
            >
              <div className="video-sub-cover">
                <img src={video.coverImage} alt={video.title} />
                <span className={`platform-pill-badge ${video.platform}`}>
                  {video.platformLabel}
                </span>
                <div className="video-time-badge">{video.duration}</div>
              </div>
              <div className="video-sub-info">
                <div className="video-sub-title">{video.title}</div>
                <div className="video-author-row">
                  <span style={{ fontSize: '10.5px' }}>{video.author}</span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <Heart size={10} color="#f43f5e" />
                    <span>{video.likes}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 视频弹窗 */}
      <VideoModal
        video={activeModalVideo}
        onClose={() => setActiveModalVideo(null)}
      />
    </div>
  );
};
