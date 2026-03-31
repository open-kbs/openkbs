import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, exec, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { createLocalProject } from './project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Track running dev servers by app name
const devServers = new Map<string, { process: ChildProcess; url: string }>();

// Get the CLI command to spawn (handles both tsx dev mode and compiled binary)
function getCliCommand(): { cmd: string; args: string[] } {
  const entryPoint = process.argv[1];
  const indexTs = path.resolve(__dirname, '..', 'index.ts');
  // If entry point is a .ts file, we need tsx to run it
  if (entryPoint.endsWith('.ts') || fs.existsSync(indexTs)) {
    return { cmd: 'npx', args: ['tsx', indexTs] };
  }
  // Compiled binary or node with .mjs
  return { cmd: process.execPath, args: [entryPoint] };
}

function getAppsDir(): string {
  const dir = path.join(process.cwd(), 'projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUiHtmlPath(): string {
  // Try src/ui/ first (development), then relative to compiled binary
  const local = path.resolve(__dirname, '..', 'ui', 'index.html');
  if (fs.existsSync(local)) return local;
  // Fallback for compiled binary
  const dist = path.resolve(__dirname, '..', '..', 'src', 'ui', 'index.html');
  if (fs.existsSync(dist)) return dist;
  return local; // will 404
}

// Check if a TCP port is reachable
function checkPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

// List apps (directories with openkbs.json) in the apps directory
function listApps(appsDir: string): Array<{ name: string; projectId: string; target?: string }> {
  const apps: Array<{ name: string; projectId: string; target?: string }> = [];
  if (!fs.existsSync(appsDir)) return apps;

  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(appsDir, entry.name, 'openkbs.json');
    if (!fs.existsSync(configPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const devEntry = devServers.get(entry.name);
      const devUrl = devEntry && !devEntry.process.killed ? devEntry.url : null;
      apps.push({ name: entry.name, projectId: config.projectId, target: config.target, devUrl });
    } catch {}
  }
  return apps;
}

// Parse JSON body from request
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// Send SSE events for streaming command output
function runCommandSSE(
  res: http.ServerResponse,
  command: string,
  args: string[],
  cwd: string,
): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const child = spawn(command, args, { cwd, shell: true, env: { ...process.env } });

  const send = (data: string) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  child.stdout?.on('data', (chunk: Buffer) => send(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => send(chunk.toString()));

  child.on('error', (err) => {
    send(`Error spawning process: ${err.message}\n`);
    try {
      res.write(`event: done\ndata: ${JSON.stringify({ code: 1 })}\n\n`);
      res.end();
    } catch {}
  });

  child.on('close', (code) => {
    try {
      res.write(`event: done\ndata: ${JSON.stringify({ code: code ?? 0 })}\n\n`);
      res.end();
    } catch {}
  });

  res.on('close', () => { if (!child.killed) child.kill(); });
}

// Extract app name from URL path: /api/apps/:name/action
function parseAppRoute(url: string): { name: string; action: string } | null {
  const match = url.match(/^\/api\/apps\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { name: decodeURIComponent(match[1]), action: match[2] };
}

// Extract proxy route: /api/apps/:name/invoke/:fnName
function parseProxyRoute(url: string): { appName: string; fnName: string } | null {
  const match = url.match(/^\/api\/apps\/([^/]+)\/invoke\/([^/]+)/);
  if (!match) return null;
  return { appName: decodeURIComponent(match[1]), fnName: decodeURIComponent(match[2]) };
}

export async function uiCommand(opts: { port: string; open: boolean }): Promise<void> {
  const port = parseInt(opts.port, 10);
  const appsDir = getAppsDir();

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    try {
      // Serve UI HTML
      if (url === '/' && method === 'GET') {
        const htmlPath = getUiHtmlPath();
        if (!fs.existsSync(htmlPath)) {
          res.writeHead(404);
          res.end('UI not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(htmlPath, 'utf-8'));
        return;
      }

      // Health check
      if (url === '/api/status' && method === 'GET') {
        const [localstack, postgres] = await Promise.all([
          checkPort('localhost', 4566),
          checkPort('localhost', 5432),
        ]);

        // Try to get LocalStack service details
        let localstackServices: any = null;
        if (localstack) {
          try {
            const resp = await fetch('http://localhost:4566/_localstack/health');
            localstackServices = await resp.json();
          } catch {}
        }

        json(res, { localstack, postgres, localstackServices });
        return;
      }

      // List apps
      if (url === '/api/apps' && method === 'GET') {
        const apps = listApps(appsDir);
        json(res, { apps });
        return;
      }

      // Create app
      if (url === '/api/apps/create' && method === 'POST') {
        const body = await parseBody(req);
        const name = body.name || 'my-app';

        try {
          const result = await createLocalProject(name, appsDir);
          json(res, { success: true, name, projectId: result.projectId, projectDir: result.projectDir });
        } catch (err: any) {
          json(res, { error: err.message }, 400);
        }
        return;
      }

      // App-specific routes
      const appRoute = parseAppRoute(url);
      if (appRoute) {
        const appDir = path.join(appsDir, appRoute.name);
        if (!fs.existsSync(appDir)) {
          json(res, { error: `App "${appRoute.name}" not found` }, 404);
          return;
        }

        // App status check
        if (appRoute.action === 'status' && method === 'GET') {
          const installed = fs.existsSync(path.join(appDir, 'node_modules'));
          const devEntry = devServers.get(appRoute.name);
          const devRunning = !!devEntry && !devEntry.process.killed;
          const devUrl = devEntry?.url || null;
          json(res, { installed, devRunning, devUrl });
          return;
        }

        // Install dependencies (GET for EventSource, POST also accepted)
        if (appRoute.action === 'install' && (method === 'GET' || method === 'POST')) {
          runCommandSSE(res, 'npm', ['install'], appDir);
          return;
        }

        // Start dev server (Vite)
        if (appRoute.action === 'dev' && method === 'POST') {
          // Check if already running
          const existing = devServers.get(appRoute.name);
          if (existing && !existing.process.killed) {
            json(res, { success: true, url: existing.url, already: true });
            return;
          }

          const child = spawn('npm', ['run', 'dev'], {
            cwd: appDir,
            shell: true,
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          devServers.set(appRoute.name, { process: child, url: '' });

          // Wait for Vite to print its URL
          let devUrl = 'http://localhost:5173';
          const urlPromise = new Promise<string>((resolve) => {
            const timeout = setTimeout(() => resolve(devUrl), 10000);

            const onData = (chunk: Buffer) => {
              const text = chunk.toString();
              const match = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
              if (match) {
                devUrl = match[1];
                clearTimeout(timeout);
                resolve(devUrl);
              }
            };

            child.stdout?.on('data', onData);
            child.stderr?.on('data', onData);
          });

          devUrl = await urlPromise;
          const entry = devServers.get(appRoute.name);
          if (entry) entry.url = devUrl;
          json(res, { success: true, url: devUrl });
          return;
        }

        // Deploy locally via SSE
        if (appRoute.action === 'deploy-local' && (method === 'GET' || method === 'POST')) {
          const cli = getCliCommand();
          runCommandSSE(res, cli.cmd, [...cli.args, 'deploy'], appDir);
          return;
        }

        // Deploy to cloud (stubbed)
        if (appRoute.action === 'deploy-cloud' && method === 'POST') {
          json(res, { error: 'Cloud deployment from UI coming soon. Use CLI: openkbs login && openkbs deploy' }, 501);
          return;
        }

        // Delete app
        if (appRoute.action === 'delete' && method === 'POST') {
          // Kill dev server if running
          const devServer = devServers.get(appRoute.name);
          if (devServer && !devServer.process.killed) {
            devServer.process.kill();
            devServers.delete(appRoute.name);
          }
          // Remove directory
          try {
            fs.rmSync(appDir, { recursive: true, force: true });
            json(res, { success: true });
          } catch (err: any) {
            json(res, { error: err.message }, 500);
          }
          return;
        }
      }

      // Lambda proxy: invoke function and translate response to HTTP
      const proxyRoute = parseProxyRoute(url);
      if (proxyRoute) {
        const appDir = path.join(appsDir, proxyRoute.appName);
        const configPath = path.join(appDir, 'openkbs.json');
        if (!fs.existsSync(configPath)) {
          json(res, { error: `App "${proxyRoute.appName}" not found` }, 404);
          return;
        }

        const appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        // Read request body
        const body = await parseBody(req);

        // Build Lambda Function URL event
        const event = {
          version: '2.0',
          requestContext: {
            http: {
              method: method,
              path: `/${proxyRoute.fnName}`,
            },
          },
          headers: { 'content-type': req.headers['content-type'] || 'application/json' },
          body: JSON.stringify(body),
          isBase64Encoded: false,
        };

        try {
          const { invokeFunction } = await import('../lib/local/lambda.js');
          const result = await invokeFunction(appConfig.projectId, proxyRoute.fnName, event) as any;

          // Translate Lambda proxy response to HTTP
          const statusCode = result?.statusCode || 200;
          const responseHeaders: Record<string, string> = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            ...(result?.headers || {}),
          };

          res.writeHead(statusCode, responseHeaders);
          res.end(result?.body || '');
        } catch (err: any) {
          json(res, { error: err.message }, 500);
        }
        return;
      }

      // 404
      json(res, { error: 'Not found' }, 404);

    } catch (err: any) {
      json(res, { error: err.message }, 500);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\nOpenKBS Local Development UI`);
    console.log(`Running at: ${url}\n`);

    // Auto-open browser
    if (opts.open !== false) {
      const platform = process.platform;
      const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} ${url}`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    for (const [name, entry] of devServers) {
      entry.process.kill();
      devServers.delete(name);
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive
  await new Promise(() => {});
}
