import { getActions } from './actions.js';

export const backendHandler = async (event) => {
    const meta = { _meta_actions: ["REQUEST_CHAT_MODEL"] };
    const lastMessage = event.payload.messages[event.payload.messages.length - 1];
    const actions = getActions(meta, event);

    const matchingActions = [];
    actions.forEach(([regex, action]) => {
        const matches = [...(lastMessage.content || '').matchAll(new RegExp(regex, 'g'))];
        matches.forEach(match => {
            matchingActions.push(action(match, event));
        });
    });

    if (matchingActions.length > 0) {
        try {
            const results = await Promise.all(matchingActions);

            // Check if any result needs LLM callback
            const needsChatModel = results.some(r =>
                r?._meta_actions?.includes('REQUEST_CHAT_MODEL')
            );

            // Handle image data for LLM vision
            if (results.some(r => r?.data?.some?.(item => item?.type === 'image_url'))) {
                return {
                    ...results[0],
                    _meta_actions: needsChatModel ? ["REQUEST_CHAT_MODEL"] : []
                };
            }

            // Single result - return as is
            if (results.length === 1) {
                return results[0];
            }

            // Multiple results
            return {
                type: 'MULTI_RESPONSE',
                data: results,
                _meta_actions: needsChatModel ? ["REQUEST_CHAT_MODEL"] : []
            };
        } catch (error) {
            return {
                type: 'ERROR',
                error: error.message,
                ...meta
            };
        }
    }

    return { type: 'CONTINUE' };
};