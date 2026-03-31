import { projectApi, requireProjectConfig } from '../lib/api.js';
import { isLocalTarget, LOCAL_POSTGRES_URL } from '../lib/config.js';

export const postgresCommand = {
  async info(): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      console.log('Postgres:\n');
      console.log('  Status:   running (local)');
      console.log('  Provider: Docker (postgres:16)');
      console.log('  Host:     localhost');
      console.log('  Port:     5432');
      console.log('  Database: openkbs');
      console.log(`\n  Connection string:\n  ${LOCAL_POSTGRES_URL}`);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/postgres`) as {
        host: string;
        port: number;
        dbName: string;
        provider: string;
        status: string;
        connectionString?: string;
      };

      console.log('Postgres:\n');
      console.log(`  Status:   ${result.status}`);
      console.log(`  Provider: ${result.provider}`);
      console.log(`  Host:     ${result.host}`);
      console.log(`  Port:     ${result.port}`);
      console.log(`  Database: ${result.dbName}`);
      if (result.connectionString) {
        console.log(`\n  Connection string:\n  ${result.connectionString}`);
      }
    } catch (err: any) {
      if (err.message.includes('not found') || err.message.includes('Not found')) {
        throw new Error('Postgres not enabled. Enable with: openkbs deploy (with postgres: true in openkbs.json)');
      }
      throw new Error(err.message);
    }
  },

  async connection(): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      process.stdout.write(LOCAL_POSTGRES_URL);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/postgres`) as {
        connectionString?: string;
      };

      if (result.connectionString) {
        process.stdout.write(result.connectionString);
      } else {
        throw new Error('Connection string not available');
      }
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
