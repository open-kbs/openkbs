import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { LOCALSTACK_ENDPOINT } from '../config.js';

const CREDENTIALS = { accessKeyId: 'test', secretAccessKey: 'test' };
const REGION = 'us-east-1';

let lambdaClient: LambdaClient | null = null;
let s3Client: S3Client | null = null;

export function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      endpoint: LOCALSTACK_ENDPOINT,
      region: REGION,
      credentials: CREDENTIALS,
    });
  }
  return lambdaClient;
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: LOCALSTACK_ENDPOINT,
      region: REGION,
      credentials: CREDENTIALS,
      forcePathStyle: true,
    });
  }
  return s3Client;
}
