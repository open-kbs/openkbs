import { config, getUserJwt, getProjectJwt, getProjectJwtGlobal, loadProjectConfig } from './config.js';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

// Resolve auth token: userJWT first, then global projectJWT fallback (container mode)
function resolveToken(explicit?: string): string | null {
  if (explicit) return explicit;
  return getUserJwt() || getProjectJwtGlobal();
}

export async function userApi(path: string, opts: ApiOptions = {}): Promise<unknown> {
  const token = opts.token || getUserJwt();
  if (!token && !path.startsWith('/login') && !path.startsWith('/register')) {
    throw new Error('Not logged in. Run: openkbs login');
  }

  const res = await fetch(`${config.apiBase}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error: ${res.status}`);
  return data;
}

export async function projectApi(path: string, opts: ApiOptions = {}): Promise<unknown> {
  const token = resolveToken(opts.token);
  if (!token) throw new Error('Not logged in. Run: openkbs login');

  const res = await fetch(`${config.projectApiBase}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error: ${res.status}`);
  return data;
}

export async function boardApi(path: string, opts: ApiOptions = {}): Promise<unknown> {
  const token = resolveToken(opts.token);
  if (!token) throw new Error('Not logged in. Run: openkbs login');

  const res = await fetch(`${config.boardApiBase}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error: ${res.status}`);
  return data;
}

export function requireProjectConfig() {
  const conf = loadProjectConfig();
  if (!conf?.projectId) {
    throw new Error('No openkbs.json found. Run: openkbs init');
  }
  return conf;
}
