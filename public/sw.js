const CACHE_NAME = 'mcshare-cache-v3'; // 每次修改记得更新版本号
const PRECACHE_URLS = [
  '/',              // 首页
  '/styles.css',     // 可选：你项目里常用的静态文件
];

// 安装阶段：预缓存
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API 请求一律走网络，避免缓存 /api/ 结果
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  // 其它资源：Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          // 更新缓存（异步）
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() => {
          // 如果网络失败而且缓存也没有，就返回一个空响应或备用页
          if (cachedResponse) return cachedResponse;
          return new Response('You are offline', { status: 503 });
        });

      // 有缓存就先用缓存，同时发起更新；没缓存就等网络
      return cachedResponse || fetchPromise;
    })
  );
});
