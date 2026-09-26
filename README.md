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
