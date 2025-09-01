export const onRequestGet = async (context) => {
    try {
        // 从 KV 命名空间 HOME_NEWS 读取 "all" 键
        const newsList = await context.env.HOME_NEWS.get("all", "json");

        if (!Array.isArray(newsList)) {
            return new Response(
                JSON.stringify({ error: "News data not found" }),
                {
                    status: 404,
                    headers: { "content-type": "application/json; charset=utf-8" }
                }
            );
        }

        // Fisher–Yates 洗牌算法（随机顺序更均匀）
        function shuffle(arr) {
            const a = arr.slice();
            if (typeof crypto.randomInt === "function") {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = crypto.randomInt(i + 1);
                    [a[i], a[j]] = [a[j], a[i]];
                }
            } else {
                const buf = new Uint32Array(1);
                for (let i = a.length - 1; i > 0; i--) {
                    const max = i + 1;
                    const limit = 0x100000000 - (0x100000000 % max);
                    let r;
                    do {
                        crypto.getRandomValues(buf);
                        r = buf[0];
                    } while (r >= limit);
                    const j = r % max;
                    [a[i], a[j]] = [a[j], a[i]];
                }
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
