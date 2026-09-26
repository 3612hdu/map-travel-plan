export type MediaType = 'all' | 'photo' | 'video';
export type MediaPlatform = 'all' | 'amap' | 'bilibili' | 'douyin' | 'xiaohongshu' | 'web';
export type MediaSourceType = 'verified-url' | 'manual';
export type MediaVerificationStatus = 'verified' | 'unverified' | 'unavailable';

export interface RouteMedia {
  id: string;
  type: 'photo' | 'video';
  sourceType: MediaSourceType;
  verificationStatus: MediaVerificationStatus;
  platform: Exclude<MediaPlatform, 'all'>;
  platformLabel: string;
  sourceUrl?: string;
  title: string;
  author?: string;
  cover?: string;
  segmentId: string;
  routeOptionIds?: string[];
  highlightId?: string;
  coordinate?: [number, number];
  coordinateNote?: string;
  verifiedAt?: string;
  isFeatured?: boolean;
  description?: string;
}

// 兼容旧接口
export type VideoReference = RouteMedia;
export type VideoPlatform = MediaPlatform;
export type VideoSourceType = MediaSourceType;
export type VideoVerificationStatus = MediaVerificationStatus;
