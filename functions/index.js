// functions/index.js - production (写入 host-only lang cookie，仅在 minecraft.cqmhv.com 生效)
// 说明：只要你以 https://minecraft.cqmhv.com/ 访问，该 cookie 会被浏览器绑定到 minecraft.cqmhv.com。
// 若你在 Pages 上设置 CANONICAL_HOST=minecraft.cqmhv.com，absoluteLocation 会指向该域。

const SUPPORTED = ["zh-cn","zh-tw","en-us","ja-jp","ko-kr","fr-fr","de-de","es-es","pt-br","ru-ru","ar-sa","it-it","hi-in","id-id"];
const LANG_COOKIE = "lang";
const COUNTRY_FALLBACK = { CN:"zh-cn", TW:"zh-tw", HK:"zh-tw", MO:"zh-tw", JP:"ja-jp", KR:"ko-kr", SG:"zh-cn", MY:"zh-cn", US:"en-us", GB:"en-us", AU:"en-us", CA:"en-us", FR:"fr-fr", DE:"de-de", ES:"es-es", BR:"pt-br", RU:"ru-ru", IT:"it-it", SA:"ar-sa", IN:"hi-in", ID:"id-id" };

function readLangCookie(req) {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
    if (!m) return null;
    try { return decodeURIComponent(m[1]).toLowerCase(); } catch(e) { return null; }
}
function negotiateLocale(acceptLang) {
    if (!acceptLang) return null;
    const parts = acceptLang.split(",").map(seg => { const [tagRaw,qRaw] = seg.trim().split(";q="); const tag=(tagRaw||"").trim().toLowerCase(); const q=qRaw?parseFloat(qRaw):1; return {tag,q:isNaN(q)?1:q}; }).filter(x=>x.tag).sort((a,b)=>b.q-a.q);
    for (const {tag} of parts) {
        if (SUPPORTED.includes(tag)) return tag;
        const base = tag.split("-")[0];
        const baseMatch = SUPPORTED.find(l=>l.split("-")[0]===base);
        if (baseMatch) return baseMatch;
    }
    return null;
}
function contentLanguageOf(locale){ return locale.split("-").map((p,i)=> i===0? p.toLowerCase(): p.toUpperCase()).join("-"); }

export const onRequest = async (ctx) => {
    const { request, env } = ctx;
    let url;
    try { url = new URL(request.url); } catch(e) { return ctx.next ? ctx.next() : new Response("Bad Request", { status: 400 }); }
    if (url.pathname !== "/") return ctx.next ? ctx.next() : undefined;

    // 语言选择：cookie -> accept-language -> CF country -> default
    let locale = readLangCookie(request);
    if (!locale) locale = negotiateLocale(request.headers.get("accept-language"));
    if (!locale) {
        const country = (request.cf && request.cf.country) || "";
        if (country && COUNTRY_FALLBACK[country]) locale = COUNTRY_FALLBACK[country];
    }
    if (!locale) locale = "en-us";

    const relativeLocation = `/${locale}/`;
    // 如果你在 Pages production 设置了 CANONICAL_HOST=minecraft.cqmhv.com 就会使用它，否则使用请求 origin
    const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : "";
    const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
    const absoluteLocation = `${origin}${relativeLocation}`;

    // headers
    const headers = new Headers();
    headers.set("Location", absoluteLocation);
    headers.set("Vary", "Accept-Language");
    headers.set("Content-Language", contentLanguageOf(locale));
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Link", SUPPORTED.map(l=>`</${l}/>; rel="alternate"; hreflang="${contentLanguageOf(l)}"`).join(", "));

    // ---- 写入 host-only Set-Cookie（**不包含 Domain 属性**），仅当请求中没有 lang cookie 时
    const reqCookieHeader = request.headers.get("cookie") || "";
    const hasLangCookie = /\blang=/.test(reqCookieHeader);
    if (!hasLangCookie) {
        const maxAge = 60 * 60 * 24 * 30; // 30 天
        const cookieValue = encodeURIComponent(locale);
        const cookieParts = [
            `lang=${cookieValue}`,
            `Path=/`,
            `Max-Age=${maxAge}`,
            `SameSite=Lax`,
            `Secure` // 生产请确保使用 HTTPS（Pages 默认启用 HTTPS）
        ];
        // 注意：**故意不添加** Domain=，这样 cookie 自动成为 host-only（只在当前主机发送）
        // 如果你希望 JS 无法读取，请取消下面注释开启 HttpOnly（但前端将无法 document.cookie 读取）
        // cookieParts.push('HttpOnly');
        headers.append('Set-Cookie', cookieParts.join('; '));
    }

    const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${absoluteLocation}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Redirecting…</title>
</head>
<body>
  <p>Redirecting to <a href="${absoluteLocation}">${relativeLocation}</a></p>
  <script>try{location.replace("${absoluteLocation}");}catch(e){window.location="${absoluteLocation}";}</script>
</body>
</html>`;

    return new Response(html, { status: 302, headers });
};
