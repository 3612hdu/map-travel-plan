import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Camera, Video, MapPin, CheckCircle2 } from 'lucide-react';
import { RouteMedia } from '../../types/media';

interface VideoModalProps {
  video: RouteMedia | null;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ video, onClose }) => {
  if (!video) return null;

  const isPhoto = video.type === 'photo';
  const available = video.verificationStatus === 'verified' && !!video.sourceUrl;
  const bvid = video.type === 'video' && video.platform === 'bilibili'
    ? video.sourceUrl?.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1]
    : undefined;
  const embedUrl = bvid
    ? `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0&danmaku=0`
    : undefined;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={video.title}>
      <div
        className="modal-content-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '90vw',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* 弹窗顶部栏 */}
        <div
          className="modal-header"
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: isPhoto ? '#0284c7' : '#e11d48',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isPhoto ? <Camera size={12} /> : <Video size={12} />}
              {isPhoto ? '实景照片' : '自驾影像'}
            </span>
            <div className="modal-title" style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
              {video.platformLabel} · {video.title}
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="modal-body" tabIndex={0} aria-label="影像详情" style={{ padding: '20px', textAlign: 'center' }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${video.title} · B站播放器`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: '12px', marginBottom: '14px' }}
            />
          ) : video.cover ? (
            <img
              src={video.cover}
              alt={video.title}
              style={{
                width: '100%',
                maxHeight: '260px',
                objectFit: 'cover',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '14px'
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '180px',
                background: isPhoto
                  ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                  : 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '14px',
                padding: '16px'
              }}
            >
              {isPhoto ? <Camera size={36} opacity={0.9} /> : <Video size={36} opacity={0.9} />}
              <span style={{ fontSize: '15px', fontWeight: 800 }}>{video.title}</span>
              <span style={{ fontSize: '11.5px', opacity: 0.85 }}>
                {video.platformLabel} · 真实地理核验影像（非AI生成）
              </span>
            </div>
          )}

          {/* 详细描述与坐标说明 */}
          <div
            style={{
              textAlign: 'left',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '14px',
              fontSize: '12px',
              lineHeight: 1.6
            }}
          >
            {video.description && (
              <div style={{ color: '#334155', marginBottom: '8px' }}>
                {video.description}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
              <MapPin size={13} color="#0284c7" />
              <span>{video.coordinateNote || '路线核验参考坐标'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={13} />
              <span>
                {video.author ? `来源机构/作者：${video.author} · ` : ''}
                {video.verificationStatus === 'verified' ? '官方/公开档案已核验' : '来源未核验'}
                {video.verifiedAt ? ` (${video.verifiedAt})` : ''}
              </span>
            </div>
          </div>

          {/* 外部来源跳转按钮 */}
          {available && (
            <a
              href={video.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-source-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '12.5px',
                fontWeight: 700
              }}
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
    </div>,
    document.body
  );
};
