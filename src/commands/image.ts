import fs from 'fs';
import path from 'path';
import { getProjectJwtGlobal, getUserJwt } from '../lib/config.js';

const PROXY_BASE = process.env.OPENKBS_PROXY_URL || 'https://proxy.openkbs.com';

function resolveToken(): string {
  const token = getUserJwt() || getProjectJwtGlobal();
  if (!token) {
    console.error('Not logged in. Run: openkbs login');
    process.exit(1);
  }
  return token;
}

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return types[ext] || 'image/png';
}

function readRefImages(refs: string[]): Array<{ mimeType: string; data: string }> {
  return refs.map((ref) => {
    if (!fs.existsSync(ref)) {
      console.error(`Reference image not found: ${ref}`);
      process.exit(1);
    }
    return {
      mimeType: mimeFromExt(ref),
      data: fs.readFileSync(ref).toString('base64'),
    };
  });
}

interface ImageOpts {
  output: string;
  fast: boolean;
  ref: string[];
  aspectRatio: string;
  count: string;
}

export const imageCommand = {
  async generate(prompt: string, opts: ImageOpts): Promise<void> {
    const token = resolveToken();

    const body: any = {
      prompt,
      quality: opts.fast ? 'fast' : 'quality',
      aspectRatio: opts.aspectRatio,
      count: parseInt(opts.count, 10) || 1,
    };

    if (opts.ref.length > 0) {
      if (opts.ref.length > 10) {
        console.error('Maximum 10 reference images allowed.');
        process.exit(1);
      }
      body.referenceImages = readRefImages(opts.ref);
    }

    console.log(`Generating image${opts.fast ? ' (fast)' : ''}...`);

    let res: Response;
    try {
      res = await fetch(`${PROXY_BASE}/v1/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      console.error(`Request failed: ${err.message}`);
      process.exit(1);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error ${res.status}: ${errText}`);
      process.exit(1);
    }

    const data = await res.json() as { images: Array<{ data: string; mimeType: string }>; text?: string };

    if (!data.images?.length) {
      if (data.text) console.log(data.text);
      console.error('No images in response.');
      process.exit(1);
    }

    const outBase = opts.output;
    const ext = path.extname(outBase);
    const base = outBase.slice(0, -ext.length || undefined);

    // Ensure output directory exists
    const outDir = path.dirname(outBase);
    if (outDir && !fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (let i = 0; i < data.images.length; i++) {
      const imgData = Buffer.from(data.images[i].data, 'base64');
      const outPath = data.images.length > 1 ? `${base}-${i + 1}${ext || '.png'}` : outBase;
      fs.writeFileSync(outPath, imgData);
      console.log(`Saved ${outPath}`);
    }
  },
};
