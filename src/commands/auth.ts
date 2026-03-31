import { createServer } from 'http';
import { execSync } from 'child_process';
import { userApi } from '../lib/api.js';
import { saveUserJwt, clearUserJwt, saveProjectJwtGlobal, decodeJwtPayload, config } from '../lib/config.js';

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
  } catch {}
}

export async function loginCommand(): Promise<void> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const email = url.searchParams.get('email') || '';

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Connection': 'close',
        });
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>${token ? 'Logged in to OpenKBS CLI' : 'Login failed'}</h2>
            <p style="color:#666">${token ? 'You can close this window.' : 'Please try again.'}</p>
          </div>
        </body></html>`);

        if (token) {
          saveUserJwt(token);
          console.log(`Logged in as ${email}`);
        } else {
          console.error('Login failed');
        }
        setTimeout(() => process.exit(token ? 0 : 1), 200);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const loginUrl = `https://platform.openkbs.com/login?cli_port=${port}`;
      console.log('Opening browser to log in...');
      console.log(`If the browser didn't open, visit: ${loginUrl}`);
      openBrowser(loginUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error('Login timed out');
      server.closeAllConnections();
      server.close(() => resolve());
      process.exitCode = 1;
    }, 5 * 60 * 1000);
  });
}

export async function logoutCommand(): Promise<void> {
  clearUserJwt();
  console.log('Logged out');
}

// openkbs auth <token> — exchange short-lived JWT for long-lived container token
export async function authCommand(token: string): Promise<void> {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.projectId) {
      console.error('Error: Invalid token');
      process.exit(1);
    }

    const res = await fetch(`${config.projectApiBase}/projects/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json() as any;
    if (!res.ok) {
      console.error(`Error: ${data.error || 'Exchange failed'}`);
      process.exit(1);
    }

    saveProjectJwtGlobal(data.token);
    console.log(`Authenticated for project ${data.project.shortId}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
