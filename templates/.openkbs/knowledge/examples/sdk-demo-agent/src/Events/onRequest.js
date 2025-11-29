// onRequest - Triggered on every user message
// Used for pre-processing, validation, or injecting context

export const handler = async (event, context) => {
    const meta = { _meta_actions: [] };

    // Example: Log user message
    console.log('User message received:', event.payload?.content?.substring(0, 100));

    // Example: Inject memory items into context
    // Uncomment to fetch priority items and add to system message
    /*
    const memoryItems = await openkbs.fetchItems({
        beginsWith: 'memory_',
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
    });

    if (memoryItems?.items?.length > 0) {
        const memoryContext = memoryItems.items
            .map(({ meta, item }) => `${meta.itemId}: ${JSON.stringify(item.body.value)}`)
            .join('\n');

        // Inject into system context
        return {
            ...meta,
            systemMessage: `Current memory:\n${memoryContext}`
        };
    }
    */

    return meta;
};
