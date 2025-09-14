(() => {
  const SW_URL = '/sw.js';
  const SCOPE = '/';

  // 确保浏览器支持 Service Worker
  if (!('serviceWorker' in navigator)) return;

  // 注册 SW
  const registerSW = async () => {
    try {
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
      await navigator.serviceWorker.ready;  // 等待 SW 准备好
      console.log('Service Worker ready.');
    } catch (e) {
      console.error('Service Worker 注册失败', e);
    }
  };

  // 调用注册 SW
  registerSW();
})();
