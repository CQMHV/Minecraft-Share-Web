// carousel-fade.js - 可复用多实例轮播（淡入淡出版）
(function () {
    "use strict";

    class CarouselFade {
        constructor(root, opts = {}) {
            this.root = root;
            this.items = Array.from(root.querySelectorAll(".carousel-item"));
            this.nextBtn = root.querySelector(".carousel-btn.next") || root.querySelector(".nextBtn");
            this.prevBtn = root.querySelector(".carousel-btn.prev") || root.querySelector(".prevBtn");

            this.transitionMs = Number(root.dataset.transition ?? opts.transitionMs ?? 600);
            this.intervalMs = Number(root.dataset.interval ?? opts.intervalMs ?? 3000);
            this.enableKeyboard = (root.dataset.keyboard ?? (opts.enableKeyboard ?? "true")) !== "false";

            this.n = this.items.length;
            if (this.n === 0) return;
            this.index = 0;
            this.isAnimating = false;
            this.autoplayTimer = null;

            if (this.enableKeyboard && !this.root.hasAttribute("tabindex")) {
                this.root.setAttribute("tabindex", "0");
            }

            this._mountDots();
            this._bind();
            this._applyActive(true);
            this._startAutoplay();
        }

        _mountDots() {
            this.dotsWrap = document.createElement("div");
            this.dotsWrap.className = "carousel-dots";
            this.dots = [];
            for (let i = 0; i < this.n; i++) {
                const b = document.createElement("button");
                b.type = "button";
                b.setAttribute("aria-label", `跳到第 ${i + 1} 张`);
                b.addEventListener("click", () => this.goTo(i));
                this.dotsWrap.appendChild(b);
                this.dots.push(b);
            }
            this.root.appendChild(this.dotsWrap);
        }

        _bind() {
            if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.next());
            if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.prev());

            if (this.enableKeyboard) {
                this.root.addEventListener("keydown", (e) => {
                    if (e.key === "ArrowRight") this.next();
                    if (e.key === "ArrowLeft") this.prev();
                });
            }

            this.root.addEventListener("mouseenter", () => this._stopAutoplay());
            this.root.addEventListener("mouseleave", () => this._startAutoplay());
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) this._stopAutoplay();
                else this._startAutoplay();
            });

            // 触控（左右滑）
            let startX = 0, deltaX = 0, touching = false;
            this.root.addEventListener("touchstart", (e) => {
                if (!e.touches || e.touches.length === 0) return;
                touching = true;
                startX = e.touches[0].clientX;
                deltaX = 0;
                this._stopAutoplay();
            }, { passive: true });

            this.root.addEventListener("touchmove", (e) => {
                if (!touching) return;
                deltaX = e.touches[0].clientX - startX;
            }, { passive: true });

            this.root.addEventListener("touchend", () => {
                if (!touching) return;
                if (Math.abs(deltaX) > 40) {
                    deltaX < 0 ? this.next() : this.prev();
                }
                touching = false;
                this._startAutoplay();
            });
        }

        _applyActive(init = false) {
            this.items.forEach((el, i) => {
                el.classList.toggle("is-active", i === this.index);
                if (init) {
                    el.style.transition = `opacity ${this.transitionMs}ms ease`;
                }
            });
            if (this.dots) this.dots.forEach((d, i) => d.classList.toggle("is-active", i === this.index));
        }

        next() {
            this.goTo((this.index + 1) % this.n);
        }
        prev() {
            this.goTo((this.index - 1 + this.n) % this.n);
        }
        goTo(i) {
            if (this.isAnimating || i === this.index) return;
            this.isAnimating = true;
            this.index = i;
            this._applyActive();
            setTimeout(() => (this.isAnimating = false), this.transitionMs);
        }

        _startAutoplay() {
            this._stopAutoplay();
            if (this.n <= 1 || this.intervalMs <= 0) return;
            this.autoplayTimer = setInterval(() => this.next(), this.intervalMs);
        }
        _stopAutoplay() {
            if (this.autoplayTimer) {
                clearInterval(this.autoplayTimer);
                this.autoplayTimer = null;
            }
        }
    }

    function initAll() {
        document.querySelectorAll(".carousel").forEach(root => {
            if (root.__carouselInstance) return;
            root.__carouselInstance = new CarouselFade(root);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    window.initCarousels = initAll;
})();
