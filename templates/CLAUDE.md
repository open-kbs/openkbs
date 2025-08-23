# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, implementing ANY feature, planing the implementation or answering ANY question about this project, you must perform the following steps:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read every single file in the examples folder using the Read tool:
- First discover all files in the `.openkbs/knowledge/examples/` directory and ALL subdirectories.
- Then, use the Read tool to examine the content of EACH file individually (skip only icon.png files, src/Frontend/Presentational/* and src/Events/Helpers/*).
- You must read ALL files directly

**THIRD**: Read existing agent code using the Read tool:
- First discover all files in the `./app/`, `./src/`, and `./scripts/` folders.
- Then, use the Read tool to examine each file individually

# OpenKBS Agent Development Guidelines

## **Critical** Rules (**IMPORTANT**)
- Never skip reading examples
- Study the complete working examples to understand OpenKBS patterns
- Never guess framework methods, settings or variables — always reference the examples.

## FIRST DECISION: Execution Context Analysis

** BEFORE writing ANY code, you MUST answer these questions IN ORDER:**

1. **Where will this code execute?** (Cloud or Local)
2. **What resources does it need to access?** (List each: databases, APIs, files, etc.)
3. **Where does each resource exist?** (Public internet, local network, specific machine)
4. **Can the execution environment reach each resource?** (Network path exists?)

**You MUST show your reasoning for these 4 questions before any code implementation.**

## Development Guidelines
- To add npm dependency to backend handlers, add it to onRequest.json and onResponse.json
- In src/Events and src/Frontend always use Imports (not Require)
- To add npm dependency to the frontend, add it to contentRender.json
- Valid values for the _meta_actions key are [] or ["REQUEST_CHAT_MODEL"]
- Add and use npm dependencies only if necessary, some of those shown in the examples are purely demonstrative
- If developing new agent, generate it's own ./scripts/run_job.js
- Before using third-party services in onRequest and onResponse handlers, ask the user for permission
- provide README.md

## Architecture Overview: Execution Environments Define Everything

OpenKBS provides **three distinct execution environments**, each with different capabilities and constraints:

### Execution Environment Reality Check

**Cloud Environment (`./src/Events/`):**
- Runs in serverless compute service for running code (stateless, ephemeral)
- No localhost, no local filesystem, no persistent state
- Can ONLY reach internet-accessible resources
- Each execution is isolated and temporary

**Browser Environment (`./src/Frontend/`):**
- Runs in user's browser when visiting https://[kbId].apps.openkbs.com
- React-based UI customization
- Subject to browser security constraints

**Local Environment (`./scripts/`) - Optional but Powerful:**
- Runs on YOUR machine with YOUR network context
- Can access YOUR localhost, files, and local services
- Enables advanced patterns: multi-agent orchestration, local resource integration
- Not required for simple agents, but unlocks complex workflows

### The Fundamental Rule
**Before writing ANY code, ask: Where does this run and what can it reach?**

### Backend
The OpenKBS backend framework is for developing AI agents with custom tools, using Node.js.
It integrates with openkbs chat service via `onRequest` and `onResponse` handlers for custom actions and service integration.

#### Backend Handlers (Cloud Environment)
The OpenKBS framework's core uses `onRequest` and `onResponse` handlers as middleware for message tool call parsing and execution.
These handlers run in the cloud environment.
- **`onResponse` Handler:** Activated after the LLM generates a message, enabling command extraction, and action execution.
- **`onRequest` Handler:** Triggered on user message to allow the user to execute action

#### NPM Dependencies for onRequest.js or onResponse.js Backend Handlers (Cloud → Public resources)
1. If a file imports an NPM dependency and is then imported by onRequest.js or onResponse.js, this dependency must be defined in the handler's corresponding json file
   Example: If actions.js imports mysql2 and onResponse.js imports actions.js, then mysql2 must be in onResponse.json:
   {
   "dependencies": {
   "mysql2": "latest"
   }
   }

Similarly, we need to create onRequest.json for onRequest.js as each handler have separate Node.js build with separate dependencies

#### Managing Secrets for Backend Handlers
Secrets securely store credentials that allow Backend Handlers to access external services like databases, APIs, etc.
Example:
`const key = "{{secrets.KEY}}"`

**Workflow**:
1. Write code using {{secrets.SECRET_NAME}} placeholders
2. Deploy agent with `openkbs push` (generates kbId in settings.json)
3. Prompt developer to define secrets: `Please set your credentials at: https://[kbId].apps.openkbs.com/?add_secrets=SECRET_NAME1,SECRET_NAME2`

**Example**: For MySQL connection requiring {{secrets.DB_HOST}}, {{secrets.DB_USER}}, {{secrets.DB_PASS}}:
`Please define your database credentials: https://[kbId].apps.openkbs.com/?add_secrets=DB_HOST,DB_USER,DB_PASS`

**Important**
Secrets syntax above is only applicable for all src/Events/* files, and NOT for User-Run Scripts

#### User-Run Scripts (Local Environment)
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

#### NPM Dependencies for User-Run Scripts (Local → Public + Private resources)
Add needed NPM dependencies to `package.json`
Example: Script connecting to local MySQL:
```json
{
   "dependencies": {
      "mysql2": "latest",
      "dotenv": "latest"
   }
}
```
Run `npm install` before executing scripts.

### Frontend Overview
The OpenKBS frontend framework, built with React and MUI, offers a flexible platform for custom chat interfaces. Developers can customize chat appearance and behavior via the `contentRender` module.

#### contentRender
The `contentRender.js` file is central to frontend customization, exporting key functions for interface adjustments.
- **`onRenderChatMessage(params)`:** function called every time a chat message is rendered.

#### OpenKBS commands
`openkbs create my-agent` - creates a directory structure for a new agent
`openkbs push` - after completing changes to your agent, use this command to deploy it to the OpenKBS cloud.
`node scripts/run_job.js init` - execute right after `openkbs push` to configure the API Key before running the job for the specific agent.

### Creating Related Agents
To create related agents that work alongside the main agent:

1. **Create in related-agents/ folder**: `cd related-agents && openkbs create agent-name`
2. **Each related agent gets**: Own `app/settings.json`, `src/` folder, and `.openkbs/secrets.json`
3. **Script usage**: Related agents use their own `agent_client.js` located in their subdirectory, ensuring they access their own settings and secrets file.
4. **Multi-agent workflows**: Scripts can orchestrate multiple agents by creating separate client instances

Related agents are independent but can share the base agent's script utilities.

## OpenKBS Agent Architecture: From Single Agent to Complex Orchestration

### Core Architecture Philosophy

OpenKBS enables everything from simple single-agent automation to sophisticated multi-agent systems through a **dual-environment architecture** that seamlessly combines **cloud-based autonomous agents** with **local orchestration scripts**.

### Understanding Where Code Runs

**The fundamental principle**: Cloud agents operate in cloud infrastructure, local scripts run on your machine. This separation enables powerful patterns:

**Cloud agents (serverless functions)** can access:
- Internet-reachable services only
- Public APIs and databases
- Any service with a public endpoint

**Local scripts (on your machine)** can access:
- Local resources (localhost, 127.0.0.1, local files)
- Cloud agents via API calls
- Both local and internet resources

**Architecture emerges from execution context**: When resources exist only locally, the architecture naturally becomes: Local Script → Cloud Agent (processing) → JSON → Local Script → Local Resource

### Advanced Pattern: Tool Composition (When Needed)

Since cloud agent tools are code, you can create composite tools when facing repetitive multi-step operations.
This is useful when an agent would otherwise need many interaction cycles for a single logical operation.

**Use sparingly**: Only create composite tools when they significantly reduce agent interactions or when domain logic requires atomic operations.

### The Powerful Two-Environment System

#### 1. Cloud Environment (Autonomous Agent Execution)
**Location**: `./src/Events/` - Deployed via `openkbs push`  
**Purpose**: Autonomous agent execution with intelligent decision-making

**Capabilities**:
- Autonomous multi-step workflows with decision branching
- Integration with ANY internet-accessible service (public or private)
- Secure credential management via {{secrets.KEY}} system
- Sequential tool call execution based on intermediate results
- Complex data extraction and structured JSON responses
- Access to cloud databases, public APIs, web services with proper credentials

**Agent Execution Flow**:
```
User Message → Agent Processes → Tool Call 1 → Analyze Result → Decision → Tool Call 2 → ... → Final JSON Response
```

**Key Insight**: Cloud agents can securely connect to APIs, and any service that have public IPs/URLs

#### 2. Local Environment (Orchestration & Local Services)
**Location**: `./scripts/` - Execute locally with `node`  
**Purpose**: Agent orchestration and local infrastructure integration

**Capabilities**:
- Orchestrate multiple cloud agents in complex workflows
- Direct access to local services (localhost databases, file systems)
- Dynamic workflow creation based on agent responses
- Parallel and sequential agent coordination
- Local credential management via .env files
- Bridge between cloud intelligence and local infrastructure

### Why This Architecture Matters

#### Key Architectural Insights
- **Cloud agents** = Autonomous intelligence with internet access
- **Local scripts** = Infrastructure control and orchestration
- Scripts call agents via API, agents return JSON, scripts handle the rest

### Orchestration Patterns

Whether using a single agent or multiple agents, common patterns include:

1. **Single Agent**: Script → Agent → Process Result → Store/Act
2. **Hierarchical**: Script → Discovery Agent → N Results → Spawn N Detail Agents → Aggregate
3. **Pipeline**: Script → Agent A → Agent B (uses A's output) → Agent C → Final Result
4. **Event-Driven**: Database Change → Script Detects → Triggers Appropriate Agent(s)
5. **Parallel**: Script → [Agent A, Agent B, Agent C] simultaneously → Combine Results
6. **Database Integration**: Script reads local DB → Sends data to Agent → Agent processes → Returns JSON → Script stores in local DB


### Understanding the Architecture

#### Cloud Agents (The Intelligence Layer)
**This is where ALL agentic flow happens:**
- Agents execute autonomously in the cloud
- Users can login to the chat UI at `https://[kbId].apps.openkbs.com` to monitor execution
- Each message and tool call is visible in the chat interface
- Agents make decisions, call tools, and process data autonomously
- The agent IS the intelligence - it thinks, decides, and acts

#### Local Scripts (The Orchestration Layer)
**Scripts are API clients that:**
- Call cloud agents via API
- Receive the final JSON result after agent completes its autonomous flow
- Handle local infrastructure (databases, files)
- Orchestrate multiple agent calls
- Process and route results between agents


### Security & Best Practices

#### Cloud Security
- Use {{secrets.KEY}} for all sensitive credentials
- Secrets are encrypted and never exposed in code
- Each agent can have its own set of secrets
- Supports database passwords, API keys, OAuth tokens

#### Local Security
- Use .env files for local credentials
- Keep local scripts in private repositories
- Implement proper error handling and logging
- Use database transactions for consistency

### Summary

OpenKBS enables building sophisticated AI systems where:
- Cloud agents provide autonomous intelligence
- Local scripts orchestrate workflows and handle infrastructure
- You maintain full control while agents think and act independently


