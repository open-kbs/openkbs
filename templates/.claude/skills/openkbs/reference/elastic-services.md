# Elastic Services Reference

OpenKBS provides managed cloud infrastructure that scales automatically.

## Overview

| Service | Purpose | CLI Command |
|---------|---------|-------------|
| Functions | Serverless Lambda (Node.js, Java, Python) | `openkbs fn` |
| Postgres | Managed PostgreSQL (Neon) | `openkbs postgres` |
| Storage | S3 file storage | `openkbs storage` |
| Pulse | Real-time WebSocket pub/sub | `openkbs pulse` |

## Configuration (openkbs.json)

```json
{
  "elastic": {
    "functions": {
      "hello": {
        "runtime": "nodejs22.x",
        "memory": 512,
        "timeout": 30
      }
    },
    "postgres": true,
    "storage": true,
    "pulse": true
  }
}
```

## Deploy/Destroy

```bash
openkbs deploy          # Deploy all configured services
openkbs destroy         # Remove all services
openkbs stack           # Show current stack status
```

---

## Functions (Lambda)

Serverless functions with automatic scaling.

### Create Function

```bash
mkdir -p functions/hello
```

Create `functions/hello/index.mjs`:

```javascript
export const handler = async (event) => {
    const body = JSON.parse(event.body || '{}');
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello', input: body })
    };
};
```

### CLI Commands

```bash
openkbs fn list                           # List all functions
openkbs fn push hello --region us-east-1  # Deploy function
openkbs fn delete hello                   # Delete function
openkbs fn logs hello                     # View logs
openkbs fn env hello                      # View env vars
openkbs fn env hello API_KEY=secret       # Set env var
openkbs fn invoke hello '{"test": true}'  # Invoke function
```

### Supported Runtimes

- `nodejs22.x`, `nodejs20.x`, `nodejs18.x`
- `python3.12`, `python3.11`
- `java21`, `java17`

### Access URLs

Functions are accessible via CloudFront on your whitelabel domain:

```
https://yourdomain.com/functionName
```

From frontend (site/), use relative paths:

```javascript
const response = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hello' })
});
```

---

## Postgres (Neon)

Managed PostgreSQL database.

### CLI Commands

```bash
openkbs postgres shell              # Connect to psql
openkbs postgres connection-string  # Get connection URL
openkbs postgres status             # Show database info
```

### Access from Agent

Connection string is available as `DATABASE_URL` environment variable:

```javascript
// In onRequest.js or actions.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Add Dependency

In `src/Events/onRequest.json`:

```json
{
  "dependencies": {
    "pg": "^8.13.1"
  }
}
```

---

## Storage (S3)

File storage with presigned URLs.

### CLI Commands

```bash
openkbs storage list              # List buckets
openkbs storage list BUCKET_NAME  # List files in bucket
openkbs storage upload FILE       # Upload file
openkbs storage download FILE     # Download file
openkbs storage delete FILE       # Delete file
```

### Access from Agent

```javascript
// Upload file
const uploaded = await openkbs.uploadImage(
    base64Content,
    'image.png',
    'image/png'
);
console.log(uploaded.url);  // Public URL

// Get presigned URL for upload
const presigned = await openkbs.kb({
    action: 'getPresignedUploadUrl',
    filename: 'document.pdf',
    contentType: 'application/pdf'
});
// Returns: { uploadUrl, publicUrl }
```

---

## Pulse (WebSocket)

Real-time messaging and pub/sub via SDK.

### CLI Commands

```bash
openkbs pulse status   # Show Pulse status
openkbs pulse channels # List channels
```

### Backend (Lambda functions)

```javascript
import pulse from 'openkbs-pulse/server';

// Get token for frontend
const tokenData = await pulse.getToken(kbId, apiKey, userId);
// Returns: { token, endpoint }

// Publish to channel
await pulse.publish('posts', 'new_post', { post }, { kbId, apiKey });

// Get presence
const presence = await pulse.presence('posts', { kbId, apiKey });
```

### Frontend (Browser)

```html
<script src="https://unpkg.com/openkbs-pulse/pulse.js"></script>
```

```javascript
// Connect (token from backend)
const realtime = new Pulse.Realtime({ kbId, token, endpoint, clientId });

// Subscribe to channel
const channel = realtime.channels.get('posts');
channel.subscribe('new_post', (message) => {
    console.log('New post:', message.data);
});

// Presence
channel.presence.enter({ name: 'Alice' });
channel.presence.subscribe((members) => {
    console.log('Online:', members.length);
});
```

### Use Cases

- Real-time notifications
- Live updates to frontend
- Multi-user collaboration
- Event streaming

---

## Full-Stack Example

Complete Node.js application with all services:

### openkbs.json

```json
{
  "elastic": {
    "functions": {
      "api": { "runtime": "nodejs22.x", "memory": 512 }
    },
    "postgres": true,
    "storage": true,
    "pulse": true
  }
}
```

### functions/api/index.mjs

```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export const handler = async (event) => {
    const { action, data } = JSON.parse(event.body || '{}');

    switch (action) {
        case 'list':
            const result = await pool.query('SELECT * FROM items');
            return { statusCode: 200, body: JSON.stringify(result.rows) };

        case 'create':
            await pool.query('INSERT INTO items (name) VALUES ($1)', [data.name]);
            return { statusCode: 201, body: JSON.stringify({ success: true }) };

        default:
            return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
};
```

### Deploy

```bash
openkbs deploy
openkbs fn push api
```

---

## Java API Example

### functions/api/pom.xml

```xml
<dependencies>
    <dependency>
        <groupId>com.amazonaws</groupId>
        <artifactId>aws-lambda-java-core</artifactId>
        <version>1.2.3</version>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <version>42.7.4</version>
    </dependency>
</dependencies>
```

### Deploy Java Function

```bash
cd functions/api
mvn package
openkbs fn push api --runtime java21
```

---

## Python API Example

### functions/api/handler.py

```python
import json
import psycopg2
import os

def handler(event, context):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute("SELECT * FROM items")
    rows = cur.fetchall()
    return {
        'statusCode': 200,
        'body': json.dumps(rows)
    }
```

### requirements.txt

```
psycopg2-binary
```

### Deploy

```bash
openkbs fn push api --runtime python3.12
```
