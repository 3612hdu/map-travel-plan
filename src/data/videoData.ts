import { VideoReference } from '../types/video';
import { verifiedStops } from './stops';

// 仅原平台页面可核对的标题/作者被标为 verified。坐标表示路线参考点，不宣称为拍摄地。
export const initialVideos: VideoReference[] = [
  {
    id: 'bili-ring-road', sourceType: 'verified-url', verificationStatus: 'verified',
    platform: 'bilibili', platformLabel: 'B站',
    sourceUrl: 'https://www.bilibili.com/video/BV1Zm4y1z792/',
    title: '房车自驾丹江口环库公路，油菜花点缀麦田，国道上的风景也很漂亮',
    author: '大毛游记', segmentId: 's6', routeOptionIds: ['scenic', 'compromise'],
    highlightId: 'xijiadian', coordinate: verifiedStops[10].coord,
    coordinateNote: '习家店路线参考位置；视频未证实在此拍摄',
    verifiedAt: '2026-09-26', isFeatured: true
  },
  {
    id: 'bili-danjiangkou', sourceType: 'verified-url', verificationStatus: 'verified',
    platform: 'bilibili', platformLabel: 'B站',
    sourceUrl: 'https://www.bilibili.com/video/BV1m1EgzTEgo/',
    title: '房车停在丹江口水库露营，一个人的旅行生活，有酒有肉真的太爽了',
    author: '大毛游记', segmentId: 's6', coordinate: verifiedStops[8].coord,
    coordinateNote: '丹江口城区路线参考位置；视频未证实在此拍摄',
    verifiedAt: '2026-09-26'
  },
  {
    id: 'legacy-douyin', sourceType: 'manual', verificationStatus: 'unverified',
    platform: 'douyin', platformLabel: '抖音',
    sourceUrl: 'https://www.douyin.com/video/7682370238982074341',
    title: '旧视频链接（内容与位置未核验）', segmentId: 's6', routeOptionIds: ['scenic']
  }
];
