# 可交互自驾路线规划器 V2 —— 会话交接文档 (HANDOFF.md)

> **最后更新**：2026-09-26  
> **当前状态**：Real-Use Fix Sprint 4（第一次真实使用反馈修复）已完成。核心功能审计状态达 **38 COMPLETE / 1 PARTIAL (#38) / 0 MISSING**。全量 10 套自动化回归测试套件 100% 全部通过。下文旧阶段记录仅供演进参考，当前结论以本节为准。
> **使用说明**：后续所有开发会话优先读取本文件作为真实上下文基线，严禁推测或依赖历史记忆。

---

## Real-Use Fix Sprint 4（2026-09-26）

针对用户第一次真实人工全流程操作反馈的 4 项严重影响自驾体验的实际问题，实施专项攻坚并彻底闭环：

- **1. 全程导航计划与接力模式 (Full Trip Navigation Plan)**：
  - **现实协议局限与免责**：高德外部 Web URI 协议单次仅支持单一目的地，杜绝将单段伪装成“一键全程”，UI 明确警示高德协议限制；
  - **决策编译器 (`buildTripNavigationPlan`)**：完整将 `Trip -> Day -> Segment -> RouteOption -> Waypoints` 编译为保全方案增量、途径点与实路数据的有序分段导航列表；
  - **双模式弹窗 (`NavigationPlanModal`)**：
    - `Overview` 全程路线确认：展示总里程（711 km）、总耗时（14h34m）、预估过路费、天数以及 6 段方案与经停点展开详情；
    - `Relay` 分步接力模式：展示“当前：第 1 / 6 段”、“下一段：XXX → XXX”，调起高德官方导航 URI 并在返程后一键推进至下一段。
- **2. 沿途影像升级与真景收录 (Route Media)**：
  - 彻底剔除违和的“车里做饭”视频（`bili-danjiangkou`）；
  - 数据模型由单一视频泛化为 `RouteMedia`（支持 `photo` 与 `video`，支持 `amap`、`web`、`bilibili`、`douyin` 等来源）；
  - 覆盖全线 6 段真实风景（龟峰山杜鹃花海、十八潭瀑布、千年银杏谷、襄阳古城、丹江口大坝、沧浪绿道），实景覆盖率 100%；
  - 诚实空状态防护：无素材时明确显示“暂未收录可靠实景影像”，绝不以无关或伪造内容充数。
- **3. 全线设施覆盖与 5-Bucket 均匀分布 (Corridor Coverage & Distribution)**：
  - 采样间隔加密至 <= 15km（上限 48 采样点），路线几何覆盖率由算法实测达 100%（>= 95%）；
  - 搜索覆盖与列表展示完全解耦（后台搜全线 100 处，列表默认截取 Top 20 并支持展开）；
  - 能源类设施（加油站/充电站）采用 **5-Progress-Bucket 桶间交错算法**（0~20%, 20~40%, 40~60%, 60~80%, 80~100%），彻底解决长途自驾“前 20km 堆满、后 500km 断档”问题；非能源类（酒店/餐饮）保留 `relevanceScore` 严格降序。
- **4. 城镇起终点可交互地点卡 (TripNode InfoWindow)**：
  - 骨干城镇节点规范化：黄冈师院、麻城、大悟、随州、襄阳、丹江口、郧阳；
  - 地图挂载 `📍` 城镇 Marker，点击调起 InfoWindow 地点卡：包含角色徽标（“全程起点”、“全程终点”等）、Day/Segment 归属、预计到达时间（ETA）与真实风景照片；
  - 提供快捷联动动作：`[查看此路段 ↗]`（直接进入路段 Focus 详情）与 `[搜索周边设施 🔍]`（注入搜索框并切至设施 Tab）。
- **验证与产物**：
  - 新增 `test-real-use-fix-4.mjs`，包含 RUF4-01-A~D, RUF4-02-A~D, RUF4-03-A~C, RUF4-04-A~C, RUF4-05-A 共 14 项专项断言，**100% PASS**；
  - 5 张浏览器实拍截图见 `docs/real-use-fix-4/`；详见专门报告 `REAL_USE_FEEDBACK.md`；
  - 全套 10 套回归测试全部 100% 绿灯。

---

## Core Fix Sprint 3（2026-09-26）

- **FIX 7：设施分类完整度** (#19 民宿, #20 餐饮, #21 加油站, #22 充电站, #23 厕所, #24 停车场, #27 分类筛选)。
  - `poiTypes.ts` 拆分独立 `homestay` 分类配置（编码 `100105|100200|100201`，图标 🏡）；
  - 规范餐饮 (`050000|...` 🍴)、加油站 (`010100|...` ⛽)、充电站 (`011100|...` ⚡)、厕所 (`200300|...` 🚾)、停车场 (`150900|...` 🅿️) 的官方编码与图标；
  - 彻底治理分类切换与已有自由词的耦合与脏词污染问题；
  - 药丸点击与列表/Marker 动态同步，过滤与展示一致。
- **FIX 8：地图 Marker → 设施列表双向联动** (#13)。
  - 点击地图 Marker 自动切换到设施 Tab；
  - 自动修正选中的类别过滤器保证该 POI 可见，若超出 Top 20 限制自动触发列表展开；
  - 依据稳定唯一 ID 匹配，高亮对应卡片（`.selected` 明显立体高亮），并平滑滚动到可见区域；
  - 在 Segment Detail（Focus 模式）与普通模式下均稳定联动。
- **FIX 9：真实住宿候选双日自驾测算与对比** (#39)。
  - 建立真实双住宿（多住宿）横向对比引擎，彻底摒弃任何伪造评分、伪造里程或虚构耗时；
  - 引入 10 分钟内存缓存与在途 Promise 去重；
  - 异步并发对各候选通过 `reconstructTripWithOvernight` 测算真实 Day1/Day2 里程与时长、ETA 和比例条；
  - 方案或停靠点变化时缓存键同步改变，自动重算；算路失败诚实展示“暂时无法获取实路数据”。
- **FIX 10：外部跳出治理** (#15)。
  - 站内具备高德完整展示能力，移除卡片上冗余的“高德详情 ↗”外跳；
  - 一级【开始导航】调用高德官方 URI 导航协议；
  - 视频弹窗外跳文案精细化标示为“打开 B站” / “打开 抖音” / “打开 小红书”。
- **验证与产物**：
  - 新增 `test-core-fix-3.mjs`，包含 FIX7-01~07, FIX8-01~04, FIX9-01~05, FIX10-01~03 全覆盖，100% PASS；
  - 生成四张真实浏览器截图于 `docs/core-fix-3/`（`01-facility-categories.png`、`02-marker-to-list.png`、`03-overnight-real-comparison.png`、`04-external-actions.png`）；
  - 全套回归测试 100% 全部通过：`test-core-fix-3.mjs`, `test-core-fix-2.mjs`, `test-core-fix-1.mjs`, `test-phase-d1.mjs`, `test-phase-d.mjs`, `test-phase-c1.mjs`, `test-phase-c.mjs`, `test-acceptance.mjs`；
  - 核心功能审计当前状态：**38 COMPLETE / 1 PARTIAL (#38) / 0 MISSING**。

---

## Core Fix Sprint 2（2026-09-26）

- 视频：逐条审计旧 8 条静态条目并移除无法对应原内容的伪标题、作者、热度与通用封面；保留一条明确未核验的抖音线索，新加入两条可在公开索引核对 URL/标题/作者的 B站内容。类型记录来源与核验状态，页面只提供原平台入口，不做脆弱 iframe。视频按当前段、方案及选中亮点过滤；坐标明确是路线参考位置，不冒充拍摄机位。详见 `docs/core-fix-2/video-provenance.md`。
- 亮点：由当前所选高德 Polyline 投影途经镇，生成进度范围并仅绘制对应橙色路线区间；方案切换清理不相关亮点。
- POI/住宿：高德缺失评分/营业状态/价格时不填假数；UI 显示“暂无评分”“营业状态未知”。不再初始化 Mock 设施和预置酒店候选。住宿比较的已选方案只有当前路线齐全才展示实路计算数据，未选候选保持等待态。
- 验证：`npm run build`、`test-core-fix-2.mjs`、`test-core-fix-1.mjs`、`test-phase-d1.mjs`、`test-phase-d.mjs`、`test-phase-c1.mjs`、`test-phase-c.mjs`、`test-acceptance.mjs` 全部通过。旧 Phase D 的 D06 断言同步接受诚实的“等待实路测算”。截图见 `docs/core-fix-2/`。审计为 **COMPLETE 28 / PARTIAL 11 / MISSING 0**。

---

## Core Fix Sprint 1（2026-09-26）

- **FIX 1：停靠点顺序**。`src/utils/geo.ts` 将 scenic via 与全部自定义停靠点投影到当前所选方案的真实 Polyline，并按累计路线进度排序后交给高德 Driving。`amapService.ts` 缓存无自定义点的参考路线；`FacilityCard.tsx` 等异步重算只接受当前点集与方案的结果。实测近线酒店新增约 2.7 km；反向加入两个酒店仍按真实路程行驶，scenic via 保留。
- **FIX 2：方案差异**。`s6` 普通路线无 via，环库经 `[9,10,11]`，折中只经 `[10]`。`routeComparison.ts` 比较实测里程、耗时、几何与主要道路序列；高度重合时方案卡明确提示。环库与折中由原来约 1 m 差异变成约 4.7 km；Detail 地图同时画当前蓝色实线和备选彩色虚线，卡片及顶部只显示高德实测数字。
- **FIX 3：稳定 Segment Detail**。Store 明确 `MapMode` 和 `viewportRevision`，中央“详细查看”进入 `segment-focus`，右栏与搜索默认聚焦当前段；“← 返回全程”恢复 Trip 视野。`CenterMapArea.tsx` 是自动 fit 的唯一调用点，设施、Marker、视频 Tab 和异步结果不会抢走视野。
- **本轮验证**：`npm run build`、`node test-core-fix-1.mjs`、`node test-phase-d1.mjs`、`node test-phase-d.mjs`、`node test-phase-c1.mjs`、`node test-phase-c.mjs`、`node test-acceptance.mjs` 全部通过。六张真实浏览器截图在 `docs/core-fix-1/`。审计当前 **COMPLETE 26 / PARTIAL 13 / MISSING 0**。
- **剩余缺口**：视频真实性与方案空间关联、POI 缺失评分/营业状态及分类准确性、住宿比较的预置数值、亮点与实路范围关联、三栏信息密度。Sprint 1 未处理这些问题。

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
   - **酒店升级为“今晚住宿”（Overnight Stop）**：将酒店从普通沿途 POI 升格为重构 Day 1 终点与 Day 2 起点的核心枢纽，自动动态切分与重算两段路线，实时反映两日驾驶负担变化。
   - **多候选地决策对比系统（Overnight Decision Comparison）**：在左侧面板与设施卡片提供【对比】与【方案比较】入口，支持 2~3 个候选方案（如广水应山宾馆 vs 随州齐星湖会馆）并列横向对比；清晰呈现今日驾驶/预计抵达/明日剩余/两日行车节奏比例条，并给出客观可解释规则标签（“更均衡”、“今天更轻松”、“明天更轻松”）。
   - **地图联动与日程聚焦**：左侧提供 `[全程] [DAY 1] [DAY 2]` 快速切换视角，地图自动高亮当前日程路线、弱化其他日程并自适应视野；在住宿点渲染专属 `🛏` 标牌 Marker 与预计到达时间标签，支持一键在弹窗中取消住宿并恢复默认边界规划。
7. **Phase D.1 行程模型泛化与完整性治理 (Trip Model Generalization & Integrity)**：
   - **消除硬编码 s3/s4 假设**：通用支持在任意路段设置住宿点，无论是路段中间停留还是路段终点边界衔接，均具备严谨的数学模型判定 (`determineOvernightPosition`) 与行程重构引擎 (`reconstructTripWithOvernight`)。
   - **路段中间智能拆分 (Middle Split)**：当住宿点选在路段中间（如广水应山宾馆），原路段 $A \to B$ 被拆分为 $A \to H$（第 1 天收车段）与 $H \to B$（第 2 天发车段），行程总段数从 6 段动态扩充至 7 段，后续路段天数归属平滑后移，各段标题清晰易懂。
   - **路段边界无损吸附 (Boundary Stop)**：当住宿点在路段终点附近（如随州齐星湖会馆），系统智能吸附前段终点与次段起点至酒店真实坐标，总段数严格保持为 6 段，绝不产生重复多余路段或重名段落。
   - **跨路段天边界动态漂移**：若将住宿改在襄阳绿地铂骊酒店，系统将自动将 Day 1 调整为 4 段（黄冈至襄阳）、Day 2 调整为 2 段（襄阳至郧阳），天边界完全由住宿决策动态主导。
   - **用户路线意图严密保全**：设置/切换住宿点前后，严格保全用户的各路段方案选择（`selectedOptions`）、风景途经点（如 s6 环库路线 `via: [9, 10, 11]`）、自定义途经点（`customWaypoints`）以及全线路线偏好（`avoidHighway` 等）。
   - **途经点与住宿点语义解耦**：`Waypoint` 为沿途经停（继续驾驶），`OvernightStop` 为日程收发分界（结束当日、开启次日）；二者数据流与时间轴表达互不干扰。
   - **泛化多日架构与消除硬编码字段**：移除 `day1StartTime` / `day2StartTime` 等专属性字段，统一采用 `dayStartTimes: Record<number, string>` 与动态 `DayPlan[]` 数组，时间轴生成器通过循环通用处理任意 $N$ 日行程。
   - **算路请求治理与代际防抖**：建立 10 分钟 TTL 算路缓存 `routeCache` 与在途请求去重 `inFlightPlans`；引入 `activeOvernightGeneration` 代际令牌，在连续快速切换 A $\to$ B $\to$ C 候选时丢弃过时异步算路，确保最终界面状态 100% 严格一致。
   - **完全恢复能力 (Zero-leak Restoration)**：取消住宿后，行程立刻无损重构回 6 段原始基线状态，Day 1 与 Day 2 段数各为 3 段，所有自定义端点坐标与标记完全清理，无残留脏数据。

---

## 2. 当前真实可运行状态与测试证据

- **构建命令**：`npm run build` -> `tsc && vite build`，**0 报错，0 告警**，产物体积 ~352 kB。
- **本地服务**：`http://127.0.0.1:5173/` 正常运行。
- **自动化测试通过率**：
  - `node test-phase-d1.mjs`：**8/8 PASS (100%)**
    - D1-01: 中间拆分成功，总段数 6->7 段，s3 收车于广水，s4 从广水发车前往随州（PASS）。
    - D1-02: 边界住宿总段数严格保持 6，无重复路段，唯一标题数 6，端点精准对齐（PASS）。
    - D1-03: 住宿改在襄阳，Day Boundary 成功后移，Day 1 变 4 段，Day 2 变 2 段（PASS）。
    - D1-04: 设置住宿后 s6 保持选中环库风景路线，环库 via points [9, 10, 11] 完整保留（PASS）。
    - D1-05: 切换住宿前后 s6 customWaypoints 严格保留（PASS）。
    - D1-06: 连续快速切换 A->B->C 住宿候选，旧代际被成功屏蔽，最终状态严格保持为 C（PASS）。
    - D1-07: 取消住宿后完全复原为 6 段（3+3），标题与坐标零残留（PASS）。
    - D1-08: 核心模型为动态数组 DayPlan[]，成功消除硬编码 day1StartTime/day2StartTime（PASS）。
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
    - 测试 D: 检索出 153 处顺路设施，默认呈现 Top 20，点击展开至全部 153 处（PASS）。
    - 测试 E: 核查 153 张设施卡片，153 处合规“预计绕行”，0 处“实际绕行”，0 处“真实绕行”（PASS）。
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
| **行政管辖与物理距离冲突** | **已修复 (Phase D.1)** | 广水在行政上由随州市代管（API 返回 `city: '随州市'`），原代码仅凭字符串包含误将广水判定为随州边界；现通过空间物理测距 `dEnd <= 18km`（或 `dEnd <= 25km && cityMatched`）与 `determineOvernightPosition` 算法，精确区分广水为“路段中间拆分”(`middle`)，随州齐星湖为“边界住宿”(`boundary`)。 |
| **自动化测试单帧状态快照陷阱** | **已修复 (Phase D.1)** | `App.tsx` 中 `window.__tripStore = store` 会在组件初次渲染时固化单次快照，导致异步测试脚本在调用 setter 后同步读取到陈旧值；重构为 `Object.defineProperty(window, '__tripStore', { get: () => useTripStore.getState() })` 动态实时访问器。 |

---

## 4. 当前 API 与队列架构

```text
[ 用户设置住宿 / 切换候选 / 取消住宿 ]
       │
       ├──> Generation Token 递增 (activeOvernightGeneration++)
       │
       ├──> 判定位置类型 determineOvernightPosition (middle vs boundary)
       │
       ├──> 重构行程段落 reconstructTripWithOvernight
       │       ├─ Middle 拆分: A->B 裂变为 A->H 与 H->B (段数 6 -> 7)
       │       ├─ Boundary 吸附: 端点吸附至 H 坐标 (段数严格保持 6)
       │       ├─ 保全已选 Option、风景途经点与自定义途经点
       │       └─ 动态重构 DayPlan[] 天数组并后移后续路段归属
       │
       ├──> 检查 routeCache (10分钟 TTL) ──[命中]──> 瞬时赋给 routeResults
       │
       ├──> 检查 inFlightPlans ──[在途]──> 复用 Promise
       │
       └──> 平滑发起 Driving 算路 ──> 校验代际令牌 ──> 更新 store
```

---

## 5. 当前核心数据模型

- **`Trip` / `DayPlan` / `Segment` / `RouteOption`** (`src/types/trip.ts`)：
  - `Trip`: `id`, `title`, `days: DayPlan[]`, `segments: Segment[]`, `totalDistanceKm`, `totalDurationMinutes`
  - `DayPlan`: `day: number`, `title: string`, `segments: Segment[]`, `date?: string`
  - `Segment`: `id`, `day`, `defaultDay`, `title`, `start`, `end`, `chosen`, `options`, `isSplitPart?`, `splitParentId?`, `isBoundaryStop?`, `customStartCoord?`, `customStartName?`, `customEndCoord?`, `customEndName?`
  - `RouteOption`: `id`, `name`, `tagTitle`, `via`, `comparisonNote`, `highlights`
- **`OvernightStop` & `TimelineItem`** (`src/types/trip.ts`)：
  - `OvernightStop`: `id`, `poiId`, `name`, `coord`, `address`, `city`, `targetCityOrArea`, `day`, `sourceSegmentId`, `positionType?: 'middle' | 'boundary'`, `rating`, `priceLevel`, `todayDrivingKm`, `todayDrivingDurationSec`, `todayEta`, `tomorrowRemainingKm`, `tomorrowRemainingDurationSec`, `decisionTag`, `decisionLabel`, `decisionReason`
  - `TimelineItem`: `id`, `day`, `type` ('departure' | 'waypoint' | 'poi' | 'destination' | 'rest' | 'overnight'), `title`, `subtitle`, `plannedTime`, `isPendingRoute`, `linkedSegmentId`, `isOvernight`
- **`TripState` Store 核心字段** (`src/store/useTripStore.ts`)：
  - `dayStartTimes: Record<number, string>`: 动态各天出发时间字典（彻底消除 hardcoded 2 天字段）
  - `overnightStop: OvernightStop | null`: 当前生效住宿点
  - `overnightCandidates: OvernightStop[]`: 2~3 个横向对比候选
  - `activeOvernightGeneration: number`: 算路代际令牌
  - `routeCache`: 内存算路缓存 (10-min TTL)
  - `inFlightPlans`: 在途算路 Promise 映射表

---

## 6. 下一阶段设计建议：Phase E — Rest / Meal / Daily Rhythm Planning
### (沿途休息、顺路就餐与日常行车节奏规划)

针对自驾出行中最真实的 4 大核心困惑：
> 1. “什么时候该休息？”  
> 2. “在哪里吃饭最顺路？”  
> 3. “现在继续开还是停下来？”  
> 4. “如何把休息、就餐无缝加入时间轴与天计划？”

建议 Phase E 围绕以下 4 大支柱展开架构设计：

### 6.1 智能疲劳监测与休息提醒规则引擎 (Fatigue & Rest Rule Engine)
- **规则触发标准**：
  - **连续驾车时长阈值**：单次连续驾驶满 2 小时（或 120km），触发【一级休息建议】（提示 15 分钟短暂休整）；满 2.5 小时，触发【强行疲劳预警】（建议进服务区/休息点 20~30 分钟）。
  - **山路/国道加权系数**：非高速路段（如大悟到随州省道、丹江口环库风景段）弯多路窄，按 1.25 倍疲劳系数计算时间，提前触发休息提醒。
- **推荐点源与筛选**：
  - 自动在当前路段走廊内筛选：高速服务区、国道停车区、观景台（如丹江口环湖观景点）、沿途加油站。
  - 标注距路线垂直距离与进出便捷度（预计绕行 <= 500m 优先）。

### 6.2 沿路顺道就餐推荐系统 (En-route Meal Recommendation System)
- **就餐时间窗口 (Meal Windows)**：
  - **午餐窗口**：11:30 ～ 13:30（黄金推荐点落在 ETA 12:00 附近）。
  - **晚餐窗口**：17:30 ～ 19:30（若当天尚未收车，黄金推荐点落在 ETA 18:00 附近）。
- **空间与时间交叉匹配 (Spatio-temporal Matching)**：
  - 遍历当前时间轴，计算 ETA 进入就餐窗口的 Segment。
  - 以该时间点前后的路线折线为采样走廊，通过 `AMap.PlaceSearch` 检索分类为“中餐厅/地方特色/农家乐”的高分 POI。
  - **顺路优先**：过滤绕行距离超过 3km 的餐饮，优先展示“路边老店”、“农家土菜”、“湖鲜馆”。
  - 预估就餐时间：统一预留 45~60 分钟标准就餐耗时。

### 6.3 休息与就餐节点无缝植入动态时间轴 (Timeline Rhythm Scheduling)
- **交互形式**：
  - 在左侧时间轴的超长驾驶路段之间，渲染虚线占位卡片：`[ ☕ 已连续驾驶 2h15m · 建议在此休整 15 分钟 | 点击查看顺路休息区 ]` 与 `[ 🍲 正值午餐时段 12:15 · 建议就餐 45 分钟 | 挑选沿途餐厅 ]`。
  - 点击【挑选沿途餐厅】后，右侧设施面板自动联动切换到【餐饮】Tab，并自动聚焦到对应路段锚点。
  - 餐饮/休息卡片增加【🍽 加入行程午餐】/【☕ 加入行程休整】按钮。
- **级联推演传播**：
  - 用户确认加入就餐/休整点后，时间轴新增 `type: 'meal'` 或 `type: 'rest'` 节点。
  - 节点包含 `durationMinutes: 45`；后续所有路段与住宿点的到达时间 (ETA) 自动平滑后推 45 分钟。

### 6.4 “继续开还是停下来”驾驶决策辅助 (Stop vs Continue Advisory)
- **收车临界点决策 (Night Driving Advisory)**：
  - 当预计到达时间超过日落时间（湖北日落通常约 18:30~19:00）或超过 19:30 且前方为山路/非高速路段时，系统在时间轴与住宿卡片高亮呈现【夜间行车安全提示】。
  - 辅助对比：“现在停下来（住广水，17:00 抵达，告别夜车）” vs “继续开（住随州，20:00 抵达，需摸黑山路开 1.5 小时）”。
  - 结合 Phase D 的 2~3 个候选方案对比弹窗，直观为驾驶者提供最符合行车安全与身体舒适度的客观依据。

---

## 7. 不得破坏的产品原则

1. **高德是底层基础设施，不是外跳壳子**：地图、道路、折线、POI、实时交通与路况均在当前工作台内闭环；只有真正自驾出发时，高德 App / Universal Link 才是主要出口。
2. **Trip 为容器，Segment 为核心，Route Option 为决策单元**：分段独立规划、独立高亮、独立搜索。
3. **共享面板 Tab 互斥切换**：沿途视频与沿途设施必须继续共享右侧同一个面板，通过顶部 Tab 切换，严禁拆成两个堆叠面板。
4. **路线走廊搜索真实沿路**：保持“全程”与“当前路段”双作用域，严控全局并发 <= 2，严禁绕过全局调度队列发起并发请求。
5. **严禁黑盒伪造行程数据**：时间轴推算严格依据真实算路与停靠预留耗时；在路线未返回时展示“等待路线数据”，绝不编造静态假数字；住宿推荐原因必须具备严格可解释的规则溯源。
6. **行程模型保持泛化与天边界自适应**：严禁回退到写死特定路段（如写死 s3/s4）的紧耦合逻辑；所有多日行程均必须由 `DayPlan[]` 动态派生。
