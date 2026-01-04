/**
 * Command actions for {{APP_NAME}} Assistant
 */

export const getActions = (meta, event) => [
    // Google Search
    [/<googleSearch>([\s\S]*?)<\/googleSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const results = await openkbs.googleSearch(data.query);

            const formatted = results?.slice(0, 5).map(({ title, link, snippet }) => ({
                title, link, snippet
            }));

            return {
                type: 'SEARCH_RESULTS',
                data: formatted,
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // Set Memory
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

            try {
                await openkbs.updateItem({
                    itemType: 'memory',
                    itemId: data.itemId,
                    body: { value: data.value, updatedAt: new Date().toISOString() }
                });
            } catch (e) {
                await openkbs.createItem({
                    itemType: 'memory',
                    itemId: data.itemId,
                    body: { value: data.value, updatedAt: new Date().toISOString() }
                });
            }

            return {
                type: "MEMORY_SAVED",
                itemId: data.itemId,
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // Delete Item
    [/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.deleteItem(data.itemId);

            return {
                type: "ITEM_DELETED",
                itemId: data.itemId,
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }]
];
