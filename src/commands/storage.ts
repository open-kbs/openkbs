import fs from 'fs';
import path from 'path';
import { projectApi, requireProjectConfig } from '../lib/api.js';
import { isLocalTarget } from '../lib/config.js';
import { mimeType } from '../lib/mime.js';

export const storageCommand = {
  async ls(prefix?: string): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      const { listObjects, ensureBucket } = await import('../lib/local/storage.js');
      const bucket = `openkbs-${config.projectId}-storage`;
      await ensureBucket(bucket);
      const objects = await listObjects(bucket, prefix);

      if (objects.length === 0) {
        console.log('No objects found.');
        return;
      }

      for (const obj of objects) {
        const size = (obj.size / 1024).toFixed(1) + ' KB';
        const date = obj.lastModified.toLocaleDateString();
        console.log(`  ${date}  ${size.padStart(10)}  ${obj.key}`);
      }
      return;
    }

    try {
      const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
      const result = await projectApi(`/projects/${config.projectId}/storage/objects${query}`) as {
        objects: Array<{ key: string; size: number; lastModified: string }>;
      };

      if (result.objects.length === 0) {
        console.log('No objects found.');
        return;
      }

      for (const obj of result.objects) {
        const size = (obj.size / 1024).toFixed(1) + ' KB';
        const date = new Date(obj.lastModified).toLocaleDateString();
        console.log(`  ${date}  ${size.padStart(10)}  ${obj.key}`);
      }
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async upload(localPath: string, remotePath?: string): Promise<void> {
    const config = requireProjectConfig();

    if (!fs.existsSync(localPath)) {
      throw new Error(`File not found: ${localPath}`);
    }

    const key = remotePath || path.basename(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentType = mimeType(ext);

    if (isLocalTarget()) {
      const { uploadFile, ensureBucket } = await import('../lib/local/storage.js');
      const bucket = `openkbs-${config.projectId}-storage`;
      await ensureBucket(bucket);
      const fileData = fs.readFileSync(localPath);
      await uploadFile(bucket, key, fileData, contentType);
      console.log(`Uploaded: ${key}`);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/storage/upload-url`, {
        method: 'POST',
        body: { key, contentType },
      }) as { uploadUrl: string };

      const fileData = fs.readFileSync(localPath);
      const res = await fetch(result.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: fileData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      console.log(`Uploaded: ${key}`);
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async download(remotePath: string, localPath?: string): Promise<void> {
    const config = requireProjectConfig();
    const outPath = localPath || path.basename(remotePath);

    if (isLocalTarget()) {
      const { downloadFile, ensureBucket } = await import('../lib/local/storage.js');
      const bucket = `openkbs-${config.projectId}-storage`;
      await ensureBucket(bucket);
      const buffer = await downloadFile(bucket, remotePath);
      fs.writeFileSync(outPath, buffer);
      console.log(`Downloaded: ${outPath}`);
      return;
    }

    try {
      const result = await projectApi(`/projects/${config.projectId}/storage/download-url`, {
        method: 'POST',
        body: { key: remotePath },
      }) as { downloadUrl: string };

      const res = await fetch(result.downloadUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buffer);
      console.log(`Downloaded: ${outPath}`);
    } catch (err: any) {
      throw new Error(err.message);
    }
  },

  async rm(keys: string[]): Promise<void> {
    const config = requireProjectConfig();

    if (isLocalTarget()) {
      const { deleteObjects, ensureBucket } = await import('../lib/local/storage.js');
      const bucket = `openkbs-${config.projectId}-storage`;
      await ensureBucket(bucket);
      await deleteObjects(bucket, keys);
      console.log(`Deleted ${keys.length} object(s).`);
      return;
    }

    try {
      await projectApi(`/projects/${config.projectId}/storage/delete`, {
        method: 'POST',
        body: { keys },
      });
      console.log(`Deleted ${keys.length} object(s).`);
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
