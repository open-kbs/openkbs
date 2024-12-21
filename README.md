# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.20-orange.svg)](https://www.npmjs.com/package/openkbs)

OpenKBS is an extendable open-source platform designed to build, 
deploy and integrate AI agents anywhere, from websites to IoT devices. 
Its event-driven architecture enables full customization of backend and 
frontend components, while the LLM abstraction layer allows seamless
switching between language models. With its powerful CLI, OpenKBS turns
complex tasks into simple prompt commands, letting developers focus on what matters.

## Table of Contents

- [Install CLI](#install-cli)
- [Create App](#create-app)
- [Deploy](#deploy)
- [Extend Frontend](#extend-frontend)
   - [Chat Render](#chat-render)
   - [Setup Local Development](#setup-local-development)
   - [Use Built-in MUI Components](#use-built-in-mui-components)
   - [AI-Powered Generation](#ai-powered-frontend-generation)
- [Extend Backend](#extend-backend)
- [Mobile & Desktop App](#mobile--desktop-app)
- [Framework Documentation](#framework-documentation)
    - [Directory Structure](#directory-structure)
    - [Backend](#backend)
        - [onRequest and onResponse Handlers](#onrequest-and-onresponse-handlers)
        - [onPublicAPIRequest Handler](#onpublicapirequest-handler)
        - [onAddMessages Event Handler](#onaddmessages-event-handler)
        - [Meta Actions](#meta-actions)
        - [SDK](#sdk)
        - [Application Settings](#application-settings)
        - [LLM Instructions](#llm-instructions)
        - [Execution Environment](#execution-environment)
    - [Frontend](#frontend)
        - [Frontend Module Loading](#frontend-module-loading)
        - [Built-in UI Libraries](#built-in-ui-libraries)
        - [Common Frontend Components and Utilities](#common-frontend-components-and-utilities)
- [License](#license)
- [Contributing](#contributing)
- [Contact](#contact)

## Install CLI

First, ensure you have the OpenKBS CLI installed globally:

```bash
npm install -g openkbs
```

## Create App

Create a new application using the OpenKBS CLI:

```bash
openkbs create my-agent

cd my-agent

git init && git stage . && git commit -m "First commit" 
```

## Deploy

1. Log in to OpenKBS:

   ```bash
   openkbs login
   ```

2. Push your application to OpenKBS:

   ```bash
   openkbs push
   ```

   This command registers your application, uploads, builds and deploys all frontend and backend code. It will respond with an application URL (e.g., `https://{kbId}.apps.openkbs.com/`).

3. Open the provided URL and interact with your application.

## Extend Frontend

Let's enhance your application with additional libraries and features.
For example, to properly render chat messages with Markdown, you can integrate `react-markdown`:

### Chat Render
1. Add `react-markdown` to your dependencies:

   ```bash
   openkbs contentRender i react-markdown
   ```

2. Edit the frontend to use `react-markdown`:

   In `./src/Frontend/contentRender.js`, import `react-markdown`:

   ```js
   import ReactMarkdown from 'react-markdown';
   ```

   Modify the `onRenderChatMessage` function:

   ```js
   const onRenderChatMessage = async (params) => {
       const { content } = params.messages[params.msgIndex];
       return <ReactMarkdown>{content}</ReactMarkdown>;
   };
   ```

3. Ask the AI to 'Write a test plan' in the chat, then Push your changes and refresh to see the `react-markdown` rendering.



   ```bash
   openkbs push
   ```

### Setup Local Development

For faster frontend development, run the OpenKBS UI dev server locally:

   ```bash
   npm i
   npm start
   ```

This command opens a browser pointing to `localhost`, allowing automatic rebuilds of your frontend code locally.

### Use Built-in MUI Components

Enhance your UI with Material-UI components:

1. Import MUI components at the top of `contentRender.js`:

   ```js
   import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
   import { MoreVert as MenuIcon, AccountCircle as AccountIcon } from '@mui/icons-material';
   ```

2. Add this block at the end of the `Header` component inside `contentRender.js`:

   ```js
    return (
        <AppBar position="absolute" style={{ zIndex: 1300, flexGrow: 1, textAlign: 'left' }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: '16px' }}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    My Agent
                </Typography>
                <IconButton edge="end" color="inherit" aria-label="account">
                    <AccountIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
   ```

3. Observe real-time rendering by refreshing your browser at http://{kbId}.apps.localhost:38593/

4. Push the changes to your remote app instance:

   ```bash
   openkbs push 
   ```

### AI-Powered Frontend Generation

OpenKBS provides simple AI-powered code generation. Use the `openkbs modify` command followed by your requirement:

```bash
openkbs modify "Implementing UI to manage renderSettings"
```

If you need to revert changes:
```bash
git checkout -- .
```

## Extend Backend

Extend backend functionality using `openkbs modify` followed by your requirements. Add file paths to scope AI changes to specific files:

```bash
openkbs modify "Implement getContent backend tool that returns text or JSON from a given URL" src/Events/actions.js app/instructions.txt
openkbs push
```

This adds a new backend tool in `actions.js` that:
- Fetches content from URLs
- Handles JSON and HTML responses
- Auto-registers in `instructions.txt` (enabling LLM to understand and use it)
- Available to users and LLM through chat

Example usage in chat:
```
/getContent("https://api.example.com/data")
```

## Mobile & Desktop App

Turn any OpenKBS app into a mobile or desktop app:

### On Mobile (Android/iOS)
1. Open your app URL in browser
2. Tap browser menu (⋮)
3. Select "Add To Home Screen"

### On Desktop
1. Click install icon (➕) in address bar
2. Select "Install"

> 💡 Your app will be available on the home screen with full-screen experience!


## Framework Documentation

### Directory Structure

```
src/
├── Events/
│   ├── actions.js              // Common actions for onRequest and onResponse
│   ├── onRequest.js            // Handles incoming user messages
│   ├── onResponse.js           // Handles outgoing LLM messages
│   ├── onPublicAPIRequest.js   // Handles public API requests
│   ├── onAddMessages.js         // Handles messages added to the chat (NEW)
│   ├── onRequest.json          // Dependencies for onRequest handler
│   ├── onResponse.json          // Dependencies for onResponse handler
│   ├── onPublicAPIRequest.json // Dependencies for onPublicAPIRequest handler
│   └── onAddMessages.json       // Dependencies for onAddMessages handler (NEW)
│── Frontend/
│   ├── contentRender.js        // Custom rendering logic for chat messages
│   └── contentRender.json      // Dependencies for the contentRender module

app/
├── icon.png                    // Application icon
├── settings.json               // Application settings
└── instructions.txt            // LLM instructions
```

### Backend
The OpenKBS backend framework provides a powerful system for developing AI agents with custom tools and functionalities. It leverages a Node.js environment and offers hooks into the chat service through `onRequest` and `onResponse` event handlers. These handlers allow developers to process user input and LLM output, respectively, enabling the execution of custom actions and integration with external services.

#### onRequest and onResponse Handlers

The core of the OpenKBS backend framework revolves around the `onRequest` and `onResponse` event handlers.  These handlers act as middleware, intercepting messages before and after they are processed by the LLM.

* **`onRequest` Handler:** This handler is invoked every time a user sends a message to the chat. It provides an opportunity to pre-process the user's input, extract commands and perform actions based on the user's message.

* **`onResponse` Handler:** This handler is invoked after the LLM generates a response. It allows post-processing of the LLM's output, execution of commands based on the LLM's intentions.


**Example `onRequest` and `onResponse` Handlers Structure (using common actions):**

```javascript
// src/Events/actions.js
export const getActions = (meta) => {
    return [
        // Define your regular expressions and corresponding actions here
        [/\/?yourCommand\("(.*)"\)/, async (match, event) => {
            // Access match groups, event payload, and openkbs object
            // Execute custom logic, API calls, etc.
            // Return an object with action results and meta information
            return { result: 'Your command executed', ...meta };
        }],
        // ... more actions
    ];
};

// src/Events/onRequest.js
import {getActions} from './actions.js';
export const handler = async (event) => {
    const actions = getActions({ _meta_actions: [] }); // Initialize meta actions if needed
    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
        const match = lastMessage?.match(regex);
        if (match) return await action(match, event); // Execute matching action
    }
    return { type: 'CONTINUE' }; // Continue to the next handler or LLM
};


// src/Events/onResponse.js
import {getActions} from './actions.js';

export const handler = async (event) => {
     // Example of conditional meta actions based on message count:
    const maxSelfInvokeMessagesCount = 30;
    const actions = getActions({
        _meta_actions: event?.payload?.messages?.length > maxSelfInvokeMessagesCount
            ? ["REQUEST_CHAT_MODEL_EXCEEDED"]
            : ["REQUEST_CHAT_MODEL"]
    });

    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;        
        const match = lastMessage?.match(regex);
        if (match) return await action(match, event);
    }

    return { type: 'CONTINUE' }
};

```

The `onRequest` and `onResponse` handlers are the core of customizing your OpenKBS agent's behavior. They act as middleware, intercepting messages before they reach the LLM (`onRequest`) and after the LLM generates a response (`onResponse`). This enables you to implement custom logic, interact with external APIs, and control the flow of the conversation.

**Example:**

```javascript
// src/Events/actions.js
export const getActions = (meta) => [
    
    [/\/?textToImage\("(.*)"\)/, async (match) => {
        const response = await openkbs.textToImage(match[1], { serviceId: 'stability.sd3Medium' });
        const imageSrc = `data:${response.ContentType};base64,${response.base64Data}`;
        return { type: 'SAVED_CHAT_IMAGE', imageSrc, ...meta };
    }],

    [/\/?googleSearch\("(.*)"\)/, async (match) => {
        const q = match[1];
        const searchParams = match[2] && JSON.parse(match[2]) || {};
        const params = {
            q,
            ...searchParams,
            key: '{{secrets.googlesearch_api_key}}',
            cx: '{{secrets.googlesearch_engine_id}}'
        };
        const response = (await axios.get('https://www.googleapis.com/customsearch/v1', { params }))?.data?.items;
        const data = response?.map(({ title, link, snippet, pagemap }) => ({
            title,
            link,
            snippet,
            image: pagemap?.metatags?.[0]?.["og:image"]
        }));
        return { data, ...meta };
    }],

    [/\/?webpageToText\("(.*)"\)/, async (match) => {
        let response = await openkbs.webpageToText(match[1]);
        if (response?.content?.length > 5000) {
            response.content = response.content.substring(0, 5000);
        }
        return { data: response, ...meta };
    }],

    [/\/?documentToText\("(.*)"\)/, async (match) => {
        let response = await openkbs.documentToText(match[1]);
        if (response?.text?.length > 5000) {
            response.text = response.text.substring(0, 5000);
        }
        return { data: response, ...meta };
    }],

    [/\/?imageToText\("(.*)"\)/, async (match) => {
        let response = await openkbs.imageToText(match[1]);
        if (response?.detections?.[0]?.txt) {
          response = { detections: response?.detections?.[0]?.txt };
        }
        return { data: response, ...meta };
    }],

    [/\/?textToSpeech\("(.*)"\s*,\s*"(.*)"\)/, async (match) => {
        const response = await openkbs.textToSpeech(match[2], {
          languageCode: match[1]
        });
        return { data: response, ...meta };
    }],
];
```


```javascript
// src/Events/onRequest.js
import {getActions} from './actions.js';


export const handler = async (event) => {
    const actions = getActions({});
    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
        const match = lastMessage?.match(regex);
        if (match) return await action(match);
    }
    
    return { type: 'CONTINUE' }
};
```

```javascript
// src/Events/onResponse.js
import {getActions} from './actions.js';

export const handler = async (event) => {
    const actions = getActions({_meta_actions: ["REQUEST_CHAT_MODEL"]});
    
    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
        const match = lastMessage?.match(regex);
        if (match) return await action(match);
    }
    
    return { type: 'CONTINUE' }
};
```

#### onPublicAPIRequest Handler

The `onPublicAPIRequest` handler serves as a bridge between publicly accessible APIs and your OpenKBS application. This enables external systems, webhooks, or even client-side JavaScript to interact with your application's backend, particularly for storing data in the OpenKBS NoSQL Items service via `openkbs.items` (managed NoSQL service). This is achieved without requiring authentication for these specific API requests.

**How it works:**

1. **Public API Endpoint:**  The `onPublicAPIRequest` handler is associated with a dedicated public API endpoint (e.g., `/publicAPIRequest`) 
2. **Payload** could be any JSON object
3. **Handler Logic:** Inside the `onPublicAPIRequest` handler, you receive this payload as an argument. Your code then processes the payload and performs the necessary actions using the OpenKBS SDK for example.
4. **Data Storage:** The `openkbs.items` function is typically used within this handler to create, update, or delete items in the OpenKBS NoSQL Items service.  You can use encryption for sensitive data within this handler.
5. **Response:**  The handler returns a response to the external system that initiated the request.

**Example `onPublicAPIRequest` Handler:**

```javascript
// src/Events/onPublicAPIRequest.js
module.exports = {
    handler: async ({ payload }) => {
        const { item, attributes, itemType, action, kbId } = payload;
        
        if (!kbId) return { error: "kbId is not provided" }

        try {
            const myItem = {};
            for (const attribute of attributes) {
                const { attrName, encrypted } = attribute;
                if (encrypted && item[attrName] !== undefined) {
                    myItem[attrName] = await openkbs.encrypt(item[attrName]);
                } else {
                    myItem[attrName] = item[attrName];
                }
            }

            // Perform the action on the Items API
            return await openkbs.items({ action, itemType, attributes, item: myItem, kbId });

        } catch (error) {
            console.error("Error in onPublicAPIRequest:", error);
            return { error: error.message }; // Return error information
        }
    }
};

```


**Example Client-Side JavaScript to Create an Item:**

```javascript
// Example creating a "feedback" item
const createFeedback = async (kbId, name, text) => (
        await fetch('https://chat.openkbs.com/publicAPIRequest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: "createItem",
            kbId,
            itemType: "feedback",
            attributes: [
              { attrType: "keyword1", attrName: "name", encrypted: true },
              { attrType: "text1", attrName: "feedbackText", encrypted: false }
            ],
            item: { name, feedbackText: text }
          })
        })
).json();
```

Remember to carefully consider security implications and implement necessary precautions, as this is public API.

#### onAddMessages Event Handler

The `onAddMessages` handler allows you to intercept and process messages *as they are added to the chat*. 
This handler is triggered *after* the `onRequest` handler but *before* the message is sent to the LLM. 
It's particularly useful for scenarios where a third-party system or service sends messages directly to your OpenKBS app to perform an action.
Unlike `onPublicAPIRequest`, this handler requires an `apiKey`, which can be created in the 'Access' section of your OpenKBS app.

**Example: User moderation:**

**1. Third-Party Service API request:**

```javascript
// Example of a third-party system sending a chat message to OpenKBS
axios.post('https://chat.openkbs.com/', {
    action: "chatAddMessages",
    chatId: 'NSFW_CHAT_ID', // the chat id created to log and process NSFW message
    messages: [{
        role: "system",
        content: JSON.stringify({
            labels: ['adult', 'explicit'],
            fileName: 'image.jpg',
            path: '/uploads/image.jpg'
        }),
        msgId: `${Date.now()}-000000`
    }],
    apiKey: "YOUR_API_KEY",
    kbId: "YOUR_KB_ID"
}, {
    headers: { 'Content-Type': 'application/json' }
});
```

**2. `onAddMessages` Handler:**

```javascript
// src/Events/onAddMessages.js
import * as actions from './actions.js';

export const handler = async (event) => {
    const { messages, chatId } = event.payload;
    let msgData;

    // NSFW Chat Handler
    if (chatId === 'NSFW_CHAT_ID') {  // Check if the message is for the NSFW chat
        try {
            msgData = JSON.parse(messages[0].content); // Parse the message content (expecting JSON)
            const { data } = await actions.getUser([null, msgData.kbId]); // Get user information
            await actions.warnAccount([null, data.user.accountId, msgData?.labels]); // Issue a warning
            await actions.deleteFile([null, msgData.path]); // Delete the offending file

            // Return a system message confirming the action
            return [
                ...messages,
                {
                    role: 'system',
                    msgId: Date.now() + '000000',
                    content: `### 👮‍♀️ System Actions:\nWarning issued and content removed`
                }
            ];
        } catch (e) {
            console.error("Error processing NSFW content:", e);
        }
    }

    return messages; // Return messages unchanged if no action is taken
};

```

**Dependencies (onRequest.json, onResponse.json, etc.):**

These files specify the NPM package dependencies required for the respective event handlers. They follow the standard `package.json` format.

```json
// src/Events/*.json
{
  "dependencies": {
    "your-package": "^1.0.0"
  }
}
```


#### Meta Actions

Meta actions provide a way to control the flow of the conversation and instruct the OpenKBS platform to perform specific actions. These actions are typically triggered within the `onResponse` handler based on the LLM's output.  Here are some key meta actions:

* **`REQUEST_CHAT_MODEL`:** This meta action instructs the platform to send the current conversation to the LLM for a response after the current event handler execution is completed.  It's essential for continuing the conversation loop.

* **`SAVED_CHAT_IMAGE`:** This meta action indicates that the LLM generated or processed an image which should be saved in the chat history. It's used in conjunction with actions that process or generate images. Requires the `imageSrc` in the return object.



**Example Meta Action Usage:**

```javascript
// src/Events/onResponse.js
// ... inside an action ...
if (actionMatch) {
    return { data: 'YourActionResponse', ...meta, _meta_actions: ['REQUEST_CHAT_MODEL'] };
}
```


#### SDK

The `openkbs` object provides a set of utility functions and services to interact with the OpenKBS platform and external APIs. It's available within the event handlers.  Here are some commonly used functions:

* **`openkbs.textToImage(prompt, params)`:** Generates an image from a text prompt using a specified or default image generation service. Returns an object containing the image content type and base64 encoded data.

* **`openkbs.speechToText(audioURL, params)`:** Transcribes audio from a URL to text.

* **`openkbs.webpageToText(pageURL, params)`:** Extracts text content from a given webpage URL.

* **`openkbs.googleSearch(q, params)`:** Performs a Google search using the provided query and parameters.

* **`openkbs.documentToText(documentURL, params)`:** Extracts text from various document formats.

* **`openkbs.imageToText(imageUrl, params)`:** Extracts text from an image.

* **`openkbs.translate(text, to)`:** Translates text to the specified target language.

* **`openkbs.detectLanguage(text, params)`:** Detects the language of the provided text.

* **`openkbs.textToSpeech(text, params)`:** Converts text to speech. Returns `response.audioContent` which automatically plays in the chat interface.

* **`openkbs.encrypt(plaintext)`:** Encrypts data using the provided AES key.

* **`openkbs.decrypt(ciphertext)`:** Decrypts data encrypted with the provided AES key.

* **`openkbs.items(data)`:** Interacts with the Items API for creating, updating, and deleting items.

* **`openkbs.chats(data)`:** Interacts with the Chats API.

* **`openkbs.kb(data)`:** Interacts with the Knowledge Base API.

* **`openkbs.clientHeaders`:** Exposes client headers for accessing information like IP address, location, etc. (e.g., `openkbs.clientHeaders['x-forwarded-for']`).

**Example SDK Usage:**

```javascript
// ... inside an action ...
const image = await openkbs.textToImage('a cat sitting on a mat');
// ... use image.base64Data and image.ContentType ...


//Encrypt submitted user data
const encryptedValue = await openkbs.encrypt(userData);

```

#### Application Settings
`app/settings.json`

This file contains essential configuration settings for the AI agent.

```json
{
  "userId": "public",
  "chatVendor": "your-vendor",
  "kbDescription": "Description of your KB",
  "kbTitle": "Title of your KB",
  "model": "your-llm-model",
  "inputTools": [
    "speechToText"
  ],
  "embeddingModel": "your-embedding-model",
  "embeddingDimension": 1536,
  "searchEngine": "your-search-engine",
  "itemTypes": { }
}
```

#### LLM Instructions
`app/instructions.txt`
This file contains the instructions for the LLM, guiding its behavior and interaction with custom functionalities. 
Clear and specific instructions ensure the LLM effectively utilizes provided actions and commands.

**Example Instructions:**

```
You are an AI assistant.

You can execute the following commands:

/googleSearch("query")
Description: """
Get results from Google Search API.
"""
$InputLabel = """Let me Search in Google!"""
$InputValue = """Search in google for the latest news"""

/someCommand("param")
...

```

Command definitions may include \$InputLabel and \$InputValue which are invisiable to the LLM:

`$InputLabel` - Text displayed as a selectable option in the chat interface.

`$InputValue` - Text automatically inserted in the chat input when \$InputLabel is selected.

These features provide quick command access and pre-populate inputs, enhancing user interaction.


#### Execution Environment

The OpenKBS backend provides a pre-configured execution environment for your event handlers, including a set of globally available objects and libraries. This eliminates the need to explicitly declare these as dependencies in your `onRequest.json` or `onResponse.json` files.  These predefined resources facilitate various operations, from interacting with AWS services to manipulating data and making HTTP requests.

Here's a breakdown of the key objects and utilities available within the OpenKBS backend environment:

**Key Objects and Utilities:**

* **`openkbs`:** The OpenKBS SDK, documented previously, provides utility functions for interacting with the OpenKBS platform and various external services.

* **`AWS: AWS_SDK`:**  The AWS SDK provides access to a wide range of AWS services directly within your event handlers.  This allows integration with S3, DynamoDB, Lambda, and other AWS resources.  Pre-configured and ready to use.

* **`axios`:**  Powerful HTTP client for making requests to external APIs and services.  Simplifies handling responses and errors compared to the built-in `https` module.

* **`cheerio`:**  A fast and flexible HTML parser implemented on top of the `parse5` parser.  Enables server-side DOM manipulation and data extraction from HTML content.

* **`Decimal`:** The Decimal.js library enables arbitrary-precision decimal arithmetic, avoiding floating-point inaccuracies common in JavaScript.

* **`crypto`:**  Node.js crypto module for performing cryptographic operations like hashing, encryption, and decryption.

* **`jwt`:** The `jsonwebtoken` library provides functions for creating, signing, and verifying JSON Web Tokens (JWTs), essential for secure authentication and authorization.

* **`JSON5`:**  A more permissive JSON parser that supports comments, trailing commas, single quotes, and other convenient features not found in standard JSON. Useful for parsing configuration files or user input.

### Frontend

The OpenKBS frontend framework is built using React and provides a flexible and extensible platform for building custom chat interfaces. It allows developers to customize the appearance and behavior of the chat through a `contentRender` module, which can be dynamically loaded and used to extend the core platform.


#### Frontend Module Loading

The frontend framework dynamically loads the `contentRender.js` module. This module can export several functions and components to customize the chat interface. The framework uses a global variable called `window.contentRender` to access the functions exported by this module.

#### contentRender

The `contentRender.js` file is the heart of frontend customization. It can export several key functions:

- **`onRenderChatMessage(params)`:** This function is called every time a chat message is rendered. It receives an object with various parameters, including:
    - `msgIndex`: The index of the message being rendered.
    - `messages`: The entire array of chat messages.
    - `setMessages`: A function to update the `messages` state.
    - `iframeRef`: A reference to the iframe element.
    - `KB`: The Knowledge Base object containing application settings.
    - `chatContainerRef`: A reference to the chat container element.
    - `RequestChatAPI`: A function to send a message to the chat API.
    - `setSystemAlert`: A function to display system alerts.
    - `setBlockingLoading`: A function to display a loading indicator.
    - `blockingLoading`: A boolean indicating if the loading indicator is active.
    - `sendButtonRef`: A reference to the send button element.
    - `sendButtonRippleRef`: A reference to the send button ripple effect.
    - `setInputValue`: A function to set the value of the input field.
    - `renderSettings`: An object containing rendering settings.
    - `axios`: The axios library for making HTTP requests.
    - `itemsAPI`: Functions for manipulating KB items.
    - `createEmbeddingItem`: Functions to create embeddings.
    - `indexedDB`: IndexedDB wrapper to access data.
    - `chatAPI`: API to access chat data.
    - `generateMsgId`: Generates a unique message ID.
    - `kbUserData`: Function to get KB user data.
    - `executeNodejs`: Execute custom JavaScript code inside a VM.

  This function should return a React component representing the rendered message. If not defined, the default rendering mechanism is used.

- **`Header(props)`:** This React component is rendered at the top of the chat interface. It receives the same `params` object as `onRenderChatMessage`. It can be used to add custom UI elements or controls to the chat header. If not defined, the standard OpenKBS chat header is displayed.

- **`onDeleteChatMessage(params)`:** This async function is triggered when a chat message is deleted. This function receives a `params` object similar to the `onRenderChatMessage` function but also includes `chatId`, `message` (the message being deleted), and can be used to perform cleanup actions related to custom rendered content. If not defined, a default delete message function is executed.

**Example `contentRender.js`:**

```javascript
import React from 'react';

const onRenderChatMessage = async (params) => {
  const { content, role } = params.messages[params.msgIndex];
  if (role === 'assistant' && content.startsWith('```json')) {
    try {
      const jsonData = JSON.parse(content.replace('```json', '').replace('```', ''));
      return <pre>{JSON.stringify(jsonData, null, 2)}</pre>;
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return null;
    }
  }
};

const Header = ({ setRenderSettings }) => {
  // Custom header content
  return (
          <div>
            <h1>Custom Chat Header</h1>
          </div>
  );
};

const onDeleteChatMessage = async (params) => {
  // Perform cleanup or other actions on chat message delete
  const { chatId, message, itemsAPI, KB, setBlockingLoading } = params;
  // Perform action before the message is deleted
};

const exports = { onRenderChatMessage, Header, onDeleteChatMessage };
window.contentRender = exports;
export default exports;
```

`contentRender.json` specifies the dependencies required for the `contentRender.js` module. It's structured like a standard `package.json` file.

```json
{
  "dependencies": {
    "react": "^18.2.0 (fixed)",
    "react-dom": "^18.2.0 (fixed)",
    "@mui/material": "^5.16.1 (fixed)",
    "@mui/icons-material": "^5.16.1 (fixed)",
    "@emotion/react": "^11.10.6 (fixed)",
    "@emotion/styled": "^11.10.6 (fixed)"
  }
}
```

#### Built-in UI Libraries

The dependencies marked as `(fixed)` are not installed as additional dependencies but are inherited from the base framework `openkbs-ui`. This ensures consistency across applications and reduces the need for redundant installations. These fixed dependencies include:

- **`react` and `react-dom`:** Core libraries for building user interfaces with React.
- **`@mui/material` and `@mui/icons-material`:** Material-UI components and icons for building modern, responsive UIs.
- **`@emotion/react` and `@emotion/styled`:** Libraries for writing CSS styles with JavaScript, used by Material-UI for styling components.

#### Common Frontend Components and Utilities

These components and utilities are accessible directly within your `onRenderChatMessage` function, streamlining your custom development process.

*msgIndex*
```javascript
const onRenderChatMessage = async (params) => {
    const { msgIndex, messages } = params;
    console.log(`Rendering message at index: ${msgIndex}`);
    const currentMessage = messages[msgIndex];
    // Further processing...
};
```

*messages*
```javascript
const onRenderChatMessage = async (params) => {
    const { messages } = params;
    messages.forEach((message, index) => {
        console.log(`Message ${index}: ${message.content}`);
    });
    // Further processing...
};
```

*setMessages*
```javascript
const onRenderChatMessage = async (params) => {
    const { setMessages, messages } = params;
    const newMessage = { content: "New message", role: "user" };
    setMessages([...messages, newMessage]);
};
```

*KB*
```javascript
const onRenderChatMessage = async (params) => {
    const { KB } = params;
    console.log(`Knowledge Base ID: ${KB.kbId}`);
    // Use KB settings...
};
```

*chatContainerRef*
```javascript
const onRenderChatMessage = async (params) => {
    const { chatContainerRef } = params;
    if (chatContainerRef.current) {
        // ...
    }
};
```

*RequestChatAPI*
```javascript
const onRenderChatMessage = async (params) => {
    const { RequestChatAPI, messages } = params;
    const newMessage = { role: "user", content: "Hello, world!" };
    await RequestChatAPI([...messages, newMessage]);
};
```

*setSystemAlert*
```javascript
const onRenderChatMessage = async (params) => {
    const { setSystemAlert } = params;
    setSystemAlert({ msg: "This is a system alert", type: "info", duration: 3000 });
};
```

*setBlockingLoading*
```javascript
const onRenderChatMessage = async (params) => {
    const { setBlockingLoading } = params;
    setBlockingLoading(true);
    // Perform some async operation...
    setBlockingLoading(false);
};
```

*blockingLoading*
```javascript
const onRenderChatMessage = async (params) => {
    const { blockingLoading } = params;
    if (blockingLoading) {
        console.log("Loading is currently active");
    }
};
```

*sendButtonRef*
```javascript
const onRenderChatMessage = async (params) => {
    const { sendButtonRef } = params;
    if (sendButtonRef.current) {
        sendButtonRef.current.disabled = true; // Disable the send button
    }
};
```

*sendButtonRippleRef*
```javascript
const onRenderChatMessage = async (params) => {
    const { sendButtonRippleRef } = params;
    if (sendButtonRippleRef.current) {
        sendButtonRippleRef.current.pulsate(); // Trigger ripple effect
    }
};
```

*setInputValue*
```javascript
const onRenderChatMessage = async (params) => {
    const { setInputValue } = params;
    setInputValue("Pre-filled input value");
};
```

*renderSettings*
```javascript
const onRenderChatMessage = async (params) => {
    const { renderSettings } = params;
    console.log(`Current render settings: ${JSON.stringify(renderSettings)}`);
};
```

*axios*
```javascript
const onRenderChatMessage = async (params) => {
    const { axios } = params;
    const response = await axios.get("https://api.example.com/data");
    console.log(response.data);
};
```

*itemsAPI*
```javascript
const onRenderChatMessage = async (params) => {
    const { itemsAPI } = params;
    const item = await itemsAPI.getItem("itemId");
    console.log(`Fetched item: ${JSON.stringify(item)}`);
};
```

*indexedDB*
```javascript
const onRenderChatMessage = async (params) => {
    const { indexedDB } = params;
    const items = await indexedDB.db["items"].toArray();
    console.log(`IndexedDB items: ${JSON.stringify(items)}`);
};
```

*generateMsgId*
```javascript
const onRenderChatMessage = async (params) => {
    const { generateMsgId } = params;
    const newMsgId = generateMsgId();
    console.log(`Generated message ID: ${newMsgId}`);
};
```

*kbUserData*
```javascript
const onRenderChatMessage = async (params) => {
    const { kbUserData } = params;
    const userData = kbUserData();
    console.log(`User data: ${JSON.stringify(userData)}`);
};
```


## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).
