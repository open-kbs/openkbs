import {
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionCommand,
  InvokeCommand,
  ListFunctionsCommand,
  DeleteFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionUrlConfigCommand,
  ResourceNotFoundException,
  ResourceConflictException,
} from '@aws-sdk/client-lambda';
import { getLambdaClient } from './client.js';

const LAMBDA_DOCKER_POSTGRES_URL = 'postgresql://postgres:openkbs@postgres:5432/openkbs';

function functionName(projectId: string, name: string): string {
  return `openkbs-${projectId}-${name}`;
}

async function waitForFunction(client: any, fnName: string, maxWait = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const result = await client.send(new GetFunctionCommand({ FunctionName: fnName }));
      const state = result.Configuration?.LastUpdateStatus || result.Configuration?.State;
      if (state !== 'InProgress') return;
    } catch {
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

export async function deployFunction(
  projectId: string,
  name: string,
  zipBuffer: Buffer,
  opts: { memory?: number; timeout?: number; schedule?: string } = {},
): Promise<{ created: boolean; url: string }> {
  const client = getLambdaClient();
  const fnName = functionName(projectId, name);
  const storageBucket = `openkbs-${projectId}-storage`;

  const envVars = {
    DATABASE_URL: LAMBDA_DOCKER_POSTGRES_URL,
    STORAGE_BUCKET: storageBucket,
    OPENKBS_PROJECT_ID: projectId,
  };

  let exists = false;
  try {
    await client.send(new GetFunctionCommand({ FunctionName: fnName }));
    exists = true;
  } catch (err: any) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
  }

  if (exists) {
    // Wait for function to be ready before updating
    await waitForFunction(client, fnName);

    // Update code
    await client.send(new UpdateFunctionCodeCommand({
      FunctionName: fnName,
      ZipFile: zipBuffer,
    }));

    // Wait again before updating config
    await waitForFunction(client, fnName);

    // Update config (env vars, memory, timeout)
    await client.send(new UpdateFunctionConfigurationCommand({
      FunctionName: fnName,
      MemorySize: opts.memory || 512,
      Timeout: opts.timeout || 30,
      Environment: { Variables: envVars },
    }));
  } else {
    // Create new function
    await client.send(new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Role: 'arn:aws:iam::000000000000:role/lambda-role',
      Code: { ZipFile: zipBuffer },
      MemorySize: opts.memory || 512,
      Timeout: opts.timeout || 30,
      Environment: { Variables: envVars },
    }));
  }

  // Try to create/get function URL (Pro feature)
  let url = `http://localhost:4566/2015-03-31/functions/${fnName}/invocations`;
  try {
    if (!exists) {
      const urlResult = await client.send(new CreateFunctionUrlConfigCommand({
        FunctionName: fnName,
        AuthType: 'NONE',
      }));
      if (urlResult.FunctionUrl) url = urlResult.FunctionUrl;
    } else {
      const urlResult = await client.send(new GetFunctionUrlConfigCommand({
        FunctionName: fnName,
      }));
      if (urlResult.FunctionUrl) url = urlResult.FunctionUrl;
    }
  } catch {
    // Function URLs not available (free tier) — use invocation endpoint
  }

  return { created: !exists, url };
}

export async function invokeFunction(
  projectId: string,
  name: string,
  payload: unknown,
): Promise<unknown> {
  const client = getLambdaClient();
  const fnName = functionName(projectId, name);

  const result = await client.send(new InvokeCommand({
    FunctionName: fnName,
    Payload: Buffer.from(JSON.stringify(payload)),
  }));

  if (result.Payload) {
    return JSON.parse(Buffer.from(result.Payload).toString());
  }
  return null;
}

export async function listFunctions(
  projectId: string,
): Promise<Array<{ name: string; runtime: string; state: string }>> {
  const client = getLambdaClient();
  const prefix = `openkbs-${projectId}-`;

  const result = await client.send(new ListFunctionsCommand({}));
  const functions = (result.Functions || [])
    .filter(fn => fn.FunctionName?.startsWith(prefix))
    .map(fn => ({
      name: fn.FunctionName!.replace(prefix, ''),
      runtime: fn.Runtime || 'unknown',
      state: fn.State || 'Active',
    }));

  return functions;
}

export async function deleteFunction(
  projectId: string,
  name: string,
): Promise<void> {
  const client = getLambdaClient();
  const fnName = functionName(projectId, name);
  await client.send(new DeleteFunctionCommand({ FunctionName: fnName }));
}
