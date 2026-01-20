# Tutorial 13: Serverless Functions

Deploy serverless APIs with AWS Lambda. Write your code in Node.js, Python, or Java. Get HTTPS endpoints automatically.

## Create a Function

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

Create `functions/api/requirements.txt`:

```
# Add Python dependencies here
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

## Deploy

```bash
# Install dependencies
cd functions/api && npm install && cd ../..

# Deploy function
openkbs fn push api
```

Your function is live at `https://yourdomain.com/api`.

## Test Your Function

### From CLI

```bash
openkbs fn invoke api '{"action":"hello","name":"OpenKBS"}'
```

### From Browser

```javascript
const response = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hello', name: 'OpenKBS' })
});

const data = await response.json();
console.log(data); // { message: "Hello, OpenKBS!" }
```

### With curl

```bash
curl -X POST https://yourdomain.com/api \
  -H "Content-Type: application/json" \
  -d '{"action":"hello","name":"OpenKBS"}'
```

## Environment Variables

Elastic services inject these automatically:

| Variable | Description |
|----------|-------------|
| `OPENKBS_KB_ID` | Your KB ID |
| `OPENKBS_API_KEY` | API key |
| `DATABASE_URL` | PostgreSQL connection (if enabled) |
| `STORAGE_BUCKET` | S3 bucket name (if enabled) |
| `STORAGE_REGION` | S3 region (if enabled) |

### View Environment

```bash
openkbs fn env api
```

### Set Custom Variables

```bash
openkbs fn env api STRIPE_KEY=sk_live_xxx
openkbs fn env api DEBUG=true
```

### Remove Variable

```bash
openkbs fn env api STRIPE_KEY=
```

## Configure Memory & Timeout

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

## View Logs

```bash
openkbs fn logs api
openkbs fn logs api --limit 100
openkbs fn logs api --follow  # Stream logs
```

## CORS Headers

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

## Multiple Functions

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

## List Functions

```bash
openkbs fn list
```

Output:
```
Functions:
  api      128MB  30s  https://yourdomain.com/api
  auth     256MB  30s  https://yourdomain.com/auth
  posts    512MB  60s  https://yourdomain.com/posts
```

## Delete Function

```bash
openkbs fn delete api
```

## CLI Reference

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

## Tips

1. **Connection Reuse** - Initialize DB connections outside the handler for reuse.

2. **Cold Starts** - More memory = faster cold starts. 512MB is a good default.

3. **Timeout** - Set appropriate timeouts. Don't leave at 30s if your function takes 5s.

4. **Logs** - Use `console.log()` (Node.js), `print()` (Python), or `context.getLogger()` (Java).

## Next Steps

- [Tutorial 14: Real-time Pulse](./14-pulse.md)
- [Tutorial 15: Node.js Full Example](./15-nodejs-example.md)
