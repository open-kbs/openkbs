// onResponse - Triggered after LLM generates response
// Used for command extraction and action execution

import { getActions } from './actions.js';

export const handler = async (event, context) => {
    const meta = { _meta_actions: [] };
    const actions = getActions(meta, event);

    // Get LLM response content
    const content = event?.payload?.data?.choices?.[0]?.message?.content;
    if (!content) return meta;

    // Execute matching actions
    for (const [pattern, fn] of actions) {
        const match = content.match(pattern);
        if (match) {
            try {
                const result = await fn(match, event);
                return result;
            } catch (e) {
                console.error('Action error:', e);
                return { error: e.message, ...meta };
            }
        }
    }

    return meta;
};
