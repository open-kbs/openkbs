import { getActions } from './actions.js';

export const handler = async (event) => {
    const response = event?.payload?.response?.content ?? event?.payload?.response;
    if (!response) return { type: 'EMPTY_RESPONSE' };

    const meta = {
        role: 'tool',
        name: 'command_executor',
        msgId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const actions = getActions(meta, event);
    const results = [];

    for (const [pattern, handler] of actions) {
        const matches = response.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
        for (const match of matches) {
            results.push(handler(match));
        }
    }

    if (results.length === 0) {
        return { type: 'NO_COMMANDS', _meta_actions: [] };
    }

    const resolved = await Promise.all(results);

    if (resolved.length === 1) {
        return resolved[0];
    }

    return {
        type: 'MULTI_COMMAND_RESULT',
        results: resolved,
        ...meta,
        _meta_actions: resolved.some(r => r._meta_actions?.includes("REQUEST_CHAT_MODEL"))
            ? ["REQUEST_CHAT_MODEL"]
            : []
    };
};
