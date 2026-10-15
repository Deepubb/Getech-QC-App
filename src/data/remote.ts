import type { TeamMaster } from '../core/types';
import type { ParsedList } from '../core/masterList';

const URL = '/api/master';

/** The latest team master list, or null when there is none, the phone is offline, or publishing is not set up. */
export async function fetchTeamMaster(): Promise<TeamMaster | null> {
  try {
    const r = await fetch(URL, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null;
    const m = (await r.json()) as TeamMaster;
    return m && typeof m.version === 'string' && Array.isArray(m.lists) ? m : null;
  } catch {
    return null;
  }
}

export type PublishError = 'passcode' | 'not_set_up' | 'offline' | 'failed';

export async function publishTeamMaster(lists: ParsedList[], source: string, publishedBy: string, passcode: string): Promise<{ ok: true } | { ok: false; error: PublishError }> {
  let r: Response;
  try {
    r = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-publish-passcode': passcode },
      body: JSON.stringify({ lists: lists.map(({ machine, folders }) => ({ machine, folders })), source, publishedBy }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }
  if (r.ok) return { ok: true };
  if (r.status === 401) return { ok: false, error: 'passcode' };
  if (r.status === 503 || r.status === 404 || r.status === 405) return { ok: false, error: 'not_set_up' };
  return { ok: false, error: 'failed' };
}
