// functions/set-lang.js
// 用于设置语言 cookie 的 Cloudflare Pages Functions
// - POST /api/set-lang  -> 接收 JSON { lang }，写入 cookie 并返回 JSON
// - GET  /api/set-lang?lang=xx -> 写入 cookie 并 302 跳转
// cookie：仅限当前主机 (不带 Domain)，SameSite=Lax，默认保存 30 天

const SUPPORTED = [
    "zh-cn","zh-tw","en-us","ja-jp","ko-kr","fr-fr",
    "de-de","es-es","pt-br","ru-ru","it-it","id-id"
];

function isSupported(lang) {
    if (!lang) return false;
    return SUPPORTED.includes(String(lang).toLowerCase());
}

function makeSetCookieHeader(lang, opts = {}) {
    const maxAge = (opts.maxAgeSeconds && Number(opts.maxAgeSeconds)) || 60 * 60 * 24 * 30;
    return [
        `lang=${encodeURIComponent(String(lang).toLowerCase())}`,
        `Path=/`,
        `Max-Age=${maxAge}`,
        `SameSite=Lax`
    ].join('; ');
}

// 简单 CSRF 检查：允许同源请求或带 X-Requested-With=XMLHttpRequest
function isSafeRequestForSettingCookie(request, env) {
    const originHeader = request.headers.get('origin');
    const xhrHeader = request.headers.get('x-requested-with');

    if (originHeader) {
        try {
            const originUrl = new URL(originHeader);
            const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
            const reqUrl = new URL(request.url);
            const originHostMatchesRequest = originUrl.host === reqUrl.host && originUrl.protocol === reqUrl.protocol;
            const originMatchesCanonical = canonicalHost ? (originUrl.host === canonicalHost) : false;
            return originHostMatchesRequest || originMatchesCanonical;
        } catch {
            return false;
        }
    }
    if (xhrHeader && xhrHeader.toLowerCase() === 'xmlhttprequest') return true;
    return false;
}

// POST: JSON { lang } -> 设置 cookie
export const onRequestPost = async (ctx) => {
    const { request, env } = ctx;

    if (!isSafeRequestForSettingCookie(request, env)) {
        return new Response(JSON.stringify({ ok: false, error: 'bad_origin' }), {
            status: 403,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
        });
    }

    let body;
    try { body = await request.json(); }
    catch {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
            status: 400,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
        });
    }

    const lang = body && body.lang ? String(body.lang).toLowerCase() : null;
    if (!isSupported(lang)) {
        return new Response(JSON.stringify({ ok: false, error: 'unsupported_lang' }), {
            status: 400,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
        });
    }

    const setCookie = makeSetCookieHeader(lang);
    const headers = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        // 标注与缓存相关的可变请求头，避免错误复用
        'Vary': 'Origin, X-Requested-With'
    });
    headers.append('Set-Cookie', setCookie);

    const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
    const reqUrl = new URL(request.url);
    const origin = canonicalHost ? `${reqUrl.protocol}//${canonicalHost}` : reqUrl.origin;
    const location = `${origin}/${lang}/`;

    return new Response(JSON.stringify({ ok: true, locale: lang, location }), {
        status: 200, headers
    });
};

// GET: ?lang=xx -> 设置 cookie + 302 跳转
export const onRequestGet = async (ctx) => {
    const { request, env } = ctx;
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang')?.toLowerCase() || null;

    if (!isSupported(lang)) {
        return new Response('unsupported language', { status: 400, headers: { 'cache-control': 'no-store' } });
    }

    const setCookie = makeSetCookieHeader(lang);

    const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
    const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
    const location = `${origin}/${lang}/`;

    const headers = new Headers({
        // 避免 302 被缓存导致后续不再下发 Set-Cookie
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Location': location
    });
    headers.append('Set-Cookie', setCookie);

    return new Response(null, { status: 302, headers });
};
