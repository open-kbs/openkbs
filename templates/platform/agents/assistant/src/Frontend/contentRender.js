import React from 'react';

const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];

    // Hide tool messages
    if (role === 'tool') {
        return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
    }

    return null; // Default rendering
};

const Header = ({ setRenderSettings }) => {
    React.useEffect(() => {
        setRenderSettings({
            disableBalanceView: true
        });
    }, [setRenderSettings]);

    return null;
};

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
