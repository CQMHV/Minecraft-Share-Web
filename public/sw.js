// 当前缓存版本号，更新时要改名
const CACHE_NAME = 'mcshare-cache-v4';

// 预缓存的资源（安装阶段一次性写入）
const PRECACHE_URLS = [
  '/',            // 首页
  '/pwa-lang',    // PWA 启动入口（确保离线可用）
  '/styles.css'   // 常用样式文件
];

// 安装阶段：预缓存资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  // 跳过等待，立即启用新 SW
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME && caches.delete(key))
    ))
  );
  // 立即接管客户端
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 仅处理：同源 + GET 请求
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // API 请求一律直连网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(req));
  }

  const isNavigate = req.mode === 'navigate'; // 页面导航请求

  event.respondWith((async () => {
    try {
      // 先查缓存
      const cached = await caches.match(req);
      // 同时发起网络请求，若成功则更新缓存
      const net = fetch(req).then(r => {
        if (r.ok) caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
        return r;
      });
      return cached || await net;
    } catch (err) {
      // 离线兜底：导航请求返回 /pwa-lang
      if (isNavigate) {
        return (await caches.match('/pwa-lang')) || new Response('Offline', { status: 503 });
      }
      // 其它请求：若缓存有就返回，否则返回 503
      const cached = await caches.match(req);
      return cached || new Response('Offline', { status: 503 });
    }
  })());
});

// 配合register-sw.js自动激活sw
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

