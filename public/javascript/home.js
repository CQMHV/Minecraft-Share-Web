// 轮播：自适应长度 + 指示器 + 循环无缝过渡(克隆) + 懒加载(IntersectionObserver)
// 支持：自动播放(悬停/标签页隐藏暂停)、键盘箭头、触控滑动、Resize 自适应、reduced-motion
(function () {
    const carouselInner = document.getElementById("carouselInner");
    const root = carouselInner ? carouselInner.closest(".carousel") : null;
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");

    if (!carouselInner || !root) return;

    // 原始项（用于指示器数量、索引映射）
    const originalItems = Array.from(root.querySelectorAll(".carousel-item"));
    const ORIGINAL_LEN = originalItems.length;
    if (ORIGINAL_LEN === 0) return;

    // === 懒加载：用 data-bg 保存图片地址 ===
    function loadBg(el) {
        const bg = el.getAttribute("data-bg");
        if (bg) {
            el.style.backgroundImage = `url('${bg}')`;
            el.removeAttribute("data-bg");
        }
    }

    // === 克隆首尾，做无缝循环 ===
    const firstClone = originalItems[0].cloneNode(true);
    const lastClone = originalItems[ORIGINAL_LEN - 1].cloneNode(true);
    carouselInner.prepend(lastClone);
    carouselInner.append(firstClone);

    // 所有项（含克隆）
    const items = Array.from(carouselInner.querySelectorAll(".carousel-item"));
    let index = 1; // 当前索引（指向第一个“真实”项）
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // === 指示器（分页圆点），数量 = ORIGINAL_LEN ===
    const dotsWrap = document.createElement("div");
    dotsWrap.className = "carousel-dots";
    const dots = [];
    for (let i = 0; i < ORIGINAL_LEN; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `跳到第 ${i + 1} 张`);
        b.addEventListener("click", () => goTo(i));
        dotsWrap.appendChild(b);
        dots.push(b);
    }
    root.appendChild(dotsWrap);

    // === 状态更新 ===
    function realIndexFrom(indexWithClones) {
        // 将 [0..ORIGINAL_LEN+1] 映射为真实 [0..ORIGINAL_LEN-1]
        if (indexWithClones === 0) return ORIGINAL_LEN - 1;      // 落在前置克隆 => 最后一张
        if (indexWithClones === ORIGINAL_LEN + 1) return 0;      // 落在尾部克隆 => 第一张
        return indexWithClones - 1;
    }

    function applyActiveState() {
        const real = realIndexFrom(index);
        items.forEach((el, i) => {
            if (i === index) el.classList.add("is-active");
            else el.classList.remove("is-active");
        });
        dots.forEach((d, i) => {
            if (i === real) d.classList.add("is-active");
            else d.classList.remove("is-active");
        });
        if (nextBtn) nextBtn.setAttribute("aria-label", "下一张");
        if (prevBtn) prevBtn.setAttribute("aria-label", "上一张");
    }

    function setTransition(enabled) {
        carouselInner.style.transition = enabled ? "" : "none";
    }

    function setTranslate() {
        carouselInner.style.transform = `translateX(-${index * 100}%)`;
    }

    function updateSlide(animate = true) {
        if (!animate) setTransition(false);
        setTranslate();
        if (!animate) {
            // 下一帧恢复过渡
            requestAnimationFrame(() => setTransition(true));
        }
        applyActiveState();

        // 预加载当前/相邻（防止正好滑到未加载的）
        eagerLoadAround(index);
    }

    // === 自动播放 ===
    const AUTOPLAY_INTERVAL = 5000;
    let autoplayTimer = null;
    function startAutoplay() {
        if (prefersReduced || ORIGINAL_LEN <= 1) return;
        stopAutoplay();
        autoplayTimer = setInterval(next, AUTOPLAY_INTERVAL);
    }
    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }

    // 悬停暂停
    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);

    // 标签页隐藏暂停
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
    });

    // === 触控滑动 ===
    let startX = 0;
    let deltaX = 0;
    let isTouching = false;
    const SWIPE_THRESHOLD = 40;

    function onTouchStart(e) {
        if (!e.touches || e.touches.length === 0) return;
        isTouching = true;
        startX = e.touches[0].clientX;
        deltaX = 0;
        stopAutoplay();
        setTransition(false); // 跟手不需要过渡
    }
    function onTouchMove(e) {
        if (!isTouching) return;
        deltaX = e.touches[0].clientX - startX;
        // 跟随手指
        const vw = root.clientWidth;
        carouselInner.style.transform = `translateX(calc(-${index * 100}% + ${deltaX}px))`;
    }
    function onTouchEnd() {
        if (!isTouching) return;
        setTransition(true);
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX < 0) next();
            else prev();
        } else {
            updateSlide(true); // 回弹
        }
        isTouching = false;
        startAutoplay();
    }
    carouselInner.addEventListener("touchstart", onTouchStart, { passive: true });
    carouselInner.addEventListener("touchmove", onTouchMove, { passive: true });
    carouselInner.addEventListener("touchend", onTouchEnd);

    // === 键盘箭头 ===
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
    });

    // === 上一/下一 ===
    function next() {
        index += 1;
        updateSlide(true);
    }
    function prev() {
        index -= 1;
        updateSlide(true);
    }
    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);

    // === 过渡结束：处理克隆两端的无缝跳转 ===
    carouselInner.addEventListener("transitionend", () => {
        if (index === 0) {
            setTransition(false);
            index = ORIGINAL_LEN; // 跳到真实最后一张
            setTranslate();
            requestAnimationFrame(() => setTransition(true));
        } else if (index === ORIGINAL_LEN + 1) {
            setTransition(false);
            index = 1; // 跳到真实第一张
            setTranslate();
            requestAnimationFrame(() => setTransition(true));
        }
        applyActiveState();
    });

    // === Resize 自适应：重置 transform，防止抖动 ===
    const ro = new ResizeObserver(() => updateSlide(false));
    ro.observe(carouselInner);

    // === 懒加载：IntersectionObserver（以轮播容器为 root，提前预载 100% 高度） ===
    const lazyObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadBg(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, {
        root: root,
        rootMargin: "100% 0px",
        threshold: 0.01
    });
    items.forEach(el => lazyObserver.observe(el));

    // 主动预载当前及相邻
    function eagerLoadAround(idxWithClones) {
        const idxs = [idxWithClones, idxWithClones - 1, idxWithClones + 1];
        idxs.forEach(i => {
            const el = items[(i + items.length) % items.length];
            if (el) loadBg(el);
        });
    }

    // === 初始化 ===
    // 初始定位到索引 1（第一张真实项），无动画
    applyActiveState();
    updateSlide(false);
    startAutoplay();
})();
