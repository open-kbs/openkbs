import {getActions} from './actions.js';

export const backendHandler = async (event) => {
    const maxSelfInvokeMessagesCount = 60;
    const lastMessage = event.payload.messages[event.payload.messages.length - 1];
    const actions = getActions();

    const matchingActions = actions.reduce((acc, [regex, action]) => {
        const matches = [...lastMessage.content.matchAll(new RegExp(regex, 'g'))];
        matches.forEach(match => {
            acc.push(action(match, event));
        });
        return acc;
    }, []);

    const meta = {
        _meta_actions:
            event?.payload?.messages?.length > maxSelfInvokeMessagesCount
                ? [] // Ends the chat
                : ["REQUEST_CHAT_MODEL"] // Triggers the LLM to react after the response
    }

    if (matchingActions.length > 0) {
        try {
            const results = await Promise.all(matchingActions);

            if (results?.[0]?.data?.some?.(o => o?.type === 'image_url')) {
                return {
                    ...results[0],
                    ...meta
                };
            }

            return {
                type: 'RESPONSE',
                data: results,
                ...meta
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