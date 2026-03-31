import { projectApi, requireProjectConfig } from '../lib/api.js';

export const domainCommand = {
  async add(domain: string): Promise<void> {
    const conf = requireProjectConfig();
    try {
      const result = await projectApi(`/projects/${conf.projectId}/domain`, {
        method: 'POST',
        body: { domain },
      }) as any;

      console.log(`Domain ${result.domain} registered (status: ${result.status})\n`);

      if (result.nsRecords?.length) {
        console.log('Add these NS records at your domain registrar:\n');
        for (const ns of result.nsRecords) {
          console.log(`  ${ns}`);
        }
        console.log('\nThen run: openkbs domain verify');
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async verify(): Promise<void> {
    const conf = requireProjectConfig();
    try {
      const result = await projectApi(`/projects/${conf.projectId}/domain/verify`, {
        method: 'POST',
      }) as any;

      console.log(`Domain: ${result.domain}`);
      console.log(`Status: ${result.status}`);
      if (result.message) console.log(`\n${result.message}`);

      if (result.dnsRecords?.length) {
        console.log('\nDNS validation records:');
        for (const r of result.dnsRecords) {
          console.log(`  ${r.name} → ${r.value} (${r.validationStatus || 'pending'})`);
        }
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async provision(): Promise<void> {
    const conf = requireProjectConfig();
    try {
      const result = await projectApi(`/projects/${conf.projectId}/domain/provision`, {
        method: 'POST',
      }) as any;

      console.log(`Domain: ${result.domain}`);
      console.log(`Status: ${result.status}`);
      if (result.cfDomainName) {
        console.log(`CloudFront: ${result.cfDomainName}`);
      }
      if (result.message) console.log(`\n${result.message}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async info(): Promise<void> {
    const conf = requireProjectConfig();
    try {
      const result = await projectApi(`/projects/${conf.projectId}/domain`) as any;

      if (!result.domain) {
        console.log('No domain configured. Add one with: openkbs domain add <domain>');
        return;
      }

      console.log(`Domain: ${result.domain}`);
      console.log(`Status: ${result.status}`);

      if (result.nsRecords?.length) {
        console.log('\nNS records:');
        for (const ns of result.nsRecords) {
          console.log(`  ${ns}`);
        }
      }

      if (result.cfDomainName) {
        console.log(`\nCloudFront: ${result.cfDomainName}`);
      }
      if (result.cfDistributionId) {
        console.log(`Distribution: ${result.cfDistributionId}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async remove(): Promise<void> {
    const conf = requireProjectConfig();
    try {
      await projectApi(`/projects/${conf.projectId}/domain`, {
        method: 'DELETE',
      });
      console.log('Domain removed');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },
};
