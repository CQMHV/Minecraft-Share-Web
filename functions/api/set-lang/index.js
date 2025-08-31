// functions/set-lang.js
// Cloudflare Pages Functions handler for setting language cookie.
// - POST /api/set-lang  -> accepts JSON { lang: "zh-cn" }, writes host-only Set-Cookie, returns JSON
// - GET  /api/set-lang?lang=zh-cn -> (no-JS fallback) writes cookie and 302 redirect to the language page
//
// Security:
// - Light CSRF protection: allow if Origin equals canonical host (or request origin), OR if
//   X-Requested-With: XMLHttpRequest header is present (common for AJAX).
// - Cookie is host-only (no Domain=...), Secure and SameSite=Lax by default.
//
// Notes:
// - In production ensure HTTPS (Pages provides it). Secure cookies won't be saved on http://localhost.
// - If you want HttpOnly (server-only cookie), uncomment the HttpOnly line (front-end won't read cookie then).
// - If you want to restrict to canonical host for Origin checks, set CANONICAL_HOST in Pages env (e.g. "minecraft.cqmhv.com").

const SUPPORTED = [
  "zh-cn","zh-tw","en-us","ja-jp","ko-kr","fr-fr",
  "de-de","es-es","pt-br","ru-ru","it-it","id-id"
];

function isSupported(lang) {
  if (!lang) return false;
  return SUPPORTED.includes(String(lang).toLowerCase());
}

function makeSetCookieHeader(lang, opts = {}) {
  // opts: { maxAgeSeconds: number, httpOnly: boolean }
  const maxAge = (opts.maxAgeSeconds && Number(opts.maxAgeSeconds)) || 60 * 60 * 24 * 30; // default 30 days
  const parts = [
    `lang=${encodeURIComponent(String(lang).toLowerCase())}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
    `Secure`
  ];
  // If you want the cookie inaccessible to JS, enable HttpOnly.
  if (opts.httpOnly) {
    parts.push('HttpOnly');
  }
  // NOTE: deliberately NOT including Domain=... so cookie is host-only (only sent to current host)
  return parts.join('; ');
}

/**
 * Lightweight CSRF / origin check:
 * - If Origin header present, accept only when it matches request origin or configured canonical host.
 * - Otherwise accept if X-Requested-With: XMLHttpRequest header is present (AJAX).
 * Returns true if request is considered safe.
 */
function isSafeRequestForSettingCookie(request, env) {
  const originHeader = request.headers.get('origin');
  const xhrHeader = request.headers.get('x-requested-with');

  // If Origin present, validate it
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
      // Accept if origin matches the request's host OR matches env.CANONICAL_HOST (if set)
      const reqUrl = new URL(request.url);
      const originHostMatchesRequest = originUrl.host === reqUrl.host && originUrl.protocol === reqUrl.protocol;
      const originMatchesCanonical = canonicalHost ? (originUrl.host === canonicalHost) : false;
      return originHostMatchesRequest || originMatchesCanonical;
    } catch (e) {
      // If Origin header invalid, reject
      return false;
    }
  }

  // If no Origin, allow when X-Requested-With is present and equals XMLHttpRequest
  if (xhrHeader && xhrHeader.toLowerCase() === 'xmlhttprequest') return true;

  // Otherwise reject (protects against CSRF via image / link)
  return false;
}

/**
 * POST handler: accepts JSON { lang } and sets host-only cookie.
 * Requires CSRF check (see above).
 */
export const onRequestPost = async (ctx) => {
  const { request, env } = ctx;

  // CSRF / origin check
  if (!isSafeRequestForSettingCookie(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_origin' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Parse JSON body (be lenient)
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const lang = body && body.lang ? String(body.lang).toLowerCase() : null;
  if (!isSupported(lang)) {
    return new Response(JSON.stringify({ ok: false, error: 'unsupported_lang' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Build Set-Cookie header (host-only)
  const setCookie = makeSetCookieHeader(lang, { maxAgeSeconds: 60 * 60 * 24 * 30 /* 30 days */, httpOnly: false });
  const headers = new Headers({
    'Content-Type': 'application/json'
  });
  // Append Set-Cookie
  headers.append('Set-Cookie', setCookie);

  // Optionally include a location hint in JSON (frontend can use it to redirect)
  const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
  // compose absolute language path (use canonicalHost if provided)
  const reqUrl = new URL(request.url);
  const origin = canonicalHost ? `${reqUrl.protocol}//${canonicalHost}` : reqUrl.origin;
  const location = `${origin}/${lang}/`;

  return new Response(JSON.stringify({ ok: true, locale: lang, location }), {
    status: 200,
    headers
  });
};

/**
 * GET handler: fallback for users without JS.
 * Example: GET /api/set-lang?lang=zh-cn
 * Writes cookie and redirects to the language page (absolute URL).
 */
export const onRequestGet = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const langParam = url.searchParams.get('lang');
  const lang = langParam ? String(langParam).toLowerCase() : null;

  if (!isSupported(lang)) {
    return new Response('unsupported language', { status: 400 });
  }

  // Build Set-Cookie header (host-only). For GET fallback we don't enforce CSRF (since navigation is explicit)
  const setCookie = makeSetCookieHeader(lang, { maxAgeSeconds: 60 * 60 * 24 * 30, httpOnly: false });

  const canonicalHost = env && env.CANONICAL_HOST ? String(env.CANONICAL_HOST).trim() : null;
  const origin = canonicalHost ? `${url.protocol}//${canonicalHost}` : url.origin;
  const location = `${origin}/${lang}/`;

  const headers = new Headers();
  headers.append('Set-Cookie', setCookie);
  headers.append('Location', location);

  return new Response(null, { status: 302, headers });
};
