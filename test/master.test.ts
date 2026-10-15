import { describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost, validLists, type Env } from '../worker/master';

const kv = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v), m };
};
const LISTS = [{ machine: 'SSDLV', folders: [{ name: 'Machine Verification', shots: [{ path: [], name: 'CCTV' }, { path: ['EPSON'], name: 'Loader Robot' }] }] }];
const post = (env: Env, body: unknown, passcode = 'team-pass-1') =>
  onRequestPost({ env, request: new Request('https://x/api/master', { method: 'POST', headers: { 'x-publish-passcode': passcode }, body: JSON.stringify(body) }) });
const get = (env: Env) => onRequestGet({ env, request: new Request('https://x/api/master') });

describe('/api/master', () => {
  it('says so when Cloudflare is not set up yet', async () => {
    expect((await get({})).status).toBe(503);
    const r = await post({ MASTER: kv() }, { lists: LISTS });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'not_set_up', missing: ['PUBLISH_PASSCODE'] });
    expect(await (await post({ PUBLISH_PASSCODE: 'x' }, { lists: LISTS })).json()).toEqual({ error: 'not_set_up', missing: ['MASTER'] });
  });

  it('has nothing until someone publishes', async () => {
    expect((await get({ MASTER: kv() })).status).toBe(404);
  });

  it('refuses a wrong passcode and stores nothing', async () => {
    const store = kv();
    const env = { MASTER: store, PUBLISH_PASSCODE: 'team-pass-1' };
    expect((await post(env, { lists: LISTS }, 'wrong')).status).toBe(401);
    expect((await post(env, { lists: LISTS }, '')).status).toBe(401);
    expect(store.m.size).toBe(0);
  });

  it('publishes with the passcode, then serves it to every phone', async () => {
    const env = { MASTER: kv(), PUBLISH_PASSCODE: 'team-pass-1' };
    const r = await post(env, { lists: LISTS, source: 'QC_Photo_Naming.xlsx', publishedBy: 'Deepak' });
    expect(r.status).toBe(200);
    const { version } = await r.json();
    const got = await (await get(env)).json();
    expect(got).toMatchObject({ version, source: 'QC_Photo_Naming.xlsx', publishedBy: 'Deepak', lists: LISTS });
  });

  it('keeps the previous list one step back', async () => {
    const store = kv();
    const env = { MASTER: store, PUBLISH_PASSCODE: 'team-pass-1' };
    await post(env, { lists: LISTS });
    const first = store.m.get('master');
    await post(env, { lists: LISTS });
    expect(store.m.get('master:previous')).toBe(first);
  });

  it('rejects lists phones could not use', async () => {
    const env = { MASTER: kv(), PUBLISH_PASSCODE: 'team-pass-1' };
    expect((await post(env, { lists: [] })).status).toBe(400);
    expect((await post(env, { lists: [{ machine: 'X', folders: [{ name: 'F', shots: [{ path: [], name: '' }] }] }] })).status).toBe(400);
    expect(validLists(LISTS)).toBe(true);
    expect(validLists([{ machine: 'X', folders: [] }])).toBe(false);
  });
});
