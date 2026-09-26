import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { VideoReference } from '../../types/video';

interface VideoModalProps { video: VideoReference | null; onClose: () => void }

export const VideoModal: React.FC<VideoModalProps> = ({ video, onClose }) => {
  if (!video) return null;
  const available = video.verificationStatus === 'verified' && !!video.sourceUrl;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{video.platformLabel} · {video.title}</div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body" style={{ padding: 24, textAlign: 'center' }}>
          {video.cover && <img src={video.cover} alt={video.title} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10 }} />}
          <p>{video.author ? `作者：${video.author} · ` : ''}{video.coordinateNote || '未标注可靠拍摄位置'}</p>
          {available && (
            <a
              href={video.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-source-link"
            >
              {video.platform === 'bilibili'
                ? '打开 B站'
                : video.platform === 'douyin'
                ? '打开抖音'
                : video.platform === 'xiaohongshu'
                ? '打开小红书'
                : `打开 ${video.platformLabel || '原平台'}`}{' '}
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
