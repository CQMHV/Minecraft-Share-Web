//调用API获取新闻数据
async function loadNews() {
    const container = document.getElementById('news-container');
    const btn = document.getElementById('refresh-news');

    // 按钮进入加载状态
    btn.disabled = true;
    btn.textContent = '加载中...';

    container.innerHTML = '<li><span>加载中...</span></li>'; // 占位符

    try {
        const res = await fetch('/api/news');
        if (!res.ok) {
            container.innerHTML = `<li><span style="color:red;">加载失败：${res.status}</span></li>`;
            return;
        }
        const data = await res.json();

        if (!Array.isArray(data.news)) {
            container.innerHTML = '<li><span style="color:red;">新闻数据缺失</span></li>';
            return;
        }

        container.innerHTML = ''; // 清空占位符

        data.news.forEach(item => {
            const li = document.createElement('li');

            const a = document.createElement('a');
            a.href = item.url;
            a.textContent = item.title;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            // 如果后端 JSON 有 date 字段就显示
            const span = document.createElement('span');
            span.className = 'date';
            span.textContent = item.date || '';

            li.appendChild(a);
            li.appendChild(span);
            container.appendChild(li);
        });
    } catch (err) {
        container.innerHTML = '<li><span style="color:red;">加载失败，请稍后重试</span></li>';
        console.error(err);
    } finally {
        // 恢复按钮状态
        btn.disabled = false;
        btn.textContent = '换一批';
    }
}
// 页面加载时执行一次
loadNews();
// 点击按钮时刷新
document.getElementById('refresh-news').addEventListener('click', loadNews);
