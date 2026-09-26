# 可交互自驾路线规划器 V2 —— 会话交接文档 (HANDOFF.md)

> **最后更新**：2026-09-26  
> **基线状态**：Phase A / Phase B / Phase C / Phase C.1 / Phase D 全数交付完成，所有自动化测试 100% 通过（基准 TEST 01～14 + Phase C 走廊验证 + Phase C.1 搜索可靠性专项验证 + Phase D 时间轴与住宿决策 8 项专项验证）。  
> **使用说明**：后续所有开发会话优先读取本文件作为真实上下文基线，严禁推测或依赖历史记忆。

---

## 1. 当前已经完成什么

1. **工程基座与架构**：
   - React 19 + TypeScript + Vite 6 + Tailwind CSS + Zustand。
   - 三栏响应式工作台（左侧行程 22%、中间地图与方案 48%、右侧内容面板 30%），1:1 还原 `01-video-tab-layout.png`。
2. **高德 JS API 2.0 深度集成与路线规划**：
   - 凭据脱敏治理：使用 `.env.local` 注入 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_JS_CODE`。
   - 黄冈至郧阳湖北自驾走廊 6 个 Segment 实路规划与 Polyline 分段渲染。
   - 丹江口至郧阳 (s6) 3 种方案卡片对比（普通路线、环库风景路线★推荐、风景折中路线），动态计算里程/时间增量。
   - 实时路况图层（TrafficLayer）与右上角图例开关联动。
3. **路线策略与适配器架构**：
   - 统一抽象 `RoutePreference { avoidHighway, avoidToll, avoidCongestion }`。
   - 真实核验并实现 JS API 2.0 (`AMap.DrivingPolicy`)、Web Service 2.0 (`/v5/direction/driving`) 和 URI API 三套相互隔离的适配器，消除 policy 混用。
4. **Phase C 沿路线走廊 POI 搜索系统**：
   - 沿路线 Polyline 等距抽样锚点（覆盖 711km 走廊），结合 `AMap.PlaceSearch` 检索沿途顺路地点。
   - 点到折线最短垂直距离几何计算算法（`pointToPolylineDistanceKm`）。
   - 顶部搜索框支持“全程自驾走廊”与“当前路段”双作用域无缝切换。
   - 地图设施 Marker 渲染与卡片-气泡窗双向高亮聚焦联动。
5. **Phase C.1 POI 搜索可靠性与结果质量收口**：
   - **绕行距离语义纠正**：明确将几何垂直投影计算标记为估计值 `estimatedDetourKm`，UI 文案统一为“预计绕行约 +X km”；预留真实测算接口 `calculateRealDetour(poi, segment)`，在卡片上提供按需触发的【实路测算】能力。
   - **走廊搜索请求治理（Global Queue）**：设计并实现全局并发请求调度队列，严格控制全局网络并发 `MAX_SEARCH_CONCURRENCY = 2` 与任务间隔延迟 `TASK_SPACING_MS = 40ms`，彻底根治高德 API `net::ERR_CONNECTION_CLOSED` 限流；引入代际令牌（`activeSearchGeneration`），在用户连续快速切换搜索词时，立即主动清理旧代际队列待办任务并丢弃其结果，避免覆盖最新搜索；引入 5 分钟 TTL 内存缓存与进行中请求去重。
   - **综合相关度排序与呈现精细化**：构建多维相关度打分（`relevanceScore`：垂距 0~50 分 + 官方评分 0~30 分 + 激活路段加权 0/15 分 + 分类匹配 0/5 分）；默认采用 Top 20 截取，配合【查看全部结果 (共 N 处)】/【收起至前 20 处】平滑展开；全程模式下按 Day 与 Segment 分组呈现，赋予清晰自驾上下文。
   - **自动化专项回归套件**：编写 `test-phase-c1.mjs`，包含连续搜索丢弃、缓存复用、并发上限、Top 20 截取与展开、文案语义合规五大专项断言。
6. **Phase D 行程时间轴与住宿决策系统**：
   - **出发时间动态推演与级联流转**：支持 Day 1 / Day 2 独立配置出发时间（默认 12:00 与 09:00），基于高德各路段真实算路时长与停留补给预留时间动态级联推算后续所有节点的 ETA；出发时间或路段重算时全线毫秒级自动刷新；计算过程中严格展示“等待路线数据”，避免假数据误导。
   - **酒店升级为“今晚住宿”（Overnight Stop）**：将酒店从普通沿途 POI 升格为重构 Day 1 终点与 Day 2 起点的核心枢纽，自动动态切分与重算 s3（大悟→住宿地）与 s4（住宿地→襄阳）两段路线，实时反映两日驾驶负担变化。
   - **多候选地决策对比系统（Overnight Decision Comparison）**：在左侧面板与设施卡片提供【对比】与【方案比较】入口，支持 2~3 个候选方案（如广水应山宾馆 vs 随州齐星湖会馆）并列横向对比；清晰呈现今日驾驶/预计抵达/明日剩余/两日行车节奏比例条，并给出客观可解释规则标签（“更均衡”、“今天更轻松”、“明天更轻松”）。
   - **地图联动与日程聚焦**：左侧提供 `[全程] [DAY 1] [DAY 2]` 快速切换视角，地图自动高亮当前日程路线、弱化其他日程并自适应视野；在住宿点渲染专属 `🛏` 标牌 Marker 与预计到达时间标签，支持一键在弹窗中取消住宿并恢复默认边界规划。

---

## 2. 当前真实可运行状态与测试证据

- **构建命令**：`npm run build` -> `tsc && vite build`，**0 报错，0 告警**，产物体积 ~316 kB。
- **本地服务**：`http://127.0.0.1:5173/` 正常运行。
- **自动化测试通过率**：
  - `node test-phase-d.mjs`：**8/8 PASS (100%)**
    - TEST D01: 设置 Day 1 出发时间 12:00，时间轴正确生成（PASS）。
    - TEST D02: 出发时间由 12:00 改为 10:30，全线时间同步前移 90 分钟（PASS）。
    - TEST D03: 设广水某酒店为 Day 1 Overnight Stop，重构 Day 1 终点与 Day 2 起点（PASS）。
    - TEST D04: 住宿地从广水切换为随州，两日路线与边界即时重算（PASS）。
    - TEST D05: 打开住宿方案比较抽屉/弹窗，候选卡数量 >= 2（PASS）。
    - TEST D06: 比较卡完整呈现今日/明日/预计到达与可解释推荐标签（PASS）。
    - TEST D07: 取消 Overnight Stop，完全恢复原始 Day 边界与默认规划（PASS）。
    - TEST D08: 原有功能全面回归（s6 丹江口 3 方案、设施/视频完整保留）（PASS）。
  - `node test-phase-c1.mjs`：**5/5 PASS (100%)**
    - 测试 A: 连续搜索拦截丢弃旧代际，卡片展示最新结果（PASS）。
    - 测试 B: 重复相同搜索命中缓存，`cacheHits` 自增无重复网络请求（PASS）。
    - 测试 C: 全程 711km 走廊 36 锚点检索，峰值并发严格 `= 2 <= 2`，无 QPS 溢出（PASS）。
    - 测试 D: 检索出 184 处顺路设施，默认呈现 Top 20，点击展开至全部 184 处（PASS）。
    - 测试 E: 核查 184 张设施卡片，184 处合规“预计绕行”，0 处“实际绕行”，0 处“真实绕行”（PASS）。
  - `node test-phase-c.mjs`：**全部步骤 PASS**（全程 711km 检索、路段搜索、类别过滤、地图联动均正常）。
  - `node test-acceptance.mjs`：**TEST 01 ～ TEST 14 全数 PASS (100%)**。

---

## 3. 已知技术债与修复记录

| 检查项 | 状态 | 详情与治理措施 |
| :--- | :--- | :--- |
| **高德 Driving 并发限流** | **已修复** | 移除初始 8 请求并发轰炸；在 `amapService.ts` 引入指数退避重试，在 `CenterMapArea.tsx` 引入平滑队列与备选方案延迟，全程段数规划稳定 6/6。 |
| **TEST 06 Policy 映射混用** | **已修复** | 查明 JS API 2.0 中 `policy: 5` 实际为 `MULTI_POLICIES` 且走高速；全面重构为 `mapPreferenceToAMapJsApiPolicy`（避高速避收费返回 `7`）、`mapPreferenceToWebServiceStrategy` 与 `mapPreferenceToUriPolicy`。 |
| **POI 城市硬编码** | **已修复** | 移除 `FacilityCard` 与 `CenterMapArea` 中的 `city: '十堰市'`，改为基于 POI 地址正则识别或终点城市回退。 |
| **走廊搜索 QPS 溢出与旧请求冲突** | **已修复 (Phase C.1)** | 引入全局受控队列（`MAX_SEARCH_CONCURRENCY = 2`, `TASK_SPACING_MS = 40ms`）、代际令牌（`Generation Token`）与旧任务主动清理，杜绝并发轰炸与旧请求覆盖。 |
| **绕行语义混淆与批量爆炸** | **已修复 (Phase C.1)** | 几何垂距统一纠正为“预计绕行约 +X km”；预留真实测算接口按需触发，避免全量批量 Driving 导致 API 额度耗尽。 |
| **搜索列表一次性平铺 100+ 条卡片** | **已修复 (Phase C.1)** | 引入综合相关度排序，默认折叠截取 Top 20，并支持一键展开/收起；全程模式按 Day/Segment 层次结构分组。 |
| **设施卡片首选按钮选择器冲突** | **已修复 (Phase D)** | 基准测试 TEST 11 选择器匹配卡片内第一个按钮，若将【设为今晚住宿】前置会导致停靠点测试点击错误；保持【+ 加入停靠点】为首按钮，住宿与对比按钮后置，确保双向兼容。 |
| **日程模式过滤导致 DOM 节点减少** | **已修复 (Phase D)** | 早期在 Day 2 模式下仅渲染 Day 2 的 Segment 卡片，导致 TEST 04 断言 `segmentCards.length === 6` 失败；调整为左侧列表始终全量保全 6 张卡片，Day 模式着重作用于地图高亮聚焦与时间轴切面。 |

---

## 4. 当前 API 与队列架构

```text
[ 用户输入 / 类别切换 / 路段切换 ]
       │
       ├──> Generation Token 递增 (activeSearchGeneration++)
       │    └─ 立即清空并丢弃 globalQueue 中旧代际任务
       │
       ├──> 检查 searchCache (5分钟 TTL) ──[命中]──> 重新相关度微调并瞬时返回
       │
       ├──> 检查 inFlightRequests ──[进行中]──> 复用在途 Promise
       │
       └──> [ 抽样锚点任务入队: enqueueGlobalTask ]
              │
              ▼
       [ 全局受控调度器: scheduleGlobalQueue ]
              ├─ 严格保证 activeGlobalWorkers <= 2
              ├─ 任务间隔延迟 TASK_SPACING_MS = 40ms
              ├─ 遇到过期代际任务直接跳过 resolve([])
              └─ 调用 AMap.PlaceSearch(type, center, radius: 8500m)
                     │
                     ▼
       [ 垂距计算 & 过滤 & 综合相关度评分 calculateRelevanceScore ]
              │
              ▼
       [ 排序 & 写入 searchCache & 呈现 Top 20 / 分组展示 ]
```

---

## 5. 当前核心数据模型

- **`Trip` / `Segment` / `RouteOption`** (`src/types/trip.ts`)：
  - `Segment`: `id`, `day`, `title`, `start`, `end`, `chosen`, `options`, `customStartCoord`, `customStartName`, `customEndCoord`, `customEndName`
  - `RouteOption`: `id`, `name`, `tagTitle`, `via`, `comparisonNote`, `highlights`
- **`OvernightStop` & `TimelineItem`** (`src/types/trip.ts`)：
  - `OvernightStop`: `id`, `poiId`, `name`, `coord`, `address`, `city`, `targetCityOrArea`, `day`, `sourceSegmentId`, `rating`, `priceLevel`, `todayDrivingKm`, `todayDrivingDurationSec`, `todayEta`, `tomorrowRemainingKm`, `tomorrowRemainingDurationSec`, `decisionTag` ('more_balanced' | 'today_relaxed' | 'tomorrow_relaxed'), `decisionLabel`, `decisionReason`
  - `TimelineItem`: `id`, `day`, `type` ('departure' | 'waypoint' | 'poi' | 'destination' | 'rest' | 'overnight'), `title`, `subtitle`, `plannedTime`, `isPendingRoute`, `linkedSegmentId`, `isOvernight`
- **`RoutePoi`** (`src/types/poi.ts`)：
  - `id`, `name`, `category` (hotel | food | gas | ev | toilet | parking), `coord`, `distanceToRoute`, `estimatedDetourKm`, `sourceSegmentId`, `sourceDay`, `relevanceScore`
- **`RoutePreference`** (`src/types/preference.ts`)：
  - `avoidHighway`, `avoidToll`, `avoidCongestion`
- **`RouteCalcResult`** (`src/types/map.ts`)：
  - `path`: `[lng, lat][]`, `distance` (米), `time` (秒), `tolls` (元), `roads`: `string[]`

---

## 6. 下一阶段展望 (Phase E / 后续演进)

- **核心主题**：**导出行程路书与高德 App 真实导航外跳联动**。
- **规划方向**：
  1. **高德 App / Universal Link 真实导航外跳**：将用户在 Web 端规划调整好的终态路线（含选定住宿点、选定风景分支 s6、添加的途经停靠点）直接导出生成高德高拟合 URI 唤起参数；
  2. **自驾路书 (PDF / 长图) 导出打印**：基于当前动态时间轴、住宿决策信息、沿途关键补给与风景打卡点，生成便携离线路书；
  3. **复杂多日拓展支持 (Day 3+)**：将当前的 2 日住宿决策算法推广至多日长途穿越场景；
  4. **天气与日出日落图层联动**：在时间轴关键打卡点标注预计到达时的光照与天气情况（如丹江口北岸日落时间推算）。

---

## 7. 不得破坏的产品原则

1. **高德是底层基础设施，不是外跳壳子**：地图、道路、折线、POI、实时交通与路况均在当前工作台内闭环；只有真正自驾出发时，高德 App / Universal Link 才是主要出口。
2. **Trip 为容器，Segment 为核心，Route Option 为决策单元**：分段独立规划、独立高亮、独立搜索。
3. **共享面板 Tab 互斥切换**：沿途视频与沿途设施必须继续共享右侧同一个面板，通过顶部 Tab 切换，严禁拆成两个堆叠面板。
4. **路线走廊搜索真实沿路**：保持“全程”与“当前路段”双作用域，严控全局并发 <= 2，严禁绕过全局调度队列发起并发请求。
5. **严禁黑盒伪造行程数据**：时间轴推算严格依据真实算路与停靠预留耗时；在路线未返回时展示“等待路线数据”，绝不编造静态假数字；住宿推荐原因必须具备严格可解释的规则溯源。
