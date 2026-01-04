# {{APP_NAME}} Platform

OpenKBS full-stack platform with AI agents, serverless functions, and static site.

## Structure

```
{{APP_NAME}}/
├── agents/                 # AI agents
│   └── assistant/          # Sample assistant agent
│       ├── app/
│       │   ├── settings.json
│       │   └── instructions.txt
│       └── src/
│           ├── Events/
│           └── Frontend/
├── functions/              # Serverless Lambda functions
│   └── api/
│       └── index.mjs       # Sample API endpoint
├── site/                   # Static site for whitelabel
│   └── index.html
├── openkbs.json            # Elastic services configuration
└── README.md
```

## Deploy

```bash
# Deploy elastic services (postgres, storage, pulse)
openkbs deploy

# Deploy the API function
openkbs fn push api

# Deploy static site
openkbs site push

# Deploy an agent
cd agents/assistant
openkbs push
```

## Elastic Services

Enabled in `openkbs.json`:

- **Postgres**: `openkbs postgres shell` to connect
- **Storage**: `openkbs storage ls` to list files
- **Pulse**: `openkbs pulse status` for WebSocket info
- **Functions**: `openkbs fn list` to see deployed functions

## Development

```bash
# Check stack status
openkbs stack status

# View function logs
openkbs fn logs api

# Invoke function locally
openkbs fn invoke api '{"action": "hello"}'
```

## URLs

After deployment:
- Site: `https://YOUR_DOMAIN/`
- API: `https://fn.openkbs.com/YOUR_KB_ID/api`
- Agent: `https://YOUR_KB_ID.apps.openkbs.com`
