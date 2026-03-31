# OpenKBS CLI

## What this project is

An open-source CLI tool with a web UI that lets developers build and deploy full-stack applications using Claude Code as their IDE. Users write code locally with Claude Code, then deploy functions, static sites, databases, and real-time services — either to a **local environment** (LocalStack + PostgreSQL) or to the **OpenKBS cloud** (AWS Lambda, S3, CloudFront, Neon PostgreSQL).

The key value: **same code, same commands, two targets**. Develop locally, deploy to cloud when ready.

## How it works

### The user experience

```bash
# Clone and set up
git clone https://github.com/open-kbs/openkbs.git
cd openkbs
npm install
cp .env.example .env   # Add LocalStack token

# Start infrastructure
docker compose up -d    # LocalStack + Postgres

# Launch the UI
npx tsx src/index.ts ui   # Opens http://localhost:3000

# From the UI:
# 1. Create App → scaffolds React + Vite project
# 2. Install Dependencies → npm install
# 3. Start Building → Vite dev server with hot reload
# 4. Deploy Locally → functions + site → LocalStack

# When ready for production
openkbs login
# Change "target" to "cloud" in openkbs.json
openkbs deploy          # Same app → real AWS
```

### Scaffolded project structure

```
my-app/
├── openkbs.json              # Project config (services, region, functions, target)
├── package.json              # React + Vite dependencies
├── vite.config.js            # Dev server + API proxy + build config
├── src/                      # React source code (edit here)
│   ├── index.html
│   ├── main.jsx
│   └── App.jsx
├── build/                    # Vite build output (deployed to S3)
├── functions/                # Each subfolder = one Lambda function
│   └── api/
│       ├── index.mjs         # Handler: export const handler = async (event) => { ... }
│       └── package.json
└── .claude/
    ├── CLAUDE.md             # Tells Claude to load the skill
    └── skills/openkbs/
        └── SKILL.md          # Full reference for building OpenKBS apps
```

### Target switching

The `target` field in `openkbs.json` controls where deployments go:

- `"target": "local"` → CLI uses AWS SDK directly against LocalStack (localhost:4566)
- `"target": "cloud"` → CLI calls `project.openkbs.com` which provisions real AWS resources

### Elastic services

| Service | Cloud provider | Local replacement |
|---------|---------------|-------------------|
| Functions | AWS Lambda | LocalStack Lambda |
| Storage | AWS S3 + CloudFront | LocalStack S3 |
| Database | Neon PostgreSQL | Local PostgreSQL container |
| Real-time (MQTT) | AWS IoT Core | Cloud only |
| Email | AWS SES | Cloud only |

## Architecture

```
target=local:  CLI → AWS SDK → LocalStack (:4566) + Postgres (:5432)
target=cloud:  CLI → project.openkbs.com → real AWS (Lambda, S3, CloudFront, Neon)
```

### UI server (`openkbs ui`)

The UI server is a Node.js HTTP server that provides:
- **Web UI** at `/` — wizard flow: create app → install → dev server → deploy
- **REST API** — `/api/status`, `/api/apps`, `/api/apps/:name/install`, `/api/apps/:name/dev`, `/api/apps/:name/deploy-local`
- **Lambda proxy** — `/api/apps/:name/invoke/:fnName` invokes Lambda functions via AWS SDK and translates the response to HTTP. The Vite dev server proxies function routes (e.g. `/api`) through this.
- **Health checks** — monitors LocalStack and Postgres availability

## Codebase layout

```
src/
├── index.ts                  # Command registration (Commander.js) + wrapAction error handler
├── commands/
│   ├── auth.ts               # login, logout, token exchange
│   ├── project.ts            # create, list projects, scaffoldProject(), createLocalProject()
│   ├── deploy.ts             # Deploy orchestrator (auto-builds site, routes local/cloud)
│   ├── fn.ts                 # Lambda function CRUD + deploy + create scaffold
│   ├── site.ts               # Static site deployment (deploys build/ directory)
│   ├── storage.ts            # S3 object operations
│   ├── postgres.ts           # Database info (local connection string or cloud)
│   ├── mqtt.ts               # Real-time messaging (cloud only)
│   ├── email.ts              # Email service (cloud only)
│   ├── domain.ts             # Custom domain management
│   ├── image.ts              # AI image generation
│   ├── board.ts              # Kanban board / task management
│   └── ui.ts                 # Web UI server + REST API + Lambda proxy
├── lib/
│   ├── config.ts             # API base URLs, JWT management, ProjectConfig, isLocalTarget()
│   ├── api.ts                # HTTP client: projectApi(), userApi(), boardApi(), requireProjectConfig()
│   ├── updater.ts            # Auto-update mechanism (binary + skill downloads)
│   ├── mime.ts               # Shared MIME type lookup
│   ├── zip.ts                # Shared function directory zip helper
│   └── local/                # Local deployment modules (AWS SDK → LocalStack)
│       ├── client.ts         # Lazy LambdaClient + S3Client singletons
│       ├── lambda.ts         # deployFunction, invokeFunction, listFunctions, deleteFunction
│       ├── storage.ts        # ensureBucket, uploadFile, downloadFile, listObjects, deploySite
│       ├── deploy.ts         # deployLocal() orchestrator (verify infra → storage → functions → build → site)
│       └── index.ts          # Barrel re-exports
└── ui/
    └── index.html            # Web UI frontend (single HTML file, dark theme)
skill/
└── SKILL.md                  # Comprehensive reference Claude gets for building apps (1200+ lines)
templates/
└── project/                  # Scaffold template for new apps
    ├── openkbs.json.template
    ├── package.json           # React + Vite
    ├── vite.config.js         # Dev server + dynamic API proxy + build output
    ├── src/                   # React source (index.html, main.jsx, App.jsx)
    ├── build/                 # Empty dir for Vite output
    ├── functions/api/         # Sample Lambda handler
    └── .claude/CLAUDE.md      # Bootstrap for Claude Code
docker-compose.yml            # LocalStack + PostgreSQL + shared network
```

## Key patterns

### Cloud mode — API calls

All cloud operations go through `projectApi()` in `src/lib/api.ts`:
```typescript
const result = await projectApi(`/projects/${projectId}/fn/${name}`, {
  method: 'POST',
  body: { code: base64Zip, runtime: 'nodejs24.x', memory: 512 },
});
```

### Local mode — AWS SDK via dynamic import

Each command checks `isLocalTarget()` and dynamically imports local modules (so AWS SDK is never loaded in cloud mode):
```typescript
if (isLocalTarget()) {
  const { deployFunction } = await import('../lib/local/lambda.js');
  await deployFunction(config.projectId, name, zipBuffer, opts);
  return;
}
// Existing cloud code unchanged
```

### Deploy orchestrator

`openkbs deploy` does everything:
1. If local: verify infra → create S3 bucket → print Postgres info → deploy functions → `npm run build` → deploy site
2. If cloud: enable storage → enable Postgres → enable MQTT → enable email → provision CloudFront → deploy functions → `npm run build` → deploy site

### Skill system

The `skill/SKILL.md` file is the comprehensive reference that Claude Code gets when working on user apps. It's copied into `.claude/skills/openkbs/` during project creation:
- Dev mode: copied directly from local `skill/` folder
- Compiled binary: downloaded from CDN (`skill.tar.gz`)

### Error handling

Command functions throw errors instead of calling `process.exit()`. The CLI entry point wraps all actions with `wrapAction()` which catches errors and exits. This allows the UI server to call the same functions and return errors as HTTP responses.

### Config endpoints (cloud)

```typescript
const API_BASE = 'https://user.openkbs.com';          // Auth
const PROJECT_API_BASE = 'https://project.openkbs.com'; // Infra provisioning
const BOARD_API_BASE = 'https://board.openkbs.com';    // Kanban board
const PROXY_BASE = 'https://proxy.openkbs.com';        // AI API proxy
```

## Broader context

This CLI is part of the OpenKBS platform ecosystem:

- **openkbs-platform** (private) — AWS backend: Lambda functions for project/user/billing/proxy services, DSQL database, deployed to AWS eu-central-1
- **openkbs-studio** (private) — Web-based IDE with Claude integration (being replaced by Claude Code for the self-hosted version)
- **openkbs-host** (private) — Multi-tenant container orchestration on Hetzner VMs (not needed for self-hosted)
- **openkbs** (this repo, open source) — CLI + local infrastructure + skill + web UI

## Build & distribution

- **Build:** `bun build --compile` creates standalone binaries for 5 platforms (linux/darwin x64/arm64, windows)
- **Also:** `esbuild` bundles to `dist/index.mjs` for npm distribution
- **Skill:** Packaged as `skill.tar.gz` for CDN, or copied from local `skill/` folder in dev mode
- **Install:** `npm install -g openkbs` or via binary download

## Development

```bash
npm install
npm run dev -- ui       # Run UI in development via tsx
npm run dev -- deploy   # Run any CLI command in development
npm run build           # Build ESM bundle with esbuild
```
