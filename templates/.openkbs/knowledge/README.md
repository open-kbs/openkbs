# OpenKBS Agent Development Guidelines

## MANDATORY FIRST STEP
**READ EVERY SINGLE FILE IN THE EXAMPLES FOLDER**

Read the content of ALL files in `.openkbs/knowledge/examples/` directory and ALL subdirectories (without the icon.png)

## Development Flow

1. **Read ALL example files first** to get familiar with OpenKBS framework for building AI agents
2. **Read existing agent code:**
   - `./app/` folder (settings, instructions, etc.)
   - `./src/` folder (all Events and Frontend files)
   - `./run_job.js` any files starting with "run"
3. **Implement requested features using knowledge from examples**


## **Critical** Rules (**IMPORTANT**)
- Never skip reading examples
- Study the complete working examples to understand OpenKBS patterns
- Never guess framework methods, settings or variables — always reference the examples.
- Think hard before the implementation

## Development Guidelines
- If develop new agent from scratch, implement the run_job.js script to provide a backend-to-backend agent invocation
- To add npm dependency to backend handlers, add it to onRequest.json and onResponse.json
- To add npm dependency to the frontend, add it to contentRender.json
- Valid values for the _meta_actions key are [] or ["REQUEST_CHAT_MODEL"].
- Add and use npm dependencies only if necessary, some of those shown in the examples are purely demonstrative

### Backend
The OpenKBS backend framework is for developing AI agents with custom tools, using Node.js. It integrates with chat services via `onRequest` and `onResponse` handlers for custom actions and service integration.

#### Backend Handlers
The framework's core uses `onRequest` and `onResponse` handlers as middleware for message tool call parsing and execution.
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


### Frontend Overview
The OpenKBS frontend framework, built with React and MUI, offers a flexible platform for custom chat interfaces. Developers can customize chat appearance and behavior via the `contentRender` module.

#### contentRender
The `contentRender.js` file is central to frontend customization, exporting key functions for interface adjustments.
- **`onRenderChatMessage(params)`:** function called every time a chat message is rendered.

