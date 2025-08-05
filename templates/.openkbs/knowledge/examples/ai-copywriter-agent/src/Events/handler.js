import {getActions} from './actions.js';

export const backendHandler = async (event) => {
    const lastMessage = event.payload.messages[event.payload.messages.length - 1];
    const actions = getActions();

    const matchingActions = actions.reduce((acc, [regex, action]) => {
        const matches = [...lastMessage.content.matchAll(new RegExp(regex, 'g'))];
        matches.forEach(match => {
            acc.push(action(match, event));
        });
        return acc;
    }, []);

    const reachedMessageLimit = event?.payload?.messages?.length > 60;

    if (matchingActions.length > 0) {
        try {
            const results = await Promise.all(matchingActions);
            
            const isOnlyJobCompletion = results.length === 1 && 
                (results[0]?.type === 'JOB_COMPLETED' || results[0]?.type === 'JOB_FAILED');
            
            const meta = {
                _meta_actions: (reachedMessageLimit || isOnlyJobCompletion) ? [] : ["REQUEST_CHAT_MODEL"]
            };

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
                _meta_actions: reachedMessageLimit ? [] : ["REQUEST_CHAT_MODEL"]
            };
        }
    }

    return { type: 'CONTINUE' };
};