# Tutorial 12: S3 Storage with CloudFront CDN

Upload files, serve images, and host media with S3 storage and CloudFront CDN. Get presigned URLs for secure browser uploads.

## Enable Storage

```bash
openkbs storage enable
```

Your S3 bucket is ready.

## Check Status

```bash
openkbs storage status
```

Output:
```
Storage Status:
  Enabled: true
  Bucket: openkbs-elastic-abc123
  Region: us-east-1
  Public: false
```

## Add CloudFront CDN

Serve files from your domain with edge caching:

```bash
openkbs storage cloudfront media
```

This maps:
- S3 path `media/*` to URL `yourdomain.com/media/*`

| S3 Key | Public URL |
|--------|------------|
| `media/photo.jpg` | `yourdomain.com/media/photo.jpg` |
| `media/uploads/image.png` | `yourdomain.com/media/uploads/image.png` |

## Upload Files

### From CLI

```bash
openkbs storage put ./photo.jpg media/photo.jpg
openkbs storage put ./document.pdf docs/document.pdf
```

### From Lambda (Presigned URL)

Generate a presigned URL for browser uploads:

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.STORAGE_REGION });

export async function handler(event) {
    const { action, fileName, contentType } = JSON.parse(event.body || '{}');

    if (action === 'getUploadUrl') {
        const bucket = process.env.STORAGE_BUCKET;

        // Key must match CloudFront path prefix
        const key = `media/uploads/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType || 'application/octet-stream'
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

        // Return relative URL for CloudFront
        const publicUrl = `/${key}`;

        return {
            statusCode: 200,
            body: JSON.stringify({ uploadUrl, publicUrl, key })
        };
    }
}
```

`package.json`:
```json
{
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/s3-request-presigner": "^3.400.0"
  }
}
```

### Browser Upload

```javascript
async function uploadFile(file) {
    // 1. Get presigned URL from your API
    const response = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'getUploadUrl',
            fileName: file.name,
            contentType: file.type
        })
    });

    const { uploadUrl, publicUrl } = await response.json();

    // 2. Upload directly to S3
    await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
    });

    // 3. Return the public URL
    return publicUrl;  // e.g., /media/uploads/1234567890-photo.jpg
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const url = await uploadFile(file);
    console.log('Uploaded to:', url);
});
```

### Upload with Progress

```javascript
function uploadWithProgress(file, onProgress) {
    return new Promise(async (resolve, reject) => {
        const { uploadUrl, publicUrl } = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getUploadUrl',
                fileName: file.name,
                contentType: file.type
            })
        }).then(r => r.json());

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) resolve(publicUrl);
            else reject(new Error('Upload failed'));
        });

        xhr.addEventListener('error', reject);
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
}

// Usage
const url = await uploadWithProgress(file, (percent) => {
    console.log(`Upload: ${percent}%`);
});
```

## List Files

```bash
openkbs storage ls
openkbs storage ls media/
openkbs storage ls media/uploads/ --limit 100
```

## Download Files

```bash
openkbs storage get media/photo.jpg
openkbs storage get media/photo.jpg ./local-photo.jpg
```

## Delete Files

```bash
openkbs storage rm media/photo.jpg
```

## Make Bucket Public

By default, buckets are private. To make files publicly accessible without presigned URLs:

```bash
openkbs storage public true
```

To make private again:
```bash
openkbs storage public false
```

## File Organization

Recommended structure:
```
media/
  images/
    avatars/
    posts/
  videos/
  documents/
uploads/
  temp/
```

## Python Example

```python
import json
import os
import boto3
from botocore.config import Config

s3 = boto3.client('s3',
    region_name=os.environ.get('STORAGE_REGION', 'us-east-1'),
    config=Config(signature_version='s3v4')
)

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    action = body.get('action')
    bucket = os.environ['STORAGE_BUCKET']

    if action == 'getUploadUrl':
        import time
        key = f"media/uploads/{int(time.time())}-{body['fileName']}"

        url = s3.generate_presigned_url('put_object',
            Params={'Bucket': bucket, 'Key': key, 'ContentType': body.get('contentType', 'application/octet-stream')},
            ExpiresIn=3600
        )

        return {
            'statusCode': 200,
            'body': json.dumps({'uploadUrl': url, 'publicUrl': f'/{key}', 'key': key})
        }

    return {'statusCode': 400, 'body': json.dumps({'error': 'Unknown action'})}
```

## CLI Reference

```bash
openkbs storage enable                    # Enable storage
openkbs storage status                    # Check status
openkbs storage public true|false         # Set public access
openkbs storage cloudfront <path>         # Add CloudFront path
openkbs storage cloudfront remove <path>  # Remove CloudFront path
openkbs storage ls [prefix]               # List files
openkbs storage put <file> [key]          # Upload file
openkbs storage get <key> [file]          # Download file
openkbs storage rm <key>                  # Delete file
openkbs storage disable --force           # Disable (DANGEROUS)
```

## Tips

1. **Always Use Presigned URLs** - Don't send file data through your Lambda. Upload directly to S3.

2. **Match CloudFront Path** - If CloudFront path is `media`, upload to `media/...` keys.

3. **Use Content-Type** - Set correct MIME type for proper browser handling.

4. **Versioned Filenames** - Use timestamps or UUIDs to avoid cache issues: `1704067200-photo.jpg`

## Next Steps

- [Tutorial 13: Serverless Functions](./13-functions.md)
- [Tutorial 14: Real-time Pulse](./14-pulse.md)
