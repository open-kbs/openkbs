# Memory System Pattern

Complete working code for memory CRUD operations with atomic updates.

## memoryHelpers.js

Create this file for reusable memory operations:

```javascript
// Memory Helpers - Atomic operations without race conditions

/**
 * Generic upsert (update or create)
 */
async function _upsertItem(itemType, itemId, body) {
    try {
        await openkbs.updateItem({ itemType, itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType, itemId, body });
    }
    return { success: true, itemId };
}

/**
 * Set a memory value atomically
 * @param {string} itemId - Must start with "memory_"
 * @param {*} value - Any JSON-serializable value
 * @param {number} expirationInMinutes - Optional expiration
 */
export async function setMemoryValue(itemId, value, expirationInMinutes = null) {
    if (!itemId.startsWith('memory_')) {
        throw new Error(`Invalid itemId: "${itemId}". Must start with "memory_"`);
    }

    const body = {
        value,
        updatedAt: new Date().toISOString()
    };

    if (expirationInMinutes != null) {
        body.exp = new Date(Date.now() + expirationInMinutes * 60 * 1000).toISOString();
    }

    return _upsertItem('memory', itemId, body);
}

/**
 * Delete any item by itemId
 */
export async function deleteItem(itemId) {
    try {
        await openkbs.deleteItem(itemId);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Set agent setting (for configuration that persists)
 */
export async function setAgentSetting(itemId, value) {
    if (!itemId.startsWith('agent_')) {
        itemId = `agent_${itemId}`;
    }
    return _upsertItem('agent', itemId, { value, updatedAt: new Date().toISOString() });
}

/**
 * Get agent setting
 */
export async function getAgentSetting(itemId) {
    try {
        const item = await openkbs.getItem(itemId);
        return item?.item?.body?.value;
    } catch (e) {
        return null;
    }
}
```

## actions.js

```javascript
import { setMemoryValue, deleteItem } from './memoryHelpers.js';

// Set memory command
[/<setMemory>([\s\S]*?)<\/setMemory>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        if (!data.itemId?.startsWith('memory_')) {
            return {
                type: "MEMORY_ERROR",
                error: "itemId must start with 'memory_'",
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        }

        await setMemoryValue(data.itemId, data.value, data.expirationInMinutes);

        return {
            type: "MEMORY_UPDATED",
            itemId: data.itemId,
            expires: data.expirationInMinutes ? `in ${data.expirationInMinutes} minutes` : 'never',
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "MEMORY_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}],

// Delete item command
[/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());
        const result = await deleteItem(data.itemId);

        if (!result.success) {
            return {
                type: "DELETE_ERROR",
                error: result.error || "Failed to delete item",
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        }

        return {
            type: "ITEM_DELETED",
            itemId: data.itemId,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "DELETE_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}]
```

## onRequest.js - Inject Memory into Context

```javascript
export const handler = async (event) => {
    // Fetch all memory items to inject into LLM context
    const memoryItems = await openkbs.fetchItems({
        itemType: 'memory',
        beginsWith: 'memory_',
        limit: 100
    });

    // Format for context injection
    let memoryContext = '';
    if (memoryItems?.items?.length > 0) {
        memoryContext = '\n\n## Current Memory State:\n';
        for (const { meta, item } of memoryItems.items) {
            const value = typeof item.body.value === 'string'
                ? item.body.value
                : JSON.stringify(item.body.value);
            memoryContext += `- ${meta.itemId}: ${value}\n`;
        }
    }

    // Inject into system message
    return {
        ...event,
        payload: {
            ...event.payload,
            messages: event.payload.messages.map((msg, idx) => {
                if (idx === 0 && msg.role === 'system') {
                    return { ...msg, content: msg.content + memoryContext };
                }
                return msg;
            })
        }
    };
};
```

## instructions.txt (LLM prompt)

```
Memory Commands:

Save to memory:
<setMemory>{"itemId": "memory_user_preference", "value": "dark mode"}</setMemory>

Save with expiration (60 minutes):
<setMemory>{"itemId": "memory_session_data", "value": {...}, "expirationInMinutes": 60}</setMemory>

Delete item:
<deleteItem>{"itemId": "memory_old_data"}</deleteItem>

Memory items are automatically loaded into your context. Check "Current Memory State" section.
```

## settings.json - Priority Items Configuration

Priority items are **automatically injected** into LLM context without needing onRequest.js:

```json
{
  "model": "gemini-3-pro",
  "embeddingModel": "text-embedding-3-large",
  "embeddingDimension": 3072,
  "searchEngine": "VectorDB",
  "itemTypes": {
    "memory": {
      "attributes": [
        { "attrName": "itemId", "attrType": "itemId", "encrypted": false },
        { "attrName": "body", "attrType": "body", "encrypted": true }
      ]
    },
    "archive": {
      "attributes": [
        { "attrName": "itemId", "attrType": "itemId", "encrypted": false },
        { "attrName": "body", "attrType": "body", "encrypted": true }
      ]
    }
  },
  "options": {
    "priorityItems": [
      { "limit": 100, "prefix": "memory" },
      { "limit": 50, "prefix": "agent" }
    ],
    "vectorDBMaxTokens": 25000,
    "vectorDBTopK": 30,
    "vectorDBMinScore": 90
  }
}
```

### How Priority Items Work

1. **Auto-injection** - Items matching prefix are automatically added to LLM context
2. **No onRequest.js needed** - OpenKBS core handles this
3. **Limit per prefix** - Control how many items are injected
4. **Multiple prefixes** - Can have memory_, agent_, telegram_, etc.

### VectorDB for Long-term Memory

For semantic search (archive), configure:
- `searchEngine: "VectorDB"` - Enable vector search
- `embeddingModel` - Which model to use for embeddings
- `embeddingDimension` - Must match model (3072 for text-embedding-3-large)
- `vectorDBTopK` - How many results to return
- `vectorDBMinScore` - Minimum similarity score (0-100)

## Key Points

1. **Prefix requirement** - All memory items must start with `memory_`
2. **Upsert pattern** - Try update first, create if fails (handles both new and existing)
3. **Expiration** - Use `exp` field with ISO timestamp for auto-cleanup
4. **Auto-encryption** - Body is encrypted automatically by OpenKBS
5. **REQUEST_CHAT_MODEL** - Memory operations continue LLM loop for confirmation
6. **Priority items** - Configure in settings.json for auto-injection into context
7. **Two storage types**:
   - **Priority items** (memory_, agent_) - Fast key-value, auto-injected
   - **VectorDB items** (archive_) - Semantic search, for long-term memory
