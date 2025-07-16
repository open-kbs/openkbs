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
- Implement the run_job.js script to provide a backend-to-backend agent invocation
- To add npm dependency to backend handlers, add it to onRequest.json and onResponse.json
- To add npm dependency to the frontend, add it to contentRender.json
- Valid values for the _meta_actions key are [] or ["REQUEST_CHAT_MODEL"].
If the `_meta_actions` key is set to `["REQUEST_CHAT_MODEL"]`, it prompts the model to right after the response. Without this flag, the chat would stop.
- Add and use npm dependencies only if necessary, some of those shown in the examples are purely demonstrative
- Feel free to install new dependencies and integrate them into both the backend and frontend as needed.

