import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.openkbs');
const USER_JWT_PATH = path.join(CONFIG_DIR, 'userJWT');
const PROJECT_JWT_PATH = path.join(CONFIG_DIR, 'projectJWT');
const PROJECTS_DIR = path.join(CONFIG_DIR, 'projects');

const API_BASE = 'https://user.openkbs.com';
const PROJECT_API_BASE = 'https://project.openkbs.com';
const BOARD_API_BASE = 'https://board.openkbs.com';
const PROXY_BASE = 'https://proxy.openkbs.com';

export const config = {
  configDir: CONFIG_DIR,
  userJwtPath: USER_JWT_PATH,
  projectsDir: PROJECTS_DIR,
  apiBase: API_BASE,
  projectApiBase: PROJECT_API_BASE,
  boardApiBase: BOARD_API_BASE,
  proxyBase: PROXY_BASE,
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getUserJwt(): string | null {
  try {
    return fs.readFileSync(USER_JWT_PATH, 'utf-8').trim();
  } catch {
    return null;
  }
}

export function saveUserJwt(token: string): void {
  ensureConfigDir();
  fs.writeFileSync(USER_JWT_PATH, token, { mode: 0o600 });
}

export function clearUserJwt(): void {
  try {
    fs.unlinkSync(USER_JWT_PATH);
  } catch {
    // ignore
  }
}

// Global projectJWT — used in containers (scoped to single project)
export function getProjectJwtGlobal(): string | null {
  try {
    return fs.readFileSync(PROJECT_JWT_PATH, 'utf-8').trim();
  } catch {
    return null;
  }
}

export function saveProjectJwtGlobal(token: string): void {
  ensureConfigDir();
  fs.writeFileSync(PROJECT_JWT_PATH, token, { mode: 0o600 });
}

// Decode JWT payload without verification (client-side decode)
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

// Per-project JWT (legacy, used for specific project tokens)
export function getProjectJwt(projectId: string): string | null {
  try {
    const jwtPath = path.join(PROJECTS_DIR, projectId, 'projectJWT');
    return fs.readFileSync(jwtPath, 'utf-8').trim();
  } catch {
    return null;
  }
}

export function saveProjectJwt(projectId: string, token: string): void {
  const dir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'projectJWT'), token, { mode: 0o600 });
}

export const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
export const LOCAL_POSTGRES_URL = 'postgresql://postgres:openkbs@localhost:5432/openkbs';

export interface ProjectConfig {
  projectId: string;
  region?: string;
  target?: 'local' | 'cloud';
  postgres?: boolean;
  storage?: { cloudfront?: string };
  mqtt?: boolean;
  email?: boolean;
  spa?: string;
  site?: string;
  functions?: Array<{
    name: string;
    runtime?: string;
    memory?: number;
    timeout?: number;
    schedule?: string;
  }>;
}

export function isLocalTarget(): boolean {
  const config = loadProjectConfig();
  return config?.target === 'local';
}

export function loadProjectConfig(): ProjectConfig | null {
  const configPath = path.join(process.cwd(), 'openkbs.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveProjectConfig(config: ProjectConfig): void {
  const configPath = path.join(process.cwd(), 'openkbs.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
