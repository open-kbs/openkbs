# Backend SDK Reference

The `openkbs` object is available globally in all backend handlers (`onRequest.js`, `onResponse.js`, `actions.js`, `onCronjob.js`, `onPublicAPIRequest.js`).

## Search & Content

### googleSearch(query, options)

Search Google for information.

```javascript
// Web search
const results = await openkbs.googleSearch('AI trends 2025');
// Returns: [{ title, link, snippet, pagemap }, ...]

// Image search
const images = await openkbs.googleSearch('sunset photography', { searchType: 'image' });
// pagemap.cse_image[0].src contains image URL
```

### webpageToText(url, options)

Extract text content from a webpage.

```javascript
const content = await openkbs.webpageToText('https://example.com');
// Returns: { content: "page text..." }

// With price parsing (extracts structured price data)
const content = await openkbs.webpageToText('https://shop.com/product', { parsePrice: true });
```

## Image Generation

### generateImage(prompt, options)

Generate AI images using Gemini or GPT.

```javascript
// Gemini model (default) - supports reference images for editing
const images = await openkbs.generateImage('sunset over mountains', {
    model: 'gemini-2.5-flash-image',
    aspect_ratio: '16:9',              // 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
    n: 1,
    imageUrls: ['reference.jpg']       // optional - for editing/variations
});

// GPT model - better for text in images
const images = await openkbs.generateImage('logo with text', {
    model: 'gpt-image-1',
    size: '1024x1024',                 // 1024x1024, 1536x1024, 1024x1536, auto
    quality: 'high',
    n: 1
});

// Returns: [{ b64_json: "base64..." }, ...]
```

### uploadImage(base64, filename, mimeType)

Upload image to permanent S3 storage.

```javascript
const uploaded = await openkbs.uploadImage(
    images[0].b64_json,
    'image.png',
    'image/png'
);
console.log(uploaded.url);  // https://file.openkbs.com/files/.../image.png
```

## Video Generation

### generateVideo(prompt, options)

Generate AI videos using Sora 2.

```javascript
const video = await openkbs.generateVideo('cinematic sunset timelapse', {
    video_model: 'sora-2',          // or 'sora-2-pro' (higher quality)
    seconds: 8,                     // 4, 8, or 12
    size: '1280x720'                // '1280x720' (landscape) or '720x1280' (portrait)
});

// With reference image
const video = await openkbs.generateVideo('animate this scene', {
    video_model: 'sora-2',
    seconds: 8,
    input_reference_url: 'https://example.com/reference.jpg'
});

// Returns: [{ status: 'pending'|'completed', video_id: '...', video_url: '...' }]
```

### checkVideoStatus(videoId)

Poll for video generation completion.

```javascript
const status = await openkbs.checkVideoStatus(videoId);

if (status[0].status === 'completed') {
    console.log(status[0].video_url);
} else if (status[0].status === 'pending') {
    // Continue polling
} else if (status[0].status === 'failed') {
    // Handle error
}
```

## Memory System (CRUD)

### createItem(params)

Create a new item.

```javascript
await openkbs.createItem({
    itemType: 'memory',
    itemId: 'memory_user_name',
    body: { value: 'John', updatedAt: new Date().toISOString() }
});
```

### updateItem(params)

Update an existing item.

```javascript
await openkbs.updateItem({
    itemType: 'memory',
    itemId: 'memory_user_name',
    body: { value: 'Jane', updatedAt: new Date().toISOString() }
});
```

### getItem(itemId)

Get a single item by ID.

```javascript
const result = await openkbs.getItem('memory_user_name');
console.log(result.item.body.value);  // 'Jane'
```

### fetchItems(params)

Fetch multiple items with filters.

```javascript
const items = await openkbs.fetchItems({
    itemType: 'memory',
    beginsWith: 'memory_',
    limit: 100
});

for (const { item, meta } of items.items) {
    console.log(meta.itemId, item.body.value);
}
```

### deleteItem(itemId)

Delete an item.

```javascript
await openkbs.deleteItem('memory_user_name');
```

### Upsert Pattern

Common pattern for create-or-update:

```javascript
async function upsertItem(itemType, itemId, body) {
    try {
        await openkbs.updateItem({ itemType, itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType, itemId, body });
    }
}
```

## Scheduling

### Create Scheduled Task

```javascript
await openkbs.kb({
    action: 'createScheduledTask',
    scheduledTime: Date.now() + 60 * 60 * 1000,  // 1 hour from now
    taskPayload: {
        message: '[SCHEDULED_TASK] Reminder: Call mom',
        createdAt: Date.now()
    },
    description: 'Call mom reminder'
});
```

### Get Scheduled Tasks

```javascript
const tasks = await openkbs.kb({ action: 'getScheduledTasks' });
// Returns: [{ timestamp, description, taskPayload }, ...]
```

### Delete Scheduled Task

```javascript
await openkbs.kb({
    action: 'deleteScheduledTask',
    timestamp: 1704067200000
});
```

## Deep Research (Async)

Autonomous research agent that searches the web and synthesizes reports. Takes 5-20 minutes.

### Start Research

```javascript
const researchData = await openkbs.deepResearch(query, params);

// query: string - The research topic
// params: object (optional)
//   - previous_interaction_id: string - For follow-up questions on completed research

// Example:
const result = await openkbs.deepResearch('AI market trends 2025');

// With follow-up:
const followUp = await openkbs.deepResearch('What about healthcare?', {
    previous_interaction_id: 'prev_interaction_id'
});

// Returns:
// - status: 'in_progress' | 'completed'
// - interaction_id: string
// - prepaid_credits: number (when in_progress)
// - output: string (when completed)
// - usage: { input_tokens, output_tokens } (when completed)
```

### Check Status

```javascript
const status = await openkbs.checkDeepResearchStatus(interactionId, prepaidCredits);

// interactionId: string - From previous deepResearch call
// prepaidCredits: number - From previous response (for billing)

// Returns same structure as deepResearch
```

## MCP Integration

### Call MCP Tool

```javascript
const result = await openkbs.mcp.callTool('brave-search', 'brave_web_search', {
    query: 'React tutorials',
    count: 10
});
// Returns: { content: [...] }
```

Available MCP servers:
- `brave-search` - Web search (requires `BRAVE_API_KEY` secret)
- `github` - Repository management (requires `GITHUB_PERSONAL_ACCESS_TOKEN`)
- `slack` - Messaging (requires `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`)

## Chat Operations

### Create New Chat

```javascript
await openkbs.chats({
    chatTitle: 'Morning Briefing',
    message: '[SCHEDULED_TASK] Create morning summary'
});
```

## Communication

### Send Email

```javascript
await openkbs.sendMail(
    'user@example.com',
    'Subject Line',
    '<h1>HTML Body</h1>'
);
```

### Text to Speech

```javascript
const audio = await openkbs.textToSpeech('Hello world', {
    voice: 'alloy',
    model: 'tts-1'
});
```

### Translate

```javascript
const translated = await openkbs.translate('Hello', 'es');
// Returns: "Hola"
```

## Encryption

### Encrypt/Decrypt

```javascript
const encrypted = await openkbs.encrypt({ sensitive: 'data' });
const decrypted = await openkbs.decrypt(encrypted);
```

Note: Items with `encrypted: true` in itemTypes are automatically encrypted/decrypted.

## Embeddings

### Create Embeddings

```javascript
const embedding = await openkbs.createEmbeddings(
    'text to embed',
    'text-embedding-3-large'
);
// Returns: [0.123, -0.456, ...] (3072 dimensions)
```

## File Upload (Presigned URLs)

### createPresignedURL

Upload files directly to S3 storage.

```javascript
// Get presigned URL for upload
const presignedUrl = await openkbs.kb({
    action: 'createPresignedURL',
    namespace: 'files',
    fileName: 'document.pdf',
    fileType: 'application/pdf',
    presignedOperation: 'putObject'
});

// Upload using axios (globally available)
const fileBuffer = Buffer.from(content, 'utf8');
await axios.put(presignedUrl, fileBuffer, {
    headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileBuffer.length
    }
});

// Public URL pattern (varies by deployment)
// For whitelabel: https://yourdomain.file.vpc1.us/files/kbId/filename
// Generic: https://file.openkbs.com/files/kbId/filename
```

## VectorDB (Semantic Search)

### items() - Create Items with Filterable Attributes

For filtering to work, items must be created with filterable attributes (keyword, integer, boolean, etc.).

```javascript
// 1. Create embeddings from content
const { embeddings, totalTokens } = await openkbs.createEmbeddings(
    'Fix login bug - users cannot login with SSO',
    'text-embedding-3-large'
);

// 2. Create item with filterable attributes
await openkbs.items({
    action: 'createItem',
    itemType: 'task',
    itemId: `task_${Date.now()}`,
    attributes: [
        { attrType: 'itemId', attrName: 'itemId', encrypted: false },
        { attrType: 'body', attrName: 'body', encrypted: true },
        // Filterable attributes - map user-friendly names to generic types
        { attrType: 'keyword1', attrName: 'category', encrypted: false },
        { attrType: 'keyword2', attrName: 'status', encrypted: false },
        { attrType: 'integer1', attrName: 'priority', encrypted: false },
        { attrType: 'boolean1', attrName: 'isUrgent', encrypted: false }
    ],
    item: {
        body: await openkbs.encrypt(JSON.stringify({
            title: 'Fix login bug',
            description: 'Users cannot login with SSO'
        })),
        // Filterable field values
        category: 'bug',
        status: 'open',
        priority: 1,
        isUrgent: true
    },
    totalTokens,
    embeddings: embeddings.slice(0, 3072),
    embeddingModel: 'text-embedding-3-large',
    embeddingDimension: 3072
});
```

### Filterable Attribute Types

| attrType | S3 Vectors Type | Operators |
|----------|-----------------|-----------|
| keyword1-20 | String | $eq, $ne, $in, $nin |
| text1-20 | String | $eq, $ne, $in, $nin |
| integer1-20 | Number | $eq, $ne, $gt, $gte, $lt, $lte |
| float1-20 | Number | $eq, $ne, $gt, $gte, $lt, $lte |
| boolean1-9 | Boolean | $eq, $ne |
| date1-9 | Number | $gt, $gte, $lt, $lte |

### vectorMetadata - Control Vector Storage

By default, the entire item (including body) is stored in vector metadata. For large items (body > 2KB), use `vectorMetadata` to store only what's needed for filtering and display. The full item is always stored in DynamoDB.

```javascript
// Large document with full text - store only filterable fields in vector
await openkbs.items({
    action: 'createItem',
    itemType: 'document',
    itemId: `doc_${Date.now()}`,
    attributes: [
        { attrType: 'itemId', attrName: 'itemId', encrypted: false },
        { attrType: 'body', attrName: 'body', encrypted: false },
        { attrType: 'keyword1', attrName: 'standard', encrypted: false },
        { attrType: 'keyword2', attrName: 'fileType', encrypted: false }
    ],
    item: {
        body: JSON.stringify({ fileName, fileUrl, text }), // Full text for DynamoDB
        standard: 'IFS',
        fileType: 'pdf'
    },
    // Only these fields stored in vector metadata (avoids 2KB limit)
    vectorMetadata: {
        standard: 'IFS',
        fileType: 'pdf',
        fileName: 'ifs-standard.pdf',
        fileUrl: 'https://...'
    },
    totalTokens,
    embeddings,
    embeddingModel: 'text-embedding-3-large',
    embeddingDimension: 3072
});
```

**Important**: S3 Vectors has a 2048 byte limit on filterable metadata. Use `vectorMetadata` when storing large body content to avoid this limit.

### searchVectorDBItems - Vector Search with Filter

```javascript
// Simple search (no filter)
const results = await openkbs.items({
    action: 'searchVectorDBItems',
    queryText: 'login issues',
    topK: 10
});

// Search with filter - use user-friendly field names
const filtered = await openkbs.items({
    action: 'searchVectorDBItems',
    queryText: 'login authentication issues',
    topK: 20,
    minScore: 70,
    itemType: 'task',  // Required for filter translation!
    filter: {
        category: 'bug',
        status: 'open'
    }
});

// Comparison operators
const highPriority = await openkbs.items({
    action: 'searchVectorDBItems',
    queryText: 'performance problems',
    itemType: 'task',
    filter: {
        priority: { "$lte": 2 },
        status: { "$ne": "done" }
    }
});

// Complex filter with $or
const urgentOrHighPriority = await openkbs.items({
    action: 'searchVectorDBItems',
    queryText: 'critical issues',
    itemType: 'task',
    filter: {
        "$or": [
            { priority: 1 },
            { isUrgent: true }
        ]
    }
});

// $in operator - match any value in array
const multipleCats = await openkbs.items({
    action: 'searchVectorDBItems',
    queryText: 'issues',
    itemType: 'task',
    filter: {
        category: { "$in": ["bug", "hotfix"] },
        status: { "$nin": ["done", "cancelled"] }
    }
});
```

### Response Format

```javascript
{
    items: [
        {
            itemId: 'task_1705123456789',
            body: 'encrypted...',       // Use openkbs.decrypt()
            category: 'bug',            // Filterable fields returned
            status: 'open',
            priority: 1,
            isUrgent: true,
            score: 0.92,                // Similarity score (0-1)
            distance: 0.08,
            totalTokens: 45
        }
    ]
}
```

### settings.json - itemTypes Configuration

Define attribute mappings in KB settings for automatic filter translation:

```json
{
    "itemTypes": {
        "task": {
            "attributes": [
                { "attrName": "itemId", "attrType": "itemId", "encrypted": false },
                { "attrName": "body", "attrType": "body", "encrypted": true },
                { "attrName": "category", "attrType": "keyword1", "encrypted": false },
                { "attrName": "status", "attrType": "keyword2", "encrypted": false },
                { "attrName": "priority", "attrType": "integer1", "encrypted": false },
                { "attrName": "isUrgent", "attrType": "boolean1", "encrypted": false }
            ],
            "embeddingTemplate": "${item.body.title} ${item.body.description}"
        }
    }
}
```

## Utilities

### Parse JSON from Text

```javascript
const data = openkbs.parseJSONFromText('Some text {"key": "value"} more text');
// Returns: { key: "value" }
```

### Get Exchange Rates

```javascript
const rates = await openkbs.getExchangeRates('USD');
// Returns: { EUR: 0.92, GBP: 0.79, ... }
```

## Global Objects

These are available globally in all backend handlers (no import needed):

```javascript
openkbs     // OpenKBS SDK (this document)
axios       // HTTP client (axios.get, axios.post, etc.)
crypto      // Node.js crypto module
```

## Properties

```javascript
openkbs.kbId              // Current Knowledge Base ID
openkbs.clientHeaders     // Request headers (IP, user-agent, etc.)
openkbs.AESKey            // Encryption key
openkbs.chatJWT           // Current chat JWT token
```
