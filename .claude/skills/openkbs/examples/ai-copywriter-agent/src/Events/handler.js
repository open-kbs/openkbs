import {getActions} from './actions.js';

export const backendHandler = async (event) => {
    const lastMessage = event.payload.messages[event.payload.messages.length - 1];
    const reachedMessageLimit = event?.payload?.messages?.length > 60;

    // Meta for continuing chat model requests
    const meta = {
        _meta_actions: reachedMessageLimit ? [] : ["REQUEST_CHAT_MODEL"]
    };

    const actions = getActions(meta);

    const matchingActions = actions.reduce((acc, [regex, action]) => {
        const matches = [...lastMessage.content.matchAll(new RegExp(regex, 'g'))];
        matches.forEach(match => {
            acc.push(action(match, event));
        });
        return acc;
    }, []);

    if (matchingActions.length > 0) {
        try {
            const results = await Promise.all(matchingActions);

            // IMPORTANT: Actions returning JOB_COMPLETED or JOB_FAILED stop agent execution and return final result
            const isOnlyJobCompletion = results.length === 1 &&
                (results[0]?.type === 'JOB_COMPLETED' || results[0]?.type === 'JOB_FAILED');

            // Override meta for job completion
            const finalMeta = {
                _meta_actions: (reachedMessageLimit || isOnlyJobCompletion) ? [] : ["REQUEST_CHAT_MODEL"]
            };

            if (results?.[0]?.data?.some?.(o => o?.type === 'image_url')) {
                return {
                    ...results[0],
                    ...finalMeta
                };
            }

            return {
                type: 'RESPONSE',
                data: results,
                ...finalMeta
            };
        } catch (error) {
            return {
                type: 'ERROR',
                error: error.message,
                _meta_actions: reachedMessageLimit ? [] : ["REQUEST_CHAT_MODEL"]
            };
        }
    }

    return { type: 'CONTINUE' };
};