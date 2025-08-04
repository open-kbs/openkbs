# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, implementing ANY feature, planing the implementation or answering ANY question about this project, you must perform the following steps:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read every single file in the examples folder using the Read tool:
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

## OpenKBS Multi-Agent Architecture: The Complete Framework

### Core Architecture Philosophy

OpenKBS enables sophisticated multi-agent systems through a **dual-environment architecture** that seamlessly combines **cloud-based autonomous agents** 
with **local orchestration scripts**, creating a powerful framework for complex AI workflows.

### The Two-Environment System

#### 1. Cloud Environment (Autonomous Agent Execution)
**Location**: `./src/Events/` - Deployed via `openkbs push`  
**Purpose**: Autonomous agent execution with intelligent decision-making

**Capabilities**:
- Autonomous multi-step workflows with decision branching
- Integration with ANY internet-accessible service (public or private)
- Secure credential management via {{secrets.KEY}} system
- Sequential tool call execution based on intermediate results
- Complex data extraction and structured JSON responses
- Access to databases, APIs, web services with proper credentials

**Agent Execution Flow**:
```
User Message → Agent Processes → Tool Call 1 → Analyze Result → Decision → Tool Call 2 → ... → Final JSON Response
```

**Key Insight**: Cloud agents securely connect to APIs, databases servers, and any internet services (with public IP) using the secrets system.

#### 2. Local/onPremises Environment (Orchestration & Local Services)
**Location**: `./scripts/` - Execute locally (onPremises) with `node`  
**Purpose**: Agent orchestration and local infrastructure integration

**Capabilities**:
- Orchestrate multiple cloud agents in complex workflows
- Direct access to local services (localhost databases, file systems)
- Dynamic workflow creation based on agent responses
- Parallel and sequential agent coordination
- Local credential management via .env files
- Bridge between cloud intelligence and local infrastructure

### Why This Architecture Matters

#### The Power of Separation
1. **Cloud Agents Focus on Intelligence**: Agents handle complex reasoning, research, and decision-making
2. **Local Scripts Handle Infrastructure**: Scripts manage databases, files, and orchestration
3. **Best of Both Worlds**: Cloud scalability + local control

#### Key Architectural Insight
The real power comes from understanding WHEN to use each environment:
- **Cloud**: When you need autonomous intelligence and internet access
- **Local**: When you need direct infrastructure control or complex orchestration

### Multi-Agent Orchestration Patterns

#### Pattern 1: Hierarchical Discovery & Processing
```
Local Script → Brand Discovery Agent → Returns 3 Brands → Local Script Stores in DB → 
→ Spawns 3 Product Agents (parallel) → Each Returns 5 Products → Local Script Stores All
```
**Real Example**: Category research that scales dynamically based on discoveries

#### Pattern 2: Pipeline Processing with Enrichment
```
Local Script → Data Extraction Agent → Raw Data → 
→ Analysis Agent (with context) → Insights → 
→ Report Generation Agent → Final Report → Local Storage
```
**Real Example**: Multi-stage document processing with progressive enhancement

#### Pattern 3: Event-Driven Agent Swarms
```
Database Event → Trigger Script → Spawns N Agents Based on Event Type → 
→ Agents Process in Parallel → Results Aggregated → Database Updated → Next Event
```
**Real Example**: Real-time monitoring systems with intelligent response

#### Pattern 4: Feedback Loop Systems
```
Local Monitoring → Detect Anomaly → Research Agent → Findings → 
→ Decision Agent → Action Plan → Execution Agent → Update Local System → Loop
```
**Real Example**: Self-improving systems with continuous learning

### Advanced Implementation Techniques

#### Dynamic Agent Spawning
```javascript
// Orchestrator dynamically creates agent instances based on discovered data
const categories = await discoveryAgent.runJob('Find all product categories');
const agentPool = categories.map(cat => ({
    agent: new OpenKBSAgentClient(), // Each gets its own instance
    category: cat
}));

// Process all categories in parallel with controlled concurrency
const results = await Promise.all(
    agentPool.map(({agent, category}) => 
        agent.runJob(`Research top products in ${category}`)
    )
);
```

#### State Machine Orchestration
```javascript
// Complex workflows with state management
class WorkflowOrchestrator {
    async processOrder(orderId) {
        let state = 'INIT';
        const context = { orderId, results: {} };
        
        while (state !== 'COMPLETE') {
            switch(state) {
                case 'INIT':
                    context.results.validation = await validationAgent.runJob(`Validate order ${orderId}`);
                    state = context.results.validation.valid ? 'ENRICH' : 'FAILED';
                    break;
                case 'ENRICH':
                    context.results.enrichment = await enrichmentAgent.runJob(`Enrich order data`, context);
                    state = 'PROCESS';
                    break;
                case 'PROCESS':
                    const promises = context.results.enrichment.items.map(item =>
                        processingAgent.runJob(`Process item ${item.id}`)
                    );
                    context.results.processed = await Promise.all(promises);
                    state = 'COMPLETE';
                    break;
            }
        }
        return context;
    }
}
```

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

### Real-World Architecture Examples

#### Example 1: E-commerce Intelligence System
```
1. Local script monitors database for new product categories
2. Discovery agent researches market trends for each category
3. Local script spawns competitor analysis agents (parallel)
4. Each agent accesses private APIs (using cloud secrets) for pricing data
5. Local script aggregates results and updates local PostgreSQL
6. Notification agent sends summary to stakeholders
```

#### Example 2: Document Processing Pipeline
```
1. Local script watches folder for new documents
2. OCR agent (cloud) extracts text from images
3. Classification agent determines document type
4. Multiple specialized agents process based on type (parallel)
5. Validation agent cross-references with external APIs
6. Local script stores processed data in MongoDB
```

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

### The Power of OpenKBS

This architecture enables:
1. **Unlimited Scalability**: Spawn thousands of agents dynamically
2. **Complex Intelligence**: Agents make decisions autonomously
3. **Infrastructure Freedom**: Integrate with any local or cloud service
4. **Rapid Development**: Reusable agents and orchestration patterns
5. **Cost Efficiency**: Pay only for agent execution time

The key insight: **You're not just calling APIs, you're orchestrating intelligent agents that can think, decide, and act autonomously while you maintain complete control over your infrastructure.**
