import { onRequestGet, onRequestPost, type Env } from './master';

interface Assets {
  fetch(request: Request): Promise<Response>;
}

/** Serves the app's files, and the team master list at /api/master. */
export default {
  async fetch(request: Request, env: Env & { ASSETS: Assets }): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/master') {
      if (request.method === 'GET') return onRequestGet({ request, env });
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST' } });
    }
    return env.ASSETS.fetch(request);
  },
};
