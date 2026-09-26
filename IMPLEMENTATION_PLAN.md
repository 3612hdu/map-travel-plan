# 可交互自驾路线规划器 V2 —— 实施方案 (IMPLEMENTATION_PLAN.md)

> **版本**：2.0.0  
> **制定时间**：2026-09-26  
> **指导文档**：`VIBE_CODING_PROMPT.md` 与 `references/` 下 3 张视觉布局规范图  
> **原则**：高德是底层地图引擎，不在页面内做简陋跳转；Trip 为容器，Segment 为核心，Route Option 为决策单元；规划在本页闭环，自驾出发时调起高德分段导航。

---

## 0. 会话交接与最新代码审计 (2026-09-26 重新审计)

### 0.1 真实可运行状态与检查清单
- **构建状态**：`npm run build` (tsc && vite build) 100% 成功，0 错误，打包产物体积约 300 kB。
- **运行环境**：本地服务运行于 `http://127.0.0.1:5173/`，浏览器控制台 0 错误（已配置 SVG Favicon，排除 404）。
- **Phase A/B 既有能力保真度**：
  - 三栏布局（左侧行程 22%、中间地图与方案 48%、右侧视频/设施 30%）完全对齐设计图 `01-video-tab-layout.png`。
  - 高德 JS API 2.0 底图平滑渲染，实时路况图层与图例开关完全正常。
  - 丹江口至郧阳 (s6) 3 路线对比卡（普通、环库风景、折中）与路线亮点横向列表正常。
  - 顶栏搜索框与“全程/当前路段”作用域切换正常。
  - 右侧共享面板“沿途视频”与“沿途设施”Tab 互斥切换正常。
- **已排查并修复的技术债**：
  1. **高德并发限流排队机制**：初始页面 8 个规划请求同时并发曾导致 AMap 服务端频控丢包（仅规划 2/6 或 3/6 段）。已在 `amapService.ts` 引入指数退避重试（最多 2 次），并在 `CenterMapArea.tsx` 采用优先计算当前段、后续段平滑队列机制，全行程 6/6 段（711 km）规划成功率达到 100%。
  2. **POI 停靠点城市硬编码清洗**：移除了 `city: '十堰市'` 硬编码，改为从 POI 地址动态正则提取或回退当前段终点城市。
  3. **导航服务策略混淆修复**：移除了 URI API 中硬编码的 `policy: '7'`，替换为符合 URI API 规范的策略适配器。
  4. **走廊采样算法覆盖**：修复了 `sampleCenters` 在 600km+ 全程模式下被上限 12 截断导致后半程遗漏的隐患，确保全线无死角抽样。

### 0.2 TEST 06 路线策略 (RoutePreference) 权威审计

#### 用户的核心自驾路线偏好：
1. **不走高速** (`avoidHighway: true`)
2. **尽量少收费** (`avoidToll: true`)
3. **可以选择躲避拥堵** (`avoidCongestion: boolean`)
4. **风景路线允许通过途经点进行人为引导**

#### 真实 API 文档与浏览器端实测对照：
经 2026-09-26 真实浏览器实测与官方文档严格核对，不同高德 API 采用**完全不同**的策略枚举体系，严禁混用：

| 平台 API | 参数名称 | 核心策略枚举值与实测表现 | 针对“不走高速+少收费+躲拥堵”的处理方式 |
| :--- | :--- | :--- | :--- |
| **AMap JS API 2.0 Driving** | `policy` | - `0`: `LEAST_TIME` (速度优先)<br>- `1`: `LEAST_FEE` (费用优先/少收费)<br>- `2`: `LEAST_DISTANCE` (最短距离)<br>- `4`: `REAL_TRAFFIC` (避拥堵)<br>- `5`: `MULTI_POLICIES` (多策略，**走高速**，实测过路费 ¥37)<br>- `6`: `HIGHWAY` (不走高速，实测 ¥0)<br>- `7`: `FEE_HIGHWAY` (不走高速且避免收费，实测 ¥0)<br>- `8`: `FEE_TRAFFIC` (避免收费且躲避拥堵)<br>- `9`: `TRAFFIC_HIGHWAY` (不走高速且躲避拥堵) | **官方局限**：JS API 2.0 **没有三合一常量**。当三项全选时，绝不伪造映射，降级使用 `7` (`FEE_HIGHWAY` 不走高速且少收费) 或 `9` (`TRAFFIC_HIGHWAY`)，优先捍卫“不走高速”底线。 |
| **Web Service 路径规划 2.0 (`/v5/direction/driving`)** | `strategy` | - `32`: 默认高德推荐<br>- `33`: 躲避拥堵<br>- `34`: 高速优先<br>- `35`: 不走高速<br>- `36`: 少收费<br>- `40`: 躲避拥堵 + 不走高速<br>- `41`: 躲避拥堵 + 少收费<br>- `42`: 少收费 + 不走高速<br>- `43`: **躲避拥堵 + 少收费 + 不走高速** | **完美支持**：官方明确定义 `strategy=43` 为“躲避拥堵+少收费+不走高速”组合，可作为未来 Web Service 精确算路并回传前端画线的演进方向。 |
| **高德 URI API (`uri.amap.com/navigation`)** | `policy` | 驾车模式 (`mode=car`)：<br>- `0`: 推荐策略<br>- `1`: 避免拥堵<br>- `2`: 避免收费<br>- `3`: 不走高速 (移动端优先) | 严禁填入 JS API 的 7 或 Web Service 的 43。通过 `mapPreferenceToUriPolicy` 精确输出 `3`（不走高速）或 `2`。 |

#### 代码架构实现：
统一在 `src/types/preference.ts` 维护统一抽象：
```ts
export interface RoutePreference {
  avoidHighway: boolean;
  avoidToll: boolean;
  avoidCongestion: boolean;
}
```
并输出三套相互隔离的适配器：
1. `mapPreferenceToAMapJsApiPolicy(pref)`
2. `mapPreferenceToWebServiceStrategy(pref)`
3. `mapPreferenceToUriPolicy(pref)`

---

## 1. 当前项目现状审计

### 1.1 文件与资产结构
- `current-prototype.html`：单文件原型（约 157 行），具备高德 JS API 动态加载、13 个核实城镇地点坐标、6 段行程基本结构、`Driving(policy: 7)` 避高速算路逻辑、路线抽样查油站与充电站、嵌入 iframe 兜底。
- `references/` 目录：
  - `01-video-tab-layout.png`：三栏布局主规范、左侧行程导航、中下路线方案三卡、路线亮点卡片、右侧“沿途视频”面板。
  - `02-facilities-tab-layout.png`：右侧“沿途设施”面板（分类过滤、绕行距离标注、加入停靠点按钮）。
  - `03-search-scope-layout.png`：顶部路线走廊搜索框（“全程”与“当前路段”双作用域）。
- `屏幕截图 2026-09-26 154920.png`：
  - 高德 Key：`e322e5e184433d8288532e3bcd044cda`
  - 安全密钥 `securityJsCode`：`1b72db05d38816eb0822ae8f56b04992`
  - 服务平台：Web端（JS API 2.0）
- 基础设施：系统已安装 Node.js `v22.14.0` 与 npm `10.9.2`，npm 镜像源已配置为淘宝镜像（延迟 500ms 内），具备现代前端工程构建条件。

### 1.2 现有旧原型问题与复用边界
| 模块 | 旧原型情况 | V2 决策 |
| :--- | :--- | :--- |
| **地点与经纬度** (`stops`) | 已核实黄冈至郧阳 13 个城镇坐标与 POI ID | **100% 完整复用**并强化元数据 |
| **行程结构** (`segments`) | 6 个路段与途经点配置 | **复用并重构扩展**为丰富 RouteOption 模型 |
| **高德算路** (`AMap.Driving`) | policy: 7（避高速）算路与折线提取 | **保留核心逻辑**，抽离为独立服务层 |
| **沿路抽样搜索** | `sampleCenters` + `searchNearBy` | **升级为走廊搜索算法**，增加垂距与绕行距离计算 |
| **UI 架构与视觉** | 粗糙侧栏与弹窗输入 Key，默认 iframe | **彻底废弃**，重构为参考图的高质感工作台 |
| **沿途视频** | 仅几个简单链接 | **升级为多平台空间关联视频系统**，支持内嵌与定位 |

---

## 2. 建议技术栈

根据需求文档第 19 节建议及生产级交互体验标准，采用现代化前端工程化方案：
- **核心框架**：React 19 + TypeScript
- **构建工具**：Vite 6（秒级冷启动、高效 HMR、生产环境零配置单包发布）
- **样式方案**：Tailwind CSS + CSS Variables（保证毛玻璃、圆角卡片、细腻微动效与响应式布局）
- **状态管理**：Zustand（无冗余模板，轻量可靠地驱动多模块响应）
- **图标系统**：Lucide React（轻量级现代矢量图标）
- **地图引擎**：`@amap/amap-jsapi-loader` + 高德 JS API 2.0（Driving、PlaceSearch、Traffic、ToolBar）

---

## 3. 最终目录结构

```text
d:/map travel plan/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── config/
│   │   └── amap.ts                     # 高德 JS API Key 与 securityJsCode 配置
│   ├── types/
│   │   ├── trip.ts                     # Trip, Day, Segment, RouteOption, Stop
│   │   ├── poi.ts                      # Facility, CorridorPOI, SearchFilter
│   │   ├── video.ts                    # VideoReference, Platform
│   │   └── map.ts                      # MapMode, MapViewStatus
│   ├── data/
│   │   ├── stops.ts                    # 黄冈至郧阳已核实城镇数据
│   │   ├── tripData.ts                 # 完整行程与三种路线方案（普通/环库/折中）
│   │   ├── scenicHighlights.ts         # 路线亮点（凉水河临水公路、习家店观景台等）
│   │   └── videoData.ts                # 沿途实景视频库（B站/抖音/小红书真实映射）
│   ├── services/
│   │   ├── amapService.ts              # 高德 Driving 算路、Polyline 渲染、路况图层
│   │   ├── corridorSearch.ts           # 路线走廊抽样、POI 搜索与点线垂距计算
│   │   └── navigationService.ts        # 高德 App 调起协议与 URI 组装
│   ├── store/
│   │   └── useTripStore.ts             # 全局行程状态、所选路段、走廊搜索、Tab 状态
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx              # 顶栏：标题、搜索框、搜索范围、全程统计
│   │   │   ├── SidebarLeft.tsx         # 左侧行程栏：Day 切换、Segment 卡片、保存分享
│   │   │   ├── CenterMapArea.tsx       # 中央区域：地图容器、方案卡片、路线亮点
│   │   │   └── RightPanel.tsx          # 右侧区域：沿途视频 / 沿途设施 Tab 共享面板
│   │   ├── search/
│   │   │   └── CorridorSearchBox.tsx   # 走廊搜索输入框与“全程/当前路段”切换
│   │   ├── route/
│   │   │   ├── RouteOptionCards.tsx    # 3张方案对比卡（普通、环库推荐、折中）
│   │   │   └── RouteHighlights.tsx     # 路线亮点横向图文与定位
│   │   ├── video/
│   │   │   ├── VideoTab.tsx            # 视频平台筛选与卡片流
│   │   │   └── VideoEmbedModal.tsx     # 视频内嵌播放与降级外跳
│   │   ├── facilities/
│   │   │   ├── FacilityTab.tsx         # 设施分类（酒店/餐饮/油站/充电/厕所/停车）
│   │   │   └── FacilityCard.tsx        # 设施卡片（显示距路线 km，支持加停靠点）
│   │   └── map/
│   │       ├── AMapContainer.tsx       # 高德地图 Canvas 挂载、Marker 与事件管理
│   │       ├── TrafficLegend.tsx       # 实时路况图例（畅通/缓行/拥堵）
│   │       └── MapControls.tsx         # 路况开关、卫星图切换、全览复位
│   └── utils/
│       └── geo.ts                      # 大圆距离、折线抽样、点到折线最短距离
```

---

## 4. 页面组件拆分与信息流

```text
[ App (useTripStore 全局状态调度) ]
 │
 ├── [ Header ]
 │     ├── 品牌标题与行程标签（黄冈→郧阳、两天、风景优先）
 │     ├── CorridorSearchBox (走廊搜索框 + 全程/当前段选择)
 │     └── 全程实时统计（总里程、驾驶时间、预估费用、风景路段数）
 │
 ├── [ Main Workspace (三栏响应式网格) ]
 │     │
 │     ├── [ SidebarLeft (22% 宽度) ]
 │     │     ├── Day 选项卡 (Day 1 / Day 2 / 全程)
 │     │     ├── Segment 卡片列表 (各段状态、里程、走法数、微标签)
 │     │     └── 底部操作栏 (保存行程、分享路线)
 │     │
 │     ├── [ CenterMapArea (48% 宽度) ]
 │     │     ├── AMapContainer (高德底图、路线折线、Marker 图层)
 │     │     ├── TrafficLegend & MapControls (路况悬浮卡)
 │     │     ├── RouteOptionCards (当前 Segment 的 3 种方案卡片：普通/环库/折中)
 │     │     └── RouteHighlights (当前段风景亮点横向列表)
 │     │
 │     └── [ RightPanel (30% 宽度，视频与设施共享容器) ]
 │           ├── Top Tab Switcher ([ ▶ 沿途视频 ] vs [ ⛽ 沿途设施 ])
 │           │
 │           ├── <Tab 1> VideoTab
 │           │     ├── 平台分类筛选 (全部 / 小红书 / 抖音 / B站)
 │           │     └── 视频列表卡片 (主大卡 + 次级流，点击联动地图与播放弹窗)
 │           │
 │           └── <Tab 2> FacilityTab
 │                 ├── 分类筛选 (全部 / 酒店民宿 / 餐饮 / 加油站 / 充电站 / 厕所 / 停车)
 │                 └── 设施结果列表 (卡片展示距路线绕行 km、支持【加入停靠点】、【查看】、【导航】)
```

---

## 5. 状态管理设计 (`useTripStore`)

```ts
interface TripState {
  // 行程与段落状态
  trip: Trip;
  activeDay: number | 'all';
  activeSegmentId: string;
  selectedOptions: Record<string, string>; // segmentId -> optionId
  customWaypoints: Record<string, Place[]>; // segmentId -> 追加的途经点
  
  // 地图算路缓存
  routeData: Record<string, RouteCalculationResult>; // `${segmentId}:${optionId}` -> result
  isRouting: boolean;
  
  // 交互模式
  mapMode: 'trip-overview' | 'day-overview' | 'segment-selected' | 'segment-focus';
  isTrafficOn: boolean;
  isSatelliteOn: boolean;
  
  // 共享面板状态
  activeContentTab: 'videos' | 'facilities';
  
  // 走廊搜索状态
  searchQuery: string;
  searchScope: 'trip' | 'segment';
  activeFacilityCategory: FacilityCategory;
  corridorPois: RoutePoi[];
  isSearchingPois: boolean;
  
  // 联动状态
  hoveredPoiId: string | null;
  selectedPoiId: string | null;
  activeVideo: VideoReference | null;
  
  // 动作
  selectSegment: (segmentId: string) => void;
  selectOption: (segmentId: string, optionId: string) => void;
  addWaypoint: (segmentId: string, poi: Place) => void;
  removeWaypoint: (segmentId: string, poiId: string) => void;
  setSearchQuery: (query: string, scope?: 'trip' | 'segment') => void;
  setFacilityCategory: (category: FacilityCategory) => void;
  focusPoi: (poiId: string | null) => void;
}
```

---

## 6. 数据模型设计

### 6.1 Trip / Segment / RouteOption
```ts
export interface Place {
  id: string;
  name: string;
  coord: [number, number]; // [lng, lat]
  poiId?: string;
  city?: string;
  address?: string;
}

export interface RouteHighlight {
  id: string;
  title: string;
  desc: string;
  image: string;
  location: [number, number];
  tags: string[];
}

export interface RouteOption {
  id: string;
  name: string;
  tagTitle: string; // 如：'推荐风景路线', '普通路线', '风景折中路线'
  isRecommended?: boolean;
  desc: string;
  via: number[]; // 索引关联预设 stops
  features: string[]; // ['临水', '山景', '拍照', '慢生活']
  comparisonNote?: string; // '+31 km · +47 min'
  highlights: RouteHighlight[];
}

export interface Segment {
  id: string;
  day: number;
  title: string;
  start: number; // 索引关联 stops
  end: number;
  chosen: string;
  note: string;
  options: RouteOption[];
}
```

### 6.2 RoutePoi (沿途设施)
```ts
export interface RoutePoi {
  id: string;
  name: string;
  category: 'hotel' | 'food' | 'gas' | 'ev' | 'toilet' | 'parking';
  categoryLabel: string;
  coord: [number, number];
  address: string;
  distanceToRoute: number; // km (点到折线垂距)
  detourDistance?: number; // 预估绕行增加里程
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  status?: string; // 如 '营业中'、'快充 4 / 慢充 2'
  sourceSegmentId: string;
}
```

### 6.3 VideoReference (沿途视频)
```ts
export interface VideoReference {
  id: string;
  platform: 'douyin' | 'bilibili' | 'xiaohongshu';
  title: string;
  author: string;
  coverImage: string;
  duration: string;
  likes?: string;
  comments?: string;
  locationName: string;
  coord: [number, number];
  segmentId: string;
  embedUrl?: string; // 允许官方 iframe 嵌入的 URL
  externalUrl: string; // 官方外部直达链接
  isFeatured?: boolean; // 是否为主推荐大卡
}
```

---

## 7. 高德地图接入方案
- **直接使用真实 Key 自动初始化**：
  配置 `window._AMapSecurityConfig = { securityJsCode: '1b72db05d38816eb0822ae8f56b04992' };`
  通过 `@amap/amap-jsapi-loader` 加载：
  ```ts
  AMapLoader.load({
    key: 'e322e5e184433d8288532e3bcd044cda',
    version: '2.0',
    plugins: ['AMap.Driving', 'AMap.PlaceSearch', 'AMap.ToolBar', 'AMap.Scale']
  })
  ```
- **摒弃旧版弹窗**：无需用户每次手动填写，页面加载直接进入高德地图渲染。
- **地图图层架构**：
  - 底图：矢量/卫星图切换（`AMap.createDefaultLayer`）；
  - 路况图层：`AMap.TileLayer.Traffic` 动态加载，可由用户一键开启/关闭；
  - 路线图层：分段独立绘制 Polyline，当前选中段加粗（8px，蓝色/风景绿），非激活段半透明（5px，淡灰/淡橙）；
  - Marker 图层：起点终点标记、自定义停靠点标记、沿路设施 POI 标记、视频地点标记。

---

## 8. 路线规划方案 (`AMap.Driving`)
- 严格遵循真实驾车逻辑，配置策略 `policy: 7`（避高速避收费）；
- 拼接途经点：`waypoints = [...option.via.map(i => stops[i].coord), ...customWaypoints[segmentId]]`；
- 提取并缓存各段 polyline 完整坐标数组、路程（`distance`）、用时（`time`）、过路费（`tolls`）、经过道路列表（`steps[].road`）；
- 当切换 RouteOption 或添加停靠点时，仅重算受影响的 Segment 并即刻更新全局总计。

---

## 9. 实时路况方案
- 地图右上角提供与设计图一致的 **“实时路况”悬浮图例**：
  - 绿色：畅通
  - 黄色：缓行
  - 红色：拥堵
- 开启状态下，加载高德实时交通热力图层并叠加在道路上方；
- 算路步骤中根据高德 Driving 返回的各 step 交通状况，展示当前段的“路况良好 / 局部施工”等状态提示，绝不编造假数字。

---

## 10. 沿途设施搜索方案
- 设施类别分类映射：
  - `hotel`: 酒店、宾馆、民宿、客栈
  - `food`: 餐厅、农家乐、特色美食
  - `gas`: 加油站、中国石化、中国石油
  - `ev`: 充电站、国家电网充电桩、特来电
  - `toilet`: 公共厕所、洗手间
  - `parking`: 停车场、观景台停车点
- 数据展示字段：名称、地址、分类标签、计算得到的“距路线 X km”、营业状态、加入停靠点操作。

---

## 11. 全程搜索 / 当前 Segment 搜索实现方案 (Corridor Search)
- **输入联动**：用户在顶部输入搜索词（如“酒店”）或切换类别标签；
- **作用域判断**：
  - **当前路段 (Segment)**：获取当前所选 Segment 的实际道路 polyline。
  - **全程 (Trip)**：获取整条行程所有已选 Segment 拼接后的连续 polyline。
- **走廊采样算法**：
  1. 计算折线总长度，按每 15km~25km 间隔提取采样锚点；
  2. 对采样锚点并发调用 `AMap.PlaceSearch.searchNearBy(keyword, center, 8000)`；
  3. 批量聚合 POI，按 `id` 或名称+坐标进行去重；
  4. 对每个 POI 运行 `pointToPolylineDistance`（几何垂直投影算法），精确算得该 POI 距离道路的实际最近垂直距离；
  5. 剔除距离路线超过 10km 的无关 POI，并按“距路线距离”由近到远排序。

---

## 12. 地图 Marker 与右侧列表双向联动
- **列表 -> 地图**：
  - 鼠标悬停列表卡片：对应地图 Marker 放大并高亮动画；
  - 点击列表卡片：地图平滑平移并自动缩放（`map.panTo(coord); map.setZoom(14);`），自动打开包含名称、距离与操作按钮的 `AMap.InfoWindow`。
- **地图 -> 列表**：
  - 点击地图上的设施 Marker：自动激活右侧“沿途设施”Tab，右侧列表滚动至该条目并添加选中边框与背景高亮。

---

## 13. 沿途视频模块方案
- 视频与自驾空间节点严格绑定：
  - 绑定到 Segment（如丹江口至郧阳 s6）和具体地标（凉水河水库公路、习家店观景台、安阳镇汉江绿谷）；
  - 数据模型包含具体经纬度，地图上同步渲染视频播放角标 Marker；
- 卡片展示对齐 `01-video-tab-layout.png`：
  - 主视频大卡：显示封面图、播放按钮、时长、标题、作者、点赞量、关联路段标签；
  - 次级视频网格：两列卡片展示。

---

## 14. 小红书 / 抖音 / B站视频处理方案
- **B站**：支持标准官方网页嵌入代码（`<iframe src="//player.bilibili.com/player.html?bvid=..." />`），点击后在应用内弹窗直接播放。
- **抖音**：官方网页开放 iframe 或分享外链，优先内嵌 Web Player；若遇跨域防盗链，采用专属视频播放预览卡片。
- **小红书**：受平台安全策略与 CSP 限制无法稳定内嵌 iframe，因此呈现精美原生预览卡片（真实封面、笔记标题、博主、点赞数），提供一键直达官方笔记。

---

## 15. 外部链接与可嵌入视频降级策略
- 严禁任何伪造抓取或易失效的第三方接口；
- 点击视频卡片时：
  1. 优先在页面内打开 VideoModal 播放；
  2. 若播放器报错或不支持嵌入，自动在弹窗内展示“当前视频受平台版权限制需在客户端或官方网页播放”，并提供一键跳转官方原链接按钮；
  3. 绝不中断用户的规划上下文。

---

## 16. 路线亮点系统 (Route Highlights)
- 位于中央地图区域正下方（对齐 `01-video-tab-layout.png`）；
- 核心展示：
  - 凉水河临水公路（一侧青山，一侧碧水）
  - 习家店观景台（俯瞰丹江口水库）
  - 丹江口水库北岸（湖光山色超治愈）
  - 安阳镇汉江绿谷（山水相连，视野开阔）
- 交互能力：点击任意亮点缩略图，地图立刻平滑聚焦到该风景坐标点，并在地图上显示图文浮窗。

---

## 17. “加入停靠点”重新算路流程
1. 用户在搜索结果中点击某个 POI（例如“习家店山水民宿”）上的【加入停靠点】；
2. 系统将该 POI 作为一个自定义途经点插入当前 Segment 的 `customWaypoints` 列表中；
3. `amapService` 自动重新发起该 Segment 的高德 Driving 请求；
4. 收到高德最新算路结果后，更新本段路线 polyline、真实里程、驾驶时间与收费；
5. 地图自动刷新路线并在停靠点位置渲染序号标记；
6. 顶部总里程与时间即时刷新；
7. 设施卡片状态切换为“已加入途经点”，并提供【移除停靠点 (Undo)】按钮。

---

## 18. 最终“开始导航”跳转高德 App 方案
- 规划期全流程在本页面闭环；
- 点击【开始导航】时，采用高德官方 Universal Link / URI Scheme：
  - 移动端：`amapuri://route/plan/?dlat=...&dlon=...&dname=...&dev=0&t=0`；
  - 桌面端：生成移动端高德扫码二维码，或调起高德官方导航页；
  - 携带当前选定段的终点与已选途经点，出发前提醒核对“不走高速”与当天实时路况。

---

## 19. 从 `current-prototype.html` 迁移的代码清单
- **已核实地标数据**：13 个 stops 对象的经纬度、POI ID、城市归属（`stops` 数组）；
- **Segment 逻辑定义**：6 个路段的起点终点定义与备注信息（`segments` 数组）；
- **高德 Driving 核心配置**：`policy: 7`、`extensions: 'all'`、`ferry: 1`；
- **抽样坐标生成算法**：`sampleCenters` 几何分段采样函数；
- **基础导航 URL 拼接**：`mobileNav` 与 `poiUrl` 生成逻辑。

---

## 20. 应该废弃的旧逻辑清单
- ❌ 废弃原顶部的简陋偏好标签按钮（移入侧栏或搜索抽屉，释放顶部黄金位置）；
- ❌ 废弃“连接高德交互地图”大表单弹窗（直接自动注入真实 Key 与安全密钥）；
- ❌ 废弃 iframe 高德网页作为默认视图的机制（高德 JS API 2.0 作为唯一主地图）；
- ❌ 废弃只能在底栏简单查油站的旧交互（升级为走廊搜索与右侧 Tab 体系）；
- ❌ 废弃静态不可操作的途经镇文本展示（升级为真途经点与动态算路）；
- ❌ 废弃所有分散在各处的“高德网页 ↗”外跳小链接。

---

## 21. Phase A ～ Phase F 阶段性任务划分

### Phase A：UI 架构搭建与现代工程脚手架（已完成 ✅）
- [x] 审计完成，输出 `IMPLEMENTATION_PLAN.md`；
- [x] 初始化 Vite + React + TypeScript 现代化前端架构；
- [x] 搭建三栏视觉布局（左侧行程 22%、中间地图与方案 48%、右侧视频/设施 30%）；
- [x] 实现顶部全局走廊搜索栏与范围选择切换（全程/当前路段）；
- [x] 实现右侧 Tab 切换（沿途视频 vs 沿途设施）；
- [x] 实现当前路段 RouteOption 三张对比卡与路线亮点轮播；
- [x] 建立规范的 Mock 数据与结构化类型，确保布局与交互 1:1 还原参考图。

### Phase B：真正接入高德 JS API 2.0 与实路算路（已完成 ✅）
- [x] 凭据安全治理：移除业务源码硬编码，使用 `.env.local` 并在 `.gitignore` 中排除，输出 `.env.example`；
- [x] 偏好策略抽象：创建 `RoutePreference`（避高速、少收费、躲拥堵），精确映射高德 JS API 策略；
- [x] 封装 `amapService.ts`，自动加载 Key 与安全密钥；
- [x] 地图主容器挂载真实高德矢量底图，支持拖拽、缩放；
- [x] 批量执行黄冈至郧阳各段高德实路算路；
- [x] 渲染真实道路 Polyline（Day 1 橙色、Day 2 绿色、选中段高亮蓝色）；
- [x] 实现点击左侧 Segment 联动地图自动聚焦与高亮；
- [x] 实现切换 RouteOption 时即刻重绘该段路线并动态计算对比增量，联动刷新全局里程/时间统计；
- [x] 接入高德实时交通图层（TrafficLayer）与右上角图例开关；
- [x] 完成实际 Chrome 自动化测试并生成 6 张高清截图，输出 `ACCEPTANCE_REPORT.md`。

### Phase C：沿路线走廊 POI 搜索系统（已完成 ✅）
- [x] 编写点到折线垂距与抽样算法（`sampleCenters`, `pointToPolylineDistanceKm`）；
- [x] 接入高德 `AMap.PlaceSearch`；
- [x] 支持“全程”与“当前路段”双模式搜索；
- [x] 搜索结果去重、计算距路线 km、按顺路程度排序；
- [x] 地图渲染设施 Marker 与自定义图标。

### Phase C.1：POI 搜索可靠性与结果质量收口（已完成 ✅）
- [x] 绕行距离语义纠正：明确几何估计命名为 `estimatedDetourKm`，统一文案为“预计绕行约 +X km”；预留真实测算接口 `calculateRealDetour` 并提供【实路测算】能力；
- [x] 全局受控调度队列：严控并发上限 `MAX_SEARCH_CONCURRENCY = 2` 与任务延迟 `TASK_SPACING_MS = 40ms`，杜绝 QPS 溢出报错；
- [x] 代际令牌与旧请求拦截：引入 `activeSearchGeneration`，快速连续换词时主动清理旧代际队列，旧任务直接丢弃绝不覆盖最新结果；
- [x] 结果缓存与去重：短时间重复搜索复用内存缓存（5 分钟 TTL），在途请求复用 Promise；
- [x] 综合相关度评分排序：综合垂距得分（0~50）、官方评分（0~30）、激活路段加权（0/15）、分类匹配（0/5）智能排序；
- [x] 列表截取与分页交互：默认展示 Top 20 最相关地点，支持一键展开/收起；全程模式按 Day 与 Segment 层次结构分组呈现；
- [x] 自动化专项回归测试：编写并通过 `test-phase-c1.mjs`，五项专项指标 100% PASS。

### Phase D：Trip Timeline & Overnight Decision (行程时间轴与住宿决策系统)

> **重新定义说明**：原 Phase D 规划的“加入停靠点、真实路线重算、Undo、Marker 联动”等能力已在 Phase B/C/C.1 中圆满落地。本阶段聚焦将规划器升级为真正的“自驾行程编排器”，核心解决“今天开到哪里”、“住广水还是随州”、“如果今晚住这里明天还剩多少路”的行宿决策问题。

#### 1. Trip 数据结构扩展设计
- **`OvernightStop`** (`src/types/trip.ts`)：
  - `id`: 唯一标识（如 `overnight-poi-123`）
  - `poiId`, `name`, `coord: [number, number]`, `address`, `city`
  - `day`: 对应结束的天数（通常为 Day 1）
  - `sourceSegmentId`: 来源路段（如 `s3`）
  - `targetCityOrArea`: 城市归属（如 “广水市” / “随州市”）
  - `rating`: 酒店评分
  - 动态计算属性：`todayDrivingKm`, `todayDrivingDurationSec`, `todayEta`, `tomorrowRemainingKm`, `tomorrowRemainingDurationSec`, `decisionTag` ('more_balanced' | 'today_relaxed' | 'tomorrow_relaxed'), `decisionLabel` ('更均衡' | '今天更轻松' | '明天更轻松'), `decisionReason`。
- **`TimelineItem`** (`src/types/trip.ts`)：
  - `id`, `day`: 天数 (1 | 2)
  - `type`: 'departure' | 'segmentStart' | 'segmentEnd' | 'waypoint' | 'overnight' | 'rest' | 'meal'
  - `title`: 节点名称（如 “黄冈师范学院出发”、“麻城市”、“今晚住宿·广水应山饭店”）
  - `subTitle`: 辅助说明（如 “国道平稳北上”、“休息 15 分钟”）
  - `plannedTime`: 预计时间（如 “12:00”、“13:45”；若未算完则必须严格显示 “等待路线数据”，严禁假数字）
  - `durationMinutes`: 耗时或停留分钟数
  - `distanceKm`: 距离
  - `isOvernight`: 是否为住宿节点
  - `isPendingRoute`: 是否处于等待路线数据态
- **`DayPlan` & Trip Store 扩充** (`src/types/trip.ts`, `src/store/useTripStore.ts`)：
  - `dayStartTimes: Record<number, string>`：用户可设定的各天出发时间（Day 1 默认 '12:00'，Day 2 默认 '09:00'）
  - `overnightStop: OvernightStop | null`：当前生效的住宿停靠点
  - `overnightCandidates: OvernightStop[]`：住宿候选列表（支持 2～3 个方案横向对比）
  - `isComparisonModalOpen: boolean`：住宿对比抽屉/弹窗开闭状态

#### 2. Overnight Stop 如何改变 Day 边界
- 原始边界：Day 1 包含 s1、s2、s3（结束于随州市区 stops[5]）；Day 2 包含 s4、s5、s6（起始于随州市区 stops[5]）。
- 设定 Overnight Stop 后的动态边界调整：
  - **Day 1 终点重定向**：s3 终点从随州市区变为该住宿点坐标（`customEndCoord: overnightStop.coord`, `customEndName: overnightStop.name`）。
  - **Day 2 起点重定向**：s4 起点从随州市区变为该住宿点坐标（`customStartCoord: overnightStop.coord`, `customStartName: overnightStop.name`）。
  - **途经逻辑保障**：若住宿点选在广水，Day 2 的 s4 自动将随州与枣阳设为途经节点，路线依然沿走廊前往襄阳。
  - **取消住宿恢复**：清除 `overnightStop` 时，s3 与 s4 清空自定义端点坐标，自动重新请求高德算路，恢复默认 随州市区 衔接。

#### 3. 时间如何传播 (Time Propagation)
- 出发时间基准：Day 1 依据 `dayStartTimes[1]`（如 12:00）。
- 动态推算逻辑：
  - 当前路段若高德算路就绪：`到达时间 = 出发时间 + segment.time / 60`；
  - 途经点与站点中途停留：自动计算途经与到站休整时间（默认段间休息 15 分钟）；
  - 下一路段出发时间 = 上一路段到达时间 + 休整时间；
  - 若用户将 Day 1 出发时间由 12:00 调整为 10:30，所有后续节点的 `plannedTime` 自动按差值实时前移 90 分钟；
  - 若任一处于前置链路的路段算路未完成（`routeResults` 尚无数据），时间轴上该节点及后续节点一律显示“等待路线数据”，不采用假静态数字。

#### 4. 设置住宿后哪些 Segment 要重新规划
- **受影响路段**：严格仅重新计算 `s3`（Day 1 收车段）与 `s4`（Day 2 发车段）。
- **不受影响路段**：`s1`、`s2`、`s5`、`s6` 保持原样，算路缓存不作废，最大化节省网络请求并规避高德 QPS 限流。

#### 5. 如何避免破坏现有 RouteOption
- `s6` 拥有 3 种 RouteOption（普通路线、环库风景路线★、风景折中路线）及复杂的差值计算，其起点为丹江口、终点为郧阳，不受广水/随州住宿调整影响。
- `Segment` 的扩展字段采用可选方式（`customStartCoord`, `customEndCoord`），完全兼容原有 `stops[segment.start]` 索引取点机制。
- 方案选择状态 `selectedOptions` 与自定义途经点 `customWaypoints` 映射字典保持不变。

#### 6. UI 放置策略
- **地图为第一视觉中心**：严禁新增第四个永久侧栏。
- **左侧侧栏 (SidebarLeft)**：
  - 顶部增加 Day 快速切换：`[全程] [DAY 1] [DAY 2]`，点击直观切换地图高亮与聚焦范围；
  - Day 标题区集成出发时间调节控件（如 `出发: 12:00 [修改]`）；
  - 各 Day 下增加可展开的“行程时间轴”，直观展示各段行驶用时与到达时点；
  - Day 1 尾部明确呈现【今晚住宿】状态卡片，并提供【🏨 住宿方案比较】快捷入口。
- **右侧设施面板 (FacilityTab / FacilityCard)**：
  - 酒店/民宿类卡片增加【设为今晚住宿】按钮（与现有【加入停靠点】并存，语义独立）；
  - 全程搜索模式下，酒店卡片动态显示“若设为今晚住宿：今日 XhXXm · 明日 XhXXm · 预计 XX:XX 到达”。
- **住宿位置决策抽屉/弹窗 (OvernightDecisionModal)**：
  - 采用轻量毛玻璃抽屉/弹窗展示 2～3 个候选方案（广水住宿 vs 随州住宿 vs 用户选定住宿）；
  - 横向对比：今日驾驶（km/h/ETA）、明日剩余（km/h）、两日负荷条形对比、可解释标签（【更均衡】、【今天更轻松】、【明天更轻松】）；
  - 提供【选用此方案】与【取消住宿恢复默认】按钮。
- **地图联动**：
  - 住宿点在地图上渲染醒目的专属床图标 Marker（`🛏`），明确呈现 Day 1 终点与 Day 2 起点；
  - 点击 `🛏` Marker 打开浮窗，展示酒店信息、到达时间、今日驾驶与明日剩余，并可一键打开对比弹窗。

#### 7. 哪些旧 Phase D 内容已完成因此不再重复
- [x] POI 分类过滤（全部/酒店/餐饮/油站/充电/厕所/停车）：已在 Phase C 完成。
- [x] 列表卡片与地图 Marker 的双向聚焦联动（点击平滑移动与打开 InfoWindow）：已在 Phase C 完成。
- [x] 【加入停靠点】与 Undo 撤销功能：已在 Phase B/C 完成并在 `test-acceptance.mjs` 中持续验证。
- [x] 走廊搜索并发调度与防抖缓存：已在 Phase C.1 完成。

#### 8. Phase D 专项验收标准
- **TEST D01**：设置 Day 1 出发时间 12:00，时间轴正确生成，各节点包含时间或明确显示“等待路线数据”。
- **TEST D02**：将出发时间改为 10:30，所有后续到达时间同步前移 1.5 小时。
- **TEST D03**：搜索“酒店”，将广水某酒店设为 Day 1 Overnight Stop，验证 Day 1 在酒店结束、Day 2 从酒店开始。
- **TEST D04**：把住宿从广水改成随州，验证两天路线和时间重新计算，s3 与 s4 更新。
- **TEST D05**：同时加入 2～3 个住宿候选，打开并展示住宿方案比较界面。
- **TEST D06**：比较卡正确显示今日驾驶里程/时间、预计到达时间、明日剩余里程/时间，并带有可解释推荐标签。
- **TEST D07**：取消 Overnight Stop，恢复原始 Day 边界（随州市区衔接）。
- **TEST D08**：原有功能全面回归：Phase A/B/C/C.1 测试 100% PASS。

### Phase E：沿途视频模块与空间绑定
- [ ] 录入湖北自驾/丹江口环库真实视频参考（B站、抖音、小红书）；
- [ ] 实现平台 Tab 过滤与主卡/次卡布局；
- [ ] 点击视频地图定位至拍摄路段与观景点；
- [ ] 实现应用内 VideoModal 播放器与优雅降级外跳。

### Phase F：体验润色、实时路况与导航闭环
- [ ] 完善高德 App 分段导航调起；
- [ ] 移动端响应式适配（下抽屉与折叠优化）；
- [ ] 全程测试验证与控制台零报错审计；
- [ ] 输出最终使用文档与交付说明。

---

## 22. 每一阶段的验收条件 (Acceptance Criteria)

| 阶段 | 核心验收标准 |
| :--- | :--- |
| **Phase A** | 1. 桌面端三栏布局与参考图视觉语言统一，比例协调；<br>2. 顶栏搜索框具备“全程/当前路段”切换；<br>3. 右侧“沿途视频/沿途设施”共享同一 Tab 空间无缝切换；<br>4. 控制台无任何报错。 |
| **Phase B** | 1. 高德底图正常渲染，无需手动配置 Key；<br>2. 真实绘制出黄冈至郧阳 6 段真实避高速路线；<br>3. 点击不同 Segment 地图平滑平移聚焦并高亮；<br>4. 切换 RouteOption，路线与里程/耗时数据真实联动。 |
| **Phase C** | 1. 顶部输入“酒店”或“充电站”，能在地图上沿实际路线走廊绘制出 POI 标记；<br>2. 切换“当前路段”与“全程”能正确缩放搜索范围；<br>3. POI 卡片清晰标注“距路线 X km”。 |
| **Phase C.1** | 1. 连续搜索防丢弃与旧任务清理；<br>2. 重复搜索缓存命中；<br>3. 全程并发受控 <= 2；<br>4. 结果 Top 20 截取平滑展开；<br>5. 绕行文案合规为“预计绕行约 +X km”。 |
| **Phase D** | 1. Day 1/Day 2 出发时间支持用户调整并驱动时间轴全线动态前移/后移；<br>2. 酒店设施支持【设为今晚住宿】，重定义 Day 1 终点与 Day 2 起点；<br>3. 支持 2～3 个住宿候选方案横向比较（今日驾驶/预计到达/明日剩余/节奏平衡）；<br>4. 地图醒目呈现 🛏 住宿 Marker 并支持气泡联动；<br>5. 支持取消住宿并恢复原始 Day 边界；<br>6. 历史回归测试全部通过。 |
| **Phase E** | 1. 视频按路线真实节点分布，点击视频卡片地图自动平移至对应风景点；<br>2. B站等可用视频可在内嵌播放器中直接播放，不可内嵌平台有明确提示与外链。 |
| **Phase F** | 1. 点击【开始导航】正确组装高德参数；<br>2. 移动端宽度（375px~768px）自适应无横向滚动条；<br>3. 控制台干净，无未处理异常。 |
