# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, implementing ANY feature, planing the implementation or answering ANY question about this project, you must perform the following steps:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read every single file in the examples folder using the Read tool:
- First list all files (every single file) in the `.openkbs/knowledge/examples/` directory and ALL subdirectories.
- Then, use the Read tool to examine the content of every file individually (skip only icon.png files).
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
These handlers run in the cloud environment, which means they cannot connect to localhost services without a public IP.
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

#### Managing Secrets for Backend Handlers
Secrets securely store credentials that allow Backend Handlers to access external services like databases, APIs, etc.
Use {{secrets.SECRET_NAME}} syntax to reference them in the backend code securely.

**Workflow**:
1. Write code using {{secrets.SECRET_NAME}} placeholders
2. Deploy agent with `openkbs push` (generates kbId in settings.json)
3. Prompt developer to define secrets: `Please set your credentials at: https://[kbId].apps.openkbs.com/?add_secrets=SECRET_NAME1,SECRET_NAME2`

**Example**: For MySQL connection requiring {{secrets.DB_HOST}}, {{secrets.DB_USER}}, {{secrets.DB_PASS}}:
`Please define your database credentials: https://[kbId].apps.openkbs.com/?add_secrets=DB_HOST,DB_USER,DB_PASS`

**Important**
Secrets syntax above is only applicable for all src/Events/* files, and NOT for User-Run Scripts

#### User-Run Scripts
User-run scripts are located in the `./scripts/` folder and communicate with cloud agents via API calls.
They execute locally, receiving the final result of the agent's flow as an API response.
This setup allows seamless interaction with local services, such as a MySQL database, directly on the user's machine.
To handle secrets in user-defined scripts, define them in a `.env` file and load them using the `dotenv` package.

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
Add needed NPM dependencies to `package.json`
Run `npm install` before executing scripts.

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
3. **Script usage**: Related agents use their own `agent_client.js` located in their subdirectory, ensuring they access their own settings and secrets file.
4. **Multi-agent workflows**: Scripts can orchestrate multiple agents by creating separate client instances

Related agents are independent but can share the base agent's script utilities.

## Agent Workflow Patterns

### Pattern 1: Result-Based Integration (Cloud → Local)
**Architecture**: User-run script calls cloud agent → Agent performs autonomous research/processing → Returns structured data → Script handles local infrastructure operations

**Use Cases**:
- Local system operations (no need to store credentials in OpenKBS cloud)
- On-premises system integration
- Post-processing workflows requiring local resources
- Database-driven queries where script fetches context first

**Technical Flow**:
```
User Script → Cloud Agent → Process & Return JSON → Local Infrastructure
```

**Variation - Database-Driven Query**:
```
User Script → Query Local/On-premises DB → Compose Agent Request → Cloud Agent → Process → Store Result in Local DB
```

### Pattern 2: Tool-Based Integration (Cloud ↔ External Services)
**Architecture**: Cloud agent directly interacts with external services via tool calls during autonomous execution

**Use Cases**:
- Multi-step research requiring intermediate queries
- Dynamic workflows based on external data
- Real-time validation against external sources
- Iterative processes with decision branching

**Technical Flow**:
```
Cloud Agent → Tool Call → External Service → Response → Agent Decision → Next Action
```

**Requirements**:
- Services must be internet-accessible
- Credentials stored in OpenKBS secrets ({{secrets.KEY}})
- Defined in Backend event handlers (onResponse.js/onRequest.js)

### Architectural Principles

1. **Separation of Concerns**: Use Pattern 1 when you want to separate cloud processing from local infrastructure operations

2. **Autonomous Workflows**: Use Pattern 2 when the agent needs to make decisions based on external data during execution

3. **Hybrid Approach**: Combine patterns - use Pattern 2 for research/validation, Pattern 1 for final local storage

4. **Security Consideration**: Pattern 1 keeps all credentials local; Pattern 2 requires cloud-stored secrets

### Implementation Guidelines
- Choose pattern based on WHERE the service lives (local vs public)
- Consider WHEN the agent needs the data (during execution vs final result)
- Avoid redundant operations across patterns
