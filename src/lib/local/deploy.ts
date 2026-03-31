import fs from 'fs';
import path from 'path';
import net from 'net';
import { execSync } from 'child_process';
import { ProjectConfig, LOCAL_POSTGRES_URL } from '../config.js';
import { zipFunctionDir } from '../zip.js';
import { deployFunction } from './lambda.js';
import { ensureBucket, deploySite } from './storage.js';

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

export async function deployLocal(config: ProjectConfig, cwd?: string): Promise<void> {
  const workDir = cwd || process.cwd();

  console.log(`Deploying project ${config.projectId} locally...\n`);

  // Verify infrastructure
  const [localstackUp, postgresUp] = await Promise.all([
    checkPort('localhost', 4566),
    checkPort('localhost', 5432),
  ]);

  if (!localstackUp) {
    throw new Error('LocalStack is not running. Run: docker compose up -d');
  }
  if (!postgresUp) {
    throw new Error('PostgreSQL is not running. Run: docker compose up -d');
  }

  // 1. Create storage bucket
  if (config.storage) {
    const storageBucket = `openkbs-${config.projectId}-storage`;
    console.log('Storage:');
    try {
      await ensureBucket(storageBucket);
      console.log(`  Bucket: ${storageBucket}`);
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  // 2. Postgres — already running, just print info
  if (config.postgres) {
    console.log('Postgres:');
    console.log(`  ${LOCAL_POSTGRES_URL}`);
  }

  // 3. Skip cloud-only services
  if (config.mqtt) console.log('MQTT: Skipped (cloud-only)');
  if (config.email) console.log('Email: Skipped (cloud-only)');

  // 4. Deploy functions
  if (config.functions && config.functions.length > 0) {
    console.log('Functions:');
    for (const fnConfig of config.functions) {
      const fnDir = path.join(workDir, 'functions', fnConfig.name);
      if (!fs.existsSync(fnDir)) {
        console.log(`  ${fnConfig.name}: skipped (directory not found)`);
        continue;
      }

      console.log(`  Deploying ${fnConfig.name}...`);
      const zipBuffer = zipFunctionDir(fnDir);
      const result = await deployFunction(config.projectId, fnConfig.name, zipBuffer, {
        memory: fnConfig.memory,
        timeout: fnConfig.timeout,
        schedule: fnConfig.schedule,
      });

      console.log(`  ${result.created ? 'Created' : 'Updated'}`);
      console.log(`  URL: ${result.url}`);
    }
  }

  // 5. Build and deploy site
  const pkgPath = path.join(workDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.build) {
        console.log('Building site...');
        execSync('npm run build', { cwd: workDir, stdio: 'pipe' });
        console.log('  Build complete');
      }
    } catch (err: any) {
      console.error(`  Build failed: ${err.message}`);
    }
  }

  const sitePath = config.site ? config.site.replace('./', '') : 'build';
  const siteDir = path.join(workDir, sitePath);
  if (fs.existsSync(siteDir)) {
    console.log('Site:');
    const files: Record<string, string> = {};
    const entries = fs.readdirSync(siteDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        const fullPath = path.join(entry.parentPath || (entry as any).path, entry.name);
        const relativePath = path.relative(siteDir, fullPath);
        files[relativePath] = fs.readFileSync(fullPath, 'base64');
      }
    }

    const siteUrl = await deploySite(config.projectId, files);
    console.log(`  Deployed: ${siteUrl}`);
  }

  console.log('\nLocal deploy complete!');
}
