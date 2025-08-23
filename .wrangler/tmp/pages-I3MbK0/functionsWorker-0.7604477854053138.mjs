var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/news.js
var onRequestGet = /* @__PURE__ */ __name(async (context) => {
  try {
    let shuffle = function(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const j = buf[0] % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    __name(shuffle, "shuffle");
    const newsList = await context.env.HOME_NEWS.get("all", "json");
    if (!newsList || !Array.isArray(newsList)) {
      return new Response(JSON.stringify({ error: "No news data found" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
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
}, "onRequestGet");

// api/set-lang/index.js
var SUPPORTED = [
  "zh-cn",
  "zh-tw",
  "en-us",
  "ja-jp",
  "ko-kr",
  "fr-fr",
  "de-de",
  "es-es",
  "pt-br",
  "ru-ru",
  "ar-sa",
  "it-it",
  "hi-in",
  "id-id"
];
function isSupported(lang) {
  if (!lang) return false;
  return SUPPORTED.includes(String(lang).toLowerCase());
}
__name(isSupported, "isSupported");
function makeSetCookieHeader(lang, opts = {}) {
  const maxAge = opts.maxAgeSeconds && Number(opts.maxAgeSeconds) || 60 * 60 * 24 * 30;
  const parts = [
    `lang=${encodeURIComponent(String(lang).toLowerCase())}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
    `Secure`
  ];
  if (opts.httpOnly) {
    parts.push("HttpOnly");
  }
  return parts.join("; ");
}
__name(makeSetCookieHeader, "makeSetCookieHeader");
function isSafeRequestForSettingCookie(request, env) {
  const originHeader = request.headers.get("origin");
  const xhrHeader = request.headers.get("x-requested-with");
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
      const reqUrl = new URL(request.url);
      const originHostMatchesRequest = originUrl.host === reqUrl.host && originUrl.protocol === reqUrl.protocol;
      const originMatchesCanonical = canonicalHost ? originUrl.host === canonicalHost : false;
      return originHostMatchesRequest || originMatchesCanonical;
    } catch (e) {
      return false;
    }
  }
  if (xhrHeader && xhrHeader.toLowerCase() === "xmlhttprequest") return true;
  return false;
}
__name(isSafeRequestForSettingCookie, "isSafeRequestForSettingCookie");
var onRequestPost = /* @__PURE__ */ __name(async (ctx) => {
  const { request, env } = ctx;
  if (!isSafeRequestForSettingCookie(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_origin" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
  const lang = body && body.lang ? String(body.lang).toLowerCase() : null;
  if (!isSupported(lang)) {
    return new Response(JSON.stringify({ ok: false, error: "unsupported_lang" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
  const setCookie = makeSetCookieHeader(lang, { maxAgeSeconds: 60 * 60 * 24 * 30, httpOnly: false });
  const headers = new Headers({
    "Content-Type": "application/json"
  });
  headers.append("Set-Cookie", setCookie);
  const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
  const reqUrl = new URL(request.url);
  const origin = canonicalHost ? `${reqUrl.protocol}//${canonicalHost}` : reqUrl.origin;
  const location = `${origin}/${lang}/`;
  return new Response(JSON.stringify({ ok: true, locale: lang, location }), {
    status: 200,
    headers
  });
}, "onRequestPost");
var onRequestGet2 = /* @__PURE__ */ __name(async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");
  const lang = langParam ? String(langParam).toLowerCase() : null;
  if (!isSupported(lang)) {
    return new Response("unsupported language", { status: 400 });
  }
  const setCookie = makeSetCookieHeader(lang, { maxAgeSeconds: 60 * 60 * 24 * 30, httpOnly: false });
  const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
  const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
  const location = `${origin}/${lang}/`;
  const headers = new Headers();
  headers.append("Set-Cookie", setCookie);
  headers.append("Location", location);
  return new Response(null, { status: 302, headers });
}, "onRequestGet");

// indexnow.js
var DEFAULT_ENDPOINTS = [
  "https://www.bing.com/indexnow",
  "https://api.indexnow.org/indexnow",
  "https://yandex.com/indexnow",
  "https://search.seznam.cz/indexnow",
  "https://search.naver.com/indexnow"
];
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
      if (res.status < 400) {
        return { endpoint, ok: true, status: res.status, body: bodyText };
      }
      if (!(res.status === 429 || res.status >= 500 && res.status <= 599)) {
        return { endpoint, ok: false, status: res.status, body: bodyText };
      }
    } catch (e) {
      lastErr = String(e);
    }
    if (attempt < maxRetries) {
      const delay = Math.min(1600 * Math.pow(2, attempt), 8e3);
      await new Promise((r) => setTimeout(r, delay));
    }
    attempt++;
  }
  return {
    endpoint,
    ok: false,
    status: res?.status ?? 0,
    body: res ? bodyText : lastErr || "network error"
  };
}
__name(postWithRetry, "postWithRetry");
async function onRequestGet3({ env }) {
  const host = env.HOST || "minecraft.cqmhv.com";
  const key = env.INDEXNOW_KEY || "";
  const extra = (env.INDEXNOW_EXTRA_ENDPOINTS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const keyLocation = env.INDEXNOW_KEY_LOCATION || (key ? `https://${host}/${key}.txt` : "");
  const endpoints = [.../* @__PURE__ */ new Set([...DEFAULT_ENDPOINTS, ...extra])];
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
__name(onRequestGet3, "onRequestGet");
async function onRequestPost2({ request, env }) {
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
      status: 400,
      headers: { "Content-Type": "application/json; charset=UTF-8" }
    });
  }
  const host = env.HOST || "minecraft.cqmhv.com";
  const key = env.INDEXNOW_KEY;
  const keyLocation = env.INDEXNOW_KEY_LOCATION || (key ? `https://${host}/${key}.txt` : "");
  const list = Array.isArray(payloadIn?.urlList) ? payloadIn.urlList : [];
  const urlList = list.map((u) => {
    try {
      return new URL(u);
    } catch {
      return null;
    }
  }).filter((u) => u && u.hostname === host).map((u) => u.toString()).slice(0, 1e4);
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
  const extra = (env.INDEXNOW_EXTRA_ENDPOINTS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const endpoints = [.../* @__PURE__ */ new Set([...DEFAULT_ENDPOINTS, ...extra])];
  const outPayload = { host, key, keyLocation, urlList };
  const results = await Promise.allSettled(
    endpoints.map((ep) => postWithRetry(ep, outPayload))
  );
  const flat = results.map(
    (r) => r.status === "fulfilled" ? r.value : { endpoint: "unknown", ok: false, status: 0, body: String(r.reason || "error") }
  );
  const anyAccepted = flat.some((r) => r.ok && (r.status === 200 || r.status === 202));
  return new Response(JSON.stringify({
    ok: anyAccepted,
    submitted: urlList.length,
    endpoints: flat
  }, null, 2), {
    status: anyAccepted ? 200 : 207,
    // 207 Multi-Status（部分失败）
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}
__name(onRequestPost2, "onRequestPost");

// index.js
var SUPPORTED2 = ["zh-cn", "zh-tw", "en-us", "ja-jp", "ko-kr", "fr-fr", "de-de", "es-es", "pt-br", "ru-ru", "ar-sa", "it-it", "hi-in", "id-id"];
var LANG_COOKIE = "lang";
var COUNTRY_FALLBACK = { CN: "zh-cn", TW: "zh-tw", HK: "zh-tw", MO: "zh-tw", JP: "ja-jp", KR: "ko-kr", SG: "zh-cn", MY: "zh-cn", US: "en-us", GB: "en-us", AU: "en-us", CA: "en-us", FR: "fr-fr", DE: "de-de", ES: "es-es", BR: "pt-br", RU: "ru-ru", IT: "it-it", SA: "ar-sa", IN: "hi-in", ID: "id-id" };
function readLangCookie(req) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).toLowerCase();
  } catch (e) {
    return null;
  }
}
__name(readLangCookie, "readLangCookie");
function negotiateLocale(acceptLang) {
  if (!acceptLang) return null;
  const parts = acceptLang.split(",").map((seg) => {
    const [tagRaw, qRaw] = seg.trim().split(";q=");
    const tag = (tagRaw || "").trim().toLowerCase();
    const q = qRaw ? parseFloat(qRaw) : 1;
    return { tag, q: isNaN(q) ? 1 : q };
  }).filter((x) => x.tag).sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    if (SUPPORTED2.includes(tag)) return tag;
    const base = tag.split("-")[0];
    const baseMatch = SUPPORTED2.find((l) => l.split("-")[0] === base);
    if (baseMatch) return baseMatch;
  }
  return null;
}
__name(negotiateLocale, "negotiateLocale");
function contentLanguageOf(locale) {
  return locale.split("-").map((p, i) => i === 0 ? p.toLowerCase() : p.toUpperCase()).join("-");
}
__name(contentLanguageOf, "contentLanguageOf");
var onRequest = /* @__PURE__ */ __name(async (ctx) => {
  const { request, env } = ctx;
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return ctx.next ? ctx.next() : new Response("Bad Request", { status: 400 });
  }
  if (url.pathname !== "/") return ctx.next ? ctx.next() : void 0;
  let locale = readLangCookie(request);
  if (!locale) locale = negotiateLocale(request.headers.get("accept-language"));
  if (!locale) {
    const country = request.cf && request.cf.country || "";
    if (country && COUNTRY_FALLBACK[country]) locale = COUNTRY_FALLBACK[country];
  }
  if (!locale) locale = "en-us";
  const relativeLocation = `/${locale}/`;
  const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : "";
  const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
  const absoluteLocation = `${origin}${relativeLocation}`;
  const headers = new Headers();
  headers.set("Location", absoluteLocation);
  headers.set("Vary", "Accept-Language");
  headers.set("Content-Language", contentLanguageOf(locale));
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Link", SUPPORTED2.map((l) => `</${l}/>; rel="alternate"; hreflang="${contentLanguageOf(l)}"`).join(", "));
  const reqCookieHeader = request.headers.get("cookie") || "";
  const hasLangCookie = /\blang=/.test(reqCookieHeader);
  if (!hasLangCookie) {
    const maxAge = 60 * 60 * 24 * 30;
    const cookieValue = encodeURIComponent(locale);
    const cookieParts = [
      `lang=${cookieValue}`,
      `Path=/`,
      `Max-Age=${maxAge}`,
      `SameSite=Lax`,
      `Secure`
      // 生产请确保使用 HTTPS（Pages 默认启用 HTTPS）
    ];
    headers.append("Set-Cookie", cookieParts.join("; "));
  }
  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${absoluteLocation}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Redirecting\u2026</title>
</head>
<body>
  <p>Redirecting to <a href="${absoluteLocation}">${relativeLocation}</a></p>
  <script>try{location.replace("${absoluteLocation}");}catch(e){window.location="${absoluteLocation}";}<\/script>
</body>
</html>`;
  return new Response(html, { status: 302, headers });
}, "onRequest");

// ../.wrangler/tmp/pages-I3MbK0/functionsRoutes-0.4640645474267473.mjs
var routes = [
  {
    routePath: "/api/news",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/set-lang",
    mountPath: "/api/set-lang",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/set-lang",
    mountPath: "/api/set-lang",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/indexnow",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/indexnow",
    mountPath: "/",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// C:/Users/29224/AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/29224/AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// C:/Users/29224/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/29224/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-TzTIQS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// C:/Users/29224/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-TzTIQS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.7604477854053138.mjs.map
