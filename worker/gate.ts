/**
 * Team code gate: nothing of the app or the team list is served until the team code is entered.
 *
 * The code lives only in the Worker secret TEAM_CODE. A correct entry sets an HttpOnly cookie
 * holding an HMAC of a fixed label keyed by the code, so the cookie never contains the code and
 * changing the secret signs everyone out. Repeated wrong entries from one address are slowed down.
 */

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface GateEnv {
  TEAM_CODE?: string;
  MASTER?: KV;
}

export const COOKIE = 'gqc_team';
const MAX_FAILS = 10;
const LOCK_SECONDS = 15 * 60;
const YEAR = 365 * 24 * 60 * 60;

/** Served without the code: what the browser needs to show the install prompt and the unlock page. */
const OPEN = new Set(['/unlock', '/manifest.webmanifest', '/favicon.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']);

async function token(code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('getech-qc-team-v1'));
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Compares without leaking how much matched. */
export function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function cookieValue(request: Request, name: string): string {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

/** Only paths on this site, so the unlock page cannot be used to send people elsewhere. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

const isPage = (request: Request) =>
  request.headers.get('sec-fetch-mode') === 'navigate' || (request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html'));

function page(status: number, opts: { error?: string; next?: string; notSetUp?: boolean } = {}): Response {
  const body = opts.notSetUp
    ? '<p>The team code has not been set up yet.</p>'
    : `<form method="post" action="/unlock">
        <input type="hidden" name="next" value="${(opts.next ?? '/').replace(/[&"<>]/g, '')}">
        <label for="code">Team code</label>
        <input id="code" name="code" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
        ${opts.error ? `<p class="err" role="alert">${opts.error}</p>` : ''}
        <button type="submit">Unlock</button>
      </form>`;
  const html = `<!doctype html><html lang="en" translate="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#3b3b3b"><meta name="google" content="notranslate"><meta name="robots" content="noindex">
<title>Getech QC</title><link rel="icon" href="/favicon.png">
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{background:#3b3b3b;color:#fff;font:400 16px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;
padding:calc(48px + env(safe-area-inset-top)) 20px 24px;min-height:100vh}
main{width:100%;max-width:420px;display:flex;flex-direction:column;gap:20px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:48px;height:48px;border-radius:12px}
.brand b{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#c6caca}
h1{margin:0;font-size:28px;line-height:1.15}
form,.box{background:#fff;color:#1e2122;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:12px;border-top:4px solid #59ac8c}
label{font-size:13px;font-weight:600;color:#62696b}
input[type=password]{font-size:16px;min-height:50px;padding:12px 14px;border:1px solid #dde1e1;border-radius:12px;width:100%}
input:focus{outline:none;border-color:#2b7a5c;box-shadow:0 0 0 3px rgba(43,122,92,.22)}
button{min-height:50px;border:0;border-radius:12px;background:#59ac8c;color:#0f2a20;font:600 16px system-ui,sans-serif;cursor:pointer}
.err{margin:0;color:#bf3127;font-size:14px;font-weight:600}p{margin:0}
</style></head><body class="notranslate"><main>
<div class="brand"><img src="/icon-192.png" alt=""><b>GeTech QC Evidence</b></div>
<h1>Enter the team code</h1>${body}</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

const locked = (request: Request, env: GateEnv) => {
  if (isPage(request)) {
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/unlock?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
  return new Response(JSON.stringify({ error: env.TEAM_CODE ? 'locked' : 'not_set_up' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};

/**
 * Returns a response when the request must stop at the gate (the unlock page, a redirect to it,
 * or a refusal), or null when it may go on to the app.
 */
export async function gate(request: Request, env: GateEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const unlocked = !!env.TEAM_CODE && same(cookieValue(request, COOKIE), await token(env.TEAM_CODE));

  if (url.pathname === '/unlock') {
    if (!env.TEAM_CODE) return page(503, { notSetUp: true });
    if (request.method === 'GET') {
      if (unlocked) return Response.redirect(`${url.origin}${safeNext(url.searchParams.get('next'))}`, 303);
      return page(200, { next: safeNext(url.searchParams.get('next')) });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const failKey = `fail:${ip}`;
    const fails = Number((await env.MASTER?.get(failKey)) ?? 0);
    const form = await request.formData().catch(() => null);
    const next = safeNext(String(form?.get('next') ?? '/'));
    if (fails >= MAX_FAILS) return page(429, { next, error: 'Too many tries. Wait 15 minutes, then try again.' });

    if (!same(String(form?.get('code') ?? ''), env.TEAM_CODE)) {
      await env.MASTER?.put(failKey, String(fails + 1), { expirationTtl: LOCK_SECONDS });
      await new Promise((r) => setTimeout(r, 600));
      return page(401, { next, error: 'That code is not right.' });
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: next,
        'set-cookie': `${COOKIE}=${await token(env.TEAM_CODE)}; Max-Age=${YEAR}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store',
      },
    });
  }

  if (unlocked || OPEN.has(url.pathname)) return null;
  return locked(request, env);
}
