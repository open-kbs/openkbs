# Claude Code Instructions

# MANDATORY FIRST STEPS
**CRITICAL**: Before taking ANY action, you must:

**FIRST**: Update the knowledge base:
```bash
openkbs update
```

**SECOND**: Read all files in `.openkbs/knowledge/examples/` directory and subdirectories using the Read tool (skip icon.png, src/Frontend/Presentational/*, src/Events/Helpers/*).

**THIRD**: Read existing agent code in `./app/` and `./src/` folders.

# Critical Rules
- Never skip reading examples
- Never guess framework methods, settings or variables — always reference the examples
- In src/Events and src/Frontend always use Imports (not Require)
- Valid values for `_meta_actions` key are `[]` or `["REQUEST_CHAT_MODEL"]`
- Add npm dependencies only if necessary
- Before using third-party services in handlers, ask the user for permission

# Architecture Overview

OpenKBS provides **two execution environments**:

## Cloud Environment (`./src/Events/`)
Runs in serverless compute (stateless, ephemeral). Can only reach internet-accessible resources.

### Backend Handlers
- **`onRequest`**: Triggered on user message, allows pre-processing
- **`onResponse`**: Activated after LLM response, enables command extraction and action execution
- **`onCronjob`**: Scheduled task execution (define schedule with `handler.CRON_SCHEDULE`)
- **`onAddMessages`**: Intercept messages added via API
- **`onPublicAPIRequest`**: Handle public API requests (no auth required)

### Command Format
Commands use XML tags with JSON content. The LLM outputs these as regular text:
```xml
<commandName>
{
  "param1": "value1",
  "param2": "value2"
}
</commandName>
```

Self-closing tags for commands without parameters:
```xml
<commandName/>
```

### Action Pattern
```javascript
// src/Events/actions.js
export const getActions = (meta) => [
    [/<commandName>([\s\S]*?)<\/commandName>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        // Execute action
        return { type: 'RESULT', data: result, ...meta };
    }],

    // View image - adds to LLM vision context
    [/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        return {
            data: [
                { type: "text", text: `Viewing: ${data.url}` },
                { type: "image_url", image_url: { url: data.url } }
            ],
            ...meta
        };
    }],
];
```

### onCronjob Handler
```javascript
// src/Events/onCronjob.js
export const handler = async (event) => {
    // Scheduled task logic
    await openkbs.chats({
        chatTitle: 'Scheduled Report',
        message: JSON.stringify([{ type: "text", text: "Daily report" }])
    });
    return { success: true };
};

// IMPORTANT: Define schedule at end of file
handler.CRON_SCHEDULE = "0 * * * *"; // Every hour
```

Cron patterns: `* * * * *` (every min), `*/5 * * * *` (5 min), `0 * * * *` (hourly), `0 0 * * *` (daily)

### Key SDK Methods
**Image Generation:**
```javascript
const images = await openkbs.generateImage(prompt, {
    model: 'gemini-2.5-flash-image', // or 'gpt-image-1'
    aspect_ratio: '16:9',            // gemini only
    imageUrls: ['url'],              // gemini only - for editing
    size: '1024x1024'                // gpt-image-1 only
});
const result = await openkbs.uploadImage(images[0].b64_json, 'file.png', 'image/png');
```

**Video Generation:**
```javascript
const video = await openkbs.generateVideo(prompt, {
    video_model: 'sora-2',           // or 'sora-2-pro'
    seconds: 8,                      // 4, 8, or 12
    size: '1280x720',                // or '720x1280'
    input_reference_url: 'url'       // optional reference image
});
const status = await openkbs.checkVideoStatus(videoId);
```

**Item Storage (Memory):**
```javascript
await openkbs.createItem({ itemType: 'memory', itemId: 'memory_key', body: { data } });
const item = await openkbs.getItem('memory_key');
await openkbs.updateItem({ itemType: 'memory', itemId: 'memory_key', body: { newData } });
await openkbs.deleteItem('memory_key');
const items = await openkbs.fetchItems({ beginsWith: 'memory_', limit: 100 });
```

**Other Methods:**
- `openkbs.googleSearch(query, { searchType: 'image' })`
- `openkbs.webpageToText(url)`
- `openkbs.sendMail(to, subject, body)`
- `openkbs.getExchangeRates({ base, symbols, period })` - period: 'latest', 'YYYY-MM-DD', 'YYYY-MM-DD..YYYY-MM-DD'
- `openkbs.chats({ chatTitle, message })` - create new chat (for notifications)
- `openkbs.kb({ action: 'createScheduledTask', scheduledTime, taskPayload })`
- `openkbs.parseJSONFromText(text)` - extract JSON from text

**Properties:**
- `openkbs.kbId` - current KB ID
- `openkbs.clientHeaders` - client headers (IP, user-agent, etc.)

### NPM Dependencies
Add to handler's JSON file:
```json
{
  "dependencies": { "mysql2": "latest" }
}
```

### Secrets Management
Use `{{secrets.KEY}}` placeholders:
```javascript
const key = "{{secrets.KEY}}"
```

## Browser Environment (`./src/Frontend/`)
Runs in user's browser at `https://[kbId].apps.openkbs.com`. React-based UI customization.

### contentRender.js

**`onRenderChatMessage(params)`** - Custom message rendering. Key params:
- `msgIndex`, `messages`, `setMessages` - message context
- `setSystemAlert({ severity, message })` - show alerts
- `setBlockingLoading(bool)` - loading indicator
- `RequestChatAPI(messages)` - send chat messages
- `kbUserData()`, `generateMsgId()` - user info and ID generation
- `markdownHandler`, `theme` - rendering utilities

Return React component, `null` for default, or `JSON.stringify({ type: 'HIDDEN_MESSAGE' })` to hide.

**`Header(props)`** - Custom header component. Same props as `onRenderChatMessage`.

```javascript
import React from 'react';

const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];
    const { msgIndex, messages, markdownHandler } = params;

    // Hide system messages
    if (role === 'system') return JSON.stringify({ type: 'HIDDEN_MESSAGE' });

    // Custom rendering for commands
    if (content.includes('<myCommand>')) {
        return <MyComponent content={content} />;
    }

    return null; // Use default rendering
};

const Header = ({ setRenderSettings, openkbs }) => {
    React.useEffect(() => {
        setRenderSettings({
            disableEmojiButton: true,
            backgroundOpacity: 0.02
        });
    }, []);
    return <div>Custom Header</div>;
};

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
```

### Frontend openkbs Object
```javascript
// Item operations (auto-encrypted)
await openkbs.createItem({ itemType, itemId, body });
await openkbs.getItem(itemId);
await openkbs.fetchItems({ itemType, beginsWith, limit });

// Files API
await openkbs.Files.listFiles('files');
await openkbs.Files.uploadFileAPI(file, 'files', onProgress);
await openkbs.Files.deleteRawKBFile(filename, 'files');

// Sharing
await openkbs.KBAPI.shareKBWith('email@example.com');
await openkbs.KBAPI.getKBShares();
```

### NPM Dependencies
Add to `contentRender.json`. Built-in (fixed): react, @mui/material, @mui/icons-material, @emotion/react.

# OpenKBS Commands
- `openkbs create my-agent` - Create new agent
- `openkbs push` - Deploy to cloud
- `openkbs update` - Update knowledge base

# Development Guidelines
- Backend deps → `onRequest.json`, `onResponse.json`, `onCronjob.json`
- Frontend deps → `contentRender.json`
- Provide README.md for the agent
