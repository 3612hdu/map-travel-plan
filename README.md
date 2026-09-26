# 可交互自驾路线规划器 v2 (Route Planner v2)

基于高德 JS API 2.0 与 React 19 + TypeScript + Zustand 构建的自驾路线规划工作台。以 Road / Segment / Route Option 为核心决策单元，解决“怎么走、哪条路风景好、为何绕行、沿途设施与真实路况体验”。

## 快速启动

### 1. 安装依赖
```bash
npm install
```

### 2. 配置高德 API 凭据
复制环境变量模板：
```bash
cp .env.example .env.local
```
在 `.env.local` 中配置您在高德开放平台申请的 Web 端 (JS API) Key 与安全密钥：
```env
VITE_AMAP_KEY=your_amap_js_api_key
VITE_AMAP_SECURITY_JS_CODE=your_amap_security_js_code
```

> **安全与部署说明**：
> 1. 本地开发阶段：凭据仅保存在 `.env.local`（已被 `.gitignore` 排除，避免泄露至代码仓库）。
> 2. 生产部署建议：根据高德官方规范，浏览器端不要直接暴露 `securityJsCode`，建议通过 Nginx / Node 后端配置高德安全代理服务器（`_AMapSecurityConfig.serviceHost`），实现真正的密钥隔离。

### 3. 运行本地开发服务
```bash
npm run dev
```
打开浏览器访问：`http://127.0.0.1:5173/`

### 4. 生产打包
```bash
npm run build
```
输出位于 `dist/` 目录。

### 5. 界面回归检查

```bash
npm run test:ui
```

脚本会自动启动临时 Vite 服务，用本机 Chrome / Edge 检查手机竖屏、横屏、平板和桌面尺寸下的滚动、影像详情、推荐筛选、收藏持久化、导航链接与日期筛选。无法启动的浏览器会明确标记为 `SKIP`；断言失败会返回非零退出码。设置 `APP_URL` 可检查线上或预览构建。

测试会屏蔽第三方地图网络请求，验证界面和链接行为；高德实际算路及手机 App 唤起需另行实机检查。截图保存到系统临时目录 `map-travel-scroll-qa`。
