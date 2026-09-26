export type VideoPlatform = 'all' | 'xiaohongshu' | 'douyin' | 'bilibili';
export type VideoSourceType = 'verified-url' | 'manual' | 'mock';
export type VideoVerificationStatus = 'verified' | 'unverified' | 'unavailable';

export interface VideoReference {
  id: string;
  sourceType: VideoSourceType;
  verificationStatus: VideoVerificationStatus;
  platform: Exclude<VideoPlatform, 'all'>;
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
}
