# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, you must:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read all files in `.openkbs/knowledge/examples/` directory and subdirectories using the Read tool (skip icon.png, src/Frontend/Presentational/*, src/Events/Helpers/*).

**THIRD**: Read existing agent code in `./app/` and `./src/` folders.

# Critical Rules
- Never skip reading examples
- Never guess framework methods, settings or variables — always reference the examples
- In src/Events and src/Frontend always use Imports (not Require)
- Valid values for `_meta_actions` key are `[]` or `["REQUEST_CHAT_MODEL"]`
- Add npm dependencies only if necessary
- Before using third-party services in handlers, ask the user for permission

# Architecture Overview

OpenKBS provides **two execution environments**:

## Cloud Environment (`./src/Events/`)
Runs in serverless compute (stateless, ephemeral). Can only reach internet-accessible resources.

### Backend Handlers
- **`onRequest`**: Triggered on user message, allows pre-processing
- **`onResponse`**: Activated after LLM response, enables command extraction and action execution

### NPM Dependencies
Add dependencies to the handler's JSON file:
```json
// onResponse.json or onRequest.json
{
  "dependencies": {
    "mysql2": "latest"
  }
}
```

### Secrets Management
Use `{{secrets.KEY}}` placeholders in code:
```javascript
const key = "{{secrets.KEY}}"
```

**Workflow**:
1. Write code using `{{secrets.SECRET_NAME}}` placeholders
2. Deploy with `openkbs push`
3. Direct user to set secrets: `https://[kbId].apps.openkbs.com/?add_secrets=SECRET_NAME1,SECRET_NAME2`

## Browser Environment (`./src/Frontend/`)
Runs in user's browser at `https://[kbId].apps.openkbs.com`. React-based UI customization.

### contentRender
The `contentRender.js` exports functions for interface customization:
- **`onRenderChatMessage(params)`**: Called when rendering each chat message

### NPM Dependencies
Add frontend dependencies to `contentRender.json`.

# OpenKBS Commands
- `openkbs create my-agent` - Create new agent directory structure
- `openkbs push` - Deploy agent to OpenKBS cloud
- `openkbs update` - Update knowledge base

# Development Guidelines
- To add backend npm dependency, add to `onRequest.json` or `onResponse.json`
- To add frontend npm dependency, add to `contentRender.json`
- Provide README.md for the agent
