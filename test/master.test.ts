import { describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost, validLists, type Env } from '../worker/master';

const kv = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v), m };
};
const LISTS = [{ machine: 'SSDLV', folders: [{ name: 'Machine Verification', shots: [{ path: [], name: 'CCTV' }, { path: ['EPSON'], name: 'Loader Robot' }] }] }];
const post = (env: Env, body: unknown) =>
  onRequestPost({ env, request: new Request('https://x/api/master', { method: 'POST', body: JSON.stringify(body) }) });
const get = (env: Env) => onRequestGet({ env, request: new Request('https://x/api/master') });

describe('/api/master', () => {
  it('names the storage when Cloudflare has not set it up', async () => {
    expect((await get({})).status).toBe(503);
    const r = await post({}, { lists: LISTS });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: 'not_set_up', missing: ['MASTER'] });
  });

  it('has nothing until someone publishes', async () => {
    expect((await get({ MASTER: kv() })).status).toBe(404);
  });

  it('publishes, then serves it to every phone', async () => {
    const env = { MASTER: kv() };
    const r = await post(env, { lists: LISTS, source: 'QC_Photo_Naming.xlsx', publishedBy: 'Deepak' });
    expect(r.status).toBe(200);
    const { version } = await r.json();
    expect(await (await get(env)).json()).toMatchObject({ version, source: 'QC_Photo_Naming.xlsx', publishedBy: 'Deepak', lists: LISTS });
  });

  it('keeps the previous list one step back', async () => {
    const store = kv();
    await post({ MASTER: store }, { lists: LISTS });
    const first = store.m.get('master');
    await post({ MASTER: store }, { lists: LISTS });
    expect(store.m.get('master:previous')).toBe(first);
  });

  it('rejects lists phones could not use, and stores nothing', async () => {
    const store = kv();
    expect((await post({ MASTER: store }, { lists: [] })).status).toBe(400);
    expect((await post({ MASTER: store }, { lists: [{ machine: 'X', folders: [{ name: 'F', shots: [{ path: [], name: '' }] }] }] })).status).toBe(400);
    expect(store.m.size).toBe(0);
    expect(validLists(LISTS)).toBe(true);
    expect(validLists([{ machine: 'X', folders: [] }])).toBe(false);
  });
});
