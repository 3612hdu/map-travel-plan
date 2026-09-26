# 核心功能冻结与缺口审计

审计日期：2026-09-26。基线：`master` / `f06c15a`，审计前工作区干净。审计只评估现有产品，不修改业务代码。

**Core Fix Sprint 2 更新（2026-09-26）**：FIX4/5/6 已在真实高德浏览器验收。视频旧条目审计见 `docs/core-fix-2/video-provenance.md`；五张截图见 `docs/core-fix-2/`。已将 #36、#37 从 PARTIAL 改为 COMPLETE。POI 缺失评分/营业状态不再填假值，住宿候选不再预置酒店与行程数值；#39 因未选候选仍待实路测算，维持 PARTIAL。下方早期段落包含历史观察，以本更新及各条最新状态为准。

**Core Fix Sprint 1 更新（2026-09-26）**：下方保留原审计的历史观察，已将本轮经 `test-core-fix-1.mjs` 实测修复的条目改为当前状态。六张修复后截图见 `docs/core-fix-1/`；原 `docs/core-audit/` 截图为修复前基线。

## 依据与验证方式

- 已核对 `git status`、最近 10 条（仓库现有 5 条）提交记录，并阅读根目录 `HANDOFF.md`、`IMPLEMENTATION_PLAN.md`、`ACCEPTANCE_REPORT.md`、`README.md`，以及 `route-planner-vibecoding-prompt/VIBE_CODING_PROMPT.md`、`references/` 三张 UI 参考图、`src/` 核心模块和全部 `test-*.mjs`。历史报告的 PASS 作为回归背景，以下等级以当前代码及本轮浏览器体验为准。
- `npm run build` 通过。使用 Chrome/Puppeteer 在 1600×1000 访问本地 Vite，完成全程、普通段、丹江口段、三个方案、酒店双范围搜索、双 Tab、卡片、Marker、停靠点添加/删除、住宿方案、回到全程等操作。联网复验 Console error 0、未处理页面异常 0、HTTP 4xx/5xx 0。301 次 `ERR_ABORTED` 均是高德瓦片请求，发生在连续移动/缩放地图时；不计为 API 失败。
- 首轮受沙箱网络权限影响，高德脚本返回 `ERR_NETWORK_ACCESS_DENIED`，页面出现 0/6 段且 `corridorSearch` 落入 Mock 回退。随后获准联网复验，高德地图、8 个已规划方案结果、实路搜索和重算均成功。本报告以联网复验为主要体验证据，仍把无实路时直接显示预置数字/Mock 的降级问题计入缺口。
- 截图在 `docs/core-audit/`；`02-segment-focus.png` 特意记录普通 Segment 被选中的现状，不能解释为已实现 Focus Mode。浏览器辅助脚本为 `docs/core-audit/audit-browser.mjs`。

等级口径：`COMPLETE` = 本轮浏览器或已有针对性浏览器回归证实核心交互成立；`PARTIAL` = 有实现但用户闭环、数据可信度或本轮验证不足；`MISSING` = 没有对应交互。下表“浏览器”中的“本轮”指联网复验，“历史”指仓库现有 Puppeteer 用例，“未逐项”指本轮未单独触发该类别，不能据代码直接判完整。

## A. Trip / Day / Segment

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 1 | 完整 Trip 正确显示 | COMPLETE | `Header.tsx` 汇总所选实路，风景段数字来自当前 `s6` 算路；`SidebarLeft.tsx` 不再显示预置里程；`CenterMapArea.tsx` 的 Trip 模式按全程路线 fit。 | Sprint 1 的 FIX3-06 与 `06-back-to-overview.png` 证实返回全程后视野覆盖 Trip；全程统计随停靠点重算变化。固定行程副标题仍描述本项目的固定行程。 |
| 2 | Day 分组 | COMPLETE | `tripReconstruction.ts`、`SidebarLeft.tsx`：按 `segments.day` 动态列出 Day，住宿拆分后 6→7 段。 | 本轮，住宿后 Day 分组同步更新。 |
| 3 | 左侧每个 Segment 可见 | COMPLETE | `SidebarLeft.tsx`：所有 Segment 保留在可滚动列表，住宿拆分后新增段可见。 | 本轮，普通段、`s6` 与住宿后 7 段均检查。 |
| 4 | 点击 Segment 展开、地图聚焦、高亮、其他路线弱化 | COMPLETE | 左栏点击选择 Segment，中央显示其方案详情；统一视角控制 fit 当前段，激活段蓝色加粗，其他段弱化。另有“详细查看”进入稳定 Focus。 | Sprint 1 的 FIX3-01/02/04 证实段级聚焦及 Detail 模式；截图 `04-segment-detail.png`。详情在中央展开，左栏卡片本身不展开。 |

## B. Route Option

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 5 | 一个 Segment 多方案 | COMPLETE | `src/types/trip.ts`、`src/data/tripData.ts`、`RouteOptionCards.tsx`：`s6` 同时展示 3 卡。 | 本轮见 `03-route-options.png`。其他段仅 1～2 个，符合数据配置。 |
| 6 | 普通、环库风景、折中三种**有效区分的实路** | COMPLETE | `tripData.ts` 中普通无风景 via、环库经 `[9,10,11]`、折中只经 `[10]`；`routeComparison.ts` 比较实际里程、耗时、几何与道路序列。 | FIX2-01/02：普通与环库相差约 6.2 km；环库与折中约 4.7 km，摆脱 1 m 重合。普通与折中仍约 96% 几何重合，UI 明确提示“实际道路基本一致”，没有将其伪称完全不同。 |
| 7 | 距离、时间、收费、相对普通路线增量 | COMPLETE | `RouteOptionCards.tsx` 只显示高德返回的数值与实时差值；未完成时显示“计算中…”。 | FIX2-01/02 显示三方案真实数值；不再展示参考图 105/121/136 km 或预设时间。 |
| 8 | 选方案后地图 Polyline、Segment 状态、Trip 统计同步 | COMPLETE | `selectedOptions` 是所选方案的状态源；路线层、卡片高亮、亮点、Trip 汇总均按该值更新。 | FIX2-04：切换普通/环库后总里程与耗时均变化，Focus 保留；`Segment.chosen` 继续作为初始默认值。 |

## C. Segment Detail / Focus Mode

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 35 | 统一的 Segment 详细查看状态 | COMPLETE | Store 的 `MapMode` 含 `segment-focus`；“详细查看”与“← 返回全程”控制进入/退出；单一 `viewportRevision` 控制 fit 优先级。Focus 内高亮当前方案、弱化其他段、同步当前方案亮点，并把右栏与搜索默认设为当前段。 | FIX3-01～06：设施搜索、Marker 选择、RouteOption 结果更新及 Tab 切换不会自动拉回全程；返回后恢复 Trip 视野。见 `04`～`06` 截图。 |

## D. Map

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 9 | 页面内部高德主地图 | COMPLETE | `CenterMapArea.tsx`、`amapService.ts` 在 `#amap-root` 初始化 JS API Map。 | 本轮 canvas、底图及实路折线显示；见 01～07 截图。 |
| 10 | 主模式不依赖 iframe | COMPLETE | `amapService.ts` 用 JS API；地图区无 iframe。 | 本轮。B 站视频使用的 iframe 是独立视频嵌入。 |
| 11 | 实时路况 | COMPLETE | `amapService.ts` 建立 `TileLayer.Traffic`，`TrafficLegend.tsx` 控制显示。 | 本轮地图有路况着色、图例与开关；未核实第三方路况数据的实时精度。 |
| 12 | POI Marker | COMPLETE | `amapService.ts` `renderPoiMarkers` 根据设施数据绘制。 | 本轮全程酒店 87 处、当前段 33 处结果均出现对应 Marker。 |
| 13 | Marker/列表双向联动 | PARTIAL | `FacilityCard.tsx` 点击会 `focusPoi`、平移与开气泡；`amapService.ts` Marker 点击回调更新选中，`FacilityTab.tsx` 监听后滚到卡片。 | 本轮卡片→地图已验证；尝试点击 Marker，但自动化选中 ID 未发生可区分变化，未能独立证实 Marker→不同卡片。需要真实点击不同 Marker 再复验。 |
| 14 | 路线高亮稳定 | COMPLETE | `amapService.ts` 当前段蓝色加粗、其他段弱化；Focus 中备选路线用不同色虚线同时预览；视角仅在明确意图变更时自动 fit。 | FIX2-03、FIX3-02～05 验证线路和视角；`03-route-options-comparison.png`。 |
| 15 | 只在导航时主要跳高德 | PARTIAL | `CenterMapArea.tsx` “开始导航”调用 `navigationService.ts`；`FacilityCard.tsx` 每张结果另有“高德详情 ↗”。 | 本轮页面内完成主要规划；搜索卡片大量外跳入口与页面内详情重复，需收敛为确有必要的外部详情。 |

## E. Search

搜索链路：`CorridorSearchBox.tsx` 选择作用域并提交自由词；`FacilityTab.tsx` 取已选实路 Polyline；`corridorSearch.ts` 以沿线锚点做 `AMap.PlaceSearch.searchNearBy`，以点到折线距离筛选 12 km 内结果，标注所属 Day/Segment、几何垂距与**估算**绕行，渲染 Marker 与右侧列表。不是地图中心搜索。没有可用 Polyline 时返回空结果，不注入 Mock。类别配置见 `src/config/poiTypes.ts`。

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 16 | 全程搜索 | COMPLETE | `CorridorSearchBox.tsx`、`FacilityTab.tsx`、`corridorSearch.ts`：拼接各段已选实路搜索，并按 Day/Segment 列表分组。 | 本轮“酒店”87 处；见 `04-trip-search.png`。 |
| 17 | 当前路段搜索 | COMPLETE | 同上，以 `s6:scenic` Polyline 搜索。 | 本轮“酒店”33 处；见 `05-segment-search.png`。 |
| 18 | 酒店 | COMPLETE | `poiTypes.ts` `hotel` 类型与自由词“酒店”。 | 本轮双作用域实搜。 |
| 19 | 民宿 | PARTIAL | `poiTypes.ts` 将民宿并入“酒店/民宿”，快捷词“湖景民宿”。 | 未逐项浏览器实搜；缺独立民宿类别与结果准确性验证。 |
| 20 | 餐饮 | PARTIAL | `poiTypes.ts` `food` 和 `FacilityTab.tsx` 筛选入口。 | 未逐项实搜；带已有搜索词切类别时 `corridorSearch.ts` 仍使用旧关键词，且 `detectCategory` 强制按所选类别标注，可能把旧词结果误归类。 |
| 21 | 加油站 | PARTIAL | `poiTypes.ts` `gas` 类别、油站关键词与 POI 类型。 | 未逐项实搜；同 #20 的类别/关键词交互风险。 |
| 22 | 充电站 | PARTIAL | `poiTypes.ts` `ev` 类别、充电关键词与 POI 类型。 | 未逐项实搜；同 #20，且实时枪位/空闲信息未接入，不应假定。 |
| 23 | 厕所 | PARTIAL | `poiTypes.ts` `toilet` 类别。 | 未逐项实搜；同 #20 的分类风险。 |
| 24 | 停车场 | PARTIAL | `poiTypes.ts` `parking` 类别。 | 未逐项实搜；同 #20 的分类风险。 |
| 25 | 自定义关键词 | COMPLETE | `CorridorSearchBox.tsx` 文本输入提交给 `corridorSearch.ts`，不是固定类别按钮。 | 本轮直接输入“酒店”并提交成功；其他自由词相关性尚未单独测。 |

结果字段有 `distanceToRoute`、`estimatedDetourKm`、`sourceSegmentId`/`sourceSegmentTitle`，对应 Marker、列表和当前段；这些结构已实现。Sprint 2 已删除高德缺失评分时的 4.5 和默认“营业中”，真实搜索中 57/57 个无评分/状态的结果均显示“暂无评分”“营业状态未知”；价格缺失时不显示。卡片的“预计绕行”只是几何估算，并非道路实测。当前首个近线酒店加入后实际路线增加 173.469 km，说明“极度顺路”判断不能直接指导停靠点插入。

## F. Facilities

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 26 | 沿途设施 Tab | COMPLETE | `RightPanel.tsx` 在共享区域挂载 `FacilityTab.tsx`。 | 本轮可切换；见 `07-facility-tab.png`。 |
| 27 | 分类筛选 | PARTIAL | `FacilityTab.tsx` 7 类按钮会触发重搜。 | 本轮只触发酒店词；其他类别未逐项测。非空搜索词与类别切换的误标风险见 #20。 |
| 28 | 加入停靠点 | COMPLETE | `FacilityCard.tsx` 将 POI 写入 `customWaypoints`。 | 本轮 `s6` 由 0→1 个。 |
| 29 | 加入后真实重算路线 | COMPLETE | `projectPointOntoRoute` 计算沿已选真实 Polyline 的累计进度；scenic via、既有自定义点和新增 POI 一起排序后交给 Driving。卡片快速增删的异步结果校验当前点集与方案。 | FIX1-01：近线酒店新增约 2.7 km；FIX1-02/03：反向加入两酒店时 Driving 次序仍按路程，且保留 scenic via 与偏好。截图 `01-waypoint-before.png`、`02-waypoint-after.png`。 |
| 30 | Undo/删除停靠点 | COMPLETE | `FacilityCard.tsx` 同一按钮切换移除并重算。 | 本轮 `s6` 恢复 126,518 m、Trip 恢复 711 km。 |
| 31 | Route Option 保持 | COMPLETE | `useTripStore.ts` 的 `selectedOptions` 与 `customWaypoints` 分离。 | 本轮加/删停靠点前后 `s6=scenic`；历史 D1 用例还覆盖住宿切换。 |
| 32 | customWaypoints 保持 | COMPLETE | `useTripStore.ts`、`tripReconstruction.ts` 重构时传入并保全自定义点。 | 本轮加/删可用；历史 `test-phase-d1.mjs` D1-05 覆盖切换住宿后保全。本轮未在留存停靠点时再设置住宿。 |

## G. Video

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 33 | 视频与设施共享一个面板 | COMPLETE | `RightPanel.tsx` 条件渲染单一右栏内容。 | 本轮双 Tab 共享区域，见 `06-video-tab.png`、`07-facility-tab.png`。 |
| 34 | Tab 互斥 | COMPLETE | `activeContentTab` 仅有 `videos`/`facilities`。 | 本轮点击后只显示相应内容。 |

当前来源：原八条静态视频经逐条审计后删除七条；重复抖音链接保留一条为明确未核验线索。另有两条 B站 URL、标题、作者可在公开索引核对。自动打开 B站页面遇到 412，故不保证播放可用；用户通过“打开原平台”自行访问。不使用 iframe，也不展示没有证据的点赞、时长、封面或拍摄机位。详见 `docs/core-fix-2/video-provenance.md`。

## H. Video ↔ Map

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 36 | 视频与 Segment/坐标/路线联动 | COMPLETE | `VideoReference` 记录来源类型、核验状态、平台 URL、段/方案/亮点与路线参考坐标；Detail 按段和所选方案过滤，选亮点后进一步筛选。视频点击关联亮点并定位参考坐标。 | FIX4-01～03 浏览器通过；未核验内容显示“内容未核验”，无播放入口；原平台访问不保证始终可用，坐标明确不是拍摄机位。 |

## I. Route Highlight

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 37 | 风景说明、临水/山区/停车/视频参考的路线亮点 | COMPLETE | `bindHighlightsToRoute` 将已核对途经镇投影到当前 RouteOption 实际 Polyline，生成 `startProgress/endProgress`；地图只截取该区间并用橙色加粗，其他路线弱化；方案切换清除不相关亮点。 | FIX5-01～03 浏览器通过，习家店高亮 176/2559 个路线点；仅陈述途经镇及路线参考，不声称最佳观景或停车条件。 |

## J. UI / Product Experience

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 38 | 与参考图一致的地图主视觉、左行程/中地图/右内容和清晰详情 | PARTIAL | 三栏及顶部搜索保持；Sprint 1 增加中央 Detail 入口、返回全程和当前段状态提示。 | 详情入口已清晰；时间轴仍挤占左栏首屏，右侧设施卡片操作过密，“沿途推荐”“行程收藏”仍只有本地 Tab 样式。 |

## K. Timeline / Overnight

| # | 能力 | 等级 | 当前实现文件与真实交互 | 浏览器证据；剩余缺口 |
|---|---|---|---|---|
| 39 | 时间轴与住宿扩展不破坏核心流程 | PARTIAL | 时间轴和住宿重构可用；比较候选来自用户当前高德酒店搜索，未选候选显示待实路测算；已选候选在当前路段实路齐全后计算两日里程/时长和仅含驾驶的 ETA。 | Sprint 2 清除了预置酒店/评分/价格/营业状态及名字驱动的行车指标；未选候选还不能直接做双方案实路对比，左栏信息密度与异步完成态仍需后续核对。 |

## 截图清单

| 文件 | 内容 |
|---|---|
| `docs/core-audit/01-overview.png` | 全程选择后的实际地图视野与 Trip 汇总 |
| `docs/core-audit/02-segment-focus.png` | 普通 Segment 被选中；用于证明现有焦点行为 |
| `docs/core-audit/03-route-options.png` | 丹江口 `s6` 三方案与地图 |
| `docs/core-audit/04-trip-search.png` | “酒店”全程 87 处 |
| `docs/core-audit/05-segment-search.png` | “酒店”当前路段 33 处 |
| `docs/core-audit/06-video-tab.png` | 视频 Tab |
| `docs/core-audit/07-facility-tab.png` | 设施 Tab |
| `docs/core-audit/08-overnight.png` | 住宿候选比较弹窗 |

Core Fix Sprint 1 修复后截图：`docs/core-fix-1/01-waypoint-before.png`、`02-waypoint-after.png`、`03-route-options-comparison.png`、`04-segment-detail.png`、`05-segment-detail-facilities.png`、`06-back-to-overview.png`。

## 审计结论

### COMPLETE

28 项。

### PARTIAL

11 项。

### MISSING

0 项。

总计 39 项（原需求编号 1～34，加 C/H/I/J/K 五个跨模块能力）。

## 剩余重要核心缺口

1. **视频自动发现与逐个播放可用性未覆盖。** 本轮只治理手工来源与路线关联，原平台可用性仍可能变化；不将此计入现有 #36 缺口。
2. **POI 分类切换准确性仍需治理。** 缺失评分、状态、价格已诚实展示；类别切换仍可能沿用旧搜索词并强制改类。对应 #19～24、#27。
3. **住宿候选间实路对比尚不完整。** 预置数值已删除，未选候选目前等待实路测算；异步完成态需继续核实。对应 #39。
4. **路线亮点已有实路范围与视频关联。** 本轮 #37 完成；进一步的景观质量或停车条件需独立证据。
5. **右栏与左栏信息密度偏高。** 设施操作按钮拥挤，时间轴挤占分段首屏，部分导航 Tab 仍只有样式切换。对应 #38。

Core Fix Sprint 2 仅处理 FIX4～6。
