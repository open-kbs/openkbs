import actions from './actions.js';

export const handler = async (event) => {
    const { text } = event.payload;
    const results = [];

    // Match all commands in parallel
    const matchPromises = actions.map(async ([regex, handler]) => {
        const matches = [...text.matchAll(new RegExp(regex.source, regex.flags + 'g'))];
        return Promise.all(matches.map(match => handler(match)));
    });

    const allResults = await Promise.all(matchPromises);

    for (const resultGroup of allResults) {
        for (const result of resultGroup) {
            if (result) results.push(result);
        }
    }

    if (results.length === 0) {
        return { type: 'NO_COMMANDS' };
    }

    // If any result requests chat model, return it
    const needsChat = results.find(r => r._meta_actions?.includes('REQUEST_CHAT_MODEL'));
    if (needsChat) {
        return results.length === 1 ? results[0] : { type: 'BATCH_RESULTS', results, ...needsChat };
    }

    return results.length === 1 ? results[0] : { type: 'BATCH_RESULTS', results };
};
