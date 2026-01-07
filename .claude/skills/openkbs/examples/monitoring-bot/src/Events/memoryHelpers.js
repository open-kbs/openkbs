// Memory Helpers - Atomic operations

async function _upsertItem(itemType, itemId, body) {
    try {
        await openkbs.updateItem({ itemType, itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType, itemId, body });
    }
    return { success: true, itemId };
}

export async function setMemoryValue(itemId, value, expirationInMinutes = null) {
    if (!itemId.startsWith('memory_')) {
        throw new Error(`itemId must start with "memory_"`);
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

export async function deleteItem(itemId) {
    try {
        await openkbs.deleteItem(itemId);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function setAgentSetting(itemId, value) {
    if (!itemId.startsWith('agent_')) {
        itemId = `agent_${itemId}`;
    }
    return _upsertItem('agent', itemId, { value, updatedAt: new Date().toISOString() });
}

export async function getAgentSetting(itemId) {
    try {
        const item = await openkbs.getItem(itemId);
        return item?.item?.body?.value;
    } catch (e) {
        return null;
    }
}

export async function storeTelegramMessage(messageId, data) {
    const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;
    const body = { ...data, storedAt: new Date().toISOString() };
    return _upsertItem('telegram', itemId, body);
}

export async function getTelegramMessage(messageId) {
    const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;
    try {
        const result = await openkbs.getItem(itemId);
        return result?.item?.body;
    } catch (e) {
        return null;
    }
}

export async function deleteTelegramMessage(itemId) {
    return deleteItem(itemId);
}

export async function cleanupExpiredMemory() {
    try {
        const items = await openkbs.fetchItems({
            beginsWith: 'memory_',
            limit: 100
        });

        const now = new Date();
        for (const item of items?.items || []) {
            const exp = item.item?.body?.exp;
            if (exp && new Date(exp) < now) {
                await deleteItem(item.meta.itemId);
            }
        }
    } catch (e) {
        console.error('Cleanup error:', e.message);
    }
}
