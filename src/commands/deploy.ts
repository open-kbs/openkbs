import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { projectApi, requireProjectConfig } from '../lib/api.js';
import { isLocalTarget } from '../lib/config.js';
import { fnCommand } from './fn.js';
import { siteCommand } from './site.js';

export async function deployCommand(): Promise<void> {
  const config = requireProjectConfig();

  if (isLocalTarget()) {
    const { deployLocal } = await import('../lib/local/deploy.js');
    await deployLocal(config);
    return;
  }

  console.log(`Deploying project ${config.projectId} (${config.region || 'eu-central-1'})...\n`);

  // 1. Enable storage if configured
  if (config.storage) {
    console.log('Storage:');
    try {
      await projectApi(`/projects/${config.projectId}/storage`, { method: 'POST', body: {} });
      console.log('  Enabled');
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('  Already enabled');
      } else {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // 2. Enable postgres if configured
  if (config.postgres) {
    console.log('Postgres:');
    try {
      await projectApi(`/projects/${config.projectId}/postgres`, { method: 'POST', body: {} });
      console.log('  Enabled');
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('  Already enabled');
      } else {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // 3. Enable MQTT if configured
  if (config.mqtt) {
    console.log('MQTT:');
    try {
      await projectApi(`/projects/${config.projectId}/mqtt`, { method: 'POST', body: {} });
      console.log('  Enabled');
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('  Already enabled');
      } else {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // 3.5. Enable email if configured
  if (config.email) {
    console.log('Email:');
    try {
      await projectApi(`/projects/${config.projectId}/email`, { method: 'POST', body: {} });
      console.log('  Enabled');
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('  Already enabled');
      } else {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // 4. Provision CloudFront (async — creates distribution for immediate access)
  console.log('CloudFront:');
  try {
    const cfResult = await projectApi(`/projects/${config.projectId}/cloudfront`, {
      method: 'POST',
      body: {},
    }) as any;
    if (cfResult.alreadyProvisioned) {
      console.log(`  Already provisioned: ${cfResult.url}`);
    } else {
      console.log(`  Provisioning: ${cfResult.url}`);
      console.log(`  (deploying in background, ready in 3-5 minutes)`);
    }
  } catch (err: any) {
    console.error(`  Error: ${err.message}`);
  }

  // 5. Map storage to CloudFront (AFTER CF is created)
  if (config.storage && typeof config.storage === 'object' && config.storage.cloudfront) {
    const pathPrefix = config.storage.cloudfront;
    console.log(`Storage CloudFront: /${pathPrefix}/*`);
    try {
      const result = await projectApi(`/projects/${config.projectId}/storage/cloudfront`, {
        method: 'POST',
        body: { pathPrefix },
      }) as any;
      console.log(`  Mapped: ${result.url || `/${pathPrefix}/*`}`);
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('  Already mapped');
      } else {
        console.error(`  Error: ${err.message}`);
      }
    }
  }

  // 6. Deploy functions
  if (config.functions && config.functions.length > 0) {
    console.log('Functions:');
    for (const fnConfig of config.functions) {
      const fnDir = path.join(process.cwd(), 'functions', fnConfig.name);
      if (!fs.existsSync(fnDir)) {
        console.log(`  ${fnConfig.name}: skipped (directory not found)`);
        continue;
      }
      await fnCommand.push(fnConfig.name, {
        schedule: fnConfig.schedule,
        memory: fnConfig.memory?.toString(),
        timeout: fnConfig.timeout?.toString(),
      });
    }
  }

  // 7. Build and deploy site
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.build) {
        console.log('Building site...');
        execSync('npm run build', { cwd: process.cwd(), stdio: 'pipe' });
        console.log('  Build complete');
      }
    } catch (err: any) {
      console.error(`  Build failed: ${err.message}`);
    }
  }

  const sitePath = config.site ? config.site.replace('./', '') : 'build';
  const siteDir = path.join(process.cwd(), sitePath);
  if (fs.existsSync(siteDir)) {
    console.log('Site:');
    await siteCommand.push();
  }

  console.log('\nDeploy complete!');
}
