# 可交互自驾路线规划器 V2 —— 会话交接文档 (HANDOFF.md)

> **最后更新**：2026-09-26  
> **基线状态**：Phase A / Phase B / Phase C / Phase C.1 全数交付完成，所有自动化测试 100% 通过（基准 TEST 01～14 + Phase C 走廊验证 + Phase C.1 搜索可靠性专项验证）。  
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

---

## 2. 当前真实可运行状态与测试证据

- **构建命令**：`npm run build` -> `tsc && vite build`，**0 报错，0 告警**，产物体积 ~316 kB。
- **本地服务**：`http://127.0.0.1:5173/` 正常运行。
- **自动化测试通过率**：
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
  - `Segment`: `id`, `day`, `title`, `start`, `end`, `chosen`, `options`
  - `RouteOption`: `id`, `name`, `tagTitle`, `via`, `comparisonNote`, `highlights`
- **`RoutePoi`** (`src/types/poi.ts`)：
  - `id`, `name`, `category` (hotel | food | gas | ev | toilet | parking), `coord`, `distanceToRoute`, `estimatedDetourKm`, `sourceSegmentId`, `sourceDay`, `relevanceScore`
- **`RoutePreference`** (`src/types/preference.ts`)：
  - `avoidHighway`, `avoidToll`, `avoidCongestion`
- **`RouteCalcResult`** (`src/types/map.ts`)：
  - `path`: `[lng, lat][]`, `distance` (米), `time` (秒), `tolls` (元), `roads`: `string[]`

---

## 6. 下一阶段入口 (Phase D)

- **核心主题**：**沿途设施深度交互与加入停靠点**（在 Phase C.1 高质量搜索数据底座之上推进）。
- **原计划规划的目标与待解决问题**：
  1. 设施卡片【+ 加入停靠点】真操作深度化：将 POI 动态插入当前 Segment 的 `customWaypoints` 并触发真实高德 Driving 算路；
  2. 路线即时重算与增量更新：路线 Polyline、里程、预计时间、通行费实时联动刷新，顶部统计即时变化；
  3. 停靠点管理与撤销（Undo）：支持已加入停靠点的排序、移除与恢复；
  4. 地图停靠点序号 Marker 与弹窗卡片交互联动；
  5. 道路经过点核对与提示（通过设施所在路段更新 `steps[].road`）。

---

## 7. 不得破坏的产品原则

1. **高德是底层基础设施，不是外跳壳子**：地图、道路、折线、POI、实时交通与路况均在当前工作台内闭环；只有真正自驾出发时，高德 App / Universal Link 才是主要出口。
2. **Trip 为容器，Segment 为核心，Route Option 为决策单元**：分段独立规划、独立高亮、独立搜索。
3. **共享面板 Tab 互斥切换**：沿途视频与沿途设施必须继续共享右侧同一个面板，通过顶部 Tab 切换，严禁拆成两个堆叠面板。
4. **路线走廊搜索真实沿路**：保持“全程”与“当前路段”双作用域，严控全局并发 <= 2，严禁绕过全局调度队列发起并发请求。
