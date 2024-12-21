# OpenKBS Framework Documentation

## Directory Structure

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

## Backend
The OpenKBS backend framework provides a powerful system for developing AI agents with custom functionalities. It leverages a Node.js environment and offers hooks into the chat service through `onRequest` and `onResponse` event handlers. These handlers allow developers to process user input and LLM output, respectively, enabling the execution of custom actions and integration with external services.

### 1. Event Handlers

The core of the OpenKBS backend framework revolves around the `onRequest` and `onResponse` event handlers.  These handlers act as middleware, intercepting messages before and after they are processed by the LLM.

* **`onRequest` Handler:** This handler is invoked every time a user sends a message to the chat. It provides an opportunity to pre-process the user's input, extract commands, perform actions, and modify the message before it's sent to the LLM.

* **`onResponse` Handler:** This handler is invoked after the LLM generates a response. It allows post-processing of the LLM's output, execution of commands based on the LLM's intentions, and modification of the final message presented to the user.

* **`onPublicAPIRequest` Handler:** This handler allows public access to certain actions via API requests, even without authentication. This is useful for form submissions and webhooks. It receives a payload containing the action, item type, attributes, and item data.


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

### Example:

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

### `onPublicAPIRequest` Handler and Public API Integration:

The `onPublicAPIRequest` handler serves as a bridge between publicly accessible APIs and your OpenKBS application. This enables external systems, webhooks, or even client-side JavaScript to interact with your application's backend, particularly for storing data in the OpenKBS NoSQL Items service via `openkbs.items`. This is achieved without requiring authentication for these specific API requests.

**How it works:**

1. **Public API Endpoint:**  The `onPublicAPIRequest` handler is associated with a dedicated public API endpoint (e.g., `/publicAPIRequest`). This endpoint can be called directly from any external system without needing to provide an authentication token.
2. **Payload Structure:** Requests to this endpoint must include a specifically formatted payload in JSON. This payload must contain the following keys:
    * `action`: The action to perform (e.g., "createItem", "updateItem", "deleteItem").
    * `itemType`: The type of item to interact with (as defined in your `settings.json`).
    * `attributes`: An array defining the attributes of the item type (as defined in your `settings.json`).
    * `item`:  An object containing the data for the item itself. The keys of this object should correspond to the `attrName` properties defined in the `attributes` array.
    * `kbId`: The ID of the knowledge base.


3. **Handler Logic:** Inside the `onPublicAPIRequest` handler, you receive this payload as an argument. Your code then processes the payload and performs the necessary actions using the OpenKBS SDK.
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

By utilizing `onPublicAPIRequest` and `openkbs.items`, you can build powerful integrations that allow external systems to store and manage data within your OpenKBS application without compromising security. This approach is especially valuable for scenarios like form submissions, webhooks, or any situation where direct, unauthenticated access to data storage is required.  Remember to carefully consider security implications and implement necessary precautions.

### `onAddMessages` Event Handler:

The `onAddMessages` handler allows you to intercept and process messages *as they are added to the chat*. This handler is triggered *after* the `onRequest` handler but *before* the message is sent to the LLM. It's particularly useful for scenarios where a third-party system or service sends messages directly to your OpenKBS application to perform an action.

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


### 2. Meta Actions

Meta actions provide a way to control the flow of the conversation and instruct the OpenKBS platform to perform specific actions. These actions are typically triggered within the `onResponse` handler based on the LLM's output.  Here are some key meta actions:

* **`REQUEST_CHAT_MODEL`:** This meta action instructs the platform to send the current conversation to the LLM for a response after the current event handler execution is completed.  It's essential for continuing the conversation loop.

* **`REQUEST_CHAT_MODEL_EXCEEDED`:**  This meta action should be used when the model has exceeded its self-invoke limit.  This prevents infinite loops. It can be used in conjunction with the `suggestion` action to provide suggestions to the user without immediately invoking the LLM.

* **`SAVED_CHAT_IMAGE`:** This meta action indicates that the LLM generated or processed an image which should be saved in the chat history. It's used in conjunction with actions that process or generate images. Requires the `imageSrc` in the return object.

* other meta actions


**Example Meta Action Usage:**

```javascript
// src/Events/onResponse.js
// ... inside an action ...
if (someCondition) {
    return { type: 'YourAction', ...meta, _meta_actions: ['REQUEST_CHAT_MODEL'] };
}
```


### 3. Backend SDK (`openkbs` Object)

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

### 4. Application Settings (app/settings.json)

This file contains essential configuration settings for the AI agent.

```json
{
  "kbId": "your-kb-id",          // Unique Knowledge Base ID
  "userId": "your-user-id",      // User ID associated with the application
  "appId": "your-app-id",        // Unique Application ID
  "chatVendor": "your-vendor",   // Chat service vendor (e.g., openai, anthropic, google, bedrock, azure)
  "kbDescription": "Description of your KB",
  "kbTitle": "Title of your KB",
  "model": "your-llm-model",   // LLM model to use
  "inputTools": [             // Input tools to enable (e.g., "speechToText")
    "speechToText"
  ],
  "embeddingModel": "your-embedding-model", // Embedding model for semantic search
  "embeddingDimension": 1536,                // Dimension of the embedding vectors
  "searchEngine": "your-search-engine",       // Search engine to use
  "itemTypes": { },           // Define your custom item types and their attributes
  "slug": "kb-slug",         // URL slug for the knowledge base
  "active": true,             // Whether the KB is active
  "category": "Category of kb" // Category of the knowledge base
}
```

### 5. LLM Instructions (app/instructions.txt)

This file contains the instructions provided to the LLM, guiding its behavior and interaction with the custom functionalities implemented through the backend framework. The clearer and more specific the instructions, the more effectively the LLM will utilize the provided actions and commands. Include examples of how to use the actions defined in `actions.js`, demonstrating both successful and unsuccessful executions. Use clear and concise language, focusing on the specific tasks the LLM should perform. Explain the expected format of commands and responses.

**Example Instructions:**

```
You are an AI assistant designed to automate WooCommerce tasks.

You can execute the following commands:

* `/googleSearch("your query")`: Performs a Google search and returns the results.
* `/webpageToText("url")`: Extracts text content from a webpage.
// ... other commands
Use backticks for meta commands (commands that are not part of the user request or LLM output)

```


### 6. Execution Environment: Predefined Objects and Utilities

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

## Frontend

The OpenKBS frontend framework is built using React and provides a flexible and extensible platform for building custom chat interfaces. It allows developers to customize the appearance and behavior of the chat through a `contentRender` module, which can be dynamically loaded and used to extend the core platform.


### 1. Frontend Module Loading

The frontend framework dynamically loads the `contentRender.js` module. This module can export several functions and components to customize the chat interface. The framework uses a global variable called `window.contentRender` to access the functions exported by this module.

### 2. `contentRender.js` and `contentRender.json`

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

### Fixed Dependencies

The dependencies marked as `(fixed)` are not installed as additional dependencies but are inherited from the base framework `openkbs-ui`. This ensures consistency across applications and reduces the need for redundant installations. These fixed dependencies include:

- **`react` and `react-dom`:** Core libraries for building user interfaces with React.
- **`@mui/material` and `@mui/icons-material`:** Material-UI components and icons for building modern, responsive UIs.
- **`@emotion/react` and `@emotion/styled`:** Libraries for writing CSS styles with JavaScript, used by Material-UI for styling components.

### 3. Common Frontend Components and Utilities

These components and utilities are accessible directly within your `onRenderChatMessage` function, streamlining your custom development process.

### msgIndex
```javascript
const onRenderChatMessage = async (params) => {
    const { msgIndex, messages } = params;
    console.log(`Rendering message at index: ${msgIndex}`);
    const currentMessage = messages[msgIndex];
    // Further processing...
};
```

### messages
```javascript
const onRenderChatMessage = async (params) => {
    const { messages } = params;
    messages.forEach((message, index) => {
        console.log(`Message ${index}: ${message.content}`);
    });
    // Further processing...
};
```

### setMessages
```javascript
const onRenderChatMessage = async (params) => {
    const { setMessages, messages } = params;
    const newMessage = { content: "New message", role: "user" };
    setMessages([...messages, newMessage]);
};
```

### KB
```javascript
const onRenderChatMessage = async (params) => {
    const { KB } = params;
    console.log(`Knowledge Base ID: ${KB.kbId}`);
    // Use KB settings...
};
```

### chatContainerRef
```javascript
const onRenderChatMessage = async (params) => {
    const { chatContainerRef } = params;
    if (chatContainerRef.current) {
        // ...
    }
};
```

### RequestChatAPI
```javascript
const onRenderChatMessage = async (params) => {
    const { RequestChatAPI, messages } = params;
    const newMessage = { role: "user", content: "Hello, world!" };
    await RequestChatAPI([...messages, newMessage]);
};
```

### setSystemAlert
```javascript
const onRenderChatMessage = async (params) => {
    const { setSystemAlert } = params;
    setSystemAlert({ msg: "This is a system alert", type: "info", duration: 3000 });
};
```

### setBlockingLoading
```javascript
const onRenderChatMessage = async (params) => {
    const { setBlockingLoading } = params;
    setBlockingLoading(true);
    // Perform some async operation...
    setBlockingLoading(false);
};
```

### blockingLoading
```javascript
const onRenderChatMessage = async (params) => {
    const { blockingLoading } = params;
    if (blockingLoading) {
        console.log("Loading is currently active");
    }
};
```

### sendButtonRef
```javascript
const onRenderChatMessage = async (params) => {
    const { sendButtonRef } = params;
    if (sendButtonRef.current) {
        sendButtonRef.current.disabled = true; // Disable the send button
    }
};
```

### sendButtonRippleRef
```javascript
const onRenderChatMessage = async (params) => {
    const { sendButtonRippleRef } = params;
    if (sendButtonRippleRef.current) {
        sendButtonRippleRef.current.pulsate(); // Trigger ripple effect
    }
};
```

### setInputValue
```javascript
const onRenderChatMessage = async (params) => {
    const { setInputValue } = params;
    setInputValue("Pre-filled input value");
};
```

### renderSettings
```javascript
const onRenderChatMessage = async (params) => {
    const { renderSettings } = params;
    console.log(`Current render settings: ${JSON.stringify(renderSettings)}`);
};
```

### axios
```javascript
const onRenderChatMessage = async (params) => {
    const { axios } = params;
    const response = await axios.get("https://api.example.com/data");
    console.log(response.data);
};
```

### itemsAPI
```javascript
const onRenderChatMessage = async (params) => {
    const { itemsAPI } = params;
    const item = await itemsAPI.getItem("itemId");
    console.log(`Fetched item: ${JSON.stringify(item)}`);
};
```

### indexedDB
```javascript
const onRenderChatMessage = async (params) => {
    const { indexedDB } = params;
    const items = await indexedDB.db["items"].toArray();
    console.log(`IndexedDB items: ${JSON.stringify(items)}`);
};
```

### generateMsgId
```javascript
const onRenderChatMessage = async (params) => {
    const { generateMsgId } = params;
    const newMsgId = generateMsgId();
    console.log(`Generated message ID: ${newMsgId}`);
};
```

### kbUserData
```javascript
const onRenderChatMessage = async (params) => {
    const { kbUserData } = params;
    const userData = kbUserData();
    console.log(`User data: ${JSON.stringify(userData)}`);
};
```
