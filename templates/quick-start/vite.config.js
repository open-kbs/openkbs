import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  root: 'src',
  plugins: [
    react(),
    // Dynamic proxy: forwards /<functionName> to the UI server's invoke endpoint
    {
      name: 'openkbs-api-proxy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Only proxy requests that match a function name in openkbs.json
          try {
            const config = JSON.parse(fs.readFileSync('openkbs.json', 'utf-8'));
            if (config.target !== 'local' || !config.functions) return next();

            const fnNames = config.functions.map(f => f.name);
            const reqPath = req.url || '';
            const match = reqPath.match(/^\/([^/?]+)/);
            if (!match || !fnNames.includes(match[1])) return next();

            const fnName = match[1];
            const appName = process.cwd().split('/').pop();
            const target = `http://localhost:3000/api/apps/${appName}/invoke/${fnName}`;

            // Forward the request
            const chunks = [];
            req.on('data', c => chunks.push(c));
            req.on('end', () => {
              const body = chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined;
              fetch(target, {
                method: req.method,
                headers: { 'content-type': req.headers['content-type'] || 'application/json' },
                ...(body && req.method !== 'GET' ? { body } : {}),
              }).then(async (proxyRes) => {
                res.writeHead(proxyRes.status, Object.fromEntries(proxyRes.headers.entries()));
                const text = await proxyRes.text();
                res.end(text);
              }).catch(err => {
                res.writeHead(502);
                res.end(JSON.stringify({ error: err.message }));
              });
            });
          } catch {
            next();
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: '../build',
    emptyOutDir: true,
  },
});
