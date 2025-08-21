// javascript/register-sw.js
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => console.log('SW 注册成功', reg))
        .catch(err => console.error('SW 注册失败', err));
}
