import {getActions} from './actions.js';

export const handler = async (event) => {
    const {messages} = event.payload;
    const lastMessage = messages[messages.length - 1];
    
    const isJobFinished = /"type"\s*:\s*"JOB_(COMPLETED|FAILED)"/.test(lastMessage.content);
    
    const matchingActions = getActions().flatMap(([regex, action]) => 
        [...lastMessage.content.matchAll(new RegExp(regex, 'g'))].map(match => action(match, event))
    );

    const meta = {
        _meta_actions: (
            messages.length > 60 ||
            isJobFinished && (matchingActions.length === 1 || lastMessage.role === 'system')
        ) ? [] : ["REQUEST_CHAT_MODEL"]
    };

    if (matchingActions.length > 0) {
        try {
            const results = await Promise.all(matchingActions);
            
            if (results?.[0]?.data?.some?.(o => o?.type === 'image_url')) {
                return {...results[0], ...meta};
            }

            return {type: 'RESPONSE', data: results, ...meta};
        } catch (error) {
            return {type: 'ERROR', error: error.message, ...meta};
        }
    }

    return {type: 'CONTINUE'};
};