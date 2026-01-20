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
  "region": "us-east-1",
  "spa": "/app/index.html",
  "postgres": true,
  "storage": {
    "cloudfront": "media"
  },
  "pulse": true,
  "functions": [
    { "name": "hello", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 }
  ],
  "site": "./site"
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

- `nodejs24.x`, `nodejs22.x`, `nodejs20.x`
- `python3.14`, `python3.13`
- `java25`, `java21`

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
    action: 'createPresignedURL',
    namespace: 'files',
    fileName: 'document.pdf',
    fileType: 'application/pdf',
    presignedOperation: 'putObject'
});
// Returns presigned URL string - upload with axios.put()
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

## SPA (Single Page Application) Support

Host React, Vue, or Angular apps on your whitelabel domain with client-side routing.

### Enable SPA Mode

```bash
openkbs site spa /app/index.html    # Enable SPA fallback
openkbs site spa --disable          # Disable SPA mode
```

### How It Works

When SPA mode is enabled, CloudFront catches 403/404 errors and serves your fallback file with HTTP 200. This allows client-side routing to handle all `/app/*` paths.

```
yourdomain.com/              → serves /index.html (landing page)
yourdomain.com/app/          → serves /app/index.html (SPA)
yourdomain.com/app/dashboard → serves /app/index.html (SPA handles route)
yourdomain.com/app/profile   → serves /app/index.html (SPA handles route)
```

### Project Structure

```
my-platform/
├── site/
│   ├── index.html           # Static landing page
│   └── app/                  # Built React app (copied from spa/dist)
│       ├── index.html
│       └── assets/
├── spa/                      # React source (not deployed)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── App.jsx
└── openkbs.json
```

### Example: React + Vite SPA

**1. Create React app:**

```bash
npm create vite@latest spa -- --template react
cd spa
npm install react-router-dom
```

**2. Configure Vite for /app base path:**

```javascript
// spa/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/app/'
})
```

**3. Add routing:**

```jsx
// spa/src/App.jsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter basename="/app">
      <nav>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**4. Build and deploy:**

```bash
cd spa && npm run build
cp -r dist/* ../site/app/
cd .. && openkbs site push
openkbs site spa /app/index.html
```

---

## Full-Stack Example

Complete Node.js application with all services:

### openkbs.json

```json
{
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
