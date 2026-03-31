import { projectApi, requireProjectConfig } from '../lib/api.js';

export const mqttCommand = {
  async info(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/mqtt`) as {
        websocketUrl: string | null;
        status: string;
      };

      console.log('MQTT:\n');
      console.log(`  Status:       ${result.status}`);
      if (result.websocketUrl) {
        console.log(`  WebSocket:    ${result.websocketUrl}`);
      }
    } catch (err: any) {
      if (err.message.includes('not found') || err.message.includes('Not found')) {
        console.log('MQTT not enabled. Enable with: openkbs mqtt enable');
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  },

  async enable(): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/mqtt`, {
        method: 'POST',
        body: {},
      }) as { websocketUrl: string; status: string };

      console.log('MQTT enabled\n');
      console.log(`  Status:       ${result.status}`);
      console.log(`  WebSocket:    ${result.websocketUrl}`);
    } catch (err: any) {
      if (err.message.includes('already')) {
        console.log('MQTT is already enabled.');
      } else {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    }
  },

  async disable(): Promise<void> {
    const config = requireProjectConfig();

    try {
      await projectApi(`/projects/${config.projectId}/mqtt`, {
        method: 'DELETE',
      });
      console.log('MQTT disabled.');
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async token(opts: { userId?: string } = {}): Promise<void> {
    const config = requireProjectConfig();

    try {
      const result = await projectApi(`/projects/${config.projectId}/mqtt/token`, {
        method: 'POST',
        body: { userId: opts.userId || undefined },
      }) as {
        endpoint: string;
        iotEndpoint: string;
        region: string;
        topicPrefix: string;
        credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string };
      };

      console.log('MQTT Token:\n');
      console.log(`  Endpoint:      ${result.endpoint}`);
      console.log(`  IoT Endpoint:  ${result.iotEndpoint}`);
      console.log(`  Region:        ${result.region}`);
      console.log(`  Topic Prefix:  ${result.topicPrefix}`);
      console.log(`  Client Prefix: ${(result as any).clientIdPrefix || 'n/a'}`);
      console.log(`  Access Key:    ${result.credentials.accessKeyId}`);
      console.log(`  Secret Key:    ${result.credentials.secretAccessKey.slice(0, 8)}...`);
      console.log(`  Session Token: ${result.credentials.sessionToken.slice(0, 20)}...`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },

  async publish(channel: string, opts: { data?: string } = {}): Promise<void> {
    const config = requireProjectConfig();
    const message = opts.data || '{}';

    try {
      await projectApi(`/projects/${config.projectId}/mqtt/publish`, {
        method: 'POST',
        body: { channel, message: JSON.parse(message) },
      });
      console.log(`Published to ${channel}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  },
};
