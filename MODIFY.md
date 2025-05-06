#### HUMAN-DEFINED REQUIREMENTS

Define any additional features, integrations, or behavior modifications

#### HUMAN-DEFINED REQUIREMENTS END


# OpenKBS Framework Technical Guide (For AI Coding Agents)

This guide provides a brief overview of developing backend and frontend logic for your OpenKBS app/agent.

## Project Structure Overview

A typical OpenKBS project has the following key directories:

*   **`src/`**: Contains your custom source code.
    *   **`Events/`**: Houses backend event handlers.
        *   `actions.js`: Often used to export shared logic/tool definitions, imported by onRequest.js and onResponse.js handlers
        *   `onRequest.js`: Handles incoming user messages before LLM processing.
        *   `onRequest.json`: NPM dependencies for `onRequest.js`.
        *   `onResponse.js`: Handles LLM responses before sending to the user.
        *   `onResponse.json`: NPM dependencies for `onResponse.js`.
        *   `onPublicAPIRequest.js`: Handles unauthenticated public API calls.
        *   `onPublicAPIRequest.json`: Dependencies for `onPublicAPIRequest.js`.
        *   `onAddMessages.js`: Handles messages added via the `chatAddMessages` API.
        *   `onAddMessages.json`: Dependencies for `onAddMessages.js`.
    *   **`Frontend/`**: Contains frontend customization logic.
        *   `contentRender.js`: Custom UI rendering for chat messages, headers, etc.
        *   `contentRender.json`: NPM dependencies for `contentRender.js`.
*   **`app/`**: Application-level configuration.
    *   `settings.json`: Core application settings (model, vendor, etc.).
    *   `instructions.txt`: Instructions for the LLM.
    *   `icon.png`: Application icon.

#### onRequest and onResponse Handlers

The core of the OpenKBS backend framework revolves around the `onRequest` and `onResponse` event handlers.  
These handlers act as middleware, intercepting messages before and after they are processed by the LLM.

* **`onRequest` Handler:** This handler is invoked every time a user sends a message to the chat. It provides an opportunity to pre-process the user's input, extract commands and perform actions based on the user's message. The `onRequest.js` file must export a function that receives `request` and `metadata` parameters and returns a modified request object.

* **`onResponse` Handler:** This handler is invoked after the LLM generates a response. It allows post-processing of the LLM's output, execution of commands based on the LLM's intentions. The `onResponse.js` file must export a function that receives `response` and `metadata` parameters and returns a modified response object.

#### NPM Dependencies for Handlers

**Important**: Each handler has its own Node.js build process, which means:

1. When `actions.js` uses an NPM dependency (e.g., axios, lodash), this dependency must be defined in all handler JSON files that import `actions.js`.

2. Dependencies are declared in the corresponding JSON files:
   - `onRequest.json` for the `onRequest.js` handler
   - `onResponse.json` for the `onResponse.js` handler
   - Any other handler JSON files that import shared code

3. Each handler is built separately, so shared code like `actions.js` gets bundled into each handler that imports it.

**Example**: If `actions.js` uses `axios` and is imported by both `onRequest.js` and `onResponse.js`, then `axios` must be declared in both `onRequest.json` and `onResponse.json`.


## Backend Dependencies

To use external NPM packages in your backend event handlers, you must declare them in the corresponding `.json` file.

**Example: Using axios with an API key**

1. **Declare dependencies** in both `src/Events/onRequest.json` and `src/Events/onResponse.json` (as each handler have separate build):
    ```json
    {
      "dependencies": {
        "axios": "^1.6.2"
      }
    }
    ```

2.  **Implement and use in `src/Events/actions.js`**:
    ```javascript
    import axios from 'axios';

    export const getActions = (meta) => {
        return [
            [/\/?getNews\("(.*)"\)/, async (match) => {
                const topic = match[1];
                const response = await axios.get('https://newsapi.org/v2/everything', {
                    params: {
                        q: topic,
                        apiKey: '{{secrets.news_api_key}}' // Securely injected at runtime
                    }
                });
                return { result: response.data.articles, ...meta };
            }],
            // ... other actions
        ];
    };
    ```
    
## Secrets Management
OpenKBS provides a secure way to handle sensitive information using the `{{secrets.your_secret_name}}` syntax.
Never hardcode secrets in the code, if any secrets are provided by the user replace them with syntax above.
The user will later insert the values using the secrets manager
#### LLM Instructions
`app/instructions.txt`
This file contains the instructions for the agent

**Example Instructions:**

```
You are an AI assistant.

You can execute the following commands:

/getNews("query")
Description: """
Get the latest news
"""
```