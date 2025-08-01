# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, implementing ANY feature, planing the implementation or answering ANY question about this project, you must perform the following steps:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read every file in the examples folder using the Read tool:
- First discover all files in the `.openkbs/knowledge/examples/` directory and ALL subdirectories.
- Then, use the Read tool to examine the content of EACH file individually (skip only icon.png files).
- You must read ALL files directly

**THIRD**: Read existing agent code using the Read tool:
- First discover all files in the `./app/`, `./src/`, and `./scripts/` folders.
- Then, use the Read tool to examine each file individually

# OpenKBS Agent Development Guidelines

## **Critical** Rules (**IMPORTANT**)
- Never skip reading examples
- Study the complete working examples to understand OpenKBS patterns
- Never guess framework methods, settings or variables — always reference the examples.

## Development Guidelines
- To add npm dependency to backend handlers, add it to onRequest.json and onResponse.json
- In src/Events and src/Frontend always use Imports (not Require)
- To add npm dependency to the frontend, add it to contentRender.json
- Valid values for the _meta_actions key are [] or ["REQUEST_CHAT_MODEL"]
- Add and use npm dependencies only if necessary, some of those shown in the examples are purely demonstrative
- If developing new agent, generate it's own ./scripts/run_job.js
- Before using third-party services in onRequest and onResponse handlers, ask the user for permission

## Architecture Overview
OpenKBS agents have **two execution environments**:

### 1. Cloud Environment (`./src/`)
- **Event handlers** (`onRequest.js`, `onResponse.js`) run on OpenKBS cloud platform
- **Purpose**: Process user messages, execute AI actions, return responses
- **Deployment**: Code is deployed via `openkbs push`

### 2. Local Environment (`./scripts/`)
- **User-run scripts** execute locally on user's machine
- **Purpose**: Call cloud agents via API, orchestrate multi-agent workflows, integrate with external systems
- **Execution**: Run directly with `node scripts/script-name.js`

### Backend
The OpenKBS backend framework is for developing AI agents with custom tools, using Node.js.
It integrates with openkbs chat service via `onRequest` and `onResponse` handlers for custom actions and service integration.

#### Backend Handlers
The OpenKBS framework's core uses `onRequest` and `onResponse` handlers as middleware for message tool call parsing and execution.
All these event handlers are executed on-demand (upon API request) by the OpenKBS cloud platform, where user production agents are deployed.
- **`onResponse` Handler:** Activated after the LLM generates a message, enabling command extraction, and action execution.
- **`onRequest` Handler:** Triggered on user message to allow the user to execute action

#### NPM Dependencies for onRequest.js or onResponse.js Backend Handlers
1. If a file imports an NPM dependency and is then imported by onRequest.js or onResponse.js, this dependency must be defined in the handler's corresponding json file
   Example: If actions.js imports mysql2 and onResponse.js imports actions.js, then mysql2 must be in onResponse.json:
   {
   "dependencies": {
   "mysql2": "^3.14.2"
   }
   }

Similarly, we need to create onRequest.json for onRequest.js as each handler have separate Node.js build with separate dependencies

#### Managing Secrets
To securely manage sensitive information like API keys or database passwords within your backend event handlers (onRequest, onResponse, etc.), use the {{secrets.your_secret_name}} syntax.

#### User-Run Scripts
**User-run scripts** are located in `./scripts/` folder and communicate with cloud agents via API calls.

**Key Components:**
- `scripts/run_job.js` - Main job runner for calling the cloud agent
- `scripts/utils/agent_client.js` - Shared utility using `OpenKBSAgentClient` class
- Custom workflow scripts for multi-agent orchestration

**Architecture:**
- Scripts use `OpenKBSAgentClient` to communicate with deployed cloud agents
- **Path Resolution**: Automatically finds `app/settings.json` and `.openkbs/secrets.json` by walking up directories
- **Usage**: `const client = new OpenKBSAgentClient(); await client.runJob(message);`
- **Multi-agent support**: Each agent (base or related) finds its own settings and secrets in its directory structure

#### NPM Dependencies for User-Run Scripts
Add needed NPM dependencies to `package.json`.

### Frontend Overview
The OpenKBS frontend framework, built with React and MUI, offers a flexible platform for custom chat interfaces. Developers can customize chat appearance and behavior via the `contentRender` module.

#### contentRender
The `contentRender.js` file is central to frontend customization, exporting key functions for interface adjustments.
- **`onRenderChatMessage(params)`:** function called every time a chat message is rendered.

#### OpenKBS commands
`openkbs push` - after completing changes to your agent, use this command to deploy it to the OpenKBS cloud.
`openkbs create my-agent` - creates a directory structure for a new agent

### Creating Related Agents
To create related agents that work alongside the main agent:

1. **Create in related-agents/ folder**: `cd related-agents && openkbs create agent-name`
2. **Each related agent gets**: Own `app/settings.json`, `src/` folder, and `.openkbs/secrets.json`
3. **Script usage**: Related agents use same `OpenKBSAgentClient` - it automatically finds their settings and secrets
4. **Multi-agent workflows**: Scripts can orchestrate multiple agents by creating separate client instances

Related agents are independent but can share the base agent's script utilities.
