# {{APP_NAME}}

OpenKBS full-stack platform with Postgres, Storage+CloudFront, and Pulse.

## Structure

```
{{APP_NAME}}/
├── openkbs.json        # Elastic services config
├── agents/             # AI agents (optional)
├── functions/
│   └── api/            # Serverless function
└── site/
    └── index.html      # Static site
```

## Deploy

```bash
# Deploy elastic services
openkbs deploy

# Deploy function
openkbs fn push api

# Deploy site
openkbs site push
```

## Elastic Services

- **Postgres**: `openkbs postgres shell`
- **Storage**: `openkbs storage ls` (CDN at /media/*)
- **Pulse**: `openkbs pulse status`
- **Functions**: `openkbs fn list`
