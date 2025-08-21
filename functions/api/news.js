export const onRequestGet = async (context) => {
    try {
        // 从 KV 命名空间 HOME_NEWS 读取 "all" 键
        const newsList = await context.env.HOME_NEWS.get("all", "json");

        if (!newsList || !Array.isArray(newsList)) {
            return new Response(JSON.stringify({ error: "No news data found" }), {
                status: 500,
                headers: { "content-type": "application/json; charset=utf-8" }
            });
        }

        // Fisher–Yates 洗牌算法（随机顺序更均匀）
        function shuffle(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const buf = new Uint32Array(1);
                crypto.getRandomValues(buf);
                const j = buf[0] % (i + 1);
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        // 随机取 5 条（不足 5 条就返回全部）
        const n = 5;
        const randomNews = shuffle(newsList).slice(0, Math.min(n, newsList.length));

        return new Response(JSON.stringify({ news: randomNews }), {
            headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store"
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" }
        });
    }
};
