import path from 'path';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getS3Client } from './client.js';
import { mimeType } from '../mime.js';

export async function ensureBucket(bucketName: string): Promise<void> {
  const client = getS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  }
}

export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function downloadFile(
  bucket: string,
  key: string,
): Promise<Buffer> {
  const client = getS3Client();
  const result = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  const stream = result.Body;
  if (!stream) throw new Error('Empty response');
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function listObjects(
  bucket: string,
  prefix?: string,
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const client = getS3Client();
  const result = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  }));

  return (result.Contents || []).map(obj => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

export async function deleteObjects(
  bucket: string,
  keys: string[],
): Promise<void> {
  const client = getS3Client();
  await client.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
    },
  }));
}

/**
 * Deploy site files to S3 bucket.
 * @param files - Map of relative path → base64-encoded content
 */
export async function deploySite(
  projectId: string,
  files: Record<string, string>,
): Promise<string> {
  const bucket = `openkbs-${projectId}-site`;
  await ensureBucket(bucket);

  for (const [relativePath, base64Content] of Object.entries(files)) {
    const ext = path.extname(relativePath).toLowerCase();
    const contentType = mimeType(ext);
    const body = Buffer.from(base64Content, 'base64');
    await uploadFile(bucket, relativePath, body, contentType);
  }

  return `http://localhost:4566/${bucket}/index.html`;
}
