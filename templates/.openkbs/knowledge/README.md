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
- Never guess framework methods, settings or variables — always reference the examples.
- Study the complete working applications in examples to understand OpenKBS patterns
- Example agents are thoroughly tested and offer stable UI and backend tools. You are encouraged to extend them or implement similar patterns. However, strive to adhere closely to or reuse implementations from the examples folder, as they are well-tested and reliable.
- Avoid excessive experimentation.
- Think hard before the implementation

## Development Tips
- When trying to parse JSON data in onRenderChatMessage, keep in mind that it may be mixed with free text from the agent, so implement extractJSONFromText function provided in the examples.

## Framework Documentation

### Directory Structure

```
src/

Events/
    actions.js // Common actions for onRequest and onResponse
    onRequest.js // Handles incoming user messages
    onResponse.js // Handles outgoing LLM messages
    onPublicAPIRequest.js // Handles public API requests
    onAddMessages.js // Handles messages added to the chat (NEW)
    onRequest.json // Dependencies for onRequest handler
    onResponse.json // Dependencies for onResponse handler
    onPublicAPIRequest.json // Dependencies for onPublicAPIRequest handler
    onAddMessages.json // Dependencies for onAddMessages handler (NEW)
Frontend/
    contentRender.js // Custom rendering logic for chat messages
    contentRender.json // Dependencies for the contentRender module
app/
    icon.png // Application icon
    settings.json // Application settings
    instructions.txt // LLM instructions
```

### Backend
The OpenKBS backend framework is for developing AI agents with custom tools, using Node.js. It integrates with chat services via `onRequest` and `onResponse` handlers for custom actions and service integration.

#### Backend Handlers
The framework's core uses `onRequest` and `onResponse` handlers as middleware for message tool call parsing and execution.
- **`onResponse` Handler:** Activated after the LLM generates a message, enabling command extraction, and action execution.
- **`onRequest` Handler:** Triggered on user message to allow the user to execute action

#### NPM Dependencies for Backend Handlers

1. If a file imports an NPM dependency and is then imported by a handler, this dependency must be defined in the handler's corresponding json file
Example: If actions.js imports mysql2 and onResponse.js imports actions.js, then mysql2 must be in onResponse.json:
{
   "dependencies": {
      "mysql2": "^3.14.2"
   }
}

Similarly, we need to create onRequest.json for onRequest.js as each handler have separate Node.js build with separate dependencies
   
### Frontend Overview
The OpenKBS frontend framework, built with React, offers a flexible platform for custom chat interfaces. Developers can customize chat appearance and behavior via the `contentRender` module.

#### contentRender

The `contentRender.js` file is central to frontend customization, exporting key functions for interface adjustments.
- **`onRenderChatMessage(params)`:** function called every time a chat message is rendered.
onRenderChatMessage should return a React component or string representing the rendered message.
If function is not defined or return undefined, the default rendering mechanism is used.

### settings.json itemTypes

Each item type has:
- **Embedding Template**: Defines how text fields are combined, using placeholders like `${item.title}`.

#### Attributes
Each attribute includes:
- **label**: Descriptive name.
- **placeholder**: Placeholder text.
- **encrypted**: `true` or `false`.
- **attrName**: Attribute name.
- **attrType**: Unique type, e.g., `keyword1`, `text1`.

#### Attribute Types
- **keyword**: `keyword1`, `keyword2`, ...
- **text**: `text1`, `text2`, ...
- **integer**: `integer1`, `integer2`, ...
- **boolean**: `boolean1`, `boolean2`, ...
- **float**: `float1`, `float2`, ...
- **date**: `date1`, `date2`, ...
- **long**: `long1`, `long2`, ...
- **double**: `double1`, `double2`, ...

Each `attrType` must have unique suffix number per type.
