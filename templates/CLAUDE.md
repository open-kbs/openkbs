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
];
```

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

**Other Methods:**
- `openkbs.googleSearch(query, { searchType: 'image' })`
- `openkbs.webpageToText(url)`
- `openkbs.sendMail(to, subject, body)`
- `openkbs.getExchangeRates({ base, symbols, period })` - period: 'latest', 'YYYY-MM-DD', 'YYYY-MM-DD..YYYY-MM-DD'
- `openkbs.createItem/updateItem/deleteItem` - for memory storage
- `openkbs.kb({ action: 'createScheduledTask', scheduledTime, taskPayload })`

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
```javascript
import React from 'react';

// Render commands as icons
const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
    // Custom rendering logic
    return null; // null = use default
};

// Custom header with settings panel
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

### NPM Dependencies
Add to `contentRender.json`. Built-in (fixed): react, @mui/material, @mui/icons-material, @emotion/react.

# OpenKBS Commands
- `openkbs create my-agent` - Create new agent
- `openkbs push` - Deploy to cloud
- `openkbs update` - Update knowledge base

# Development Guidelines
- Backend deps → `onRequest.json` or `onResponse.json`
- Frontend deps → `contentRender.json`
- Provide README.md for the agent
