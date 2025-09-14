// /functions/indexnow.js
// 4空格缩进

const DEFAULT_ENDPOINTS = [
    "https://www.bing.com/indexnow",
    "https://api.indexnow.org/indexnow",
    "https://yandex.com/indexnow",
    "https://search.seznam.cz/indexnow",
    "https://search.naver.com/indexnow"
];

// 简单重试：针对 429/5xx 指数退避
async function postWithRetry(endpoint, payload, maxRetries = 3) {
    let attempt = 0, lastErr = null, res = null, bodyText = "";
    while (attempt <= maxRetries) {
        try {
            res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify(payload)
            });
            bodyText = await res.text().catch(() => "");
            // 成功或可接受（多数实现返回 200 或 202）
            if (res.status < 400) {
                return { endpoint, ok: true, status: res.status, body: bodyText };
            }
            // 仅对 429/5xx 重试
            if (!(res.status === 429 || (res.status >= 500 && res.status <= 599))) {
                return { endpoint, ok: false, status: res.status, body: bodyText };
            }
        } catch (e) {
            lastErr = String(e);
        }
        // 退避等待
        if (attempt < maxRetries) {
            const delay = Math.min(1600 * Math.pow(2, attempt), 8000);
            await new Promise(r => setTimeout(r, delay));
        }
        attempt++;
    }
    return {
        endpoint,
        ok: false,
        status: res?.status ?? 0,
        body: res ? bodyText : (lastErr || "network error")
    };
}

// GET：健康检查（不泄露敏感值）
export async function onRequestGet({ env }) {
    const host = env.HOST || "minecraft.cqmhv.com";
    const key = env.INDEXNOW_KEY || "";
    const extra = (env.INDEXNOW_EXTRA_ENDPOINTS || "")
        .split(",").map(s => s.trim()).filter(Boolean);

    const keyLocation = env.INDEXNOW_KEY_LOCATION || (key
        ? `https://${host}/${key}.txt`
        : "");

    const endpoints = [...new Set([...DEFAULT_ENDPOINTS, ...extra])];

    const status = {
        ok: true,
        message: "IndexNow endpoint OK",
        host,
        hasKey: !!key,
        hasToken: !!env.INDEXNOW_TOKEN,
        keyLocation,
        endpoints
    };

    return new Response(JSON.stringify(status, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=UTF-8" }
    });
}

// POST：多引擎提交（需要 X-IndexNow-Token）
export async function onRequestPost({ request, env }) {
    const auth = request.headers.get("X-IndexNow-Token") || "";
    if (!env.INDEXNOW_TOKEN || auth !== env.INDEXNOW_TOKEN) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    let payloadIn;
    try {
        payloadIn = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400, headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    const host = env.HOST || "minecraft.cqmhv.com";
    const key = env.INDEXNOW_KEY;
    const keyLocation = env.INDEXNOW_KEY_LOCATION || (key
        ? `https://${host}/${key}.txt`
        : "");

    // 过滤并规范 urlList
    const list = Array.isArray(payloadIn?.urlList) ? payloadIn.urlList : [];
    const urlList = list
        .map(u => { try { return new URL(u); } catch { return null; } })
        .filter(u => u && u.hostname === host)
        .map(u => u.toString())
        .slice(0, 10000); // 单次最多 10000

    if (!key || !keyLocation || urlList.length === 0) {
        return new Response(JSON.stringify({
            error: "INDEXNOW_KEY or urlList missing",
            detail: {
                hasKey: !!key,
                urlCount: urlList.length,
                hostExpected: host
            }
        }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    const extra = (env.INDEXNOW_EXTRA_ENDPOINTS || "")
        .split(",").map(s => s.trim()).filter(Boolean);

    const endpoints = [...new Set([...DEFAULT_ENDPOINTS, ...extra])];

    const outPayload = { host, key, keyLocation, urlList };

    // 并发提交到各引擎
    const results = await Promise.allSettled(
        endpoints.map(ep => postWithRetry(ep, outPayload))
    );

    const flat = results.map(r => r.status === "fulfilled"
        ? r.value
        : { endpoint: "unknown", ok: false, status: 0, body: String(r.reason || "error") }
    );

    // 统计总体是否至少有一个成功
    const anyAccepted = flat.some(r => r.ok && (r.status === 200 || r.status === 202));

    return new Response(JSON.stringify({
        ok: anyAccepted,
        submitted: urlList.length,
        endpoints: flat
    }, null, 2), {
        status: anyAccepted ? 200 : 207, // 207 Multi-Status（部分失败）
        headers: { "Content-Type": "application/json; charset=UTF-8" }
    });
}
