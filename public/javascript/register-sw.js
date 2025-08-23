// javascript/register-sw.js
(() => {
  const SW_URL = '/sw.js';
  const SCOPE = '/';

  // 配置
  const AUTO_ACTIVATE_NEW_SW = true;   // 发现新 SW 时自动 skipWaiting
  const PROMPT_ON_UPDATE = true;       // 新版接管后，是否弹确认刷新
  const AUTO_RELOAD_IF_NO_PROMPT = true; // 如果不弹确认，则自动刷新
  const MAX_RETRIES = 2;               // 注册失败的重试次数
  const RETRY_DELAY_MS = 1000;         // 重试初始间隔（指数退避）

  if (!('serviceWorker' in navigator)) return;

  let reloadedOnce = false;   // 防止 controllerchange 触发多次导致循环刷新
  let updateTriggered = false; // 标记已触发一次更新流程

  // ---- 可选：简单弹窗封装 ----
  const info = (msg) => { try { console.log('[SW]', msg); } catch(_){} };
  const error = (msg, err) => { try { console.error('[SW]', msg, err || ''); alert(msg); } catch(_){} };
  const confirmBox = (msg) => {
    try { return window.confirm(msg); } catch(_) { return true; }
  };

  // ---- 主流程：注册 + 监听更新 ----
  const registerWithRetry = async () => {
    let attempt = 0;
    while (true) {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
        wireUpdateListeners(reg);
        await navigator.serviceWorker.ready; // 等到 active
        info('Service Worker ready.');
        return reg;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          error('Service Worker 注册失败，请稍后重试。', err);
          throw err;
        }
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  };

  // 绑定 updatefound / waiting 的处理
  const wireUpdateListeners = (reg) => {
    // 浏览器后台检查可能已把新 SW 放在 waiting
    if (reg.waiting) onWaitingSW(reg);

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          onWaitingSW(reg);
        }
      });
    });
  };

  // 发现等待中的新 SW
  const onWaitingSW = (reg) => {
    const waiting = reg.waiting;
    if (!waiting) return;

    const isUpdate = !!navigator.serviceWorker.controller; // 有 controller 说明这是更新，而非首次安装
    updateTriggered = true;

    if (isUpdate) {
      info('发现新版本，可更新。');
      if (AUTO_ACTIVATE_NEW_SW) {
        // 发送指令给 waiting SW 立刻接管（需要 sw.js 里监听 message 才能生效，见文末说明）
        try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch(_) {}
      } else {
        // 不自动激活时，给用户个提示
        if (confirmBox('A new version is available. Reload now to update?')) {
          try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch(_) {}
        } else {
          info('用户选择稍后更新。');
        }
      }
    } else {
      // 首次安装：通常无需提示，直接激活即可
      if (AUTO_ACTIVATE_NEW_SW) {
        try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch(_) {}
      }
    }
  };

  // 新 SW 接管页面时触发
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedOnce) return;  // 避免重复
    reloadedOnce = true;

    if (!updateTriggered) return; // 不是更新流程触发的，不处理

    if (PROMPT_ON_UPDATE) {
      if (confirmBox('The app has been updated. Reload to apply the latest version?')) {
        location.reload();
      } else {
        info('用户暂不刷新，继续使用旧页面。');
      }
    } else if (AUTO_RELOAD_IF_NO_PROMPT) {
      location.reload();
    }
  });

  // 拉起注册
  registerWithRetry().catch(() => { /* 忽略，页面仍可工作 */ });
})();
