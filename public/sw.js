const CACHE_NAME = 'pwa-cache-v11';
const urlsToCache = [
  '/pwa-loading', // 只缓存启动页
];

// 安装 Service Worker 时缓存启动页
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching the PWA loading page');
        return cache.addAll(urlsToCache);  // 仅缓存 `/pwa-loading`
      })
  );
});

// 激活 Service Worker，清理旧缓存
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName); // 删除不再使用的旧缓存
          }
        })
      );
    })
  );
});

// 拦截网络请求并返回缓存的启动页
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/pwa-loading')) {  // 只拦截 pwa-loading 页面请求
    event.respondWith((async () => {
      const cachedResponse = await caches.match(event.request);
      // 如果缓存中有该页面，返回缓存的资源
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(event.request);
      // 检查响应是否有效
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // 克隆响应以便缓存
      const responseToCache = response.clone();

      // 将响应缓存起来并确保写入完成
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, responseToCache);
        } catch (error) {
          console.error('Failed to cache the response:', error);
        }
      })());

      return response;
    })());
  }
});
