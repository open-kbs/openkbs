#### HUMAN-DEFINED REQUIREMENTS

Define any additional features, integrations, or behavior modifications

#### HUMAN-DEFINED REQUIREMENTS END


# OpenKBS Framework Technical Guide (For AI Coding Agents)

This guide provides a brief overview of developing backend and frontend logic for your OpenKBS app/agent.

## Project Structure Overview

A typical OpenKBS project has the following key directories:

*   **`src/`**: Contains your custom source code.
    *   **`Events/`**: Houses backend event handlers.
        *   `actions.js`: Example file for shared logic. You can create any JS files here, not just actions.js.
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

**Important**: Files with names starting with "on" (like onRequest.js) are entry points for Node.js builds:

1. Each handler has its own build process
2. If a file imports node-fetch, then node-fetch must be in that handler's JSON file
3. Example: If utils.js uses node-fetch and is imported by onRequest.js, then node-fetch must be in onRequest.json


## Backend Dependencies

To use external NPM packages in your backend event handlers, you must declare them in the corresponding `.json` file.

**Example: Using node-fetch with an API key**

1. **Declare dependencies** in both `src/Events/onRequest.json` and `src/Events/onResponse.json` (as each handler have separate build):
    ```json
    {
      "dependencies": {
        "node-fetch": "^2.6.7"
      }
    }
    ```

2.  **Implement in any JavaScript file** (actions.js is just an example name):

```javascript
export const getActions = (meta) => {
    return [
        [/\/?getNews\("(.*)"\)/, async (match) => {
            const topic = match[1];
            const url = new URL('https://newsapi.org/v2/everything');
            url.searchParams.append('q', topic);
            url.searchParams.append('apiKey', '{{secrets.news_api_key}}'); // Securely injected at runtime by secret manager
            
            const response = await fetch(url);
            const data = await response.json();
            
            return { result: data.articles, ...meta };
        }],
        // ... other actions
    ];
};
```
    
## Secrets Management
OpenKBS provides a secure way to handle sensitive information using the `{{secrets.your_secret_name}}` syntax.
Never hardcode secrets in the code, if any secrets are provided by the user replace them with placeholders syntax above.
The user will later insert the secrets using the secrets manager

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