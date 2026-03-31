import fs from 'fs';
import path from 'path';
import { projectApi, requireProjectConfig } from '../lib/api.js';
import { isLocalTarget } from '../lib/config.js';

export const siteCommand = {
  async push(): Promise<void> {
    const config = requireProjectConfig();
    const sitePath = config.site ? config.site.replace('./', '') : 'build';
    const siteDir = path.join(process.cwd(), sitePath);

    if (!fs.existsSync(siteDir)) {
      throw new Error(`No ${sitePath}/ directory found. Run: npm run build`);
    }

    console.log('Deploying site...');

    // Collect site files
    const files: Record<string, string> = {};
    const entries = fs.readdirSync(siteDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        const fullPath = path.join(entry.parentPath || (entry as any).path, entry.name);
        const relativePath = path.relative(siteDir, fullPath);
        files[relativePath] = fs.readFileSync(fullPath, 'base64');
      }
    }

    if (isLocalTarget()) {
      const { deploySite } = await import('../lib/local/storage.js');
      const url = await deploySite(config.projectId, files);
      console.log(`Site deployed locally`);
      console.log(`URL: ${url}`);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/storage/site`, {
        method: 'POST',
        body: { files, spa: config.spa },
      }) as { status: string; url?: string };

      console.log(`Site deployed: ${result.status}`);
      if (result.url) console.log(`URL: ${result.url}`);
    } catch (err: any) {
      throw new Error(`Deploy failed: ${err.message}`);
    }
  },
};
