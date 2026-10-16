import { gate, type GateEnv } from './gate';
import { onRequestGet, onRequestPost, type Env } from './master';

interface Assets {
  fetch(request: Request): Promise<Response>;
}

/** Every request passes the team code gate first; then the team list, or the app's files. */
export default {
  async fetch(request: Request, env: Env & GateEnv & { ASSETS: Assets }): Promise<Response> {
    const stop = await gate(request, env);
    if (stop) return stop;
    const { pathname } = new URL(request.url);
    if (pathname === '/api/master') {
      if (request.method === 'GET') return onRequestGet({ request, env });
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST' } });
    }
    return env.ASSETS.fetch(request);
  },
};
