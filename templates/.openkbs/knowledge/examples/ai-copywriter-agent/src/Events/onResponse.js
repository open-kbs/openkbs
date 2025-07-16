import {getActions} from './actions.js';

export const handler = async (event) => {
    const maxSelfInvokeMessagesCount = 60;
    const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
    
    // Check if this is a JOB_COMPLETED or JOB_FAILED event
    const isJobCompleted = /"type"\s*:\s*"JOB_COMPLETED"/.test(lastMessage);
    const isJobFailed = /"type"\s*:\s*"JOB_FAILED"/.test(lastMessage);

    const actions = getActions();

    const matchingActions = actions.reduce((acc, [regex, action]) => {
        const matches = [...lastMessage.matchAll(new RegExp(regex, 'g'))];
        matches.forEach(match => {
            acc.push(action(match, event));
        });
        return acc;
    }, []);

    const isJobFinished = isJobCompleted || isJobFailed;

    const meta = {
        _meta_actions:
            (
                event?.payload?.messages?.length > maxSelfInvokeMessagesCount ||
                isJobFinished && lastMessage.role === 'system'
            )
                ? []
                : ["REQUEST_CHAT_MODEL"] // Important Flag: enables agent's post-response interaction
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