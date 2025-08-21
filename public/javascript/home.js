// 轮播（简化稳定版）：指示器 + 无限循环(克隆) + 自动播放 + 触控/键盘
// 说明：无懒加载；过渡时长假设为 500ms（需与 CSS 的 .carousel-inner transition 一致）
(function () {
    const carouselInner = document.getElementById("carouselInner");
    const root = carouselInner ? carouselInner.closest(".carousel") : null;
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    if (!carouselInner || !root) return;

    // ===== 常量（与 CSS 对齐）=====
    const TRANSITION_MS = 500;      // .carousel-inner { transition: transform 500ms ease; }
    const AUTOPLAY_INTERVAL = 5000; // 自动播放间隔
    const SWIPE_THRESHOLD = 40;     // 触控阈值
    const FALLBACK_BUFFER = 80;     // 过渡兜底缓冲

    // ===== 初始化项 & 克隆首尾 =====
    const originalItems = Array.from(carouselInner.querySelectorAll(".carousel-item"));
    const N = originalItems.length;
    if (N === 0) return;

    const firstClone = originalItems[0].cloneNode(true);
    const lastClone  = originalItems[N - 1].cloneNode(true);
    carouselInner.prepend(lastClone);
    carouselInner.append(firstClone);

    const items = Array.from(carouselInner.querySelectorAll(".carousel-item"));
    let index = 1;                 // 当前索引（含克隆）
    let isAnimating = false;       // 防抖：动画中阻止重复切换
    let autoplayTimer = null;
    let transitionFallbackTimer = null;

    // ===== 指示器（圆点）=====
    const dotsWrap = document.createElement("div");
    dotsWrap.className = "carousel-dots";
    const dots = [];
    for (let i = 0; i < N; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `跳到第 ${i + 1} 张`);
        b.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(b);
        dots.push(b);
    }
    root.appendChild(dotsWrap);

    // ===== 工具函数 =====
    function setTransition(enabled) {
        carouselInner.style.transition = enabled ? "" : "none";
    }
    function setTranslate() {
        carouselInner.style.transform = `translateX(-${index * 100}%)`;
    }
    function realIndexFrom(withClones) {
        if (withClones === 0) return N - 1;         // 前置克隆 -> 最后一张
        if (withClones === N + 1) return 0;         // 尾部克隆 -> 第一张
        return withClones - 1;                      // 1..N -> 0..N-1
    }
    function applyActiveState() {
        const real = realIndexFrom(index);
        items.forEach((el, i) => el.classList.toggle("is-active", i === index));
        dots.forEach((d, i) => d.classList.toggle("is-active", i === real));
        if (nextBtn) nextBtn.setAttribute("aria-label", "下一张");
        if (prevBtn) prevBtn.setAttribute("aria-label", "上一张");
    }

    function clearFallback() {
        if (transitionFallbackTimer) {
            clearTimeout(transitionFallbackTimer);
            transitionFallbackTimer = null;
        }
    }

    function onTransitionDone() {
        clearFallback();
        // 无缝回跳：落在克隆时，瞬移到真实对应项，且不触发动画
        if (index === 0) {
            setTransition(false);
            index = N;
            setTranslate();
            requestAnimationFrame(() => setTransition(true));
        } else if (index === N + 1) {
            setTransition(false);
            index = 1;
            setTranslate();
            requestAnimationFrame(() => setTransition(true));
        }
        applyActiveState();
        isAnimating = false;
    }

    function updateSlide(animate = true) {
        if (!animate) setTransition(false);
        setTranslate();
        if (!animate) requestAnimationFrame(() => setTransition(true));
        applyActiveState();
    }

    function safeChange(toIndex) {
        if (isAnimating) return;
        isAnimating = true;
        index = toIndex;
        updateSlide(true);
        // 兜底：即使 transitionend 因各种原因没触发，也确保解锁
        clearFallback();
        transitionFallbackTimer = setTimeout(onTransitionDone, TRANSITION_MS + FALLBACK_BUFFER);
    }

    function next() { safeChange(index + 1); }
    function prev() { safeChange(index - 1); }
    function goTo(realIndex) { safeChange(realIndex + 1); } // real 0..N-1 -> 带克隆 1..N

    // ===== 事件绑定 =====
    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);

    carouselInner.addEventListener("transitionend", (e) => {
        if (e.propertyName !== "transform") return;
        onTransitionDone();
    });

    // ===== 自动播放（悬停/隐藏暂停）=====
    function startAutoplay() {
        stopAutoplay();
        if (N <= 1) return;
        autoplayTimer = setInterval(next, AUTOPLAY_INTERVAL);
    }
    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }
    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
    });

    // ===== 触控滑动 =====
    let startX = 0, deltaX = 0, isTouching = false;
    root.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length === 0) return;
        isTouching = true;
        startX = e.touches[0].clientX;
        deltaX = 0;
        stopAutoplay();
        setTransition(false); // 跟手无动画
        clearFallback();
    }, { passive: true });

    root.addEventListener("touchmove", (e) => {
        if (!isTouching) return;
        deltaX = e.touches[0].clientX - startX;
        carouselInner.style.transform = `translateX(calc(-${index * 100}% + ${deltaX}px))`;
    }, { passive: true });

    root.addEventListener("touchend", () => {
        if (!isTouching) return;
        setTransition(true);
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
            deltaX < 0 ? next() : prev();
        } else {
            // 回弹
            isAnimating = true; // 与按钮切换一致，进入动画并设置兜底
            updateSlide(true);
            clearFallback();
            transitionFallbackTimer = setTimeout(onTransitionDone, TRANSITION_MS + FALLBACK_BUFFER);
        }
        isTouching = false;
        startAutoplay();
    });

    // ===== 键盘左右键 =====
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft")  prev();
    });

    // ===== Resize 自适应（不打断动画）=====
    const ro = new ResizeObserver(() => {
        // 仅根据当前 index 重设位置，不改 transition 状态
        setTranslate();
    });
    ro.observe(carouselInner);

    // ===== 初始化：跳到 index=1（第一张真实项），无动画定位；启动自动播放 =====
    setTransition(false);
    setTranslate();
    requestAnimationFrame(() => setTransition(true));
    applyActiveState();
    startAutoplay();
})();


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
        const data = await res.json();

        container.innerHTML = ''; // 清空占位符

        data.news.forEach(item => {
            const li = document.createElement('li');
            
            const a = document.createElement('a');
            a.href = item.url;
            a.textContent = item.title;
            a.target = '_blank';

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
