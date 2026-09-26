import { Stop } from '../types/trip';

// 黄冈至郧阳经过核实的 13 个城镇地点
export const verifiedStops: Stop[] = [
  { id: 'huanggang', name: '黄冈师范学院', coord: [114.927342, 30.449045], poi: 'B02C902KZW', city: '黄冈市', address: '黄州区开发区新港二路146号' },
  { id: 'macheng', name: '麻城市', coord: [115.008011, 31.172917], poi: 'B02C90OIPI', city: '黄冈市', address: '黄冈市麻城市金桥大道' },
  { id: 'hongan', name: '红安县', coord: [114.618134, 31.288167], poi: 'B02C901F1L', city: '黄冈市', address: '黄冈市红安县发展大道' },
  { id: 'dawu', name: '大悟县', coord: [114.127122, 31.561179], poi: 'B02C80N4IM', city: '孝感市', address: '孝感市大悟县长征南路' },
  { id: 'guangshui', name: '广水市', coord: [113.825977, 31.617015], poi: 'B02D200L85', city: '随州市', address: '随州市广水市应山大道' },
  { id: 'suizhou', name: '随州市', coord: [113.382324, 31.690275], poi: 'B02D20NFH4', city: '随州市', address: '随州市曾都区迎宾大道' },
  { id: 'zaoyang', name: '枣阳市', coord: [112.772723, 32.128968], poi: 'B02C602ADU', city: '襄阳市', address: '襄阳市枣阳市民主路' },
  { id: 'xiangyang', name: '襄阳市', coord: [112.121743, 32.010161], poi: 'B02C60P80R', city: '襄阳市', address: '襄阳市襄城区檀溪路' },
  { id: 'danjiangkou', name: '丹江口市', coord: [111.513318, 32.540287], poi: 'B02CF01Y5W', city: '十堰市', address: '十堰市丹江口市右岸迎宾路' },
  { id: 'liangshuihe', name: '凉水河镇人民政府', coord: [111.472041, 32.645282], poi: 'B02CF010FD', city: '十堰市', address: '十堰市丹江口市凉水河镇' },
  { id: 'xijiadian', name: '习家店镇', coord: [111.183426, 32.748143], poi: 'B02CF0Q069', city: '十堰市', address: '十堰市丹江口市习家店镇迎宾大道' },
  { id: 'anyang', name: '安阳镇人民政府', coord: [111.013760, 32.845297], poi: 'B02CF010BD', city: '十堰市', address: '十堰市郧阳区安阳镇' },
  { id: 'yunyang', name: '郧阳区人民政府', coord: [110.813261, 32.835532], poi: 'B0FFG11XSU', city: '十堰市', address: '十堰市郧阳区城关镇' }
];
