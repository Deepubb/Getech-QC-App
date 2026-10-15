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

export type PublishError = 'passcode' | 'not_set_up' | 'no_server' | 'offline' | 'failed';

export async function publishTeamMaster(
  lists: ParsedList[],
  source: string,
  publishedBy: string,
  passcode: string,
): Promise<{ ok: true } | { ok: false; error: PublishError; missing?: string[] }> {
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
  const body = r.headers.get('content-type')?.includes('application/json') ? await r.json().catch(() => null) : null;
  // The Worker script always answers with JSON. Anything else means only the app's files are being served.
  if (!body) return { ok: false, error: 'no_server' };
  if (r.status === 503) return { ok: false, error: 'not_set_up', missing: Array.isArray(body.missing) ? body.missing : [] };
  return { ok: false, error: 'failed' };
}
