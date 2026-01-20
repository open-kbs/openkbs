# OpenKBS Elastic Services

Deploy full-stack applications with zero infrastructure setup. Elastic Services provide production-ready PostgreSQL, S3 storage, serverless functions, and real-time WebSockets - all with simple CLI commands.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [PostgreSQL Database](#postgresql-database)
- [S3 Storage & CloudFront CDN](#s3-storage--cloudfront-cdn)
- [Serverless Functions](#serverless-functions)
- [Real-time Pulse](#real-time-pulse)
- [CLI Reference](#cli-reference)

---

## Overview

### What Are Elastic Services?

Elastic Services extend your OpenKBS Knowledge Base with cloud infrastructure:

| Service | What You Get | Use Case |
|---------|--------------|----------|
| **Postgres** | PostgreSQL database (Neon) | Store users, orders, content |
| **Storage** | S3 bucket + CloudFront CDN | Upload images, files, media |
| **Functions** | Serverless Lambda functions | Build APIs, webhooks, background jobs |
| **Pulse** | Real-time WebSocket | Live updates, chat, presence |

### Why Elastic?

**Before Elastic:**
- Set up AWS accounts, IAM roles, VPCs
- Configure databases, connection strings
- Manage deployments, CI/CD pipelines
- Handle SSL certificates, domains
- Debug networking issues

**With Elastic:**
```bash
openkbs postgres enable    # Database ready in 10 seconds
openkbs storage enable     # S3 bucket with CDN
openkbs fn push api        # Deploy your API
openkbs deploy             # Ship everything
```

Your app is live at `https://yourdomain.com/`.

### Environment Variables

When you enable Elastic services, environment variables are automatically injected into your functions:

| Variable | Service | Example |
|----------|---------|---------|
| `DATABASE_URL` | Postgres | `postgresql://user:pass@host/db` |
| `STORAGE_BUCKET` | Storage | `openkbs-elastic-xyz123` |
| `STORAGE_REGION` | Storage | `us-east-1` |
| `OPENKBS_KB_ID` | All | `abc123xyz` |
| `OPENKBS_API_KEY` | All | Your API key |

No manual configuration needed. Just use `process.env.DATABASE_URL` in your code.

### Regions

Available in 3 regions:

| Region | Location | Latency Target |
|--------|----------|----------------|
| `us-east-1` | N. Virginia (default) | Americas |
| `eu-central-1` | Frankfurt | Europe |
| `ap-southeast-1` | Singapore | Asia-Pacific |

Specify region in `openkbs.json` or with `--region` flag.

---

## Quick Start

### 1. Create Project

```bash
mkdir my-app && cd my-app
openkbs init
```

### 2. Configure Services

Create `openkbs.json`:

```json
{
  "name": "my-app",
  "region": "us-east-1",
  "spa": "/app/index.html",
  "postgres": true,
  "storage": {
    "cloudfront": "media"
  },
  "pulse": true,
  "functions": [
    { "name": "api", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 }
  ],
  "site": "./site"
}
```

### 3. Create API Function

Create `functions/api/index.mjs`:

```javascript
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let connected = false;

export async function handler(event) {
    if (!connected) { await db.connect(); connected = true; }

    const { action } = JSON.parse(event.body || '{}');

    if (action === 'list') {
        const { rows } = await db.query('SELECT * FROM items');
        return { statusCode: 200, body: JSON.stringify(rows) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
}
```

Create `functions/api/package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "pg": "^8.11.3"
  }
}
```

### 4. Deploy

```bash
cd functions/api && npm install && cd ../..
openkbs deploy
```

Done. Your API is live at `https://yourdomain.com/api`.

---

## PostgreSQL Database

Add a PostgreSQL database to your project with one command. Elastic Postgres uses Neon - a serverless PostgreSQL that scales automatically.

### Enable Postgres

```bash
openkbs postgres enable
```

That's it. Your database is ready.

### Check Status

```bash
openkbs postgres status
```

Output:
```
Postgres Status:
  Enabled: true
  Host: ep-xyz-123456.us-east-1.aws.neon.tech
  Database: neondb
  Region: us-east-1
```

### Get Connection String

```bash
openkbs postgres connection
```

Output:
```
postgresql://user:password@ep-xyz-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Use in Node.js

```javascript
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let connected = false;

export async function handler(event) {
    // Connect once, reuse across invocations
    if (!connected) {
        await db.connect();
        connected = true;

        // Create tables on first run
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    const { action, ...data } = JSON.parse(event.body || '{}');

    switch (action) {
        case 'list':
            const { rows } = await db.query('SELECT * FROM users ORDER BY created_at DESC');
            return { statusCode: 200, body: JSON.stringify(rows) };

        case 'create':
            const result = await db.query(
                'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
                [data.name, data.email]
            );
            return { statusCode: 200, body: JSON.stringify(result.rows[0]) };

        case 'delete':
            await db.query('DELETE FROM users WHERE id = $1', [data.id]);
            return { statusCode: 200, body: JSON.stringify({ deleted: true }) };

        default:
            return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
}
```

### Use in Python

```python
import json
import os
import psycopg2

conn = None

def handler(event, context):
    global conn
    if conn is None:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        with conn.cursor() as cur:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS items (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL
                )
            ''')
            conn.commit()

    body = json.loads(event.get('body', '{}'))
    action = body.get('action')

    with conn.cursor() as cur:
        if action == 'list':
            cur.execute('SELECT * FROM items')
            rows = cur.fetchall()
            return {'statusCode': 200, 'body': json.dumps(rows)}

        elif action == 'create':
            cur.execute('INSERT INTO items (name) VALUES (%s) RETURNING id', (body['name'],))
            conn.commit()
            return {'statusCode': 200, 'body': json.dumps({'id': cur.fetchone()[0]})}

    return {'statusCode': 400, 'body': json.dumps({'error': 'Unknown action'})}
```

### Use in Java

```java
package com.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import java.sql.*;
import java.util.*;

public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private static Connection conn;
    private static final Gson gson = new Gson();

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        try {
            if (conn == null || conn.isClosed()) {
                conn = DriverManager.getConnection(System.getenv("DATABASE_URL"));
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)");
                }
            }

            String body = (String) event.get("body");
            Map<String, Object> request = gson.fromJson(body, Map.class);
            String action = (String) request.get("action");

            if ("list".equals(action)) {
                List<Map<String, Object>> items = new ArrayList<>();
                try (ResultSet rs = conn.createStatement().executeQuery("SELECT * FROM items")) {
                    while (rs.next()) {
                        items.add(Map.of("id", rs.getInt("id"), "name", rs.getString("name")));
                    }
                }
                return Map.of("statusCode", 200, "body", gson.toJson(items));
            }

            return Map.of("statusCode", 400, "body", "{\"error\":\"Unknown action\"}");
        } catch (Exception e) {
            return Map.of("statusCode", 500, "body", "{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
```

### Common Patterns

#### Parameterized Queries (Prevent SQL Injection)

```javascript
// GOOD - parameterized
await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// BAD - string concatenation (NEVER DO THIS)
await db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

#### Pagination

```javascript
const page = data.page || 1;
const limit = data.limit || 20;
const offset = (page - 1) * limit;

const { rows } = await db.query(
    'SELECT * FROM items ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
);

const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM items');

return { items: rows, total: parseInt(count), page, limit };
```

#### Search

```javascript
const { rows } = await db.query(
    'SELECT * FROM items WHERE name ILIKE $1',
    [`%${data.query}%`]
);
```

#### JSON Columns

```javascript
// Create table with JSONB column
await db.query(`
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT,
        metadata JSONB DEFAULT '{}'
    )
`);

// Query JSON
const { rows } = await db.query(
    "SELECT * FROM products WHERE metadata->>'category' = $1",
    ['electronics']
);

// Update JSON field
await db.query(
    "UPDATE products SET metadata = jsonb_set(metadata, '{stock}', $1) WHERE id = $2",
    [JSON.stringify(100), productId]
);
```

#### Transactions

```javascript
try {
    await db.query('BEGIN');
    await db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await db.query('COMMIT');
} catch (e) {
    await db.query('ROLLBACK');
    throw e;
}
```

### Postgres CLI Commands

```bash
openkbs postgres enable              # Enable database
openkbs postgres status              # Check status
openkbs postgres connection          # Get connection string
openkbs postgres disable             # Disable (WARNING: deletes data)
```

---

## S3 Storage & CloudFront CDN

Upload files, serve images, and host media with S3 storage and CloudFront CDN. Get presigned URLs for secure browser uploads.

### Enable Storage

```bash
openkbs storage enable
```

Your S3 bucket is ready.

### Check Status

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

### Add CloudFront CDN

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

### Upload Files from CLI

```bash
openkbs storage put ./photo.jpg media/photo.jpg
openkbs storage put ./document.pdf docs/document.pdf
```

### Generate Presigned Upload URL (Node.js)

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

### Generate Presigned Upload URL (Python)

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

### Storage CLI Commands

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

---

## Serverless Functions

Deploy serverless APIs with AWS Lambda. Write your code in Node.js, Python, or Java. Get HTTPS endpoints automatically.

### Project Structure

```
my-app/
├── openkbs.json
├── functions/
│   └── api/
│       ├── index.mjs      # Node.js handler
│       └── package.json   # Dependencies
└── site/
    └── index.html
```

### Node.js Function

Create `functions/api/index.mjs`:

```javascript
export async function handler(event) {
    const { action, ...data } = JSON.parse(event.body || '{}');

    switch (action) {
        case 'hello':
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Hello, ${data.name || 'World'}!` })
            };

        case 'echo':
            return {
                statusCode: 200,
                body: JSON.stringify({ received: data })
            };

        default:
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Unknown action' })
            };
    }
}
```

Create `functions/api/package.json`:

```json
{
  "type": "module",
  "dependencies": {}
}
```

### Python Function

Create `functions/api/handler.py`:

```python
import json

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    action = body.get('action')

    if action == 'hello':
        name = body.get('name', 'World')
        return {
            'statusCode': 200,
            'body': json.dumps({'message': f'Hello, {name}!'})
        }

    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'Unknown action'})
    }
```

### Java Function

Create `functions/api/src/main/java/com/example/Handler.java`:

```java
package com.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import java.util.Map;

public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private static final Gson gson = new Gson();

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        String body = (String) event.get("body");
        Map<String, Object> request = gson.fromJson(body, Map.class);
        String action = (String) request.get("action");

        if ("hello".equals(action)) {
            String name = (String) request.getOrDefault("name", "World");
            return Map.of(
                "statusCode", 200,
                "body", gson.toJson(Map.of("message", "Hello, " + name + "!"))
            );
        }

        return Map.of("statusCode", 400, "body", "{\"error\":\"Unknown action\"}");
    }
}
```

### Deploy Function

```bash
# Install dependencies
cd functions/api && npm install && cd ../..

# Deploy function
openkbs fn push api
```

Your function is live at `https://yourdomain.com/api`.

### Test Function

```bash
# From CLI
openkbs fn invoke api '{"action":"hello","name":"OpenKBS"}'

# With curl
curl -X POST https://yourdomain.com/api \
  -H "Content-Type: application/json" \
  -d '{"action":"hello","name":"OpenKBS"}'
```

### Configure Memory & Timeout

```bash
# Default: 128MB memory, 30s timeout
openkbs fn push api

# More memory (= more CPU)
openkbs fn push api --memory 512

# Longer timeout (max 900s)
openkbs fn push api --timeout 60

# Both
openkbs fn push api --memory 1024 --timeout 120
```

Memory options: 128, 256, 512, 1024, 2048, 3008 MB

### Environment Variables

```bash
# View environment
openkbs fn env api

# Set custom variables
openkbs fn env api STRIPE_KEY=sk_live_xxx
openkbs fn env api DEBUG=true

# Remove variable
openkbs fn env api STRIPE_KEY=
```

### CORS Headers

For browser access, add CORS headers:

```javascript
export async function handler(event) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS preflight
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Your logic here...

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
}
```

### Multiple Functions

```
functions/
├── auth/
│   ├── index.mjs
│   └── package.json
├── posts/
│   ├── index.mjs
│   └── package.json
└── payments/
    ├── index.mjs
    └── package.json
```

`openkbs.json`:
```json
{
  "name": "my-app",
  "region": "us-east-1",
  "spa": "/app/index.html",
  "postgres": true,
  "functions": [
    { "name": "auth", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 },
    { "name": "posts", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 },
    { "name": "payments", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 }
  ],
  "site": "./site"
}
```

Deploy all at once:
```bash
openkbs deploy
```

Or individually:
```bash
openkbs fn push auth
openkbs fn push posts
```

### Functions CLI Commands

```bash
openkbs fn list                      # List functions
openkbs fn push <name>               # Deploy function
openkbs fn push <name> --memory 512  # With memory
openkbs fn push <name> --timeout 60  # With timeout
openkbs fn logs <name>               # View logs
openkbs fn logs <name> --follow      # Stream logs
openkbs fn env <name>                # View env vars
openkbs fn env <name> KEY=value      # Set env var
openkbs fn invoke <name> '{}'        # Test invoke
openkbs fn delete <name>             # Delete function
```

---

## Real-time Pulse

Add real-time features to your app with Pulse WebSocket messaging. Build live updates, chat, presence tracking, and collaborative features.

### Enable Pulse

```bash
openkbs pulse enable
```

### How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser 1  │     │    Pulse     │     │   Browser 2  │
│              │────▶│   Server     │────▶│              │
│  Subscribe   │     │              │     │  Receive     │
│  to 'posts'  │     │              │     │  message     │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │ Publish
                     ┌──────────────┐
                     │   Lambda     │
                     │   Function   │
                     └──────────────┘
```

1. Clients connect via WebSocket and subscribe to channels
2. Your Lambda publishes events to channels
3. All subscribers receive the message instantly

### Client SDK (Browser)

Install:

```html
<script src="https://unpkg.com/openkbs-pulse/pulse.js"></script>
```

Or with npm:
```bash
npm install openkbs-pulse
```

Connect:

```javascript
// Get token from your API (see Server SDK below)
const { token, endpoint, kbId } = await fetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'getPulseToken', userId: 'user123' })
}).then(r => r.json());

// Connect to Pulse
const realtime = new Pulse.Realtime({
    kbId,
    token,
    endpoint,
    clientId: 'user123'
});

// Connection events
realtime.connection.on('connected', () => console.log('Connected!'));
realtime.connection.on('disconnected', () => console.log('Disconnected'));
```

Subscribe to channel:

```javascript
const channel = realtime.channels.get('posts');

// Subscribe to specific event
channel.subscribe('new_post', (message) => {
    console.log('New post:', message.data);
});

// Subscribe to all events
channel.subscribe((message) => {
    console.log('Event:', message.name, message.data);
});
```

Presence (who's online):

```javascript
const channel = realtime.channels.get('posts');

// Enter presence with data
channel.presence.enter({ name: 'Alice', avatar: '/alice.jpg' });

// Get current members
channel.presence.get((members) => {
    console.log('Online:', members.length);
    members.forEach(m => console.log(m.data.name));
});

// Subscribe to presence changes
channel.presence.subscribe((members) => {
    console.log('Members updated:', members);
});

// Specific events
channel.presence.subscribe('enter', (member) => {
    console.log(`${member.data.name} joined`);
});

channel.presence.subscribe('leave', (member) => {
    console.log(`${member.data.name} left`);
});

// Leave when done
channel.presence.leave();
```

### Server SDK (Lambda)

Generate token:

```javascript
import pulse from 'openkbs-pulse/server';

export async function handler(event) {
    const { action, userId } = JSON.parse(event.body || '{}');
    const kbId = process.env.OPENKBS_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    if (action === 'getPulseToken') {
        const tokenData = await pulse.getToken(kbId, apiKey, userId);
        return {
            statusCode: 200,
            body: JSON.stringify({
                token: tokenData.token,
                endpoint: tokenData.endpoint,
                kbId
            })
        };
    }
}
```

Publish events:

```javascript
import pulse from 'openkbs-pulse/server';

export async function handler(event) {
    const { action, ...data } = JSON.parse(event.body || '{}');
    const kbId = process.env.OPENKBS_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    if (action === 'createPost') {
        // Save to database...
        const post = { id: 1, title: data.title, content: data.content };

        // Publish to all subscribers
        await pulse.publish('posts', 'new_post', { post }, { kbId, apiKey });

        return { statusCode: 200, body: JSON.stringify({ post }) };
    }
}
```

Get presence:

```javascript
const presence = await pulse.presence('posts', { kbId, apiKey });
console.log('Online count:', presence.count);
console.log('Members:', presence.members);
```

### Private Channels

For private messaging, use secret channel IDs:

```javascript
// Generate unique channel ID per user (store in database)
const privateChannel = crypto.randomBytes(32).toString('hex');

// User subscribes to their own private channel
const myChannel = realtime.channels.get(user.privateChannel);
myChannel.subscribe('message', (msg) => {
    console.log('Private message:', msg.data);
});

// Server publishes to recipient's channel
await pulse.publish(recipient.privateChannel, 'message', {
    from: sender.name,
    text: 'Hello!'
}, { kbId, apiKey });
```

### Pulse CLI Commands

```bash
openkbs pulse enable               # Enable Pulse
openkbs pulse status               # Check status
openkbs pulse channels             # List active channels
openkbs pulse presence <channel>   # View presence
openkbs pulse publish <ch> "msg"   # Publish message
openkbs pulse disable              # Disable
```

---

## CLI Reference

### General Commands

```bash
openkbs init                    # Initialize project
openkbs deploy                  # Deploy everything
openkbs ls                      # List your KBs
openkbs status                  # Show project status
```

### Postgres Commands

```bash
openkbs postgres enable         # Enable database
openkbs postgres status         # Check status
openkbs postgres connection     # Get connection string
openkbs postgres disable        # Disable (deletes data!)
```

### Storage Commands

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
openkbs storage disable --force           # Disable (dangerous!)
```

### Function Commands

```bash
openkbs fn list                      # List functions
openkbs fn push <name>               # Deploy function
openkbs fn push <name> --memory 512  # With memory setting
openkbs fn push <name> --timeout 60  # With timeout setting
openkbs fn logs <name>               # View logs
openkbs fn logs <name> --follow      # Stream logs live
openkbs fn logs <name> --limit 100   # Limit log entries
openkbs fn env <name>                # View environment variables
openkbs fn env <name> KEY=value      # Set environment variable
openkbs fn env <name> KEY=           # Remove environment variable
openkbs fn invoke <name> '{json}'    # Test invoke function
openkbs fn delete <name>             # Delete function
```

### Pulse Commands

```bash
openkbs pulse enable               # Enable Pulse
openkbs pulse status               # Check status
openkbs pulse channels             # List active channels
openkbs pulse presence <channel>   # View channel presence
openkbs pulse publish <ch> "msg"   # Publish message to channel
openkbs pulse disable              # Disable Pulse
```

---

## Example Apps

For complete working examples, see the tutorials:

- **[Node.js Full-Stack App](/tutorials/nodejs-fullstack/)** - Social app with posts, real-time chat, image uploads, and presence
- **[Java REST API](/tutorials/java-api/)** - CRUD API with PostgreSQL
- **[Python API](/tutorials/python-api/)** - REST API with S3 file uploads
