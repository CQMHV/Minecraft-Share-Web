// functions/index.js - production
// 首页重定向，根据 cookie / 浏览器语言 / 国家选择语言
// 写入 host-only lang cookie（不带 Domain，SameSite=Lax），默认 30 天有效

const SUPPORTED = [
    "zh-cn","zh-tw","en-us","ja-jp","ko-kr","fr-fr",
    "de-de","es-es","pt-br","ru-ru","it-it","id-id"
];
const LANG_COOKIE = "lang";
const COUNTRY_FALLBACK = {
    CN:"zh-cn", TW:"zh-tw", HK:"zh-tw", MO:"zh-tw",
    JP:"ja-jp", KR:"ko-kr",
    FR:"fr-fr", DE:"de-de", ES:"es-es", BR:"pt-br",
    RU:"ru-ru", IT:"it-it", ID:"id-id",
    SG:"zh-cn", MY:"zh-cn",
    US:"en-us", GB:"en-us", AU:"en-us", CA:"en-us"
};

function readLangCookie(req) {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
    if (!m) return null;
    try { return decodeURIComponent(m[1]).toLowerCase(); } catch { return null; }
}

function negotiateLocale(acceptLang) {
    if (!acceptLang) return null;
    const parts = acceptLang.split(",").map(seg => {
        const [tagRaw,qRaw] = seg.trim().split(";q=");
        const tag=(tagRaw||"").trim().toLowerCase();
        const q=qRaw?parseFloat(qRaw):1;
        return {tag,q:isNaN(q)?1:q};
    }).filter(x=>x.tag).sort((a,b)=>b.q-a.q);
    for (const {tag} of parts) {
        if (SUPPORTED.includes(tag)) return tag;
        const base = tag.split("-")[0];
        const baseMatch = SUPPORTED.find(l=>l.split("-")[0]===base);
        if (baseMatch) return baseMatch;
    }
    return null;
}

function contentLanguageOf(locale){
    return locale.split("-").map((p,i)=> i===0? p.toLowerCase(): p.toUpperCase()).join("-");
}

export const onRequest = async (ctx) => {
    const { request, env } = ctx;
    let url;
    try { url = new URL(request.url); } catch {
        return ctx.next ? ctx.next() : new Response("Bad Request", { status: 400 });
    }
    if (url.pathname !== "/") return ctx.next ? ctx.next() : undefined;

    // 语言选择：cookie -> accept-language -> CF country -> 默认
    let locale = readLangCookie(request);
    if (!locale) locale = negotiateLocale(request.headers.get("accept-language"));
    if (!locale) {
        const country = (request.cf && request.cf.country) || "";
        if (country && COUNTRY_FALLBACK[country]) locale = COUNTRY_FALLBACK[country];
    }
    if (!locale) locale = "en-us";

    const relativeLocation = `/${locale}/`;
    const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : "";
    const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
    const absoluteLocation = `${origin}${relativeLocation}`;

    const headers = new Headers();
    headers.set("Location", absoluteLocation);
    headers.set("Vary", "Accept-Language, Cookie");
    headers.set("Content-Language", contentLanguageOf(locale));
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");

    // hreflang 链接 + 默认语言 x-default
    const alternates = SUPPORTED.map(
        l => `</${l}/>; rel="alternate"; hreflang="${contentLanguageOf(l)}"`
    );
    alternates.push(`</en-us/>; rel="alternate"; hreflang="x-default"`);
    headers.set("Link", alternates.join(", "));

    // 写入 host-only cookie（不含 Domain，仅当请求中没有 lang cookie 时）
    const reqCookieHeader = request.headers.get("cookie") || "";
    if (!/\blang=/.test(reqCookieHeader)) {
        const maxAge = 60 * 60 * 24 * 30;
        const cookieValue = encodeURIComponent(locale);
        const cookieParts = [
            `lang=${cookieValue}`,
            `Path=/`,
            `Max-Age=${maxAge}`,
            `SameSite=Lax`
        ];
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
