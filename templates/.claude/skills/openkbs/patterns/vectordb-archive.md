# VectorDB Archive Pattern

Complete working code for archiving items to long-term memory with semantic search.

## Concept

- **Priority items** (memory_, agent_) - Fast, auto-injected, limited capacity
- **Archive items** - Unlimited, semantic search, for long-term storage

When priority storage fills up, archive old items to VectorDB.

## actions.js

```javascript
// Archive items to long-term memory (VectorDB)
[/<archiveItems>([\s\S]*?)<\/archiveItems>/s, async (match) => {
    try {
        const content = match[1].trim();
        const itemIds = JSON.parse(content);

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            throw new Error('Must provide an array of itemIds to archive');
        }

        const results = [];
        const embeddingModel = 'text-embedding-3-large';
        const embeddingDimension = 3072;
        const timestamp = Date.now();

        for (const itemId of itemIds) {
            try {
                // 1. Fetch the original item
                const originalItem = await openkbs.getItem(itemId);
                if (!originalItem?.item?.body) {
                    results.push({ itemId, status: 'error', error: 'Item not found' });
                    continue;
                }

                const body = originalItem.item.body;
                const originalItemType = itemId.split('_')[0];

                // 2. Build embedding text based on item type
                let embeddingText = '';
                if (originalItemType === 'memory') {
                    embeddingText = `${itemId}: ${typeof body.value === 'string' ? body.value : JSON.stringify(body.value)}`;
                } else if (originalItemType === 'telegram') {
                    const date = body.date ? new Date(body.date * 1000).toISOString() : '';
                    embeddingText = `[${date}] ${body.from || 'Unknown'}: ${body.text || ''}`;
                } else {
                    embeddingText = `${itemId}: ${JSON.stringify(body)}`;
                }

                // 3. Create embeddings
                const { embeddings, totalTokens } = await openkbs.createEmbeddings(embeddingText, embeddingModel);

                // 4. Create archive item with timestamp for uniqueness
                const archiveItemId = `archive_${timestamp}_${itemId}`;
                const archiveBody = {
                    originalItemId: itemId,
                    originalItemType: originalItemType,
                    content: body,
                    archivedAt: new Date().toISOString()
                };

                await openkbs.items({
                    action: 'createItem',
                    itemType: 'archive',
                    itemId: archiveItemId,
                    attributes: [
                        { attrType: 'itemId', attrName: 'itemId', encrypted: false },
                        { attrType: 'body', attrName: 'body', encrypted: true }
                    ],
                    item: { body: await openkbs.encrypt(JSON.stringify(archiveBody)) },
                    totalTokens,
                    embeddings: embeddings ? embeddings.slice(0, embeddingDimension) : undefined,
                    embeddingModel,
                    embeddingDimension
                });

                // 5. Delete original item from priority storage
                await openkbs.deleteItem(itemId);

                results.push({
                    itemId,
                    archiveItemId,
                    status: 'success',
                    tokens: totalTokens
                });

            } catch (e) {
                results.push({ itemId, status: 'error', error: e.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        return {
            type: "ITEMS_ARCHIVED",
            summary: `Archived ${successCount} of ${itemIds.length} items (${errorCount} errors)`,
            results,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "ARCHIVE_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}],

// Search long-term archive memory (VectorDB semantic search)
[/<searchArchive>([\s\S]*?)<\/searchArchive>/s, async (match) => {
    try {
        const content = match[1].trim();
        const data = JSON.parse(content);

        if (!data.query) {
            throw new Error('Must provide a "query" for semantic search');
        }

        const topK = data.topK || 10;
        const minScore = data.minScore || 0;

        // Call VectorDB search
        const searchResult = await openkbs.items({
            action: 'searchVectorDBItems',
            queryText: data.query,
            topK: topK,
            minScore: minScore
        });

        // Format and decrypt results
        const formattedResults = [];

        for (const item of (searchResult?.items || [])) {
            try {
                let parsed = null;
                if (item.body) {
                    const decryptedBody = await openkbs.decrypt(item.body);
                    parsed = JSON.parse(decryptedBody);
                }

                formattedResults.push({
                    archiveItemId: item.itemId,
                    originalItemId: parsed?.originalItemId,
                    originalItemType: parsed?.originalItemType,
                    content: parsed?.content,
                    archivedAt: parsed?.archivedAt,
                    score: item.score
                });
            } catch (e) {
                formattedResults.push({
                    archiveItemId: item.itemId,
                    score: item.score,
                    error: 'Failed to decrypt: ' + e.message
                });
            }
        }

        return {
            type: "ARCHIVE_SEARCH_RESULTS",
            query: data.query,
            count: formattedResults.length,
            results: formattedResults,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "ARCHIVE_SEARCH_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}]
```

## settings.json Configuration

```json
{
  "embeddingModel": "text-embedding-3-large",
  "embeddingDimension": 3072,
  "searchEngine": "VectorDB",
  "itemTypes": {
    "archive": {
      "attributes": [
        { "attrName": "itemId", "attrType": "itemId", "encrypted": false },
        { "attrName": "body", "attrType": "body", "encrypted": true }
      ]
    }
  },
  "options": {
    "vectorDBMaxTokens": 25000,
    "vectorDBTopK": 30,
    "vectorDBMinScore": 90
  }
}
```

## instructions.txt (LLM prompt)

```
Long-term Memory:

Archive items from priority storage:
<archiveItems>["memory_old_item1", "memory_old_item2"]</archiveItems>

Search archived memories semantically:
<searchArchive>{"query": "what did user say about project X", "topK": 10}</searchArchive>

Use archive when:
- Priority storage is filling up
- You need to remember things long-term
- You want semantic search over past conversations
```

## Key Points

1. **Two-tier storage**:
   - Priority items: Fast, limited, auto-injected into context
   - Archive items: Unlimited, semantic search, manual retrieval

2. **Archive flow**: Fetch → Create embeddings → Store in VectorDB → Delete original

3. **Embedding model** must match settings.json configuration

4. **Encrypted storage** - Archive body is encrypted, decrypted on retrieval

5. **Score-based search** - Results sorted by semantic similarity score
