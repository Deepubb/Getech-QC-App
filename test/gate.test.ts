import { describe, expect, it } from 'vitest';
import worker from '../worker/index';
import { COOKIE } from '../worker/gate';

const CODE = 'test-team-code';
const kv = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v), m };
};
const assets = { fetch: async () => new Response('APP', { status: 200 }) };
const env = (o: Record<string, unknown> = {}) => ({ TEAM_CODE: CODE, MASTER: kv(), ASSETS: assets, ...o });
const page = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://qc.example${path}`, { headers: { 'sec-fetch-mode': 'navigate', accept: 'text/html', ...headers } });
const unlock = (code: string, next = '/evidence/x', ip = '1.2.3.4') =>
  new Request('https://qc.example/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ip },
    body: new URLSearchParams({ code, next }).toString(),
  });
const cookieFrom = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0];

describe('team code gate', () => {
  it('sends a page without the code to the unlock page, keeping where it was going', async () => {
    const r = await worker.fetch(page('/evidence/abc'), env());
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://qc.example/unlock?next=%2Fevidence%2Fabc');
  });

  it('refuses the team list and app files without the code', async () => {
    const api = await worker.fetch(new Request('https://qc.example/api/master'), env());
    expect(api.status).toBe(401);
    expect(await api.json()).toEqual({ error: 'locked' });
    expect((await worker.fetch(new Request('https://qc.example/assets/index.js'), env())).status).toBe(401);
  });

  it('still serves what the browser needs to install the app', async () => {
    for (const p of ['/manifest.webmanifest', '/icon-192.png', '/favicon.png']) {
      expect(await (await worker.fetch(new Request(`https://qc.example${p}`), env())).text()).toBe('APP');
    }
  });

  it('shows the unlock form, never the code itself', async () => {
    const r = await worker.fetch(page('/unlock?next=/settings'), env());
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain('Enter the team code');
    expect(html).not.toContain(CODE);
  });

  it('refuses a wrong code and sets no cookie', async () => {
    const r = await worker.fetch(unlock('wrong'), env());
    expect(r.status).toBe(401);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(await r.text()).toContain('That code is not right.');
  });

  it('unlocks with the right code: an HttpOnly cookie that does not contain the code, then the app opens', async () => {
    const e = env();
    const r = await worker.fetch(unlock(CODE), e);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/evidence/x');
    const set = r.headers.get('set-cookie') ?? '';
    expect(set).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    expect(set).not.toContain(CODE);
    const cookie = cookieFrom(r);
    expect(cookie.startsWith(`${COOKIE}=`)).toBe(true);
    expect(await (await worker.fetch(page('/evidence/x', { cookie }), e)).text()).toBe('APP');
  });

  it('signs everyone out when the code is changed', async () => {
    const cookie = cookieFrom(await worker.fetch(unlock(CODE), env()));
    expect((await worker.fetch(page('/', { cookie }), env({ TEAM_CODE: 'a-new-code' }))).status).toBe(302);
  });

  it('only sends people back to pages on this site', async () => {
    expect((await worker.fetch(unlock(CODE, 'https://evil.example/'), env())).headers.get('location')).toBe('/');
    expect((await worker.fetch(unlock(CODE, '//evil.example/'), env())).headers.get('location')).toBe('/');
  });

  it('stops guessing after 10 wrong tries from one address', async () => {
    const e = env();
    for (let i = 0; i < 10; i++) expect((await worker.fetch(unlock('nope', '/', '9.9.9.9'), e)).status).toBe(401);
    expect((await worker.fetch(unlock(CODE, '/', '9.9.9.9'), e)).status).toBe(429);
    expect((await worker.fetch(unlock(CODE, '/', '8.8.8.8'), e)).status).toBe(303);
  }, 20_000);

  it('lets nobody in when the code has not been set up', async () => {
    const e = env({ TEAM_CODE: undefined });
    expect((await worker.fetch(page('/'), e)).status).toBe(302);
    expect((await worker.fetch(page('/unlock'), e)).status).toBe(503);
    expect((await worker.fetch(unlock(''), e)).status).toBe(503);
  });
});
