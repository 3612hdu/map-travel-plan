// 高德地图 JS API 2.0 配置
// 凭证通过环境变量读取，禁止在业务源码中硬编码敏感 Key
const envKey = import.meta.env.VITE_AMAP_KEY || '';
const envSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE || '';

export const AMAP_CONFIG = {
  key: envKey,
  securityJsCode: envSecurityJsCode,
  version: '2.0',
  plugins: [
    'AMap.Driving',
    'AMap.PlaceSearch',
    'AMap.ToolBar',
    'AMap.Scale',
    'AMap.ControlBar'
  ]
};

// 初始化高德安全密钥
export function initAMapSecurity() {
  if (typeof window !== 'undefined') {
    if (!AMAP_CONFIG.securityJsCode) {
      console.warn('未检测到高德 securityJsCode，请在 .env.local 中配置 VITE_AMAP_SECURITY_JS_CODE');
    }
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_CONFIG.securityJsCode
    };
  }
}
