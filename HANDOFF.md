# 可交互自驾路线规划器 V2 —— 会话交接文档 (HANDOFF.md)

> **最后更新**：2026-09-26  
> **基线状态**：Phase A / Phase B 验收完成，TEST 01 ～ TEST 14 全数通过，路线策略完成深度重构。  
> **使用说明**：后续所有开发会话优先读取本文件作为真实上下文基线，严禁推测或依赖历史记忆。

---

## 1. 当前已经完成什么

1. **工程基座与架构**：
   - React 19 + TypeScript + Vite 6 + Tailwind CSS + Zustand。
   - 三栏响应式工作台（左侧行程 22%、中间地图与方案 48%、右侧内容面板 30%），1:1 还原 `01-video-tab-layout.png`。
2. **高德 JS API 2.0 深度集成**：
   - 凭据脱敏治理：使用 `.env.local` 注入 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_JS_CODE`。
   - 黄冈至郧阳湖北自驾走廊 6 个 Segment 实路规划与 Polyline 分段渲染。
   - 丹江口至郧阳 (s6) 3 种方案卡片对比（普通路线、环库风景路线★推荐、风景折中路线），动态计算里程/时间增量。
   - 实时路况图层（TrafficLayer）与右上角图例开关联动。
3. **路线策略与适配器架构**：
   - 统一抽象 `RoutePreference { avoidHighway, avoidToll, avoidCongestion }`。
   - 真实核验并实现 JS API 2.0 (`AMap.DrivingPolicy`)、Web Service 2.0 (`/v5/direction/driving`) 和 URI API 三套相互隔离的适配器，消除 policy 混用。
4. **沿途设施与走廊检索基础**：
   - 支持顶部搜索框（“全程”与“当前路段”双作用域）。
   - 沿路线折线垂距几何计算（`pointToPolylineDistanceKm`）与设施过滤。
   - 右侧“沿途视频”与“沿途设施”Tab 共享面板无缝切换。
   - 设施卡片【+ 加入停靠点】动态插入 Driving 并重算路线，支持 Undo 撤销恢复。

---

## 2. 当前真实可运行状态

- **构建命令**：`npm run build` -> `tsc && vite build`，**0 报错，0 告警**，产物体积 ~300 kB。
- **本地服务**：`http://127.0.0.1:5173/` 正常运行。
- **浏览器控制台**：**0 错误**（内置 SVG Favicon，排除 404 资源警报）。
- **初始化算路**：采用优先计算激活段 + 队列平滑算路机制，页面加载后**全程 6/6 段 711 km 规划成功率 100%**。

---

## 3. 已知技术债与修复记录

| 检查项 | 状态 | 详情与治理措施 |
| :--- | :--- | :--- |
| **高德 Driving 并发限流** | **已修复** | 移除初始 8 请求并发轰炸；在 `amapService.ts` 引入指数退避重试，在 `CenterMapArea.tsx` 引入平滑队列，全程段数从丢包的 2/6 升至稳定 6/6。 |
| **TEST 06 Policy 映射混用** | **已修复** | 查明 JS API 2.0 中 `policy: 5` 实际为 `MULTI_POLICIES` 且走高速（过路费 ¥37）；全面重构为 `mapPreferenceToAMapJsApiPolicy`（不走高速且避免收费返回 `7`）、`mapPreferenceToWebServiceStrategy` 与 `mapPreferenceToUriPolicy`。 |
| **POI 城市硬编码** | **已修复** | 移除 `FacilityCard` 与 `CenterMapArea` 中的 `city: '十堰市'`，改为基于 POI 地址正则识别或终点城市回退。 |
| **全程采样覆盖截断** | **待深化 (Phase C)** | `sampleCenters` 原实现上限锁死为 12 个，对 600km+ 全程搜索后半段存在抽样遗漏，需优化动态采样步长与半径覆盖。 |
| **设施分类类型码检索** | **待深化 (Phase C)** | `corridorSearch.ts` 目前以中文关键词正则或模糊词为主，需升级为高德官方 POI `type` 分类码结合关键字，提高检索顺路地点的召回率与准确度。 |

---

## 4. 当前 API 架构

```text
[ 用户偏好抽象: RoutePreference ]
  ├─ avoidHighway (不走高速)
  ├─ avoidToll (尽量少收费)
  └─ avoidCongestion (躲避拥堵)
       │
       ├──> [ AMap JS API 2.0 DrivingPolicy Adapter ] -> policy (7: 避高速+少收费, 9: 避高速+避拥堵, 6: 避高速)
       │    (用于前端地图底图与实时 Driving 交互渲染)
       │
       ├──> [ Web Service 2.0 Strategy Adapter ] -> strategy (43: 避拥堵+少收费+不走高速, 42, 40, 35)
       │    (用于未来服务端/代理端高精度组合策略算路)
       │
       └──> [ AMap URI Navigation Adapter ] -> policy (3: 避高速, 2: 避收费, 1: 避拥堵)
            (用于移动端 App 调起 amapuri:// 与桌面端网页导航)
```

---

## 5. 当前核心数据模型

- **`Trip` / `Segment` / `RouteOption`** (`src/types/trip.ts`)：
  - `Segment`: `id`, `day`, `title`, `start`, `end`, `chosen`, `options`
  - `RouteOption`: `id`, `name`, `tagTitle`, `via`, `comparisonNote`, `highlights`
- **`RoutePoi`** (`src/types/poi.ts`)：
  - `id`, `name`, `category` (hotel | food | gas | ev | toilet | parking), `coord`, `distanceToRoute`, `detourDistance`, `sourceSegmentId`
- **`RoutePreference`** (`src/types/preference.ts`)：
  - `avoidHighway`, `avoidToll`, `avoidCongestion`
- **`RouteCalcResult`** (`src/types/map.ts`)：
  - `path`: `[lng, lat][]`, `distance` (米), `time` (秒), `tolls` (元), `roads`: `string[]`

---

## 6. 下一阶段入口 (Phase C)

- **核心主题**：**沿路线走廊 POI 搜索系统深度完善**。
- **入口文件**：
  - `src/services/corridorSearch.ts`
  - `src/utils/geo.ts`
  - `src/components/search/CorridorSearchBox.tsx`
  - `src/components/facilities/FacilityTab.tsx`
  - `src/services/amapService.ts` (`renderPoiMarkers`)

---

## 7. 不得破坏的产品原则

1. **高德是底层基础设施，不是外跳壳子**：地图、道路、折线、POI、实时交通与路况均在当前工作台内闭环；只有真正自驾出发时，高德 App / Universal Link 才是主要出口。
2. **Trip 为容器，Segment 为核心，Route Option 为决策单元**：分段独立规划、独立高亮、独立搜索。
3. **共享面板 Tab 互斥切换**：沿途视频与沿途设施必须继续共享右侧同一个面板，通过顶部 Tab 切换，严禁拆成两个堆叠面板。
4. **路线走廊搜索真实沿路**：顶部搜索框必须保持“全程”与“当前路段”双作用域，并沿真实路线 Polyline 走廊抽样搜索与计算垂距，严禁退化为以地图中心为圆心的粗暴辐射搜索。
