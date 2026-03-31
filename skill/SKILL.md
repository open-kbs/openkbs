---
name: openkbs
description: OpenKBS platform CLI, elastic services, and AI proxy
---

# OpenKBS Platform v2

## CLI Commands

### Authentication
```bash
openkbs login              # Browser-based login (interactive users)
openkbs auth <token>       # Authenticate with project JWT (containers)
openkbs logout             # Clear stored credentials
```

### Projects
```bash
openkbs list               # List all projects (alias: ls)
openkbs create [name] -r <region>  # Create + scaffold project
openkbs deploy             # Build site + deploy all services from openkbs.json
openkbs update             # Update CLI binary + download latest skill
```

### Local Development
```bash
openkbs ui                 # Start web UI for local development (port 3000)
openkbs ui -p 8080         # Custom port
openkbs ui --no-open       # Don't auto-open browser
```

### Functions (Lambda)
```bash
openkbs fn create <name>   # Scaffold new function (creates dir + updates openkbs.json)
openkbs fn list            # List deployed functions (alias: ls)
openkbs fn deploy <name>   # Zip ./functions/<name>/ and deploy
openkbs fn logs <name>     # Tail recent logs
openkbs fn invoke <name> -d '{"action":"hello"}'   # Invoke with JSON payload
openkbs fn destroy <name>  # Delete function
```

Options for `fn deploy`:
- `-s, --schedule <expr>` -- Schedule expression, e.g. `"rate(1 hour)"` or `"cron(0 9 * * ? *)"`
- `-m, --memory <mb>` -- Memory in MB (default from openkbs.json)
- `-t, --timeout <sec>` -- Timeout in seconds
- `--no-http` -- Disable HTTP access (function URL)

### Static Site
```bash
openkbs site deploy        # Deploy ./build/ to S3 + CloudFront
```

### Storage (S3)
```bash
openkbs storage list [prefix]              # List objects (alias: ls)
openkbs storage upload <local> [remote]    # Upload a file
openkbs storage download <remote> [local]  # Download a file
openkbs storage rm <keys...>              # Delete objects
```

### PostgreSQL
```bash
openkbs postgres info       # Show host, database, user
openkbs postgres connection # Output full connection string
```

### MQTT (Real-time Messaging via AWS IoT Core)
```bash
openkbs mqtt info                              # Show MQTT status and endpoint
openkbs mqtt enable                            # Enable MQTT for this project
openkbs mqtt disable                           # Disable MQTT
openkbs mqtt token [-u userId]                 # Generate temporary client credentials
openkbs mqtt publish <channel> -d '<json>'     # Publish event to channel
```

### Email
```bash
openkbs email enable           # Enable email sending for this project
openkbs email info             # Show email status and usage
openkbs email send <to> -s <subject> -b <body>  # Send email
openkbs email disable          # Disable email
openkbs email verify-domain <domain>  # Start domain verification for custom sender
openkbs email verify-status           # Check verification status
```

### Custom Domain
```bash
openkbs domain add <domain>    # Register custom domain (e.g. example.com)
openkbs domain verify          # Check DNS records and certificate status
openkbs domain provision       # Create CloudFront distribution for domain
openkbs domain info            # Show current domain configuration
openkbs domain remove          # Remove custom domain
```

---

## Project Structure

```
./openkbs.json          # Project config (services, region, functions, target)
./package.json          # Root package.json (React, Vite)
./vite.config.js        # Vite config (dev server, API proxy, build output)
./src/                  # React source code (edit here)
  index.html            # HTML entry point
  main.jsx              # React entry point
  App.jsx               # Root component
./build/                # Vite build output (auto-generated, deployed to S3)
./functions/            # Each subfolder = one Lambda function
  api/
    index.mjs           # Entry point (export handler)
    package.json        # Optional dependencies (bundled on deploy)
```

## Local vs Cloud Deployment

The `target` field in `openkbs.json` controls where deployments go:

| | Local | Cloud |
|---|---|---|
| **Functions** | LocalStack Lambda | AWS Lambda |
| **Storage** | LocalStack S3 | AWS S3 + CloudFront |
| **Database** | Docker PostgreSQL | Neon PostgreSQL |
| **MQTT** | Not available | AWS IoT Core |
| **Email** | Not available | AWS SES |
| **Target** | `"target": "local"` | `"target": "cloud"` |

`openkbs deploy` automatically runs `npm run build` before deploying the site.

## openkbs.json

```json
{
  "projectId": "a0ebcf5d1fa5",
  "region": "us-east-1",
  "target": "local",
  "postgres": true,
  "storage": { "cloudfront": "media" },
  "mqtt": true,
  "email": true,
  "functions": [
    { "name": "api", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 },
    { "name": "auth", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 },
    { "name": "cleanup", "schedule": "rate(1 hour)", "timeout": 900 }
  ],
  "site": "./build",
  "spa": "/app/index.html"
}
```

| Field | Description |
|-------|-------------|
| `projectId` | Project short ID (auto-set on create) |
| `region` | AWS region for all resources |
| `target` | `"local"` for LocalStack, `"cloud"` for AWS |
| `postgres` | `true` to provision PostgreSQL |
| `storage` | Object with `cloudfront` prefix for CDN distribution |
| `mqtt` | `true` to enable real-time WebSocket messaging (cloud only) |
| `email` | `true` to enable email sending via SES (cloud only) |
| `functions` | Array of function definitions to deploy |
| `site` | Path to build output directory |
| `spa` | SPA fallback path (all 404s redirect here) |

---

## Elastic Services

### Functions (Lambda)

Serverless functions running on **Node.js 24.x** (AWS Lambda) or **Node.js 20.x** (LocalStack).

Each function lives in `./functions/<name>/` with an `index.mjs` entry point that exports a `handler` function. The handler receives a Lambda Function URL event and returns a response object.

**Creating a new function:**
```bash
openkbs fn create payments    # Creates functions/payments/ with handler template
                              # Also adds it to openkbs.json functions array
```

**Environment variables** injected automatically:
- `DATABASE_URL` -- Postgres connection string (if `postgres: true`)
- `STORAGE_BUCKET` -- S3 bucket name (if `storage` configured)
- `OPENKBS_PROJECT_ID` -- Project short ID
- `OPENKBS_API_KEY` -- Secret key for calling OpenKBS platform APIs (cloud only)

Deploy: `openkbs fn deploy <name>`

### Storage (S3 + CloudFront)

Object storage backed by S3 with CloudFront CDN. Files uploaded to S3 are served through CloudFront at the domain's CDN path prefix (e.g. `/media/`).

### PostgreSQL

Managed PostgreSQL database. Connection string is injected as `DATABASE_URL` into all functions.

- **Local:** `postgresql://postgres:openkbs@localhost:5432/openkbs` (Docker container)
- **Cloud:** Neon PostgreSQL (provisioned automatically)

Use `openkbs postgres connection` to get the string.

### MQTT (Real-time Messaging) — Cloud Only

Real-time pub/sub messaging via AWS IoT Core MQTT over WebSocket. Clients get temporary AWS credentials from `POST /projects/{id}/mqtt/token`, then connect directly to IoT Core. Supports channels, presence, and event-based subscriptions. Client SDK: `<script src="https://openkbs.com/sdk/mqtt.js"></script>` (requires mqtt.js).

**Security:** MQTT credentials allow pub/sub on ALL channels within the project. For private/sensitive channels, use unpredictable channel names (e.g., `crypto.randomBytes(32).toString('hex')`). For sensitive data, publish only from the server via `POST /projects/{id}/mqtt/publish`.

---

## API Base URLs

| Service | URL |
|---------|-----|
| Project API | `https://project.openkbs.com` |
| User API | `https://user.openkbs.com` |
| AI Proxy | `https://proxy.openkbs.com` |

---

## Frontend Development

The project template uses **React + Vite** with hot module replacement (HMR).

- Source code lives in `./src/` (React JSX components)
- Build output goes to `./build/` (auto-generated by `npm run build`)
- The Vite dev server runs on port 5173 with API proxy to LocalStack functions
- `openkbs deploy` automatically runs `npm run build` before deploying

**Adding new pages/components:** Create new `.jsx` files in `./src/` and import them in `App.jsx`.

**API proxy:** In local mode, the Vite dev server automatically proxies requests to function endpoints. For example, if you have a function named `api`, requests to `/api` are proxied to the Lambda function running in LocalStack. No configuration needed — the proxy reads `openkbs.json` dynamically.

---

## Function Development Patterns

### Basic handler with CORS

```javascript
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(data),
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const body = event.body ? JSON.parse(event.body) : {};
  return json({ message: 'OK' });
}
```

### Action-based dispatch

```javascript
export async function handler(event) {
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const body = event.body ? JSON.parse(event.body) : {};
  const { action } = body;

  switch (action) {
    case 'list':   return handleList(body);
    case 'create': return handleCreate(body);
    default:       return json({ error: 'Unknown action' }, 400);
  }
}
```

### Postgres connection pooling and table creation

```javascript
import pg from 'pg';

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 120000,
});
let dbInitialized = false;

async function connectDB() {
  if (!dbInitialized) {
    dbInitialized = true;
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
}

// Usage in handler:
export async function handler(event) {
  await connectDB();
  const result = await db.query('SELECT * FROM users LIMIT 50');
  return json({ users: result.rows });
}
```

**Note:** Use `max: 1` for Lambda — each invocation gets its own connection. Use `CREATE TABLE IF NOT EXISTS` for auto-migration on first deploy.

### User authentication pattern

```javascript
import crypto from 'crypto';

// Register
const privateChannel = crypto.randomBytes(32).toString('hex');  // for private MQTT messaging
const result = await db.query(
  'INSERT INTO users (name, email, password, private_channel) VALUES ($1, $2, $3, $4) RETURNING *',
  [name, email, password, privateChannel]
);

// Login
const result = await db.query(
  'SELECT * FROM users WHERE email = $1 AND password = $2',
  [email, password]
);
```

### S3 presigned upload URLs

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function getUploadUrl(fileName, contentType) {
  const bucket = process.env.STORAGE_BUCKET;
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `media/uploads/${timestamp}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || 'image/jpeg',
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = '/' + key;  // served via CloudFront
  return { uploadUrl, publicUrl, key };
}
```

Alternatively, use the Project API to get an upload URL without importing the AWS SDK:

```javascript
const projectId = process.env.OPENKBS_PROJECT_ID;
const apiKey = process.env.OPENKBS_API_KEY;

const res = await fetch(`https://project.openkbs.com/projects/${projectId}/storage/upload-url`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ key: 'media/uploads/photo.jpg', contentType: 'image/jpeg' }),
});
const { uploadUrl, publicUrl } = await res.json();
```

### Frontend image upload (React)

```jsx
async function uploadImage(file) {
  // Get presigned URL from your function
  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getUploadUrl', fileName: file.name, contentType: file.type }),
  });
  const { uploadUrl, publicUrl } = await res.json();

  // Upload directly to S3
  await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

  return publicUrl;
}
```

### Email — sending from a Lambda function

```javascript
const projectId = process.env.OPENKBS_PROJECT_ID;
const apiKey = process.env.OPENKBS_API_KEY;

const res = await fetch(`https://project.openkbs.com/projects/${projectId}/email/send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: 'Hello',
    html: '<h1>Hi!</h1>',
  }),
});
const { sent } = await res.json();
```

### MQTT — Architecture

MQTT uses AWS IoT Core MQTT over WebSocket. Clients connect **directly** to IoT Core (no proxy). The platform provides:
- `POST /projects/{id}/mqtt/token` — temporary STS credentials (15 min, scoped to project topics)
- `POST /projects/{id}/mqtt/publish` — server-side publish (metered, billed)
- Client SDK (`mqtt.js`) — browser SDK with channels, presence, auto-reconnect

**Data flow:**
```
Browser → SigV4-signed WebSocket → AWS IoT Core (managed MQTT broker)
Server  → POST /mqtt/publish   → Lambda → IoT Core → all subscribers
```

**Presence** uses MQTT Last Will and Testament (LWT) for auto-leave on disconnect.

### MQTT — get credentials (server-side)

```javascript
const projectId = process.env.OPENKBS_PROJECT_ID;
const apiKey = process.env.OPENKBS_API_KEY;

const res = await fetch(`https://project.openkbs.com/projects/${projectId}/mqtt/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ userId: String(userId) }),
});
// Returns: { iotEndpoint, region, topicPrefix, clientIdPrefix, credentials: { accessKeyId, secretAccessKey, sessionToken } }
const mqttData = await res.json();
```

### MQTT — publish from server (metered)

```javascript
await fetch(`https://project.openkbs.com/projects/${projectId}/mqtt/publish`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ channel: 'posts', event: 'new_post', data: { id: 1, title: 'Hello' } }),
});
```

### MQTT — client SDK (browser)

```html
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
<script src="https://openkbs.com/sdk/mqtt.js"></script>
```

```javascript
const realtime = new MQTT.Realtime({
  credentials: mqttData.credentials,
  iotEndpoint: mqttData.iotEndpoint,
  region: mqttData.region,
  topicPrefix: mqttData.topicPrefix,
  clientIdPrefix: mqttData.clientIdPrefix,
  clientId: 'user-123',
  debug: false
});

// Connection events
realtime.connection.on('connected', () => console.log('online'));
realtime.connection.on('disconnected', () => console.log('offline'));

// Channels
const channel = realtime.channels.get('posts');
channel.subscribe('new_post', (msg) => console.log(msg.data));
channel.publish('greeting', { text: 'Hello!' });

// Presence
channel.presence.enter({ name: 'Alice' });
channel.presence.subscribe((members) => console.log(members));
channel.presence.leave();

// Cleanup
realtime.close();
```

### MQTT — private messaging pattern

For secure private messaging, each user gets an unpredictable private channel:

```javascript
// Server: generate private channel on registration
const privateChannel = crypto.randomBytes(32).toString('hex');
await db.query('INSERT INTO users (name, private_channel) VALUES ($1, $2)', [name, privateChannel]);

// Server: send message by publishing to recipient's private channel
const recipient = await db.query('SELECT private_channel FROM users WHERE id = $1', [toUserId]);
await mqttPublish(recipient.rows[0].private_channel, 'new_message', { fromUserId, content: message });

// Client: subscribe to own private channel (only this user knows it)
const privateChannel = realtime.channels.get(user.privateChannel);
privateChannel.subscribe('new_message', (msg) => console.log('New message:', msg.data));
```

### MQTT — Security

- Credentials are scoped to the project's IoT topics only (STS session policy)
- Any user with credentials can subscribe to **all** channels in the project
- For private channels, use unpredictable names: `crypto.randomBytes(32).toString('hex')`
- For sensitive data, publish only from server via `/mqtt/publish`
- Store messages in the database for chat history (MQTT is fire-and-forget)

---

## Multi-function Architecture

For larger apps, split logic into separate functions:

```
functions/
  auth/          # User registration, login, token management
    index.mjs
    package.json
  posts/         # Content CRUD, image uploads
    index.mjs
    package.json
  payments/      # Payment processing
    index.mjs
    package.json
```

Create new functions with `openkbs fn create <name>`. Each function:
- Has its own `package.json` for dependencies
- Gets all environment variables (DATABASE_URL, STORAGE_BUCKET, etc.)
- Is independently deployable with `openkbs fn deploy <name>`
- Has its own Lambda URL endpoint
- The Vite proxy automatically routes `/<functionName>` to the right Lambda

**Frontend API calls:**
```javascript
// Each function is accessible at /<functionName>
await fetch('/auth', { method: 'POST', body: JSON.stringify({ action: 'login', email, password }) });
await fetch('/posts', { method: 'POST', body: JSON.stringify({ action: 'list' }) });
await fetch('/payments', { method: 'POST', body: JSON.stringify({ action: 'charge', amount: 100 }) });
```

---

## Building a Complete App (End-to-End)

This section shows how all pieces connect to build a real-time app with auth, data, file uploads, and live updates.

### Architecture Overview

```
Frontend (React + Vite)
  ├── /auth     → functions/auth/     → Postgres (users table)
  ├── /posts    → functions/posts/    → Postgres (posts, messages tables) + S3 (images)
  └── MQTT SDK  → AWS IoT Core       → Real-time updates (posts, private messages, presence)
```

### Step-by-step Data Flow

**Registration:**
1. Frontend POSTs `{ action: 'register', name, email, password }` to `/auth`
2. Backend creates user in Postgres with a random `private_channel` (crypto.randomBytes)
3. Backend calls `/mqtt/token` to get temporary MQTT credentials
4. Backend returns `{ user: { id, name, privateChannel, mqtt: { credentials, iotEndpoint, ... } } }`
5. Frontend stores user in `localStorage`, connects to MQTT

**Login (page reload):**
1. Frontend reads user from `localStorage` on mount
2. MQTT credentials are expired (15-min STS tokens) — calls `/auth` with `{ action: 'refreshMqtt', userId }`
3. Gets fresh credentials, connects to MQTT
4. Subscribes to public channels (`posts`) and private channel (`user.privateChannel`)

**Creating a post:**
1. Frontend POSTs `{ action: 'create', content, userId, userName }` to `/posts`
2. Backend inserts into Postgres `posts` table
3. Backend calls MQTT publish to `posts` channel with the new post data
4. All connected clients receive the post via their MQTT subscription callback
5. Frontend updates React state: `setPosts(prev => [newPost, ...prev])`

**Sending a private message:**
1. Frontend POSTs `{ action: 'sendMessage', toUserId, message, fromUserId, fromUserName }` to `/posts`
2. Backend looks up recipient's `private_channel` from users table
3. Backend stores message in `messages` table
4. Backend publishes to recipient's private channel via MQTT
5. Only the recipient receives it (only they subscribe to their private channel)
6. Sender adds message to their local React state immediately

**Presence (who's online):**
1. On MQTT connect, client enters presence on the `posts` channel
2. SDK broadcasts presence to all subscribers, handles sync for newcomers
3. On disconnect (tab close, crash), MQTT LWT auto-removes the user
4. Frontend displays green/red dots based on presence data

### Complete Auth Function

```javascript
// functions/auth/index.mjs
import pg from 'pg';
import crypto from 'crypto';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 120000 });
let dbReady = false;

async function initDB() {
  if (dbReady) return;
  dbReady = true;
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      private_channel VARCHAR(64) UNIQUE NOT NULL,
      avatar_color VARCHAR(7) DEFAULT '#007bff',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

const COLORS = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'];

async function getMqttToken(userId) {
  const projectId = process.env.OPENKBS_PROJECT_ID;
  const apiKey = process.env.OPENKBS_API_KEY;
  if (!projectId || !apiKey) return null;
  try {
    const res = await fetch(`https://project.openkbs.com/projects/${projectId}/mqtt/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ userId: String(userId) }),
    });
    const data = await res.json();
    return data.error ? null : data;
  } catch { return null; }
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (data, statusCode = 200) => ({ statusCode, headers: CORS, body: JSON.stringify(data) });

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  await initDB();
  const body = JSON.parse(event.body || '{}');
  const { action } = body;

  if (action === 'register') {
    const { name, email, password } = body;
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return json({ error: 'Email already registered' }, 400);

    const privateChannel = crypto.randomBytes(32).toString('hex');
    const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const result = await db.query(
      'INSERT INTO users (name, email, password, private_channel, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, private_channel, avatar_color',
      [name, email, password, privateChannel, avatarColor]
    );
    const user = result.rows[0];
    const mqtt = await getMqttToken(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color, privateChannel: user.private_channel, mqtt } });
  }

  if (action === 'login') {
    const { email, password } = body;
    const result = await db.query('SELECT id, name, email, private_channel, avatar_color FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return json({ error: 'Invalid email or password' }, 401);
    const user = result.rows[0];
    const mqtt = await getMqttToken(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color, privateChannel: user.private_channel, mqtt } });
  }

  if (action === 'refreshMqtt') {
    const { userId } = body;
    const check = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (check.rows.length === 0) return json({ error: 'Invalid user' }, 403);
    const mqtt = await getMqttToken(userId);
    return json({ mqtt });
  }

  // Public user list — NEVER expose email, password, or privateChannel
  if (action === 'users') {
    const result = await db.query('SELECT id, name, avatar_color FROM users ORDER BY name');
    return json({ users: result.rows.map(u => ({ id: u.id, name: u.name, avatarColor: u.avatar_color })) });
  }

  return json({ error: 'Unknown action', available: ['register', 'login', 'refreshMqtt', 'users'] }, 400);
}
```

### Complete Posts + Messaging Function

```javascript
// functions/posts/index.mjs
import pg from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 120000 });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
let dbReady = false;

async function initDB() {
  if (dbReady) return;
  dbReady = true;
  await db.query(`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, user_name VARCHAR(255) NOT NULL,
    content TEXT, image_url TEXT, created_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY, from_user_id INTEGER NOT NULL, from_user_name VARCHAR(255) NOT NULL,
    to_user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
  )`);
}

async function mqttPublish(channel, event, data) {
  const projectId = process.env.OPENKBS_PROJECT_ID;
  const apiKey = process.env.OPENKBS_API_KEY;
  if (!projectId || !apiKey) return null;
  try {
    const res = await fetch(`https://project.openkbs.com/projects/${projectId}/mqtt/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ channel, event, data }),
    });
    return await res.json();
  } catch { return null; }
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (data, sc = 200) => ({ statusCode: sc, headers: CORS, body: JSON.stringify(data) });

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const body = JSON.parse(event.body || '{}');
  const { action } = body;

  // S3 upload URL — doesn't need DB
  if (action === 'getUploadUrl') {
    const bucket = process.env.STORAGE_BUCKET;
    if (!bucket) return json({ error: 'Storage not configured' }, 500);
    const safeName = (body.fileName || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `media/uploads/${Date.now()}-${safeName}`;
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: bucket, Key: key, ContentType: body.contentType || 'image/jpeg'
    }), { expiresIn: 3600 });
    return json({ uploadUrl, publicUrl: '/' + key, key });
  }

  await initDB();

  if (action === 'list') {
    const result = await db.query('SELECT id, user_id, user_name, content, image_url, created_at FROM posts ORDER BY created_at DESC LIMIT 50');
    return json({ posts: result.rows.map(r => ({ id: r.id, userId: r.user_id, userName: r.user_name, content: r.content, imageUrl: r.image_url, createdAt: r.created_at })) });
  }

  if (action === 'create') {
    const { content, imageUrl, userId, userName } = body;
    if (!content && !imageUrl) return json({ error: 'Content or image required' }, 400);
    if (!userId || !userName) return json({ error: 'Missing user info' }, 400);
    const result = await db.query('INSERT INTO posts (user_id, user_name, content, image_url) VALUES ($1, $2, $3, $4) RETURNING id, created_at', [userId, userName, content || '', imageUrl || null]);
    const post = { id: result.rows[0].id, userId, userName, content: content || '', imageUrl: imageUrl || null, createdAt: result.rows[0].created_at };
    await mqttPublish('posts', 'new_post', { post });
    return json({ post });
  }

  if (action === 'sendMessage') {
    const { toUserId, message, fromUserId, fromUserName } = body;
    if (!toUserId || !message || !fromUserId || !fromUserName) return json({ error: 'Missing fields' }, 400);
    // Look up recipient's SECRET private channel
    const recipient = await db.query('SELECT private_channel FROM users WHERE id = $1', [toUserId]);
    if (recipient.rows.length === 0) return json({ error: 'Recipient not found' }, 404);
    const result = await db.query('INSERT INTO messages (from_user_id, from_user_name, to_user_id, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at', [fromUserId, fromUserName, toUserId, message]);
    const msg = { id: result.rows[0].id, fromUserId, fromUserName, toUserId, content: message, createdAt: result.rows[0].created_at };
    // Publish to recipient's private channel — only they receive it
    await mqttPublish(recipient.rows[0].private_channel, 'new_message', msg);
    return json({ message: msg });
  }

  if (action === 'getMessages') {
    const { userId, withUserId } = body;
    // Bidirectional query — messages sent in either direction
    const result = await db.query(
      `SELECT id, from_user_id, from_user_name, to_user_id, content, created_at FROM messages
       WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
       ORDER BY created_at ASC LIMIT 100`, [userId, withUserId]
    );
    return json({ messages: result.rows.map(m => ({ id: m.id, fromUserId: m.from_user_id, fromUserName: m.from_user_name, toUserId: m.to_user_id, content: m.content, createdAt: m.created_at })) });
  }

  return json({ error: 'Unknown action' }, 400);
}
```

---

## React Frontend Patterns

### App structure with auth, MQTT, and real-time state

```jsx
// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const mqttRef = useRef(null);

  // Restore user from localStorage on page load
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (!saved) return;
    const u = JSON.parse(saved);
    setUser({ ...u, mqtt: null }); // Show UI immediately
    // Refresh expired MQTT credentials (STS tokens last 15 min)
    fetch('/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refreshMqtt', userId: u.id }),
    })
      .then(r => r.json())
      .then(d => { if (d.mqtt) setUser(prev => ({ ...prev, mqtt: d.mqtt })); });
  }, []);

  // Connect to MQTT when credentials are available
  useEffect(() => {
    if (!user?.mqtt?.credentials) return;

    // Load initial data
    fetch('/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) })
      .then(r => r.json()).then(d => setPosts(d.posts || []));
    fetch('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'users' }) })
      .then(r => r.json()).then(d => setUsers((d.users || []).filter(u => u.id !== user.id)));

    // Connect MQTT
    const realtime = new MQTT.Realtime({
      credentials: user.mqtt.credentials,
      iotEndpoint: user.mqtt.iotEndpoint,
      region: user.mqtt.region,
      topicPrefix: user.mqtt.topicPrefix,
      clientIdPrefix: user.mqtt.clientIdPrefix,
      clientId: String(user.id),
    });
    mqttRef.current = realtime;

    // Subscribe to posts channel
    const postsChannel = realtime.channels.get('posts');
    postsChannel.subscribe('new_post', (msg) => {
      const post = msg.data?.post || msg.data;
      if (post?.id) setPosts(prev => prev.some(p => p.id === post.id) ? prev : [post, ...prev]);
    });

    // Presence — who's online
    postsChannel.presence.enter({ userId: String(user.id), name: user.name });
    postsChannel.presence.subscribe((members) => {
      const ids = new Set(members.map(m => Number(m.data?.userId || m.clientId)));
      ids.add(user.id);
      setOnlineUsers(ids);
    });

    // Subscribe to private channel for direct messages
    let privateChannel = null;
    if (user.privateChannel) {
      privateChannel = realtime.channels.get(user.privateChannel);
      privateChannel.subscribe('new_message', (msg) => {
        // Handle incoming private message — update your message state
        console.log('Private message:', msg.data);
      });
    }

    // Cleanup on unmount or credential change
    return () => {
      postsChannel.presence.leave();
      if (privateChannel) privateChannel.detach();
      realtime.close();
    };
  }, [user?.mqtt?.credentials]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    mqttRef.current?.close();
    setUser(null);
    setPosts([]);
    localStorage.removeItem('user');
  };

  if (!user) return <LoginForm onLogin={handleLogin} />;

  return (
    <div>
      <header>
        <span>Welcome, {user.name}</span>
        <button onClick={handleLogout}>Logout</button>
      </header>
      <UserList users={users} onlineUsers={onlineUsers} />
      <PostsFeed user={user} posts={posts} />
    </div>
  );
}
```

### Login/Register form

```jsx
function LoginForm({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isRegister ? 'register' : 'login', name, email, password }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else if (data.user) onLogin(data.user);
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {isRegister && <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />}
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button disabled={loading}>{loading ? 'Loading...' : isRegister ? 'Register' : 'Login'}</button>
      <p><a onClick={() => setIsRegister(!isRegister)}>{isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}</a></p>
    </form>
  );
}
```

### Posts feed with image upload

```jsx
function PostsFeed({ user, posts }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file?.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;
    setLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        // Get presigned upload URL
        const urlRes = await fetch('/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getUploadUrl', fileName: imageFile.name, contentType: imageFile.type }),
        });
        const { uploadUrl, publicUrl } = await urlRes.json();
        // Upload directly to S3
        await fetch(uploadUrl, { method: 'PUT', body: imageFile, headers: { 'Content-Type': imageFile.type } });
        imageUrl = publicUrl;
      }
      await fetch('/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', content, imageUrl, userId: user.id, userName: user.name }),
      });
      setContent(''); setImageFile(null); setImagePreview(null);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea placeholder="What's on your mind?" value={content} onChange={e => setContent(e.target.value)} />
        <input type="file" accept="image/*" onChange={handleImageSelect} />
        {imagePreview && <img src={imagePreview} style={{ maxWidth: 200 }} alt="Preview" />}
        <button disabled={loading}>{loading ? 'Posting...' : 'Post'}</button>
      </form>
      {posts.map(post => (
        <div key={post.id}>
          <strong>{post.userName}</strong>
          <p>{post.content}</p>
          {post.imageUrl && <img src={post.imageUrl} style={{ maxWidth: '100%' }} alt="" />}
        </div>
      ))}
    </div>
  );
}
```

### User list with online status

```jsx
function UserList({ users, onlineUsers, onSelectUser }) {
  return (
    <div>
      {users.map(u => (
        <div key={u.id} onClick={() => onSelectUser?.(u)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: onlineUsers.has(u.id) ? '#4CAF50' : '#ccc',
          }} />
          <span>{u.name}</span>
        </div>
      ))}
    </div>
  );
}
```

### Chat messages with send

```jsx
function ChatView({ user, selectedUser, messages, onSend }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div>
      <div style={{ overflowY: 'auto', maxHeight: 400 }}>
        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{ textAlign: msg.fromUserId === user.id ? 'right' : 'left', marginBottom: 8 }}>
            <span style={{
              display: 'inline-block', padding: '8px 12px', borderRadius: 12,
              background: msg.fromUserId === user.id ? '#007bff' : '#e0e0e0',
              color: msg.fromUserId === user.id ? 'white' : '#333',
            }}>{msg.content}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1 }} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Sending a private message (wiring)

```javascript
// In your App component or message handler:
const sendMessage = async (toUserId, content) => {
  const res = await fetch('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sendMessage', toUserId, message: content, fromUserId: user.id, fromUserName: user.name }),
  });
  const data = await res.json();
  if (data.message) {
    // Add to local state immediately (sender sees it right away)
    setMessages(prev => ({ ...prev, [toUserId]: [...(prev[toUserId] || []), data.message] }));
  }
};

// Loading chat history when selecting a user:
const loadMessages = async (withUserId) => {
  const res = await fetch('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getMessages', userId: user.id, withUserId }),
  });
  const data = await res.json();
  setMessages(prev => ({ ...prev, [withUserId]: data.messages || [] }));
};
```

---

## Board (Task Management)

The project board is a Trello-like kanban system.

```bash
openkbs board                          # Get full board
openkbs board create <title> [-c <column>] [-t <type>] [-p <priority>] [-d <description>]
openkbs board update <cardId> [--title <t>] [--description <d>] [--priority <p>] [--status <s>]
openkbs board move <cardId> <columnName>
openkbs board comment <cardId> <message>
openkbs board delete <cardId>
```

**Card types:** task, bug, feature, paid-task
**Priorities:** low, medium, high, critical
**Default columns:** Backlog, To Do, In Progress, Review, Done

### Image Generation

```bash
openkbs image "A sunset over mountains" -o site/hero.png
openkbs image "Create a banner with this logo" --ref site/logo.png -o site/banner.png
openkbs image "Wide banner" --aspect-ratio 16:9 --count 4 -o site/banner.png
```

---

## AI Proxy (proxy.openkbs.com)

AI proxy that routes to OpenAI, Anthropic, and Google. Charges to project credits automatically — no vendor API keys needed.

### Routes

| Route | Vendor |
|-------|--------|
| `/v1/openai/*` | OpenAI |
| `/v1/anthropic/*` | Anthropic |
| `/v1/google/*` | Google |

### Authentication

Uses `OPENKBS_API_KEY` (injected automatically into elastic functions).

> **Important:** The proxy only accepts `Authorization: Bearer <OPENKBS_API_KEY>` for auth.
> The Anthropic SDK sends `x-api-key` and the Google SDK sends `x-goog-api-key` — neither works.
> You must add `headers: { Authorization: \`Bearer ${apiKey}\` }` when configuring those providers.

### Recommended: Vercel AI SDK

```javascript
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const apiKey = process.env.OPENKBS_API_KEY;

const openai = createOpenAI({
  baseURL: 'https://proxy.openkbs.com/v1/openai',
  apiKey,
});

const anthropic = createAnthropic({
  baseURL: 'https://proxy.openkbs.com/v1/anthropic/v1',
  apiKey,
  headers: { Authorization: `Bearer ${apiKey}` },
});

const google = createGoogleGenerativeAI({
  baseURL: 'https://proxy.openkbs.com/v1/google',
  apiKey,
  headers: { Authorization: `Bearer ${apiKey}` },
});

const { text } = await generateText({
  model: openai('gpt-5.4-mini'),
  prompt: 'Hello!',
});
```

> **Note:** Functions run on AWS Lambda which does not support streaming responses. Use `generateText` (not `streamText`).

### Available Models

| Vendor | Model | Input (credits/1K) | Output (credits/1K) |
|--------|-------|---------------------|---------------------|
| openai | gpt-5.4 | 300 | 1800 |
| openai | gpt-5.4-mini | 90 | 540 |
| anthropic | claude-opus-4-6 | 600 | 3000 |
| anthropic | claude-sonnet-4-6 | 360 | 1800 |
| anthropic | claude-haiku-4-5-20251001 | 120 | 600 |
| google | gemini-3.1-pro-preview | 240 | 1440 |
| google | gemini-3.1-flash-lite-preview | 30 | 180 |
| google | gemini-3-flash-preview | 60 | 360 |

100,000 credits = 1 EUR. Use `GET /ai/models` to fetch the latest list programmatically.
