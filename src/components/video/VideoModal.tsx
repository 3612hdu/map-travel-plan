import React from 'react';
import { X, ExternalLink, Play } from 'lucide-react';
import { VideoReference } from '../../types/video';

interface VideoModalProps {
  video: VideoReference | null;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ video, onClose }) => {
  if (!video) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span
              className={`platform-pill-badge ${video.platform}`}
              style={{ position: 'static', marginRight: '8px' }}
            >
              {video.platformLabel}
            </span>
            <span>{video.title}</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {video.embedUrl ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '10px' }}>
              <iframe
                src={video.embedUrl}
                title={video.title}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div
                style={{
                  width: '100%',
                  height: '240px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '16px',
                  background: '#0f172a'
                }}
              >
                <img
                  src={video.coverImage}
                  alt={video.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.45)',
                    color: 'white',
                    padding: '20px'
                  }}
                >
                  <Play size={42} color="white" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 650 }}>
                    该平台版权限制，不支持直接网页内嵌播放
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                拍摄地点：<strong>{video.locationName}</strong> · 时长 {video.duration} · 作者：{video.author}
              </p>

              <a
                href={video.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#1875ff',
                  color: 'white',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 750,
                  textDecoration: 'none'
                }}
              >
                <span>在 {video.platformLabel} App 或官方网页中查看原视频</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
