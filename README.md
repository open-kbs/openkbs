# OpenKBS &middot; [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) [![npm version](https://img.shields.io/badge/npm-v0.0.20-orange.svg)](https://www.npmjs.com/package/openkbs)


OpenKBS is an extendable AI service designed to build,
deploy and integrate AI agents and applications.

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
        - [Managing Secrets](#managing-secrets)
        - [Application Settings](#application-settings)
        - [Message Types and Content Formats](#message-types-and-content-formats)
        - [Supported AI Models](#supported-ai-models)
        - [LLM Instructions](#llm-instructions)
        - [Execution Environment](#execution-environment)
    - [Frontend](#frontend)
        - [Frontend Module Loading](#frontend-module-loading)
        - [Built-in UI Libraries](#built-in-ui-libraries)
        - [Common Frontend Components and Utilities](#common-frontend-components-and-utilities)
- [API](#api)
    - [Keys and Authentication](#keys-and-authentication)
    - [Encryption and Decryption](#encryption-and-decryption)
    - [API Endpoints](#api-endpoints)
        - [Agent newChat](#newChat)
        - [Agent getChatMessages](#getChatMessages)
        - [Agent chatAddMessages](#chatAddMessages)
        - [Ledger signTransaction](#signTransaction)
        - [Ledger accountBalances](#account-balances)
        - [Ledger transactions](#transactions)
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
   `````

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
│   ├── onAddMessages.js        // Handles messages added to the chat
│   ├── onCronjob.js            // Scheduled task handler (runs on cron schedule)
│   ├── onRequest.json          // Dependencies for onRequest handler
│   ├── onResponse.json         // Dependencies for onResponse handler
│   ├── onPublicAPIRequest.json // Dependencies for onPublicAPIRequest handler
│   ├── onAddMessages.json      // Dependencies for onAddMessages handler
│   └── onCronjob.json          // Dependencies for onCronjob handler
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
export const getActions = (meta) => [
    // Commands use XML tags with JSON content
    [/<myCommand>([\s\S]*?)<\/myCommand>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        // Execute custom logic, API calls, etc.
        return { result: data.param, ...meta };
    }]
];

// src/Events/onRequest.js
import {getActions} from './actions.js';
export const handler = async (event) => {
    const actions = getActions({ _meta_actions: [] });
    const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
    for (const [regex, action] of actions) {
        const match = lastMessage?.match(regex);
        if (match) return await action(match, event);
    }
    return { type: 'CONTINUE' };
};

// src/Events/onResponse.js
import {getActions} from './actions.js';
export const handler = async (event) => {
    const maxSelfInvokeMessagesCount = 30;
    const actions = getActions({
        _meta_actions: event?.payload?.messages?.length > maxSelfInvokeMessagesCount
            ? [] : ["REQUEST_CHAT_MODEL"]
    });
    const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
    for (const [regex, action] of actions) {
        const match = lastMessage?.match(regex);
        if (match) return await action(match, event);
    }
    return { type: 'CONTINUE' };
};
```

The `onRequest` and `onResponse` handlers are the core of customizing your OpenKBS agent's behavior. They act as middleware, intercepting messages before they reach the LLM (`onRequest`) and after the LLM generates a response (`onResponse`). This enables you to implement custom logic, interact with external APIs, and control the flow of the conversation.

#### Command Format

Commands use XML tags with JSON content inside. This format is cleaner and more flexible than regex-based parsing:

```xml
<commandName>
{
  "param1": "value1",
  "param2": "value2"
}
</commandName>
```

For commands without parameters, use self-closing tags:
```xml
<commandName/>
```

**Example:**

```javascript
// src/Events/actions.js

// Helper function for uploading generated images
const uploadGeneratedImage = async (base64Data, meta) => {
    const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const uploadResult = await openkbs.uploadImage(base64Data, fileName, 'image/png');
    return {
        type: 'CHAT_IMAGE',
        data: { imageUrl: uploadResult.url },
        ...meta
    };
};

export const getActions = (meta) => [

    // AI Image Generation (supports multiple models)
    [/<createAIImage>([\s\S]*?)<\/createAIImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const model = data.model || "gemini-2.5-flash-image";
            const params = { model, n: 1 };

            if (data.imageUrls?.length > 0) {
                params.imageUrls = data.imageUrls;
            }

            if (model === 'gpt-image-1') {
                const validSizes = ["1024x1024", "1536x1024", "1024x1536", "auto"];
                params.size = validSizes.includes(data.size) ? data.size : "1024x1024";
                params.quality = "high";
            } else if (model === 'gemini-2.5-flash-image') {
                const validAspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
                params.aspect_ratio = validAspectRatios.includes(data.aspect_ratio) ? data.aspect_ratio : "1:1";
            }

            const image = await openkbs.generateImage(data.prompt, params);
            return await uploadGeneratedImage(image[0].b64_json, meta);
        } catch (error) {
            return { error: error.message || 'Image creation failed', ...meta };
        }
    }],

    // AI Video Generation (Sora 2)
    [/<createAIVideo>([\s\S]*?)<\/createAIVideo>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const params = {
                video_model: data.model || "sora-2",
                seconds: [4, 8, 12].includes(data.seconds) ? data.seconds : 8
            };

            if (data.input_reference_url) {
                params.input_reference_url = data.input_reference_url;
            } else {
                const validSizes = ['720x1280', '1280x720'];
                params.size = validSizes.includes(data.size) ? data.size : '1280x720';
            }

            const videoData = await openkbs.generateVideo(data.prompt, params);

            if (videoData?.[0]?.status === 'pending') {
                return {
                    type: 'VIDEO_PENDING',
                    data: { videoId: videoData[0].video_id, message: 'Video generation in progress...' },
                    ...meta
                };
            }

            if (videoData?.[0]?.video_url) {
                return { type: 'CHAT_VIDEO', data: { videoUrl: videoData[0].video_url }, ...meta };
            }
            return { error: 'Video generation failed', ...meta };
        } catch (error) {
            return { error: error.message || 'Video creation failed', ...meta };
        }
    }],

    // Continue video polling
    [/<continueVideoPolling>([\s\S]*?)<\/continueVideoPolling>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const videoData = await openkbs.checkVideoStatus(data.videoId);

            if (videoData?.[0]?.status === 'completed' && videoData[0].video_url) {
                return { type: 'CHAT_VIDEO', data: { videoUrl: videoData[0].video_url }, ...meta };
            } else if (videoData?.[0]?.status === 'pending') {
                return { type: 'VIDEO_PENDING', data: { videoId: data.videoId, message: 'Still generating...' }, ...meta };
            }
            return { error: 'Video generation failed', ...meta };
        } catch (error) {
            return { error: error.message, ...meta };
        }
    }],

    // Google Search
    [/<googleSearch>([\s\S]*?)<\/googleSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query);
            const results = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet,
                image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Web scraping
    [/<webpageToText>([\s\S]*?)<\/webpageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.webpageToText(data.url);
            if (response?.content?.length > 5000) {
                response.content = response.content.substring(0, 5000);
            }
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Exchange rates with period support
    [/<getExchangeRates>([\s\S]*?)<\/getExchangeRates>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            // period can be: 'latest', 'YYYY-MM-DD' (historical), or 'YYYY-MM-DD..YYYY-MM-DD' (time series)
            let response = await openkbs.getExchangeRates({
                base: data.base,
                symbols: data.symbols,
                period: data.period || 'latest'
            });
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Send email
    [/<sendMail>([\s\S]*?)<\/sendMail>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.sendMail(data.to, data.subject, data.body);
            return { type: 'EMAIL_SENT', data: { email: data.to, subject: data.subject, response }, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Schedule task
    [/<scheduleTask>([\s\S]*?)<\/scheduleTask>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let scheduledTime;

            if (data.time) {
                let isoTimeStr = data.time.replace(' ', 'T');
                if (!isoTimeStr.includes('Z') && !isoTimeStr.includes('+')) isoTimeStr += 'Z';
                scheduledTime = new Date(isoTimeStr).getTime();
            } else if (data.delay) {
                let delayMs = 0;
                if (data.delay.endsWith('h')) delayMs = parseFloat(data.delay) * 3600000;
                else if (data.delay.endsWith('d')) delayMs = parseFloat(data.delay) * 86400000;
                else delayMs = parseFloat(data.delay) * 60000;
                scheduledTime = Date.now() + delayMs;
            } else {
                scheduledTime = Date.now() + 3600000;
            }

            const response = await openkbs.kb({
                action: 'createScheduledTask',
                scheduledTime: Math.floor(scheduledTime / 60000) * 60000,
                taskPayload: { message: `[SCHEDULED_TASK] ${data.message}`, createdAt: Date.now() },
                description: data.message.substring(0, 50)
            });

            return { type: 'TASK_SCHEDULED', data: { scheduledTime: new Date(scheduledTime).toISOString(), taskId: response.taskId }, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Get scheduled tasks
    [/<getScheduledTasks\s*\/>/s, async () => {
        try {
            const response = await openkbs.kb({ action: 'getScheduledTasks' });
            return { type: 'SCHEDULED_TASKS_LIST', data: response, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // View image - adds image to LLM vision context
    [/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            return {
                data: [
                    { type: "text", text: `Viewing image: ${data.url}` },
                    { type: "image_url", image_url: { url: data.url } }
                ],
                ...meta
            };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],
];
```


```javascript
// src/Events/onRequest.js
import {getActions} from './actions.js';

export const handler = async (event) => {
    const actions = getActions({ _meta_actions: [] });
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
    const actions = getActions({ _meta_actions: ["REQUEST_CHAT_MODEL"] });
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

#### onCronjob Handler

The `onCronjob` handler enables scheduled task execution for your agent. It runs automatically based on a cron schedule you define, without requiring user interaction.

**How it works:**
1. Create `src/Events/onCronjob.js` with your handler logic
2. Define the schedule using `handler.CRON_SCHEDULE` at the end of the file
3. Deploy with `openkbs push` - the cronjob is automatically registered

**Cron Schedule Format:**
Standard cron syntax: `minute hour day month weekday`

- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1-5` - Weekdays at 9 AM

**Example `onCronjob.js`:**

```javascript
// src/Events/onCronjob.js

export const handler = async (event) => {
    try {
        // Fetch external data
        const response = await fetch('https://api.example.com/status');
        const data = await response.json();

        // Process and store results
        await openkbs.createItem({
            itemType: 'status_check',
            itemId: `status_${Date.now()}`,
            body: { timestamp: new Date().toISOString(), ...data }
        });

        // Optionally trigger a chat for notifications
        if (data.alertLevel > 5) {
            await openkbs.chats({
                chatTitle: `Alert: ${data.message}`,
                message: JSON.stringify([
                    { type: "text", text: `ALERT: ${data.message}\nLevel: ${data.alertLevel}` }
                ])
            });
        }

        return {
            success: true,
            processed: data,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// IMPORTANT: Define the cron schedule at the end of the file
handler.CRON_SCHEDULE = "*/5 * * * *"; // Runs every 5 minutes
```

**Key Points:**
- The `CRON_SCHEDULE` must be defined as `handler.CRON_SCHEDULE = "pattern"` at the end of the file
- The handler receives an empty `event` object (no user payload)
- Use `openkbs.chats()` to create new chat sessions for notifications
- All SDK methods (`openkbs.*`) are available
- Return an object with results for logging purposes
- To disable the cronjob, simply remove or rename the `onCronjob.js` file and redeploy

**Dependencies (onRequest.json, onResponse.json, onCronjob.json, etc.):**

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


#### SDK (Backend `openkbs` object)

The `openkbs` object is a global object available in all backend event handlers (`onRequest`, `onResponse`, `onAddMessages`, `onPublicAPIRequest`, `onCronjob`). It provides access to OpenKBS services, external APIs, and data storage.

**Properties:**
```javascript
openkbs.kbId              // Current Knowledge Base ID
openkbs.clientHeaders     // Client headers (e.g., openkbs.clientHeaders['x-forwarded-for'] for IP)
openkbs.AESKey            // Encryption key for this KB
openkbs.chatJWT           // JWT token for current chat session
```

##### Image & Video Generation

* **`openkbs.generateImage(prompt, params)`:** Generates images using AI models. Returns array with `b64_json` data.
  - `params.model`: `"gemini-2.5-flash-image"` (default, supports image editing) or `"gpt-image-1"` (better for text in images)
  - `params.imageUrls`: Array of reference image URLs (gemini only)
  - `params.aspect_ratio`: For gemini: `"1:1"`, `"16:9"`, `"9:16"`, `"3:2"`, `"2:3"`, `"4:3"`, `"3:4"`, `"4:5"`, `"5:4"`, `"21:9"`
  - `params.size`: For gpt-image-1: `"1024x1024"`, `"1536x1024"`, `"1024x1536"`, `"auto"`
  - `params.n`: Number of images (default: 1)

* **`openkbs.generateVideo(prompt, params)`:** Generates videos using Sora 2. Returns array with `video_url` or `status: 'pending'`.
  - `params.video_model`: `"sora-2"` (default, fast) or `"sora-2-pro"` (higher quality)
  - `params.seconds`: `4`, `8` (default), or `12`
  - `params.size`: `"1280x720"` (landscape) or `"720x1280"` (portrait)
  - `params.input_reference_url`: Optional reference image URL

* **`openkbs.checkVideoStatus(videoId)`:** Check status of pending video generation.

* **`openkbs.uploadImage(base64Data, fileName, mimeType)`:** Upload image to storage. Returns `{ url }`.

##### Search & Content Extraction

* **`openkbs.googleSearch(query, params)`:** Performs Google search. Optional `params.searchType: 'image'` for image search.

* **`openkbs.webpageToText(pageURL, params)`:** Extracts text content from a webpage.

* **`openkbs.documentToText(documentURL, params)`:** Extracts text from documents (PDF, DOC, etc.).

* **`openkbs.imageToText(imageUrl, params)`:** OCR - extracts text from images.

##### Communication

* **`openkbs.sendMail(email, subject, content)`:** Sends an email to the specified recipient.

* **`openkbs.textToSpeech(text, params)`:** Converts text to speech. Returns `response.audioContent`.

* **`openkbs.speechToText(audioURL, params)`:** Transcribes audio from a URL to text.

##### Data & Utilities

* **`openkbs.getExchangeRates({ base, symbols, period })`:** Retrieves exchange rates.
  - `base`: Base currency (e.g., `"EUR"`)
  - `symbols`: Target currencies (e.g., `"USD,GBP"`)
  - `period`: `"latest"` (default), `"YYYY-MM-DD"` (historical), or `"YYYY-MM-DD..YYYY-MM-DD"` (time series)

* **`openkbs.checkVAT(vatNumber)`:** Validates a VAT number against official databases.

* **`openkbs.translate(text, to)`:** Translates text to the specified target language.

* **`openkbs.detectLanguage(text, params)`:** Detects the language of the provided text.

##### Encryption & Storage

* **`openkbs.encrypt(plaintext)`:** Encrypts data using the provided AES key.

* **`openkbs.decrypt(ciphertext)`:** Decrypts data encrypted with the provided AES key.

* **`openkbs.items(data)`:** Interacts with the Items API for creating, updating, and deleting items.

* **`openkbs.createItem({ itemType, itemId, body })`:** Create a new item.

* **`openkbs.updateItem({ itemType, itemId, body })`:** Update an existing item.

* **`openkbs.deleteItem(itemId)`:** Delete an item by ID.

* **`openkbs.getItem(itemId)`:** Get a single item by ID. Returns item with auto-decrypted body.

* **`openkbs.fetchItems({ limit, itemType, beginsWith, from, to, field })`:** Fetch multiple items with filters.
  - `limit`: Max items to return (default: 1000)
  - `itemType`: Filter by item type
  - `beginsWith`: Filter by itemId prefix
  - `from`, `to`: Date range filters
  - `field`: Field name for range query

* **`openkbs.chats(data)`:** Interacts with the Chats API.

* **`openkbs.kb(data)`:** Interacts with the Knowledge Base API. Actions include:
  - `createScheduledTask`: Schedule a future task
  - `getScheduledTasks`: List all scheduled tasks
  - `deleteScheduledTask`: Delete a scheduled task
  - `createPresignedURL`: Get URL for file upload

##### Scheduled Tasks API

Scheduled tasks allow your agent to execute actions at specific times in the future. When a scheduled task fires, it creates a new chat session with the task message.

**Create a scheduled task:**
```javascript
const response = await openkbs.kb({
    action: 'createScheduledTask',
    scheduledTime: Date.now() + 3600000,  // Unix timestamp in ms (1 hour from now)
    taskPayload: {
        message: '[SCHEDULED_TASK] Send weekly report',
        source: 'marketing_agent',
        customData: { reportType: 'weekly' }
    },
    description: 'Weekly report task'  // Short description for listing
});
// Returns: { taskId: 'task_123...' }
```

**List scheduled tasks:**
```javascript
const tasks = await openkbs.kb({ action: 'getScheduledTasks' });
// Returns: { items: [{ timestamp, taskPayload, description, status }] }
```

**Delete a scheduled task:**
```javascript
await openkbs.kb({
    action: 'deleteScheduledTask',
    timestamp: 1704067200000  // The scheduledTime of the task to delete
});
```

**How it works:**
1. Task is stored with the specified `scheduledTime`
2. At the scheduled time, system creates a new chat with `taskPayload.message` as the initial message
3. Your agent's `onRequest`/`onResponse` handlers process the message normally
4. Use `[SCHEDULED_TASK]` prefix in message to help your agent identify scheduled tasks

* **`openkbs.createEmbeddings(input, model)`:** Create embeddings from input text.
  - `model`: `"text-embedding-3-large"` (default) or other OpenAI embedding models
  - Returns: `{ embeddings, totalTokens, dimension }`

* **`openkbs.parseJSONFromText(text)`:** Utility to extract JSON object from text. Returns parsed object or null.

* **`openkbs.textToImage(prompt, params)`:** (Legacy) Generates image using Stability AI. Use `generateImage` for newer models.
  - `params.serviceId`: `"stability.sd35Large"` (default) or `"stability.sd3Medium"`
  - Returns: `{ ContentType, base64Data }`

**Example SDK Usage:**

```javascript
// Generate an image with Gemini
const images = await openkbs.generateImage('a sunset over mountains', {
    model: 'gemini-2.5-flash-image',
    aspect_ratio: '16:9'
});
const base64 = images[0].b64_json;

// Upload the generated image
const result = await openkbs.uploadImage(base64, 'sunset.png', 'image/png');
console.log(result.url);

// Generate a video with Sora 2
const video = await openkbs.generateVideo('a cat playing with yarn', {
    video_model: 'sora-2',
    seconds: 8,
    size: '1280x720'
});

// Check video status if pending
if (video[0]?.status === 'pending') {
    const status = await openkbs.checkVideoStatus(video[0].video_id);
    if (status[0]?.video_url) {
        console.log('Video ready:', status[0].video_url);
    }
}

// Get exchange rates for a date range
const rates = await openkbs.getExchangeRates({
    base: 'EUR',
    symbols: 'USD,GBP,JPY',
    period: '2024-01-01..2024-01-31'
});

// Item CRUD operations
await openkbs.createItem({
    itemType: 'memory',
    itemId: 'memory_user_settings',
    body: { theme: 'dark', notifications: true }
});

const item = await openkbs.getItem('memory_user_settings');
console.log(item.item.body); // { theme: 'dark', notifications: true }

await openkbs.updateItem({
    itemType: 'memory',
    itemId: 'memory_user_settings',
    body: { theme: 'light', notifications: false }
});

// Fetch multiple items
const items = await openkbs.fetchItems({
    itemType: 'memory',
    beginsWith: 'memory_',
    limit: 100
});

// Schedule a task
await openkbs.kb({
    action: 'createScheduledTask',
    scheduledTime: Date.now() + 3600000, // 1 hour from now
    taskPayload: { message: 'Reminder to check analytics' },
    description: 'Analytics reminder'
});

// Create embeddings
const { embeddings, totalTokens } = await openkbs.createEmbeddings(
    'Text to embed',
    'text-embedding-3-large'
);

// Access client info
const clientIP = openkbs.clientHeaders['x-forwarded-for'];
const userAgent = openkbs.clientHeaders['user-agent'];

// Encrypt/decrypt data
const encryptedValue = await openkbs.encrypt(JSON.stringify(userData));
const decryptedValue = JSON.parse(await openkbs.decrypt(encryptedValue));

// Parse JSON from LLM response
const jsonData = openkbs.parseJSONFromText('Some text {"key": "value"} more text');
// Returns: { key: "value" }
```

#### Managing Secrets
To securely manage sensitive information like API keys or database passwords within your backend event handlers (`onRequest`, `onResponse`, etc.), use the `{{secrets.your_secret_name}}` syntax.

Define the placeholder in your code:

```javascript
const apiKey = '{{secrets.external_api_key}}';
const dbPassword = '{{secrets.db_password}}';
```
The actual values for `external_api_key` and `db_password` are set securely within the OpenKBS platform's file manager for your application. These values are injected at runtime and are never committed to your code repository, ensuring your secrets remain confidential.

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

#### Message Types and Content Formats

OpenKBS supports multiple message content types for rich interactions with AI models. Messages can be sent as plain text or as structured content arrays.

##### Plain Text Messages

The simplest format - just a string:

```javascript
{
  "role": "user",
  "content": "Hello, how are you?"
}
```

##### Structured Content Arrays

For rich content (images, documents, videos), use a JSON array as the content:

```javascript
{
  role: "user",
  content: JSON.stringify([
    { type: "text", text: "Analyze this:" },
    { type: "image_url", image_url: { url: "https://example.com/image.jpg" } }
  ])
}
```

##### Supported Content Types

**text** - Plain text content
```javascript
{ type: "text", text: "Your message here" }
```

**image_url** - Images (JPEG, PNG, GIF, WebP, SVG) and PDFs
```javascript
{ type: "image_url", image_url: { url: "https://example.com/photo.jpg" } }
{ type: "image_url", image_url: { url: "https://example.com/document.pdf" } }
```

**file_url** - Video files (Gemini models only)
```javascript
{ type: "file_url", file_url: { url: "https://example.com/video.mp4", mimeType: "video/mp4" } }
{ type: "file_url", file_url: { url: "https://youtube.com/watch?v=VIDEO_ID" } }
```

##### Content Type Examples

**Analyze an image:**
```javascript
content: JSON.stringify([
  { type: "text", text: "What's in this image?" },
  { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } }
])
```

**Compare multiple images:**
```javascript
content: JSON.stringify([
  { type: "text", text: "Compare these:" },
  { type: "image_url", image_url: { url: "https://example.com/image1.jpg" } },
  { type: "image_url", image_url: { url: "https://example.com/image2.jpg" } }
])
```

**Analyze a video (Gemini only):**
```javascript
content: JSON.stringify([
  { type: "text", text: "Describe this video:" },
  { type: "file_url", file_url: { url: "https://example.com/video.mp4", mimeType: "video/mp4" } }
])
```

#### Supported AI Models

OpenKBS provides a unified API for multiple AI providers. Configure your model in `app/settings.json`:

```json
{
  "model": "claude-sonnet-4-5-20250929"
}
```

##### Model Capabilities
**Anthropic Claude** (Vision, PDF)
**OpenAI GPT** (Vision, PDF, Video)
**Google Gemini** (Vision, PDF, Video)
**Other Models** (Text only)

##### Usage in Actions

When building custom actions that return content to the LLM, use the same content type format:

```javascript
// In actions.js - returning an image for analysis
[/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
    const data = JSON.parse(match[1].trim());
    return {
        data: [
            { type: "text", text: `Viewing image: ${data.url}` },
            { type: "image_url", image_url: { url: data.url } }
        ],
        _meta_actions: ["REQUEST_CHAT_MODEL"]
    };
}]

// Returning a video for analysis (Gemini only)
[/<viewVideo>([\s\S]*?)<\/viewVideo>/s, async (match) => {
    const data = JSON.parse(match[1].trim());
    return {
        data: [
            { type: "text", text: `Analyzing video: ${data.url}` },
            { type: "file_url", file_url: { url: data.url, mimeType: "video/mp4" } }
        ],
        _meta_actions: ["REQUEST_CHAT_MODEL"]
    };
}]
```

#### LLM Instructions
`app/instructions.txt`
This file contains the instructions for the LLM, guiding its behavior and interaction with custom functionalities.
Clear and specific instructions ensure the LLM effectively utilizes provided actions and commands.

**Command Format:**
Commands use XML tags with JSON content. The LLM outputs these as regular text, and the backend parses and executes them.

**Example Instructions:**

```
You are an AI assistant.

LIST OF AVAILABLE COMMANDS:
To execute a command, output it as text and wait for system response.

<googleSearch>
{
  "query": "search query"
}
</googleSearch>
Description: """
Get results from the Google Search API.
"""
$InputLabel = """Let me Search in Google!"""
$InputValue = """Search for latest news"""

<createAIImage>
{
  "model": "gemini-2.5-flash-image",
  "aspect_ratio": "16:9",
  "prompt": "image description"
}
</createAIImage>
Description: """
Generate AI images. Models: gemini-2.5-flash-image (supports image editing, aspect ratios), gpt-image-1 (better for text).
"""

<createAIVideo>
{
  "model": "sora-2",
  "size": "1280x720",
  "seconds": 8,
  "prompt": "video description"
}
</createAIVideo>
Description: """
Generate AI videos with Sora 2. Duration: 4, 8, or 12 seconds.
"""

<getExchangeRates>
{
  "base": "EUR",
  "symbols": "USD,GBP",
  "period": "latest"
}
</getExchangeRates>
Description: """
Get exchange rates. Period: 'latest', 'YYYY-MM-DD' (historical), or 'YYYY-MM-DD..YYYY-MM-DD' (time series).
"""

<scheduleTask>
{
  "delay": "2h",
  "message": "Task description"
}
</scheduleTask>
Description: """
Schedule a future task. Use delay (minutes, "2h", "1d") or specific time (UTC).
"""

<getScheduledTasks/>
Description: """
List all scheduled tasks.
"""

<viewImage>
{
  "url": "https://example.com/image.jpg"
}
</viewImage>
Description: """
Add an image to the vision context. Use when you have an image URL that needs to be analyzed.
The image will be added to the conversation for visual analysis.
"""

$Comment = """
Any instructions or comments placed here will be removed before sending to the LLM.
These can span multiple lines and contain any characters, code, or formatting.
"""
```

Command definitions may include \$InputLabel and \$InputValue which are invisible to the LLM:

`$InputLabel` - Text displayed as a selectable option in the chat interface.

`$InputValue` - Text automatically inserted in the chat input when \$InputLabel is selected.

These features provide quick command access and pre-populate inputs, enhancing user interaction.

`zipMessages` and `unzipMessages` command instructions allow the LLM to manage the chat size by summarizing or restoring portions of the conversation, optimizing context retention and token usage.

Instructions:
```
/zipMessages([{"MSG_ID": 1234567890123, "zipSummary": "Optional summary"}])

Description: """
Compresses specified messages to optimize chat memory and reduce costs.
Include message IDs with optional summaries to maintain context while using fewer tokens.
"""
```

```
/unzipMessages([{ "MSG_ID" : 1234567890123 }])
Description: """
Uncompresses the message associated with the provided `MSG_ID`, restoring its original content to the chat.
"""
```

**Important:** `MSG_ID` value must be a unique identifier present anywhere in the message content. The OpenKBS platform automatically handles the zipping and unzipping of messages based on these commands. No custom implementation is required.

#### Instruction Variables

OpenKBS provides dynamic variables that can be used in `app/instructions.txt` to inject runtime information:

- `{{kbId}}` - Current Knowledge Base ID → `abc123xyz`
- `{{openkbsDateNow}}` - Current UTC time (ISO format) → `2025-01-15T14:30:00.000Z`
- `{{openkbsTimestamp}}` - Current Unix timestamp (ms) → `1736948200000`
- `{{openkbsDate:locale:timezone}}` - Formatted date with locale and timezone → `15/01/2025, 16:30:00`
- `{{openkbsDateTZ:timezone}}` - Formatted date with timezone (en-GB locale) → `15/01/2025, 16:30:00`

**Example usage in instructions.txt:**

```
You are a helpful assistant.

## Current Time Information
- UTC Time: {{openkbsDateNow}}
- Local Time (Bulgaria): {{openkbsDate:bg-BG:Europe/Sofia}}
- US Eastern Time: {{openkbsDate:en-US:America/New_York}}
- Unix Timestamp: {{openkbsTimestamp}}
- Agent ID: {{kbId}}

Use the current time to provide time-aware responses.
```

**Locale examples:** `en-US`, `en-GB`, `bg-BG`, `de-DE`, `fr-FR`, `ja-JP`

**Timezone examples:** `UTC`, `Europe/Sofia`, `America/New_York`, `Asia/Tokyo`, `Europe/London`

#### Execution Environment

The OpenKBS backend provides a pre-configured execution environment for your event handlers, including a set of globally available objects and libraries. This eliminates the need to explicitly declare these as dependencies in your `onRequest.json` or `onResponse.json` files.  These predefined resources facilitate various operations:

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

- **`onRenderChatMessage(params)`:** This function is called every time a chat message is rendered. It receives an object with various parameters:

  **Message Context:**
  - `msgIndex` - Index of the message being rendered
  - `messages` - Entire array of chat messages
  - `setMessages` - Function to update the messages state
  - `KB` - Knowledge Base object containing application settings
  - `kbUserData` - Function returning KB user data (chatUsername, etc.)

  **UI Controls:**
  - `setSystemAlert` - Display system alerts: `setSystemAlert({ severity: 'success', message: 'Done!' })`
  - `setBlockingLoading` - Show/hide loading indicator: `setBlockingLoading(true)`
  - `blockingLoading` - Boolean indicating if loading indicator is active
  - `setInputValue` - Set the chat input field value
  - `blockAutoscroll` - Control auto-scrolling behavior

  **API & Communication:**
  - `RequestChatAPI` - Send message to chat API: `await RequestChatAPI([...messages, newMsg])`
  - `axios` - Axios library for HTTP requests
  - `chatAPI` - API to access chat data
  - `itemsAPI` - Functions for manipulating KB items

  **DOM References:**
  - `iframeRef` - Reference to iframe element
  - `chatContainerRef` - Reference to chat container element
  - `sendButtonRef` - Reference to send button element
  - `sendButtonRippleRef` - Reference to send button ripple effect
  - `newChatButtonRef` - Reference to new chat button

  **Utilities & Libraries:**
  - `generateMsgId` - Generates unique message ID
  - `markdownHandler` - Markdown rendering utilities
  - `createEmbeddingItem` - Functions to create embeddings
  - `executeNodejs` - Execute custom JavaScript code inside a VM
  - `initDB` - Initialize IndexedDB
  - `indexedDB` - IndexedDB wrapper for local data access
  - `Files` - File management utilities (same as `openkbs.Files`)
  - `uploadFileAPI` - Upload files to storage

  **Rendering Libraries (pre-loaded):**
  - `theme` - MUI theme object
  - `ReactPrismjs` - Syntax highlighting component
  - `CopyToClipboard` - Clipboard copy component
  - `APIResponseComponent` - Standard API response renderer
  - `CodeViewer` - Code display component
  - `textDetectionsImageFiles` - OCR detection results

  **Return Value:** Return a React component to render the message, or `null` to use default rendering. Return `JSON.stringify({ type: 'HIDDEN_MESSAGE' })` to hide a message completely.

  **Example Usage:**
  ```javascript
  const onRenderChatMessage = async (params) => {
      const { content, role } = params.messages[params.msgIndex];
      const { msgIndex, messages, setSystemAlert, RequestChatAPI,
              kbUserData, generateMsgId, markdownHandler } = params;

      // Hide system messages
      if (role === 'system') {
          return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
      }

      // Custom rendering for specific content
      if (content.includes('<myCommand>')) {
          return <MyCustomComponent content={content} />;
      }

      // Send a follow-up message
      const sendFollowUp = async () => {
          await RequestChatAPI([...messages, {
              role: 'user',
              content: 'Follow up message',
              userId: kbUserData().chatUsername,
              msgId: generateMsgId()
          }]);
      };

      return null; // Use default rendering
  };
  ```

- **`Header(props)`:** This React component is rendered at the top of the chat interface. It receives the same `params` object as `onRenderChatMessage`. It can be used to add custom UI elements or controls to the chat header. If not defined, the standard OpenKBS chat header is displayed.

- **`onDeleteChatMessage(params)`:** This async function is triggered when a chat message is deleted. This function receives a `params` object similar to the `onRenderChatMessage` function but also includes `chatId`, `message` (the message being deleted), and can be used to perform cleanup actions related to custom rendered content. If not defined, a default delete message function is executed.

**Example `contentRender.js` with Command Rendering:**

```javascript
import React from 'react';
import { Box, Tooltip, Typography, Zoom } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

// Define command patterns to detect
const COMMAND_PATTERNS = [
    /<createAIImage>[\s\S]*?<\/createAIImage>/,
    /<createAIVideo>[\s\S]*?<\/createAIVideo>/,
    /<googleSearch>[\s\S]*?<\/googleSearch>/
];

// Icon mapping for commands
const commandIcons = {
    createAIImage: ImageIcon,
    createAIVideo: VideoLibraryIcon,
    googleSearch: SearchIcon
};

// Parse commands from content
const parseCommands = (content) => {
    const commands = [];
    const regex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        try {
            commands.push({
                name: match[1],
                data: JSON.parse(match[2].trim())
            });
        } catch (e) {}
    }
    return commands;
};

// Render command as icon with tooltip
const CommandIcon = ({ command }) => {
    const Icon = commandIcons[command.name] || SearchIcon;
    return (
        <Tooltip title={<pre>{JSON.stringify(command.data, null, 2)}</pre>} arrow>
            <Box sx={{
                display: 'inline-flex',
                width: 32, height: 32,
                borderRadius: '50%',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '2px solid rgba(76, 175, 80, 0.3)',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 0.5
            }}>
                <Icon sx={{ fontSize: 16, color: '#4CAF50' }} />
            </Box>
        </Tooltip>
    );
};

const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];

    // Check for commands in content
    const hasCommand = COMMAND_PATTERNS.some(p => p.test(content));
    if (hasCommand) {
        const commands = parseCommands(content);
        return (
            <Box>
                {commands.map((cmd, i) => <CommandIcon key={i} command={cmd} />)}
            </Box>
        );
    }

    return null; // Use default rendering
};

const Header = ({ setRenderSettings, openkbs, setSystemAlert }) => {
    const [panelOpen, setPanelOpen] = React.useState(false);

    React.useEffect(() => {
        setRenderSettings({
            disableBalanceView: false,
            disableEmojiButton: true,
            backgroundOpacity: 0.02
        });
    }, [setRenderSettings]);

    return (
        <>
            {/* Settings button */}
            <Box
                onClick={() => setPanelOpen(true)}
                sx={{
                    position: 'absolute',
                    top: 90, left: 340,
                    width: 40, height: 40,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 1200
                }}
            >
                ⚙️
            </Box>

            {/* Simple settings panel */}
            {panelOpen && (
                <Box
                    onClick={() => setPanelOpen(false)}
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 1300,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Box
                        onClick={e => e.stopPropagation()}
                        sx={{
                            width: 400,
                            backgroundColor: 'white',
                            borderRadius: 2,
                            p: 3
                        }}
                    >
                        <Typography variant="h6">Settings</Typography>
                        <Typography>Your custom admin panel here</Typography>
                    </Box>
                </Box>
            )}
        </>
    );
};

const exports = { onRenderChatMessage, Header };
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

#### Header Component Props

The `Header` component receives all available props from the OpenKBS chat interface. These props enable full control over chat behavior, UI state, and data access.

**All Available Props:**

- `messages` (Array) - Current chat messages array
- `setMessages` (Function) - Update messages array (e.g., add welcome message)
- `KB` (Object) - Current Knowledge Base data
- `openkbs` (Object) - OpenKBS SDK object (see Frontend SDK section)
- `setRenderSettings` (Function) - Configure UI rendering options
- `setSystemAlert` (Function) - Show alert notifications
- `setBlockingLoading` (Function) - Show/hide full-screen loading overlay
- `RequestChatAPI` (Function) - Send messages to chat API
- `chatAPI` (Object) - Chat API utilities
- `itemsAPI` (Object) - Items API (low-level)
- `Files` (Object) - Files API module
- `indexedDB` (Object) - IndexedDB interface for local storage
- `initDB` (Function) - Initialize IndexedDB
- `kbUserData` (Function) - Get current user data
- `navigateToChat` (Function) - Navigate to different chat
- `setIsContextItemsOpen` (Function) - Toggle context items panel
- `isContextItemsOpen` (Boolean) - Context items panel state
- `chatContainerRef` (Ref) - Reference to chat container element
- `renderSettings` (Object) - Current render settings
- `blockingLoading` (Boolean) - Loading state
- `blockAutoscroll` (Boolean) - Auto-scroll state
- `axios` (Object) - Axios HTTP client

**Common Usage Patterns:**

*setRenderSettings* - Configure UI behavior:
```javascript
const Header = ({ setRenderSettings }) => {
    useEffect(() => {
        setRenderSettings({
            disableBalanceView: false,
            disableEmojiButton: true,
            disableChatModelsSelect: true,
            disableShareButton: true,
            disableMultichat: true,
            disableMobileLeftButton: true,
            disableTextToSpeechButton: true,
            disableInitialScroll: true,
            backgroundOpacity: 0.02,
            customStreamingLoader: true,
            inputLabelsQuickSend: true,
            setMessageWidth: (content) => content.includes('<html') ? '90%' : undefined
        });
    }, [setRenderSettings]);
};
```

*setSystemAlert* - Show notifications:
```javascript
const Header = ({ setSystemAlert }) => {
    const showSuccess = () => {
        setSystemAlert({
            msg: 'Operation completed successfully',
            type: 'success',  // 'success', 'error', 'warning', 'info'
            duration: 3000    // milliseconds
        });
    };

    const showError = (error) => {
        setSystemAlert({
            msg: error.message,
            type: 'error',
            duration: 5000
        });
    };
};
```

*setBlockingLoading* - Full-screen loading overlay:
```javascript
const Header = ({ setBlockingLoading, openkbs }) => {
    const loadData = async () => {
        setBlockingLoading(true);  // Show loading
        // Or with custom text:
        // setBlockingLoading({ text: 'Loading files...' });

        try {
            const files = await openkbs.Files.listFiles('files');
            // Process files...
        } finally {
            setBlockingLoading(false);  // Hide loading
        }
    };
};
```

*RequestChatAPI* - Send messages programmatically:
```javascript
const Header = ({ RequestChatAPI, messages, kbUserData, navigateToChat }) => {
    const sendQuickMessage = (prompt) => {
        navigateToChat(null);  // Start new chat
        RequestChatAPI([{
            role: 'user',
            content: prompt,
            userId: kbUserData().chatUsername,
            msgId: `${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`
        }]);
    };

    return (
        <button onClick={() => sendQuickMessage('Help me create a marketing plan')}>
            Quick Action
        </button>
    );
};
```

*setMessages* - Initialize welcome message:
```javascript
const Header = ({ messages, setMessages, openkbs }) => {
    useEffect(() => {
        const initWelcome = async () => {
            // Only for new chats
            if (!messages || messages.length === 0) {
                const profile = await openkbs.getItem('memory_profile');

                if (!profile?.item) {
                    setMessages([{
                        msgId: `${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`,
                        role: 'assistant',
                        content: 'Welcome! Tell me about your business to get started.'
                    }]);
                }
            }
        };

        initWelcome();
    }, [messages, setMessages, openkbs]);
};
```

*navigateToChat* - Chat navigation:
```javascript
const Header = ({ navigateToChat }) => {
    // Navigate to specific chat
    const goToChat = (chatId) => navigateToChat(chatId);

    // Start new chat
    const newChat = () => navigateToChat(null);
};
```

**Complete Header Example:**

```javascript
import React, { useEffect, useState } from 'react';
import { IconButton, Dialog, Box, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

const Header = ({
    setRenderSettings,
    openkbs,
    setSystemAlert,
    setBlockingLoading,
    messages,
    setMessages,
    RequestChatAPI,
    kbUserData,
    navigateToChat
}) => {
    const [panelOpen, setPanelOpen] = useState(false);
    const [files, setFiles] = useState([]);

    // Configure UI on mount
    useEffect(() => {
        setRenderSettings({
            disableEmojiButton: true,
            disableChatModelsSelect: true,
            backgroundOpacity: 0.02
        });
    }, [setRenderSettings]);

    // Initialize welcome message for new chats
    useEffect(() => {
        if (!messages?.length && openkbs) {
            setMessages([{
                msgId: `${Date.now()}-000000`,
                role: 'assistant',
                content: 'Welcome! How can I help you today?'
            }]);
        }
    }, [messages, setMessages, openkbs]);

    // Load files when panel opens
    const loadFiles = async () => {
        setBlockingLoading(true);
        try {
            const result = await openkbs.Files.listFiles('files');
            setFiles(result || []);
        } catch (e) {
            setSystemAlert({ msg: e.message, type: 'error', duration: 5000 });
        } finally {
            setBlockingLoading(false);
        }
    };

    // Quick action handler
    const quickAction = (prompt) => {
        navigateToChat(null);
        RequestChatAPI([{
            role: 'user',
            content: prompt,
            userId: kbUserData().chatUsername,
            msgId: `${Date.now()}-${Math.floor(Math.random() * 900000)}`
        }]);
    };

    return (
        <>
            <IconButton
                onClick={() => { setPanelOpen(true); loadFiles(); }}
                sx={{ position: 'absolute', top: 90, left: 340, zIndex: 1200 }}
            >
                <SettingsIcon />
            </IconButton>

            <Button
                onClick={() => quickAction('Create a marketing plan')}
                sx={{ position: 'absolute', top: 90, left: 400, zIndex: 1200 }}
            >
                Quick Action
            </Button>

            <Dialog open={panelOpen} onClose={() => setPanelOpen(false)}>
                <Box sx={{ p: 2 }}>
                    <h3>Files ({files.length})</h3>
                    {files.map((f, i) => <div key={i}>{f.name}</div>)}
                </Box>
            </Dialog>
        </>
    );
};

const exports = { Header };
window.contentRender = exports;
export default exports;
```

#### Frontend SDK (`openkbs` object)

The `openkbs` object is passed to `Header` and `onRenderChatMessage` functions, providing access to item storage, file management, and KB sharing APIs.

**Properties:**
```javascript
const Header = ({ openkbs }) => {
    console.log(openkbs.kbId);      // Current KB ID
    console.log(openkbs.KBData);    // Full KB configuration
    console.log(openkbs.Files);     // Files API module
    console.log(openkbs.itemsAPI);  // Items API module (low-level)
    console.log(openkbs.KBAPI);     // KB API module
};
```

##### Item CRUD Operations

```javascript
// Create an item
await openkbs.createItem({
    itemType: 'memory',
    itemId: 'memory_user_preferences',
    body: { theme: 'dark', language: 'en' }  // Auto-encrypted
});

// Update an item
await openkbs.updateItem({
    itemType: 'memory',
    itemId: 'memory_user_preferences',
    body: { theme: 'light', language: 'bg' }
});

// Get a single item (auto-decrypted)
const result = await openkbs.getItem('memory_user_preferences');
console.log(result.item.body);  // { theme: 'light', language: 'bg' }

// Delete an item
await openkbs.deleteItem('memory_user_preferences');

// Fetch multiple items with filters
const items = await openkbs.fetchItems({
    itemType: 'memory',           // Filter by item type
    limit: 100,                   // Max items to return
    beginsWith: 'memory_',        // Filter by ID prefix
    from: '2024-01-01',           // Range start (for date fields)
    to: '2024-12-31',             // Range end
    field: 'createdAt',           // Field for range query
});

// Items are returned with decrypted bodies
items.items.forEach(({ item, meta }) => {
    console.log(meta.itemId, item.body);
});
```

##### Encryption Utilities

```javascript
// Encrypt sensitive data
const encrypted = await openkbs.encrypt('sensitive data');

// Decrypt data
const decrypted = await openkbs.decrypt(encrypted);
```

##### Files API (`openkbs.Files`)

```javascript
// List files in a namespace
const files = await openkbs.Files.listFiles('files');

// Upload a file
const file = new File(['content'], 'example.txt', { type: 'text/plain' });
await openkbs.Files.uploadFileAPI(file, 'files', (progress) => {
    console.log(`Upload progress: ${progress}%`);
});

// Create presigned URL for upload/download
const url = await openkbs.Files.createPresignedURL(
    'files',           // namespace
    'putObject',       // 'putObject' or 'getObject'
    'myfile.pdf',      // filename
    'application/pdf'  // content type
);

// Delete a file
await openkbs.Files.deleteRawKBFile('filename.txt', 'files');

// Rename a file
await openkbs.Files.renameFile(
    'files/kbId/old-name.txt',  // old path
    'new-name.txt',              // new name
    'files'                      // namespace
);

// Secrets management
const secrets = await openkbs.Files.listSecrets();
await openkbs.Files.createSecretWithKBToken('API_KEY', 'secret-value');
await openkbs.Files.deleteSecret('API_KEY');

// File versions
const versions = await openkbs.Files.listVersions('myfile.js', 'functions');
await openkbs.Files.restoreVersion('version-id', 'myfile.js', 'functions');
```

##### KB API (`openkbs.KBAPI`)

```javascript
// Get KB configuration
const kb = await openkbs.KBAPI.getKB();

// Share KB with another user (by email)
await openkbs.KBAPI.shareKBWith('user@example.com');

// Get list of users KB is shared with
const shares = await openkbs.KBAPI.getKBShares();
// Returns: { sharedWith: ['user1@example.com', 'user2@example.com'] }

// Remove share
await openkbs.KBAPI.unshareKBWith('user@example.com');

// API Keys management
const keys = await openkbs.KBAPI.getAPIKeys();
const newKey = await openkbs.KBAPI.createAPIKey('My API Key', { resources: '*' });
await openkbs.KBAPI.deleteAPIKey('api-key-id');

// Update KB variable
await openkbs.KBAPI.updateVariable('customSetting', 'value');

// Search items (semantic search if embeddings enabled)
const results = await openkbs.KBAPI.searchItems('search query', openkbs.kbId, 100);
```

##### Complete Header Example with Admin Panel

```javascript
import React, { useState, useEffect } from 'react';
import { Box, IconButton, Dialog, Tabs, Tab, List, ListItem,
         ListItemText, TextField, Button, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

const Header = ({ openkbs, setRenderSettings, setSystemAlert, setBlockingLoading }) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(0);
    const [files, setFiles] = useState([]);
    const [shares, setShares] = useState([]);
    const [email, setEmail] = useState('');

    useEffect(() => {
        setRenderSettings({
            disableEmojiButton: true,
            backgroundOpacity: 0.02
        });
    }, []);

    // Load files
    const loadFiles = async () => {
        setBlockingLoading(true);
        try {
            const result = await openkbs.Files.listFiles('files');
            setFiles(result || []);
        } finally {
            setBlockingLoading(false);
        }
    };

    // Load shares
    const loadShares = async () => {
        const result = await openkbs.KBAPI.getKBShares();
        setShares(result?.sharedWith || []);
    };

    // Share with user
    const shareWith = async () => {
        try {
            await openkbs.KBAPI.shareKBWith(email);
            setSystemAlert({ msg: `Shared with ${email}`, type: 'success', duration: 3000 });
            setEmail('');
            loadShares();
        } catch (e) {
            setSystemAlert({ msg: e.message, type: 'error', duration: 5000 });
        }
    };

    useEffect(() => {
        if (open && tab === 0) loadFiles();
        if (open && tab === 1) loadShares();
    }, [open, tab]);

    return (
        <>
            <IconButton
                onClick={() => setOpen(true)}
                sx={{ position: 'absolute', top: 80, right: 20, zIndex: 1200 }}
            >
                <SettingsIcon />
            </IconButton>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6">Settings</Typography>
                    <Tabs value={tab} onChange={(e, v) => setTab(v)}>
                        <Tab label="Files" />
                        <Tab label="Sharing" />
                    </Tabs>

                    {tab === 0 && (
                        <List>
                            {files.map((file, i) => (
                                <ListItem key={i}>
                                    <ListItemText primary={file.name} />
                                </ListItem>
                            ))}
                        </List>
                    )}

                    {tab === 1 && (
                        <Box>
                            <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <Button variant="contained" onClick={shareWith}>
                                    Share
                                </Button>
                            </Box>
                            <List>
                                {shares.map((s, i) => (
                                    <ListItem key={i}>
                                        <ListItemText primary={s} />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </Box>
            </Dialog>
        </>
    );
};

const exports = { Header };
window.contentRender = exports;
export default exports;
```

## API

OpenKBS provides APIs to interact programmatically with your application. These APIs allow you to perform actions like starting new chats, retrieving chat messages, and managing data within your application. Data exchanged with these APIs is encrypted and decrypted using AES-256 encryption.

### Keys and Authentication

- **kbId**: Agent ID from OpenKBS app > Access > kbId.
- **apiKey**: API key from OpenKBS app > Access > API Keys.
- **AESKey**: Encryption key from OpenKBS app > Access > AES Key.

### Encryption and Decryption

OpenKBS utilizes AES-256 encryption to secure sensitive data. The encryption process involves generating a salt, deriving a key and initialization vector (IV) from a passphrase using a key derivation function (KDF), and then encrypting the data using AES-256 in CBC mode. The encrypted data is then prepended with the salt and a marker, and finally base64 encoded.  Decryption reverses this process.

**Example in JavaScript (using CryptoJS):**

```javascript
import CryptoJS from 'crypto-js';

export const encrypt = (text, AESKey) => {
    return CryptoJS.AES.encrypt(text, AESKey).toString();
};

export const decrypt = (ciphertext, AESKey) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, AESKey);
    return bytes.toString(CryptoJS.enc.Utf8);
};
```

### API Endpoints

#### newChat

This endpoint initiates a new task (chat session) with a specific title and initial message.

-  **Endpoint:** `https://chat.openkbs.com/`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "kbId": "YOUR_KB_ID",
  "apiKey": "YOUR_API_KEY",
  "chatTitle": "Chat Title",
  "encrypted": true,
  "message": "Initial task content (must be encrypted)" 
}
```

**Response (JSON):**

```json
[
  {
    "createdChatId": "1737908556342-603701"
  },
  { "id":1, "content": "other content"}
]
```


#### getChatMessages

This endpoint retrieves messages from a specified chat.

-  **Endpoint:** `https://chat.openkbs.com/`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "action": "getChatMessages",
  "kbId": "YOUR_KB_ID",
  "apiKey": "YOUR_API_KEY",
  "chatId": "createdChatId"
}
```

**Response (JSON):**

```json
[
  {
    "data": {
      "messages": [
        {
          "content": "Message content (encrypted)",
          "role": "sender_role (e.g., 'user', 'assistant')",
          "msgId": "message_id"
        },
        // ... other messages
      ]
    }
  }
]
```

#### signTransaction

This endpoint is used to sign a JWT, which is necessary for accessing the ledger endpoint to retrieve transactions and account balances.

-  **Endpoint:** `https://kb.openkbs.com/`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "kbId": "YOUR_KB_ID",
  "action": "signTransaction",
  "apiKey": "YOUR_API_KEY"
}
```

- **Response:**

The response contains a signed JWT used for authenticating requests to the ledger and account balance endpoints.


```json
{
  "transactionJWT": "xxx"
}
```

#### accountBalances

This endpoint retrieves the account balance for a specific resource, such as credits.

-  **Endpoint:** `https://ledger.openkbs.com/account-balances`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "apiKey": "YOUR_API_KEY",
  "transactionJWT": "SIGNED_JWT_FROM_SIGN_TRANSACTION"
}
```

- **Response:**

The response is a JSON object containing account balance details:

```json
{
  "balance": 1000000, // 1000 credits === 1 cent
  "accountId": "0000da3b669a3426019ffc8ddae93c2e",
  "resourceId": "credits",
  "lastTransactionSubject": "kbId",
  "userId": "xxx646594380230f",
  "accountName": "User Account"
}
```

#### transactions

This endpoint retrieves a list of transactions associated with the specified agent.

-  **Endpoint:** `https://ledger.openkbs.com/transactions`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "lastEvaluatedKey": null,
  "limit": 25, // or any specified limit
  "apiKey": "YOUR_API_KEY",
  "transactionJWT": "SIGNED_JWT_FROM_SIGN_TRANSACTION"
}
```

- **Response:**

The response is a JSON object containing a `transactions` array. Each transaction object includes:

```json
{
  "transactions": [
    {
      "subject": "kbId",
      "accountId": "0000da3b669a3426019ffc8ddae93c2e",
      "resourceId": "credits",
      "subjectId": "xxxx2sxeobc9",
      "amount": -6024,
      "message": "Input: 11816 tokens, Output: 649 tokens",
      "remoteAccount": "xxx1b21a831389b59bbc263face0e41d",
      "transactionId": "1737909703561-305239"
    }
    // ... other transactions
  ]
}
```

#### chatAddMessages

This endpoint allows adding messages to a specified chat, which is useful for integrating with external systems or logging events.  Combined with the `onAddMessages` event handler, these added messages can trigger actions within your OpenKBS application.

-  **Endpoint:** `https://chat.openkbs.com/`
-  **Method:** `POST`
-  **Request Body (JSON):**

```json
{
  "action": "chatAddMessages",
  "chatId": "Chat ID",
  "messages": [
    {
      "role": "Sender role (e.g., 'user', 'assistant', 'system')",
      "content": "Message content",
      "msgId": "Unique message ID (recommended to include a timestamp)"
    },
    // ... more messages can be added to this array
  ],
  "apiKey": "YOUR_API_KEY", // Required for authentication
  "kbId": "YOUR_KB_ID"
}
```

#### createPublicChatToken

This endpoint allows third-party systems (like WordPress, e-commerce platforms, etc.) to generate signed JWT tokens for their users to interact with the OpenKBS agent. This enables secure, limited access to the agent while maintaining user context and authorization.

- **Endpoint:** `https://chat.openkbs.com/`
-  **Method:** `POST`
-  **Request Body (JSON):**

For new chat session:
```json
{
  "action": "createPublicChatToken",
  "kbId": "YOUR_KB_ID",
  "apiKey": "YOUR_API_KEY",
  "title": "Chat Title (must be encrypted)",
  "variables": {
    "publicUserName": "User's Name",
    "publicUserId": "User's ID",
    "publicUserEmail": "User's Email (optional)",
    // Additional custom variables can be added here
  },
  "maxMessages": 50, // Limit messages per chat session
  "maxTokens": 64000, // Limit token usage
  "tokenExpiration": 3600000, // Token validity period in milliseconds
  "messages": [
    {
      "msgId": "unique_message_id",
      "role": "assistant",
      "content": "Welcome message"
    }
  ]
}
```

For existing chat:
```json
{
  "action": "createPublicChatToken",
  "kbId": "YOUR_KB_ID",
  "apiKey": "YOUR_API_KEY",
  "chatId": "EXISTING_CHAT_ID",
  "variables": {
    "publicUserName": "User's Name",
    "publicUserId": "User's ID",
    "publicUserEmail": "User's Email (optional)"
  },
  "maxMessages": 50,
  "maxTokens": 64000,
  "tokenExpiration": 3600000
}
```

**Parameters:**
- `title`: (Required for new chat) Encrypted chat title
- `chatId`: (Required for existing chat) ID of existing chat session
- `variables`: Object containing user information
- `maxMessages`: Maximum number of messages allowed in the chat
- `maxTokens`: Maximum number of tokens allowed for LLM processing
- `tokenExpiration`: Token expiration time in milliseconds
- `messages`: (Optional) Initial messages for new chat sessions

**Key Features:**
- Enables third-party systems to create authorized chat sessions for their users
- Variables passed in the token can be accessed in agent event handlers using `{{variables.variableName}}`
- Enforces usage limits per user/session
- Maintains security by signing user context in JWT

This token can be used for subsequent client-side interactions with the chat system.

### OpenKBS Chat Widget Integration

#### Basic Setup

First, include the OpenKBS Chat Widget script in your HTML:

```html
<script src="https://openkbs.com/widget.js"></script>
```

#### Widget Initialization

```javascript
openkbsWidget('init', {
    app: 'YOUR_KB_ID', // Your Knowledge Base ID
    endChatMessage: 'Are you sure you want to end this chat session?',
    
    // Optional prompt configuration
    promptTitle: "Can't find what you're looking for?",
    promptDescription: "Let me help!",
    showPromptAfter: 5000, // Show prompt after 5 seconds
    removePromptAfter: 10000, // Remove prompt after 10 seconds

    // Session management
    initSession: async () => {
        // Initialize or retrieve chat session (use createPublicChatToken to generate the session)
        const chatSession = {
            token: 'JWT_TOKEN_FROM_SERVER', 
            chatId: 'CHAT_ID',
            kbId: 'YOUR_KB_ID'
        };
        localStorage.setItem('openkbsChatSession', JSON.stringify(chatSession));
        return;
    },

    // Custom actions that can be triggered by the agent
    actions: {
        setFormValue: (data) => {
            const element = document.querySelector(data.selector);
            if (element) {
                element.value = data.value;
            }
        },
    }
});


## License

This project is licensed under the MIT License. For more details, please refer to the [LICENSE](https://github.com/open-kbs/openkbs-chat/blob/main/LICENSE) file.

## Contributing

We welcome contributions from the community! Please feel free to submit issues, fork the repository, and send pull requests.

## Contact

For more information, visit our [official website](https://openkbs.com) or join our community discussions on [GitHub](https://github.com/open-kbs/openkbs/discussions).