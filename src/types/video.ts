// 沿途视频数据类型

export type VideoPlatform = 'all' | 'xiaohongshu' | 'douyin' | 'bilibili';

export interface VideoReference {
  id: string;
  platform: 'xiaohongshu' | 'douyin' | 'bilibili';
  platformLabel: string;
  title: string;
  author: string;
  avatar?: string;
  coverImage: string;
  duration: string;
  likes: string;
  comments?: string;
  locationName: string;
  coord: [number, number];
  segmentId: string;
  routeOptionId?: string;
  embedUrl?: string; // 允许嵌入时的 iframe URL
  externalUrl: string; // 官方外部直达链接
  isFeatured?: boolean; // 主大卡
}
