// /functions/indexnow.js

// GET：用于健康检查/手动验证（浏览器直接打开）
// 不泄露真正的密钥，只给出是否已配置等状态。
export async function onRequestGet({ env }) {
    const host = env.HOST || "minecraft.cqmhv.com";
    const keyLocation = env.INDEXNOW_KEY_LOCATION || `https://${host}/${env.INDEXNOW_KEY || "<missing>"}.txt`;

    const status = {
        ok: true,
        message: "IndexNow endpoint OK",
        host,
        // 只返回布尔值，避免泄露敏感内容
        hasKey: !!env.INDEXNOW_KEY,
        hasToken: !!env.INDEXNOW_TOKEN,
        keyLocation
    };

    return new Response(JSON.stringify(status, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=UTF-8" }
    });
}

// POST：推送 URL 到 IndexNow（需要鉴权）
// 需要在请求头带上 X-IndexNow-Token，与 env.INDEXNOW_TOKEN 一致。
export async function onRequestPost({ request, env }) {
    const token = request.headers.get("X-IndexNow-Token") || "";
    if (!env.INDEXNOW_TOKEN || token !== env.INDEXNOW_TOKEN) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    const host = env.HOST || "minecraft.cqmhv.com";
    const key = env.INDEXNOW_KEY;
    const keyLocation = env.INDEXNOW_KEY_LOCATION || `https://${host}/${key}.txt`;

    const list = Array.isArray(payload?.urlList) ? payload.urlList : [];
    const urlList = list
        .map(u => { try { return new URL(u); } catch { return null; } })
        .filter(u => u && u.hostname === host)
        .map(u => u.toString());

    if (!key || urlList.length === 0) {
        return new Response(JSON.stringify({ error: "INDEXNOW_KEY or urlList missing" }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
    }

    const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key, keyLocation, urlList })
    });

    const text = await res.text();
    return new Response(JSON.stringify({
        ok: res.ok,
        status: res.status,
        body: text
    }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=UTF-8" }
    });
}
