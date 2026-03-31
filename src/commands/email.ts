import { projectApi, requireProjectConfig } from '../lib/api.js';

export const emailCommand = {
  async enable(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/email`, {
        method: 'POST',
        body: {},
      }) as { status: string; dailyLimit?: number };

      console.log('Email enabled\n');
      console.log(`  Status: ${result.status}`);
      if (result.dailyLimit) console.log(`  Daily limit: ${result.dailyLimit}`);
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('Email is already enabled.');
      } else {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    }
  },

  async info(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/email`) as {
        status: string;
        domain: string | null;
        dailyLimit: number;
        sentToday: number;
        sentTotal: number;
        sesVerified: boolean;
        verificationStatus: string | null;
        dkimStatus: string | null;
      };

      console.log('Email:\n');
      console.log(`  Status:       ${result.status}`);
      console.log(`  Domain:       ${result.domain || 'noreply@openkbs.com (default)'}`);
      console.log(`  Verified:     ${result.sesVerified ? 'Yes' : 'No'}`);
      if (result.verificationStatus) {
        console.log(`  Verification: ${result.verificationStatus}`);
      }
      if (result.dkimStatus) {
        console.log(`  DKIM:         ${result.dkimStatus}`);
      }
      console.log(`  Daily limit:  ${result.dailyLimit}`);
      console.log(`  Sent today:   ${result.sentToday}`);
      console.log(`  Total sent:   ${result.sentTotal}`);
    } catch (err: any) {
      if (err.message.includes('not found') || err.message.includes('Not found')) {
        console.log('Email not enabled. Enable with: openkbs email enable');
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  },

  async send(to: string, opts: { subject?: string; body?: string; html?: string }): Promise<void> {
    const config = requireProjectConfig();

    if (!opts.subject) {
      console.error('Error: --subject is required');
      process.exit(1);
    }
    if (!opts.body && !opts.html) {
      console.error('Error: --body or --html is required');
      process.exit(1);
    }

    try {
      await projectApi(`/projects/${config.projectId}/email/send`, {
        method: 'POST',
        body: { to, subject: opts.subject, text: opts.body, html: opts.html },
      });
      console.log(`Email sent to ${to}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async disable(): Promise<void> {
    const config = requireProjectConfig();

    try {
      await projectApi(`/projects/${config.projectId}/email`, {
        method: 'DELETE',
      });
      console.log('Email disabled.');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async verifyDomain(domain: string): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/email/verify-domain`, {
        method: 'POST',
        body: { domain },
      }) as {
        domain: string;
        verification: { success: boolean; record: string };
        dkim: { success: boolean; tokens: string[] };
        message: string;
      };

      console.log(`Domain verification initiated for ${result.domain}\n`);
      if (result.verification?.success) console.log(`  TXT record created: ${result.verification.record}`);
      if (result.dkim?.success) console.log(`  DKIM records created: ${result.dkim.tokens.length} CNAME(s)`);
      console.log(`\n  Check status: openkbs email verify-status`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async verifyStatus(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/email/verify-status`) as {
        domain: string;
        verificationStatus: string;
        dkimStatus: string;
        sesVerified: boolean;
      };

      console.log('Email Domain Verification:\n');
      console.log(`  Domain:       ${result.domain}`);
      console.log(`  Verification: ${result.verificationStatus}`);
      console.log(`  DKIM:         ${result.dkimStatus}`);
      console.log(`  SES Verified: ${result.sesVerified ? 'Yes' : 'No'}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },
};
