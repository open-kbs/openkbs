import fs from 'fs';
import path from 'path';
import { projectApi, requireProjectConfig } from '../lib/api.js';
import { isLocalTarget, loadProjectConfig, saveProjectConfig } from '../lib/config.js';
import { zipFunctionDir } from '../lib/zip.js';

const FUNCTION_TEMPLATE = `export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {
            case 'hello':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ message: 'Hello from FUNCTION_NAME!' })
                };

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Unknown action', available: ['hello'] })
                };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
`;

export const fnCommand = {
  async create(name: string, opts: { memory?: string; timeout?: string } = {}): Promise<void> {
    const config = loadProjectConfig();
    const fnDir = path.join(process.cwd(), 'functions', name);

    if (fs.existsSync(fnDir)) {
      throw new Error(`Function directory already exists: functions/${name}`);
    }

    // Create directory and handler
    fs.mkdirSync(fnDir, { recursive: true });
    fs.writeFileSync(
      path.join(fnDir, 'index.mjs'),
      FUNCTION_TEMPLATE.replace('FUNCTION_NAME', name),
    );
    fs.writeFileSync(
      path.join(fnDir, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: {} }, null, 2) + '\n',
    );

    // Add to openkbs.json
    if (config) {
      if (!config.functions) config.functions = [];
      if (!config.functions.find(f => f.name === name)) {
        config.functions.push({
          name,
          runtime: 'nodejs24.x',
          memory: opts.memory ? parseInt(opts.memory) : 512,
          timeout: opts.timeout ? parseInt(opts.timeout) : 30,
        });
        saveProjectConfig(config);
      }
    }

    console.log(`Function created: functions/${name}/`);
    console.log(`  Handler: functions/${name}/index.mjs`);
    console.log(`  Deploy:  openkbs fn deploy ${name}`);
  },

  async list(): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      const { listFunctions } = await import('../lib/local/lambda.js');
      const functions = await listFunctions(config.projectId);

      if (functions.length === 0) {
        console.log('No functions deployed.');
        return;
      }

      console.log('Functions:\n');
      for (const fn of functions) {
        console.log(`  ${fn.name}  ${fn.runtime}  ${fn.state}`);
      }
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/fn`) as {
        functions: Array<{ name: string; runtime: string; status: string; lastDeployedAt: string | null; httpUrl?: string }>;
      };

      if (result.functions.length === 0) {
        console.log('No functions deployed.');
        return;
      }

      console.log('Functions:\n');
      for (const fn of result.functions) {
        const deployed = fn.lastDeployedAt ? new Date(fn.lastDeployedAt).toLocaleDateString() : 'never';
        const url = fn.httpUrl ? `  ${fn.httpUrl}` : '';
        console.log(`  ${fn.name}  ${fn.runtime}  ${fn.status}  (deployed: ${deployed})${url}`);
      }
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async push(name: string, opts: { schedule?: string; memory?: string; timeout?: string; http?: boolean } = {}): Promise<void> {
    const config = requireProjectConfig();
    const fnDir = path.join(process.cwd(), 'functions', name);

    if (!fs.existsSync(fnDir)) {
      throw new Error(`Function directory not found: functions/${name}`);
    }

    console.log(`Deploying function: ${name}...`);

    const zipBuffer = zipFunctionDir(fnDir);

    if (isLocalTarget()) {
      const { deployFunction } = await import('../lib/local/lambda.js');
      let memory = opts.memory ? parseInt(opts.memory) : undefined;
      let timeout = opts.timeout ? parseInt(opts.timeout) : undefined;

      if (config.functions) {
        const fnConfig = config.functions.find((f) => f.name === name);
        if (fnConfig) {
          memory = memory || fnConfig.memory;
          timeout = timeout || fnConfig.timeout;
        }
      }

      const result = await deployFunction(config.projectId, name, zipBuffer, { memory, timeout });
      console.log(`  ${result.created ? 'Created' : 'Updated'}`);
      console.log(`  URL: ${result.url}`);
      return;
    }

    const zipData = zipBuffer.toString('base64');

    // Get schedule from openkbs.json if available
    let schedule = opts.schedule;
    let memory = opts.memory ? parseInt(opts.memory) : undefined;
    let timeout = opts.timeout ? parseInt(opts.timeout) : undefined;

    if (!schedule && config.functions) {
      const fnConfig = config.functions.find((f) => f.name === name);
      if (fnConfig) {
        schedule = schedule || fnConfig.schedule;
        memory = memory || fnConfig.memory;
        timeout = timeout || fnConfig.timeout;
      }
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/fn/${name}`, {
        method: 'POST',
        body: {
          code: zipData,
          runtime: 'nodejs24.x',
          memory,
          timeout,
          schedule,
          httpAccess: opts.http ?? true,
        },
      }) as { created?: boolean; updated?: boolean; url?: string; customUrl?: string };

      console.log(`  ${result.created ? 'Created' : 'Updated'}`);
      if (result.url) console.log(`  URL: ${result.url}`);
      if (result.customUrl) console.log(`  Domain: ${result.customUrl}`);
    } catch (err: any) {
      throw new Error(`Deploy failed: ${err.message}`);
    }
  },

  async logs(name: string): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      console.log('Local logs: check docker logs for the LocalStack container.');
      console.log('  docker compose logs localstack');
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/fn/${name}/logs`) as {
        logs: Array<{ timestamp: string; message: string }>;
      };

      if (result.logs.length === 0) {
        console.log('No logs found.');
        return;
      }

      for (const line of result.logs) {
        const ts = new Date(line.timestamp).toISOString().slice(11, 23);
        console.log(`${ts}  ${line.message.trimEnd()}`);
      }
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async invoke(name: string, opts: { data?: string } = {}): Promise<void> {
    const config = requireProjectConfig();
    const payload = opts.data ? JSON.parse(opts.data) : {};

    if (isLocalTarget()) {
      const { invokeFunction } = await import('../lib/local/lambda.js');
      const result = await invokeFunction(config.projectId, name, payload);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/fn/${name}/invoke`, {
        method: 'POST',
        body: { payload },
      }) as { response: unknown };

      console.log(JSON.stringify(result.response, null, 2));
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async del(name: string): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      const { deleteFunction } = await import('../lib/local/lambda.js');
      await deleteFunction(config.projectId, name);
      console.log(`Function ${name} deleted.`);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/fn/${name}`, {
        method: 'DELETE',
      }) as { deleted: boolean };

      console.log(`Function ${name} deleted.`);
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
