# 可交互自驾路线规划器 V2 —— Vibe Coding 实施提示词

> **用途**：把本文件连同 `current-prototype.html` 和 `references/` 下 3 张参考图一起交给 Codex / Antigravity / Claude Code 等编码 Agent。  
> **目标**：基于现有原型做一次**保留核心结构、重构交互和信息架构**的 V2，而不是重新做一个普通地图网页。

---

## 0. 先读这些文件，再开始改代码

请先完整阅读并理解：

1. `current-prototype.html` —— 当前可运行原型，里面已经有 Trip / Day / Segment / Route Option、路线高亮、高德 JS API、沿路 POI 抽样查询、分段导航等基础能力。
2. `references/01-video-tab-layout.png` —— **主要布局参考 + “沿途视频”状态参考**。
3. `references/02-facilities-tab-layout.png` —— **“沿途设施”状态参考**。
4. `references/03-search-scope-layout.png` —— **顶部搜索框 + 全程/单段搜索作用域参考**。

### 参考图优先级

不是机械像素复刻，而是按下面优先级融合：

- **整体布局、比例、视觉语言**：以 `01-video-tab-layout.png` 为主。
- **右侧/右下信息区的“沿途设施”列表状态**：以 `02-facilities-tab-layout.png` 为主。
- **顶部原标签区域改为搜索框**：以 `03-search-scope-layout.png` 为主。
- 三张图冲突时，以本 PRD 的功能要求为最终准则。

---

# 1. 产品定位

这不是“自己重做一个高德地图”，也不是“高德网页的外壳”。

它应该是一个：

> **以自驾路线选择为核心的可交互旅行规划器。**

普通地图主要回答“怎么最快到达”；本产品重点回答：

- 这一段有哪些走法？
- 哪条更好看？
- 多绕多少公里、多少时间？
- 沿途哪里值得停？
- 沿途哪里能加油、充电、吃饭、上厕所、停车、住店？
- 小红书 / 抖音 / B站有没有真实路况与风景参考？
- 我切换某一段路线后，整趟旅行会发生什么变化？

**核心对象不是“景点”，而是 Road / Segment / Route Option。**

---

# 2. 必须遵守的产品原则

## P1. 高德是底层地图引擎，不是默认外跳页面

只要高德 JS API / Web Service API 能在本页面完成的能力，就优先在本页面完成。

例如：

- 地图显示
- 路线绘制
- 多路线比较
- 实时路况
- POI 搜索
- 油站 / 充电站 / 餐厅 / 酒店 / 厕所 / 停车场
- 距离、时间、收费
- 点击 POI 查看详情

**禁止为了省事，把大量功能做成“打开高德网页查看”。**

高德 App/网页只在以下场景作为兜底：

1. 用户真正开始驾驶，需要实时语音导航；
2. 当前开放 API 无法提供某项能力；
3. API 加载失败时的 fallback。

页面里最主要的外跳按钮应该是：

> **开始导航**

而不是到处出现“高德 ↗”。

---

## P2. Trip 是容器，Segment 是核心，Route Option 是选择

数据层级：

```text
Trip
 ├─ Day
 │   ├─ Segment
 │   │   ├─ Route Option A
 │   │   ├─ Route Option B
 │   │   └─ Route Option C
 │   └─ ...
 └─ ...
```

不要把整个 Trip 画成一根不可拆的大 Polyline。

每一个 Segment 都必须独立保存：

- 起点
- 终点
- 途经点
- 路线 polyline
- 距离
- 时间
- 收费
- 路况
- 选中的 Route Option
- 路线亮点
- 沿途设施
- 沿途视频

这样才能自然实现：

- 点击某段高亮
- 单独缩放某段
- 替换某段
- 比较某段
- 搜索某段附近酒店/充电站等

---

## P3. 规划阶段尽量在本页面闭环

用户在桌面端做规划时，尽量不要被迫离开页面。

理想流程：

```text
看全程
→ 点击某一段
→ 比较路线
→ 选风景路线
→ 看真实路况
→ 看沿途视频
→ 切换到沿途设施
→ 搜酒店/餐厅/充电站
→ 点击地图上的点查看详情
→ 保存路线
→ 真正出发时点“开始导航”
```

---

# 3. 页面整体布局

保持三大区域，参考 `01-video-tab-layout.png`：

```text
┌─────────────────────────────────────────────────────────────┐
│ Logo / 标题       全局搜索框 + 搜索范围        全程统计      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ 左侧行程栏   │                高德交互地图                  │
│ Trip/Day/段  │                                              │
│              │                                              │
├──────────────┼───────────────────────┬──────────────────────┤
│ 左侧继续     │ 路线方案 / 路线亮点   │ 视频 / 设施切换区    │
└──────────────┴───────────────────────┴──────────────────────┘
```

### 桌面端比例建议

- 左侧行程栏：20%～22%
- 中央地图 + 底部路线卡片：45%～50%
- 右侧内容面板：28%～32%

不要把所有功能平铺到首屏。

重点通过：

- Tab
- 折叠
- 分层详情
- Bottom/Side panel

控制信息密度。

---

# 4. 顶栏：删除原来的偏好胶囊，改成全局搜索

参考 `03-search-scope-layout.png`。

原顶部的：

- 不走高速
- 少收费
- 风景优先
- 少人
- 两天

这些标签**不要继续占据顶部主视觉空间**。

偏好仍要保留，但移动到：

- 路线设置弹窗
- Trip 设置
- 或搜索框旁的小筛选按钮

顶部主区域改成：

```text
[ 🔍 搜索沿途的酒店、餐厅、加油站、充电站、景点、厕所等... ] [范围 ▼]
```

### 搜索范围至少支持

1. **全程**
2. **当前路段**

可选扩展：

3. 当前 Day
4. 当前地图可视区域

但第一版最重要的是“全程 / 当前路段”。

### 搜索示例

用户输入：

- 酒店
- 旅馆
- 民宿
- 餐厅
- 农家乐
- 加油站
- 充电站
- 厕所
- 停车场
- 景点
- 咖啡
- 便利店
- 修车

---

# 5. 搜索的核心逻辑：沿“路线走廊”搜索，而不是围绕一个点搜索

这是 V2 的关键能力之一。

## 5.1 全程模式

如果用户选择“全程”，例如搜索“酒店”：

- 获取整趟 Trip 由所有已选 Segment 拼接出的实际 polyline；
- 沿 polyline 按一定距离抽样；
- 对抽样点做高德 POI 搜索；
- 合并去重；
- 计算每个 POI 与路线的最近距离 / 可能绕行距离；
- 把结果显示在地图上；
- 同时显示在“沿途设施”面板里。

**不要只围绕终点或中心点搜。**

## 5.2 当前路段模式

如果选择“当前路段”：

- 只使用当前 selected Segment 的实际 polyline；
- 只显示该段附近的结果；
- 地图自动聚焦该 Segment；
- 结果列表标题明确显示：

```text
丹江口 → 郧阳 · 沿途附近
```

## 5.3 POI 去重与排序

结果至少按以下维度排序：

1. 离路线的绕行距离
2. 是否顺路
3. 评分（如果 API 有）
4. 评价数（如果 API 有）
5. 营业状态（如果 API 有）

建议显示：

```text
习家店山水民宿
★ 4.8 · 126条点评
距路线 1.8 km
免费停车 · 临水景观
[查看] [加入停靠点]
```

优先显示“距路线多少 km”，而不是“距地图中心多少 km”。

---

# 6. 搜索结果与地图联动

这是必须实现的交互。

### 搜索后

地图出现对应 marker：

- 酒店：床 / H
- 餐饮：餐具
- 加油：油枪
- 充电：闪电
- 厕所：WC
- 停车：P
- 景点：山 / 相机

### 点击右侧列表项

必须：

1. 地图 `panTo / setZoomAndCenter` 到对应 Marker；
2. Marker 高亮；
3. 弹出 InfoWindow / detail card；
4. 显示：
   - 名称
   - 地址
   - 评分
   - 距路线距离
   - 营业状态
   - 主要标签
   - 图片（如果有）
5. 提供：
   - `加入停靠点`
   - `查看详情`
   - `开始导航`

### 点击地图 Marker

反向联动右侧对应列表项并滚动到可见位置。

---

# 7. “沿途视频”和“沿途设施”必须共用同一个面板

这一点按用户要求定死。

不要把视频和设施分别摆成两块常驻区域。

参考：

- 视频状态：`01-video-tab-layout.png`
- 设施状态：`02-facilities-tab-layout.png`

面板顶部固定两个 Tab：

```text
[ ▶ 沿途视频 ]   [ ⛽ 沿途设施 ]
```

只有一个内容区。

切换 Tab 时复用同一空间。

这能避免“所有功能都摆到面上”的拥挤感。

---

# 8. 沿途视频 Tab

## 8.1 平台筛选

至少：

```text
全部 | 小红书 | 抖音 | B站
```

视频必须与路线空间绑定，而不是简单“丹江口相关”。

数据关系：

```text
VideoReference
  ↓
Route Highlight / POI / Segment
  ↓
Route Option
```

示例：

```text
《丹江口水库北岸临水公路自驾实拍》
平台：抖音
对应路段：凉水河 → 习家店
坐标：xxx
Segment：s6
```

## 8.2 视频卡片

参考 `01-video-tab-layout.png`。

主卡片可以较大，其他卡片较小：

- 缩略图
- 平台角标
- 时长
- 标题
- 作者
- 点赞 / 收藏 / 播放量（能获取就显示，不能就不要造假）
- 对应路线位置

点击视频卡：

- 地图定位到视频对应路段 / POI；
- 对应路线局部闪烁或高亮；
- 打开播放器。

## 8.3 直接嵌入播放

目标：**能内嵌播放就内嵌播放，不要默认跳外站。**

需要设计平台适配层：

```ts
interface VideoReference {
  id: string
  platform: 'douyin' | 'xiaohongshu' | 'bilibili'
  title: string
  author?: string
  thumbnail?: string
  embedUrl?: string
  externalUrl: string
  duration?: number
  location?: [number, number]
  segmentId?: string
  routeOptionId?: string
  highlightId?: string
}
```

实现原则：

- B站如果官方 iframe/embed 可用 → 页面内播放；
- 抖音如果官方分享/嵌入形式可用 → 页面内播放；
- 小红书如果不允许稳定 iframe → 卡片保留，点击时优先弹出应用内 WebView/modal，必要时再跳官方页面；
- 浏览器 / CSP / 平台限制导致失败时必须优雅 fallback：
  - 保留封面；
  - 明确提示“该平台不支持网页内播放”；
  - 提供“在官方页面打开”。

**禁止伪造第三方视频数据。**

第一版允许用手工维护的 JSON VideoReference 数据完成内容层闭环。

---

# 9. 沿途设施 Tab

参考 `02-facilities-tab-layout.png`。

切到设施 Tab 后，顶部显示类别筛选：

```text
全部 | 酒店/民宿 | 餐饮 | 加油站 | 充电站 | 厕所 | 停车场
```

若用户通过顶部搜索框搜了“酒店”，则：

- 自动切到“沿途设施”Tab；
- 自动选中“酒店/民宿”；
- 地图显示酒店 marker；
- 右侧列表显示酒店结果。

设施条目建议：

```text
[图标] 凉水河镇加油站       2.3 km
       中国石化 · 92#/95# · 营业中
                                  [查看] [加入停靠点]
```

充电站可额外显示（有数据才显示）：

- 快充 / 慢充
- 总枪数
- 空闲数量

酒店可显示：

- 评分
- 类型
- 停车
- 距路线

餐厅可显示：

- 评分
- 菜系
- 营业状态

停车点可显示：

- 是否免费
- 是否适合观景

---

# 10. “加入停靠点”必须是真操作

用户在搜索酒店 / 餐厅 / 景点后可以点：

> **加入停靠点**

之后：

1. 把 POI 变成当前 Segment 的 via point；
2. 调用高德重新算路；
3. 地图路线立即变化；
4. Segment 距离 / 时间 / 收费更新；
5. Trip 总里程 / 总驾驶时间同步更新；
6. 提供 Undo。

不能只是收藏。

---

# 11. 地图交互状态

请显式维护状态，不要靠 DOM 猜当前模式。

建议：

```ts
type MapMode =
  | 'trip-overview'
  | 'day-overview'
  | 'segment-selected'
  | 'route-compare'
  | 'segment-focus'
  | 'poi-search'
```

状态至少包含：

```ts
mapMode
selectedDay
selectedSegmentId
selectedRouteOptionId
previewRouteOptionId
activeContentTab // 'videos' | 'facilities'
searchQuery
searchScope // 'trip' | 'segment'
selectedPoiId
selectedVideoId
```

---

# 12. 地图行为

## 全程

点击“全程总览”：

- 显示所有已选 Segment；
- Day 1 / Day 2 可用不同颜色或不同视觉层级；
- 自动 fit bounds。

## 点击 Segment

例如：

> 丹江口 → 郧阳

必须：

- 当前段加粗 / 高亮；
- 其他段降低透明度；
- 地图 fit 到当前段；
- 下方显示该段 Route Option；
- 视频/设施面板的默认上下文也切到该 Segment。

## “详细查看”

进入 Segment Focus：

- 隐藏或淡化其他路线；
- 放大本段；
- 显示 via point；
- 显示路线亮点；
- 显示可选的视频 / POI marker。

---

# 13. 路线方案区

保持参考图中的三卡逻辑：

```text
普通路线
环库风景路线（推荐）
风景折中路线
```

每张卡必须突出决策成本：

```text
136 km · 3h08m · ¥0
+31 km · +47 min（相比普通路线）
```

推荐标签不要只写“推荐”，还要解释：

- 临水
- 山景
- 摄影
- 车流较少
- 铺装路

选中某 Route Option 后：

- 当前 Segment polyline 替换；
- 统计实时刷新；
- 右侧视频 / 设施内容按新路线重新过滤。

---

# 14. 路线亮点（Route Highlight）

保留参考图下方“路线亮点”区域。

这里不要只放景点。

支持：

- 临水公路
- 山路
- 桥
- 观景停车点
- 某段连续风景带
- 小镇
- 摄影点

示例：

```text
凉水河 → 习家店
本次路线核心风景段，连续临水视野，建议白天通过。
```

缩略图点击后地图定位对应路段。

---

# 15. 实时路况

参考图右上角路况图例。

尽量直接使用高德交通图层 / route traffic data：

- 绿：畅通
- 黄 / 橙：缓行
- 红：拥堵

当前 Segment 卡片可以汇总：

```text
当前路况
畅通 112 km
缓行 21 km
拥堵 3 km
```

数据拿不到时显示：

> 暂无实时路况

不要编数字。

---

# 16. “开始导航”

仍需保留，但职责非常明确：

> **从规划工具切换到驾驶执行。**

点击后：

- 优先调起高德 App；
- 使用当前 Segment 或当前下一站作为导航目标；
- 如果当前路线含多个途经点，按可支持的方式分段导航；
- 进入高德后让用户确认：
  - 不走高速
  - 避免收费
  - 当天实时通行

不要让“开始导航”替代页面内规划功能。

---

# 17. 当前黄冈 → 郧阳 Demo 数据

第一版继续使用当前原型的 Demo：

## Day 1

1. 黄冈师范学院 → 麻城
2. 麻城 → 大悟（经红安）
3. 大悟 → 随州（经广水）

## Day 2

4. 随州 → 襄阳（经枣阳）
5. 襄阳 → 丹江口
6. 丹江口 → 郧阳

重点把 Segment 6 做完整：

```text
丹江口
→ 凉水河
→ 习家店
→ 安阳
→ 郧阳
```

至少三种 Route Option：

1. 普通路线
2. 环库风景路线（推荐）
3. 风景折中路线

---

# 18. 数据模型建议

## Trip

```ts
interface Trip {
  id: string
  title: string
  days: Day[]
  preferences: RoutePreference
}
```

## Segment

```ts
interface Segment {
  id: string
  dayId: string
  title: string
  start: Place
  end: Place
  routeOptions: RouteOption[]
  selectedRouteOptionId: string
}
```

## RouteOption

```ts
interface RouteOption {
  id: string
  name: string
  viaPoints: Place[]
  path?: [number, number][]
  distance?: number
  duration?: number
  toll?: number
  trafficSummary?: TrafficSummary
  tags: string[]
  highlights: RouteHighlight[]
  videos: VideoReference[]
}
```

## RouteHighlight

```ts
interface RouteHighlight {
  id: string
  title: string
  type: 'scenic-road' | 'viewpoint' | 'bridge' | 'town' | 'photo-stop' | 'poi'
  description: string
  location?: [number, number]
  pathRange?: {
    startIndex: number
    endIndex: number
  }
  images?: string[]
}
```

## Facility / POI

```ts
interface RoutePoi {
  id: string
  name: string
  category: string
  location: [number, number]
  address?: string
  rating?: number
  reviewCount?: number
  businessStatus?: string
  distanceToRoute?: number
  detourDistance?: number
  raw?: unknown
}
```

## Search State

```ts
interface RouteSearchState {
  query: string
  scope: 'trip' | 'segment'
  segmentId?: string
  category?: string
  results: RoutePoi[]
}
```

---

# 19. 技术方向

如果继续单 HTML 原型也可以，但如果准备长期维护，推荐升级为：

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- 高德 JS API 2.0

第一版无需复杂后端。

数据先用：

- localStorage
- IndexedDB
- 本地 JSON

视频 Reference 也可以先人工录入 JSON。

---

# 20. 高德 Key 与安全

不要让普通用户每次在 UI 里手工输入 Key / securityJsCode。

开发版本：

- `.env.local`
- 环境变量
- 不提交真实密钥

生产版本：

- 使用高德官方推荐的安全配置方式；
- 配置域名白名单；
- 不在 UI 里把安全密钥暴露给用户。

旧版“连接高德交互地图”的大弹窗应该移除或仅保留开发调试用途。

---

# 21. 视觉要求

参考三张 UI 图，保持：

- 明亮白色底
- 蓝色为主要交互色
- 绿色用于风景 / 已选 / 正向状态
- 卡片圆角
- 非常轻的阴影
- 信息层级清晰
- 地图仍然是视觉中心

但不要：

- 所有功能同时平铺
- 大量彩色胶囊塞满 Header
- 每个按钮都用强色
- 一屏出现太多分散卡片
- 重复展示同一个统计

### 信息密度原则

首屏只保留：

1. 行程列表
2. 地图
3. 当前 Segment 的路线方案
4. 一个“视频/设施”切换面板
5. 搜索框

其他详情按需展开。

---

# 22. 响应式

桌面是主场景，但手机也必须可用。

### 手机建议

- 地图占上半屏；
- Segment / Route Option 用 Bottom Sheet；
- 视频 / 设施使用 Tab；
- 搜索框固定顶部；
- 列表滚动；
- 不要把桌面三栏硬缩成三栏。

---

# 23. 不要做的事情

1. **不要重写成一个静态旅游宣传页。**
2. **不要用假折线代替高德实际道路。**
3. **不要伪造实时路况、酒店评分、充电空闲数、视频热度。**
4. **不要大量用外链代替 API 能完成的功能。**
5. **不要把所有功能同时铺在页面。**
6. **不要把“沿途视频”和“沿途设施”拆成两个常驻大面板。**
7. **不要破坏现有 Segment / Route Option 的数据逻辑。**
8. **不要为了美观删掉实际可操作功能。**
9. **不要一开始就做账号、社区、支付、复杂后端。**
10. **不要擅自改掉黄冈 → 郧阳这条 Demo 的核心路线结构。**

---

# 24. 推荐开发顺序

## Phase A —— UI 架构重构

先不加新 API，完成：

- 三栏布局重构
- 顶部搜索框
- 视频 / 设施共用 Tab 面板
- 当前 Segment 卡片
- Route Option 三卡
- 地图区域保持可用

验收：视觉结构接近参考图。

---

## Phase B —— 真高德地图常驻

完成：

- 去掉“需要手动连接高德”的正常用户流程
- JS API 地图作为默认底图
- iframe 降级为 fallback
- Segment 点击地图 fitView
- Route Option 切换实时画线

---

## Phase C —— 沿路线 POI 搜索

完成：

- 顶部搜索
- 全程 / 当前路段 scope
- polyline sampling
- POI 搜索
- 去重
- marker + 列表联动
- 酒店 / 餐饮 / 油站 / 充电 / 厕所 / 停车

这是 V2 最重要的功能闭环之一。

---

## Phase D —— 沿途设施

完成：

- Tab 切换
- 类别筛选
- 设施列表
- Marker 联动
- “加入停靠点”
- 重算路线

---

## Phase E —— 沿途视频

完成：

- VideoReference 模型
- 平台筛选
- 路线空间绑定
- 卡片
- 内嵌播放器 / fallback
- 点击视频定位地图

---

## Phase F —— 实时增强

完成：

- Traffic layer
- 当前路况 summary
- 卫星图 / 普通图切换
- 刷新按钮
- 当前时间戳

---

# 25. 每个 Phase 的工作纪律

每完成一个 Phase：

1. 运行页面；
2. 检查控制台 error；
3. 验证桌面端；
4. 验证手机宽度；
5. 不通过不要继续堆下一阶段；
6. 更新 `CHANGELOG.md`；
7. 记录：
   - 完成了什么
   - 尚未完成什么
   - 有什么 API 限制
   - 下一阶段入口

不要一次性“大爆改”全部功能后再测试。

---

# 26. 最终验收场景

请至少完整走通下面场景：

### 场景 1：选择风景路线

1. 打开页面；
2. 点击 Day 2；
3. 点击“丹江口 → 郧阳”；
4. 地图只高亮该段；
5. 比较普通 / 环库 / 折中；
6. 选择“环库风景路线”；
7. 总里程和时间刷新。

### 场景 2：查看沿途视频

1. 当前为“丹江口 → 郧阳”；
2. 点击“沿途视频”；
3. 切换“抖音 / B站 / 小红书”；
4. 点某个视频；
5. 地图定位到视频对应路段；
6. 能嵌入则页面内播放；否则清晰 fallback。

### 场景 3：找当前段酒店

1. 顶部输入“酒店”；
2. 范围选择“当前路段”；
3. 自动切换“沿途设施”；
4. 地图显示该 Segment 附近酒店 marker；
5. 右侧显示酒店列表；
6. 点击某酒店，地图定位并弹详情。

### 场景 4：找全程酒店

1. 顶部输入“酒店”；
2. 范围选择“全程”；
3. 沿整条 Trip 搜索；
4. 显示全程顺路酒店；
5. 结果以“距路线 / 绕行距离”作为核心排序依据。

### 场景 5：加入停靠点

1. 在结果中选择一家酒店 / 餐厅；
2. 点击“加入停靠点”；
3. 该 POI 插入对应 Segment；
4. 路线重算；
5. 地图与统计刷新；
6. 可以 Undo。

### 场景 6：开始导航

1. 当前 Segment / Route Option 已选定；
2. 点击“开始导航”；
3. 调起高德；
4. 导航目标正确；
5. 页面本身没有因为跳转逻辑破坏已保存的规划。

---

# 27. 完成定义（Definition of Done）

V2 不是“看起来像参考图”就算完成。

必须同时满足：

- [ ] 高德地图默认在页面内部工作
- [ ] Segment 点击可高亮 / 聚焦
- [ ] Route Option 可以切换实际路线
- [ ] 视频 / 设施共享同一面板并可切换
- [ ] 顶部搜索框可以搜索自定义 POI
- [ ] 搜索支持“全程 / 当前路段”
- [ ] 搜索结果真正显示到地图
- [ ] Marker 与列表双向联动
- [ ] 沿途设施可以按类别筛选
- [ ] 视频与 Segment / 路线位置绑定
- [ ] 能内嵌的视频优先内嵌播放
- [ ] 可把设施加入途经点并重算路线
- [ ] 实时路况尽量在本页面展示
- [ ] 只有真正导航时才主要跳高德
- [ ] 不伪造任何实时或第三方数据
- [ ] 桌面和手机均可用

---

# 28. 开始编码前，先输出实施计划

在动代码前，请先回复/生成一份：

```text
IMPLEMENTATION_PLAN.md
```

内容包括：

1. 对现有 `current-prototype.html` 的结构理解；
2. 哪些代码保留；
3. 哪些代码重构；
4. 新组件结构；
5. 状态模型；
6. 高德 API 使用点；
7. 搜索方案；
8. 视频嵌入方案；
9. Phase A～F 的执行顺序；
10. 风险与 fallback。

我确认或计划合理后，再开始实际编码。

---

# 29. 最后一句产品判断标准

开发过程中，每新增一个功能都问：

> **“这个功能是在帮助用户更好地决定‘这段路怎么走’，还是只是在往地图上堆东西？”**

如果只是堆东西，就不要加入主界面。

最终产品应该让用户获得这种体验：

> **我不用来回切高德、小红书、抖音、B站和搜索页面，就能在一个路线工作台里完成大部分旅行前决策；真正启程时，再把最终路线交给高德导航。**
