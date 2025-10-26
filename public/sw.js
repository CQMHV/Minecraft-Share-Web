const CACHE_NAME = 'pwa-cache-v3';
const STARTUP_URL = '/pwa-loading';

// 安装阶段：仅缓存启动页（强制绕过浏览器 HTTP 缓存）
// 如果资源请求失败（例如断网/404），不会阻止 SW 安装成功
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            await cache.add(new Request(STARTUP_URL, { cache: 'reload' }));
        } catch (e) {
            console.warn('Precache failed:', e);
        }
        // 跳过等待阶段，立即进入 activate
        self.skipWaiting();
    })());
});

// 激活阶段：清理旧版本缓存，并启用导航预加载（若浏览器支持）
// navigationPreload 可以让 fetch 在 SW 启动时并行请求资源，加快弱网加载
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        // 删除不在白名单中的缓存
        const names = await caches.keys();
        await Promise.all(names.map(n => (n === CACHE_NAME ? Promise.resolve() : caches.delete(n))));

        // 开启导航预加载（可选优化）
        if ('navigationPreload' in self.registration) {
            try { await self.registration.navigationPreload.enable(); } catch {}
        }

        // 立即接管所有客户端
        await self.clients.claim();
    })());
});

// 请求拦截：只处理启动页的请求
// 策略为“缓存优先”：
//   1. 先从缓存返回（ignoreSearch 确保带查询参数也能命中）
//   2. 否则尝试使用 navigation preload 的响应
//   3. 再次失败则走网络请求并更新缓存
//   4. 若离线且无缓存，则返回一个 503 响应
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (!(url.origin === self.location.origin && url.pathname === STARTUP_URL)) return;

    event.respondWith((async () => {
        // 优先返回缓存
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // 其次尝试 navigation preload 的响应
        const preloaded = 'preloadResponse' in event ? await event.preloadResponse : null;
        if (preloaded) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, preloaded.clone());
            return preloaded;
        }

        // 再尝试网络请求
        try {
            const net = await fetch(req);
            if (net && net.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(req, net.clone());
            }
            return net;
        } catch {
            // 离线兜底
            return new Response('Offline', { status: 503 });
        }
    })());
});
