
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
openkbs create [name] -r <region>  # Create + scaffold project (openkbs.json, functions/, site/, .claude/skills/)
openkbs deploy             # Deploy all elastic services declared in openkbs.json
openkbs update             # Update CLI binary + download latest skill into project
```

### Functions (Lambda)
```bash
openkbs fn list            # List deployed functions (alias: ls)
openkbs fn deploy <name>   # Zip ./functions/<name>/ and deploy to Lambda
openkbs fn logs <name>     # Tail recent CloudWatch logs
openkbs fn invoke <name> -d '{"action":"hello"}'   # Invoke with JSON payload
openkbs fn destroy <name>  # Delete function and its Lambda URL
```

Options for `fn deploy`:
- `-s, --schedule <expr>` -- Schedule expression, e.g. `"rate(1 hour)"` or `"cron(0 9 * * ? *)"`
- `-m, --memory <mb>` -- Memory in MB (default from openkbs.json)
- `-t, --timeout <sec>` -- Timeout in seconds
- `--no-http` -- Disable HTTP access (function URL)

### Static Site
```bash
openkbs site deploy        # Deploy ./site/ to S3 + CloudFront
```

### Storage (S3)
```bash
openkbs storage list [prefix]              # List objects (alias: ls)
openkbs storage upload <local> [remote]    # Upload a file
openkbs storage download <remote> [local]  # Download a file
openkbs storage rm <keys...>              # Delete objects
```

### PostgreSQL (Neon)
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
./openkbs.json          # Project config (services, region, functions)
./functions/            # Each subfolder = one Lambda function
  api/
    index.mjs           # Entry point (export handler)
    package.json        # Optional dependencies (bundled on push)
./site/                 # Static site (S3 + CloudFront CDN)
  index.html
```

## openkbs.json

```json
{
  "projectId": "a0ebcf5d1fa5",
  "region": "us-east-1",
  "postgres": true,
  "storage": { "cloudfront": "media" },
  "mqtt": true,
  "functions": [
    { "name": "api", "runtime": "nodejs24.x", "memory": 512, "timeout": 30 },
    { "name": "cleanup", "schedule": "rate(1 hour)", "timeout": 900 }
  ],
  "site": "./site",
  "spa": "/app/index.html"
}
```

| Field | Description |
|-------|-------------|
| `projectId` | Project short ID (auto-set by `openkbs init` or `openkbs create`) |
| `region` | AWS region for all resources |
| `postgres` | `true` to provision Neon Postgres |
| `storage` | Object with `cloudfront` prefix for CDN distribution |
| `mqtt` | `true` to enable real-time WebSocket messaging |
| `functions` | Array of function definitions to deploy |
| `site` | Path to static site directory |
| `spa` | SPA fallback path (all 404s redirect here) |

---

## Elastic Services

### Functions (Lambda)

Serverless functions running on **Node.js 24.x** (AWS Lambda).

Each function lives in `./functions/<name>/` with an `index.mjs` entry point that exports a `handler` function. The handler receives a Lambda Function URL event and returns a response object.

**Environment variables** injected automatically:
- `DATABASE_URL` -- Postgres connection string (if `postgres: true`)
- `STORAGE_BUCKET` -- S3 bucket name (if `storage` configured)
- `OPENKBS_PROJECT_ID` -- Project short ID
- `OPENKBS_API_KEY` -- Secret key for calling OpenKBS platform APIs

Deploy: `openkbs fn deploy <name>`

### Storage (S3 + CloudFront)

Object storage backed by S3 with CloudFront CDN. Files uploaded to S3 are served through CloudFront at the domain's CDN path prefix (e.g. `/media/`).

### Postgres (Neon)

Managed PostgreSQL database. Connection string is injected as `DATABASE_URL` into all functions. Use `openkbs postgres connection` to get the string for local development.

### MQTT (Real-time Messaging)

Real-time pub/sub messaging via AWS IoT Core MQTT over WebSocket. Clients get temporary AWS credentials from `POST /projects/{id}/mqtt/token`, then connect directly to IoT Core. Supports channels, presence, and event-based subscriptions. Client SDK: `<script src="https://openkbs.com/sdk/mqtt.js"></script>` (requires mqtt.js).

**Security:** MQTT credentials allow pub/sub on ALL channels within the project. Any user with credentials can subscribe to any channel. For private/sensitive channels, use unpredictable channel names (e.g., `crypto.randomBytes(32).toString('hex')`). For sensitive data, publish only from the server via `POST /projects/{id}/mqtt/publish` — never trust client-published messages without server-side validation.

---

## API Base URLs

| Service | URL |
|---------|-----|
| Project API | `https://project.openkbs.com` |
| User API | `https://user.openkbs.com` |
| AI Proxy | `https://proxy.openkbs.com` |

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

### Postgres connection pooling

```javascript
import pg from 'pg';

let pool;
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 60_000,
    });
  }
  return pool;
}

// Usage in handler:
const db = getPool();
const result = await db.query('SELECT * FROM items LIMIT 50');
```

### S3 presigned upload URLs

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const publicUrl = '/' + key;  // served via CloudFront
  return { uploadUrl, publicUrl };
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

**Presence** uses MQTT Last Will and Testament (LWT) for auto-leave on disconnect (tab close, crash, network loss). When a new member enters, existing members reply with `sync` so the newcomer discovers everyone instantly. No polling or heartbeat needed.

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
// Initialize (mqttData from /mqtt/token)
const realtime = new MQTT.Realtime({
  credentials: mqttData.credentials,
  iotEndpoint: mqttData.iotEndpoint,
  region: mqttData.region,
  topicPrefix: mqttData.topicPrefix,
  clientIdPrefix: mqttData.clientIdPrefix,
  clientId: 'user-123',     // unique per user
  debug: false               // true for console logs
});

// Connection events
realtime.connection.on('connected', () => console.log('online'));
realtime.connection.on('disconnected', () => console.log('offline'));

// Channels — subscribe to messages
const channel = realtime.channels.get('posts');
channel.subscribe((msg) => console.log(msg.name, msg.data));           // all messages
channel.subscribe('new_post', (msg) => console.log(msg.data));         // specific event
channel.publish('greeting', { text: 'Hello!' });                       // publish (if allowed)

// Presence — who's online
channel.presence.enter({ name: 'Alice' });                             // announce yourself
channel.presence.subscribe((members) => console.log(members));         // member list updates
channel.presence.subscribe('enter', (m) => console.log(m, 'joined'));  // specific events
channel.presence.subscribe('leave', (m) => console.log(m, 'left'));
channel.presence.leave();                                              // leave presence

// Cleanup
realtime.close();
```

### MQTT — Security

- Credentials are scoped to the project's IoT topics only (STS session policy)
- Credentials cannot access S3, Lambda, or any other AWS service
- Any user with credentials can subscribe to **all** channels in the project
- For private channels, use unpredictable names: `crypto.randomBytes(32).toString('hex')`
- For sensitive data, publish only from server via `/mqtt/publish` — never trust client-published messages
- Server-side publish is metered and billed; client-side publish is not

### MQTT — Billing

Server-side publish (`POST /mqtt/publish`) is billed probabilistically: 5 credits per 10,000 messages. Client-side presence (enter/leave/sync) is free.

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
> The OpenAI SDK sends this header by default, but the Anthropic SDK sends `x-api-key`
> and the Google SDK sends `x-goog-api-key` — neither works with the proxy.
> You must add `headers: { Authorization: \`Bearer ${apiKey}\` }` when configuring
> Anthropic or Google providers (both Vercel AI SDK and direct SDKs).

### List Available Models

Fetch current models programmatically:

```javascript
// From the proxy (no auth required)
const res = await fetch('https://proxy.openkbs.com/v1/models');
const { models } = await res.json();
// models: [{ vendor, model, alias, inputPrice, outputPrice, contextWindow }]

// Or from the project API
const res2 = await fetch('https://project.openkbs.com/ai/models');
```

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

// Note: baseURL includes /v1 because @ai-sdk/anthropic appends only /messages
// (the proxy needs the full path /v1/anthropic/v1/messages)
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
  model: openai('gpt-5.4-mini'),    // or anthropic('claude-sonnet-4-6')
  prompt: 'Hello!',                  // or google('gemini-3.1-flash-lite-preview')
});
```

> **Note:** Functions run on AWS Lambda which does not support streaming responses. Use `generateText` (not `streamText`). The response is returned as JSON.

### Alternative: Direct SDK

```javascript
// OpenAI SDK
import OpenAI from 'openai';
const client = new OpenAI({
  baseURL: 'https://proxy.openkbs.com/v1/openai',
  apiKey: process.env.OPENKBS_API_KEY,
});
const res = await client.chat.completions.create({
  model: 'gpt-5.4-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
  max_completion_tokens: 1024,  // Note: newer models use this instead of max_tokens
});

// Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
const anthropicClient = new Anthropic({
  baseURL: 'https://proxy.openkbs.com/v1/anthropic',  // Direct SDK appends /v1/messages automatically
  apiKey: process.env.OPENKBS_API_KEY,
  defaultHeaders: { Authorization: `Bearer ${process.env.OPENKBS_API_KEY}` },
});
const msg = await anthropicClient.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Google Gemini (raw fetch — no official SDK wrapper needed)
const apiKey = process.env.OPENKBS_API_KEY;
const geminiRes = await fetch('https://proxy.openkbs.com/v1/google/models/gemini-3.1-flash-lite-preview:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
    generationConfig: { maxOutputTokens: 1024 },
  }),
});
```

### Image Generation

Generate images. Supports reference images for branding, editing, and style transfer.

```bash
# Generate image
openkbs image "A sunset over mountains" -o site/hero.png

# With reference images
openkbs image "Create a banner with this logo" --ref site/logo.png -o site/banner.png
openkbs image "Product photo in this brand style" --ref brand.png --ref product.jpg -o site/promo.png

# Fast mode (quicker, lighter quality)
openkbs image "Quick sketch" --fast -o site/sketch.png

# Options
openkbs image "Wide banner" --aspect-ratio 16:9 --count 4 -o site/banner.png
```

Options: `-o <file>`, `--ref <file>` (repeatable, up to 10), `--aspect-ratio`, `--count`, `--fast`

When user uploads images in chat, they are saved to `site/_tmp/` and can be used as `--ref` paths.

### Available Models

| Vendor | Model | Type | Input (credits/1K) | Output (credits/1K) |
|--------|-------|------|---------------------|---------------------|
| openai | gpt-5.4 | chat | 300 | 1800 |
| openai | gpt-5.4-mini | chat | 90 | 540 |
| anthropic | claude-opus-4-6 | chat | 600 | 3000 |
| anthropic | claude-sonnet-4-6 | chat | 360 | 1800 |
| anthropic | claude-haiku-4-5-20251001 | chat | 120 | 600 |
| google | gemini-3.1-pro-preview | chat | 240 | 1440 |
| google | gemini-3.1-flash-lite-preview | chat | 30 | 180 |
| google | gemini-3-flash-preview | chat | 60 | 360 |

100,000 credits = 1 EUR. Use `GET /ai/models` to fetch the latest list programmatically.
