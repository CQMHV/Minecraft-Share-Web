// 轮播（无克隆版）：指示器 + 自动播放 + 触控/键盘
// 边界处理：到最后一张再“下一张”→无动画瞬移到第1张；到第1张再“上一张”→无动画瞬移到最后一张
(function () {
  const carouselInner = document.getElementById("carouselInner");
  const root = carouselInner ? carouselInner.closest(".carousel") : null;
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  if (!carouselInner || !root) return;

  // 与 CSS 对齐
  const TRANSITION_MS = 500;       // .carousel-inner { transition: transform 500ms ease; }
  const AUTOPLAY_INTERVAL = 5000;  // 自动播放间隔
  const SWIPE_THRESHOLD = 40;      // 触控滑动阈值

  // 只有“原始项”，不克隆
  const items = Array.from(carouselInner.querySelectorAll(".carousel-item"));
  const N = items.length;
  if (N === 0) return;

  let index = 0;                // 当前索引：0..N-1
  let isAnimating = false;      // 防抖
  let autoplayTimer = null;

  // 指示器
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

  // 工具
  function setTransition(enabled) {
    carouselInner.style.transition = enabled ? "" : "none";
  }
  function setTranslate() {
    carouselInner.style.transform = `translateX(-${index * 100}%)`;
  }
  function applyActiveState() {
    items.forEach((el, i) => el.classList.toggle("is-active", i === index));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    if (nextBtn) nextBtn.setAttribute("aria-label", "下一张");
    if (prevBtn) prevBtn.setAttribute("aria-label", "上一张");
  }
  function jumpTo(i) {
    // 关闭过渡 → 瞬移 → 下一帧恢复过渡
    setTransition(false);
    index = i;
    setTranslate();
    requestAnimationFrame(() => setTransition(true));
    applyActiveState();
  }

  function updateSlide(animate = true) {
    if (!animate) {
      setTransition(false);
      setTranslate();
      requestAnimationFrame(() => setTransition(true));
    } else {
      setTranslate();
    }
    applyActiveState();
  }

  // 切换动作（边界瞬移）
  function next() {
    if (isAnimating) return;
    isAnimating = true;
    if (index === N - 1) {
      // 到尾再“下一张”：无动画瞬移回0
      jumpTo(0);
      // 给一点点时间，避免连续点击太快产生错觉
      setTimeout(() => (isAnimating = false), 50);
    } else {
      index += 1;
      updateSlide(true);
      setTimeout(() => (isAnimating = false), TRANSITION_MS);
    }
  }

  function prev() {
    if (isAnimating) return;
    isAnimating = true;
    if (index === 0) {
      // 到首再“上一张”：无动画瞬移到最后
      jumpTo(N - 1);
      setTimeout(() => (isAnimating = false), 50);
    } else {
      index -= 1;
      updateSlide(true);
      setTimeout(() => (isAnimating = false), TRANSITION_MS);
    }
  }

  function goTo(i) {
    if (i === index) return;
    // 同步过渡：根据距离决定是否无动画瞬移（可选：这里用正常动画即可）
    isAnimating = true;
    index = i;
    updateSlide(true);
    setTimeout(() => (isAnimating = false), TRANSITION_MS);
  }

  // 事件
  if (nextBtn) nextBtn.addEventListener("click", next);
  if (prevBtn) prevBtn.addEventListener("click", prev);

  // 自动播放（悬停/隐藏暂停）
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

  // 触控滑动
  let startX = 0, deltaX = 0, isTouching = false;
  root.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length === 0) return;
    isTouching = true;
    startX = e.touches[0].clientX;
    deltaX = 0;
    stopAutoplay();
    setTransition(false); // 跟手无动画
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
      updateSlide(true);
    }
    isTouching = false;
    startAutoplay();
  });

  // 键盘
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // Resize 自适应
  const ro = new ResizeObserver(() => {
    setTranslate(); // 不打断当前过渡
  });
  ro.observe(carouselInner);

  // 初始化
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
