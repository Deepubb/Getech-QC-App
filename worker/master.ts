/**
 * /api/master: the team's master list of photo names.
 *
 * GET  returns the latest published list (404 until someone publishes).
 * POST publishes a new list. Anyone past the team code can publish; the previous list is kept as a backup.
 *
 * Needs a KV namespace bound as MASTER (see wrangler.jsonc).
 * The Excel is read on the publisher's PC; only machine, folder and photo names are sent here.
 */

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  MASTER?: KV;
}

export interface Context {
  request: Request;
  env: Env;
}

interface Shot {
  path: string[];
  name: string;
}
interface List {
  machine: string;
  folders: { name: string; shots: Shot[] }[];
}

const KEY = 'master';
const MAX_BODY = 1_000_000;
const MAX_SHOTS = 20_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const isName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;

/** Checks the shape so a bad publish can never leave phones with a list they cannot read. */
export function validLists(v: unknown): v is List[] {
  if (!Array.isArray(v) || !v.length || v.length > 200) return false;
  let shots = 0;
  for (const l of v) {
    if (!l || !isName(l.machine) || !Array.isArray(l.folders) || !l.folders.length) return false;
    for (const f of l.folders) {
      if (!f || !isName(f.name) || !Array.isArray(f.shots)) return false;
      for (const s of f.shots) {
        if (!s || !isName(s.name) || !Array.isArray(s.path) || s.path.length > 10 || !s.path.every(isName)) return false;
        if (++shots > MAX_SHOTS) return false;
      }
    }
  }
  return true;
}

/** What is missing on Cloudflare, named so the app can say exactly what to fix. */
const notSetUp = () => json({ error: 'not_set_up', missing: ['MASTER'] }, 503);

export async function onRequestGet({ env }: Context): Promise<Response> {
  if (!env.MASTER) return notSetUp();
  const stored = await env.MASTER.get(KEY);
  return stored ? new Response(stored, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ error: 'none' }, 404);
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!env.MASTER) return notSetUp();
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
  let body: { lists?: unknown; source?: unknown; publishedBy?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!validLists(body.lists)) return json({ error: 'bad_request' }, 400);
  const master = {
    version: crypto.randomUUID(),
    publishedAt: new Date().toISOString(),
    publishedBy: typeof body.publishedBy === 'string' ? body.publishedBy.slice(0, 80) : '',
    source: typeof body.source === 'string' ? body.source.slice(0, 200) : '',
    lists: body.lists,
  };
  // The previous list is kept one step back, so a bad publish can be undone by hand in Cloudflare.
  const previous = await env.MASTER.get(KEY);
  if (previous) await env.MASTER.put(`${KEY}:previous`, previous);
  await env.MASTER.put(KEY, JSON.stringify(master));
  return json({ version: master.version, publishedAt: master.publishedAt });
}
