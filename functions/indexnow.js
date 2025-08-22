// /functions/indexnow.js
export const onRequestPost = async (ctx) => {
    const { request, env } = ctx;

    const token = request.headers.get("X-IndexNow-Token") || "";
    if (!env.INDEXNOW_TOKEN || token !== env.INDEXNOW_TOKEN) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" }
        });
    }

    let payload;
    try { payload = await request.json(); }
    catch { return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400, headers: { "Content-Type": "application/json" }
    }); }

    const host = env.HOST || "minecraft.cqmhv.com";
    const key = env.INDEXNOW_KEY;
    const keyLocation = env.INDEXNOW_KEY_LOCATION || `https://${host}/${key}.txt`;

    const list = Array.isArray(payload?.urlList) ? payload.urlList : [];
    const urlList = list.map(u => { try { return new URL(u); } catch { return null; } })
                        .filter(u => u && u.hostname === host)
                        .map(u => u.toString());

    if (!key || urlList.length === 0) {
        return new Response(JSON.stringify({ error: "INDEXNOW_KEY or urlList missing" }), {
            status: 400, headers: { "Content-Type": "application/json" }
        });
    }

    const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, key, keyLocation, urlList })
    });

    const text = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, body: text }, null, 2), {
        headers: { "Content-Type": "application/json" }
    });
};
