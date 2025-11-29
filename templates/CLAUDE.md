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
export const getActions = (meta, event) => [
    // Basic command with JSON parsing
    [/<commandName>([\s\S]*?)<\/commandName>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        return { type: 'RESULT', data: result, ...meta, _meta_actions: ['REQUEST_CHAT_MODEL'] };
    }],

    // View image - adds to LLM vision context
    [/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        return {
            data: [
                { type: "text", text: `Viewing: ${data.url}` },
                { type: "image_url", image_url: { url: data.url } }
            ],
            ...meta, _meta_actions: ['REQUEST_CHAT_MODEL']
        };
    }],

    // Memory operations
    [/<setMemory>([\s\S]*?)<\/setMemory>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        await openkbs.updateItem({
            itemType: 'memory',
            itemId: data.itemId.startsWith('memory_') ? data.itemId : `memory_${data.itemId}`,
            body: { value: data.value, updatedAt: new Date().toISOString() }
        });
        return { type: 'MEMORY_UPDATED', itemId: data.itemId, ...meta, _meta_actions: ['REQUEST_CHAT_MODEL'] };
    }],

    // Delete item
    [/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        await openkbs.deleteItem(data.itemId);
        return { type: 'ITEM_DELETED', itemId: data.itemId, ...meta, _meta_actions: ['REQUEST_CHAT_MODEL'] };
    }],
];
```

### onCronjob Handler
```javascript
// src/Events/onCronjob.js
export const handler = async (event) => {
    // Create a new chat with notification
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

## Backend SDK (openkbs object)

### Image & Video Generation
```javascript
// Generate image with Gemini (supports editing with reference images)
const images = await openkbs.generateImage(prompt, {
    model: 'gemini-2.5-flash-image', // or 'gpt-image-1' (better for text)
    aspect_ratio: '16:9',            // gemini: 1:1, 16:9, 9:16, 4:3, 3:4
    imageUrls: ['reference.jpg'],    // gemini only - for editing
    size: '1024x1024'                // gpt-image-1: 1024x1024, 1536x1024, 1024x1536
});
const uploaded = await openkbs.uploadImage(images[0].b64_json, 'output.png', 'image/png');
console.log(uploaded.url);

// Generate video with Sora 2
const video = await openkbs.generateVideo(prompt, {
    video_model: 'sora-2',           // or 'sora-2-pro' (higher quality)
    seconds: 8,                      // 4, 8, or 12
    size: '1280x720',                // or '720x1280' (portrait)
    input_reference_url: 'img.jpg'   // optional reference image
});
// Check status if pending
if (video[0]?.status === 'pending') {
    const status = await openkbs.checkVideoStatus(video[0].video_id);
}
```

### Item Storage (Memory System)
```javascript
// Create/Update item (upsert pattern)
async function upsertItem(itemType, itemId, body) {
    try {
        await openkbs.updateItem({ itemType, itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType, itemId, body });
    }
}

// Memory with expiration
await upsertItem('memory', 'memory_user_preferences', {
    value: { theme: 'dark', language: 'en' },
    updatedAt: new Date().toISOString(),
    exp: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
});

// Get single item (body is auto-decrypted)
const item = await openkbs.getItem('memory_user_preferences');
console.log(item.item.body.value);

// Fetch multiple items with filters
const items = await openkbs.fetchItems({
    itemType: 'memory',
    beginsWith: 'memory_',
    limit: 100,
    sortBy: 'createdAt',
    sortOrder: 'desc'
});

// Delete item
await openkbs.deleteItem('memory_user_preferences');

// Cleanup expired items
const now = new Date();
for (const item of items.items) {
    if (item.item?.body?.exp && new Date(item.item.body.exp) < now) {
        await openkbs.deleteItem(item.meta.itemId);
    }
}
```

### Search & Content
```javascript
// Google Search
const results = await openkbs.googleSearch('AI trends 2025');
const images = await openkbs.googleSearch('sunset', { searchType: 'image' });

// Extract text from webpage
const text = await openkbs.webpageToText('https://example.com');

// OCR - extract text from image
const ocr = await openkbs.imageToText('https://example.com/document.jpg');
console.log(ocr.results);

// Extract text from PDF/DOC
const docText = await openkbs.documentToText('https://example.com/file.pdf');
```

### Communication
```javascript
// Send email (HTML supported)
await openkbs.sendMail('user@example.com', 'Subject', '<h1>Hello</h1><p>Content</p>');

// Text to speech
const audio = await openkbs.textToSpeech('Hello world');
console.log(audio.audioContent); // base64

// Speech to text
const transcript = await openkbs.speechToText('https://example.com/audio.mp3');

// Translation
const { translation } = await openkbs.translate('Hello world', 'bg');

// Language detection
const { language } = await openkbs.detectLanguage('Здравей свят');
```

### Chat Operations
```javascript
// Create new chat (for notifications, scheduled tasks)
await openkbs.chats({
    chatTitle: 'Alert: Fire Detected',
    message: JSON.stringify([{ type: "text", text: "Fire detected at location X" }])
});

// Update chat title and icon
await openkbs.chats({
    action: "updateChat",
    title: await openkbs.encrypt('New Title'),
    chatIcon: '🔥',
    chatId: event.payload.chatId
});
```

### Scheduled Tasks
```javascript
// Create scheduled task (fires at specific time, creates new chat)
await openkbs.kb({
    action: 'createScheduledTask',
    scheduledTime: Date.now() + 3600000, // 1 hour from now (ms)
    taskPayload: {
        message: '[SCHEDULED_TASK] Send weekly report',
        customData: { reportType: 'weekly' }
    },
    description: 'Weekly report'
});

// List scheduled tasks
const tasks = await openkbs.kb({ action: 'getScheduledTasks' });

// Delete scheduled task
await openkbs.kb({ action: 'deleteScheduledTask', timestamp: 1704067200000 });
```

### File Upload with Presigned URL
```javascript
// Download file and upload to KB storage
const fileResponse = await axios.get(sourceUrl, { responseType: 'arraybuffer' });

const presigned = await openkbs.kb({
    action: 'createPresignedURL',
    namespace: 'files',
    fileName: 'uploaded.jpg',
    fileType: 'image/jpeg',
    presignedOperation: 'putObject'
});

await axios.put(presigned, fileResponse.data, {
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': fileResponse.data.length }
});

const publicUrl = `https://your-domain.file.vpc1.us/files/${openkbs.kbId}/uploaded.jpg`;
```

### Utilities
```javascript
// Exchange rates (latest, historical, time series)
const rates = await openkbs.getExchangeRates({ base: 'EUR', symbols: 'USD,GBP' });
const historical = await openkbs.getExchangeRates({ base: 'EUR', symbols: 'USD', period: '2024-01-15' });
const series = await openkbs.getExchangeRates({ base: 'EUR', symbols: 'USD', period: '2024-01-01..2024-01-31' });

// VAT validation
const vat = await openkbs.checkVAT('BG123456789');

// Parse JSON from text (handles LLM output with extra text)
const data = openkbs.parseJSONFromText('Some text {"key": "value"} more text');

// Encryption (uses KB's AES key)
const encrypted = await openkbs.encrypt(JSON.stringify(sensitiveData));
const decrypted = JSON.parse(await openkbs.decrypt(encrypted));

// Create embeddings
const { embeddings, totalTokens } = await openkbs.createEmbeddings('Text to embed', 'text-embedding-3-large');
```

### Properties
```javascript
openkbs.kbId              // Current Knowledge Base ID
openkbs.clientHeaders     // Request headers (IP, user-agent, etc.)
openkbs.AESKey            // Encryption key
openkbs.chatJWT           // Current chat JWT token
```

### NPM Dependencies
Add to handler's JSON file (e.g., `onResponse.json`):
```json
{
  "dependencies": { "mysql2": "latest", "decimal.js": "^10.4.3" }
}
```

### Secrets Management
Use `{{secrets.KEY}}` placeholders (replaced at runtime):
```javascript
const apiKey = "{{secrets.EXTERNAL_API_KEY}}";
const telegramToken = "{{secrets.TELEGRAM_BOT_TOKEN}}";
```

## Browser Environment (`./src/Frontend/`)
Runs in user's browser at `https://[kbId].apps.openkbs.com`. React-based UI customization.

### contentRender.js

**`onRenderChatMessage(params)`** - Custom message rendering. Key params:
- `msgIndex`, `messages`, `setMessages` - message context
- `setSystemAlert({ severity, message })` - show alerts (severity: 'success', 'error', 'warning', 'info')
- `setBlockingLoading(bool)` - loading overlay
- `RequestChatAPI(messages)` - send chat messages
- `kbUserData()`, `generateMsgId()` - user info and ID generation
- `markdownHandler`, `theme` - rendering utilities

Return: React component, `null` for default, `JSON.stringify({ type: 'HIDDEN_MESSAGE' })` to hide.

**`Header(props)`** - Custom header component. Same props plus `openkbs` object.

```javascript
import React, { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';

const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];
    const { msgIndex, messages, setSystemAlert, RequestChatAPI, kbUserData, generateMsgId } = params;

    // Hide system messages
    if (role === 'system') return JSON.stringify({ type: 'HIDDEN_MESSAGE' });

    // Custom rendering for commands
    if (content.includes('<myCommand>')) {
        return <MyComponent content={content} />;
    }

    // Send follow-up message example
    const sendFollowUp = async () => {
        await RequestChatAPI([...messages, {
            role: 'user',
            content: 'Follow up',
            userId: kbUserData().chatUsername,
            msgId: generateMsgId()
        }]);
    };

    return null; // Use default rendering
};

const Header = ({ setRenderSettings, openkbs, setSystemAlert, setBlockingLoading }) => {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setRenderSettings({
            disableEmojiButton: true,
            disableBalanceView: false,
            backgroundOpacity: 0.02
        });
    }, [setRenderSettings]);

    return <Box>Custom Header</Box>;
};

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
```

### Frontend openkbs Object

```javascript
// Item CRUD (auto-encrypted)
await openkbs.createItem({ itemType: 'memory', itemId: 'memory_key', body: { value: 'data' } });
await openkbs.updateItem({ itemType: 'memory', itemId: 'memory_key', body: { value: 'updated' } });
const item = await openkbs.getItem('memory_key');
console.log(item.item.body.value);

// Fetch with filters
const items = await openkbs.fetchItems({
    itemType: 'memory',
    beginsWith: 'memory_',
    limit: 100,
    sortBy: 'createdAt',
    sortOrder: 'desc'
});
items.items.forEach(({ item, meta }) => {
    console.log(meta.itemId, item.body);
});

await openkbs.deleteItem('memory_key');
```

### Files API
```javascript
// List files in namespace
const files = await openkbs.Files.listFiles('files');
// Returns: [{ Key: 'files/kbId/filename.jpg', Size: 12345, LastModified: '...' }]

// Upload file with progress
const onProgress = (percent) => console.log(`${percent}% uploaded`);
await openkbs.Files.uploadFileAPI(fileObject, 'files', onProgress);

// Delete file
await openkbs.Files.deleteRawKBFile('filename.jpg', 'files');

// Rename file
await openkbs.Files.renameFile('old-path/file.jpg', 'new-path/file.jpg', 'files');

// File URL pattern
const fileUrl = `https://your-domain.file.vpc1.us/files/${openkbs.kbId}/filename.jpg`;
```

### Sharing API
```javascript
// Share KB with another user
await openkbs.KBAPI.shareKBWith('user@example.com');

// Get current shares
const shares = await openkbs.KBAPI.getKBShares();
// Returns: { sharedWith: ['email1@example.com', 'email2@example.com'] }

// Remove share
await openkbs.KBAPI.unshareKBWith('user@example.com');
```

### Other Frontend Properties
```javascript
openkbs.kbId           // Current KB ID
openkbs.isMobile       // Boolean - is mobile device
openkbs.KBData         // KB metadata (title, description, etc.)
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
