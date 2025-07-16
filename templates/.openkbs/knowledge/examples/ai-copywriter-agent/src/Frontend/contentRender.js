import React, { useEffect } from "react";
import JsonView from '@uiw/react-json-view';
import { Chip } from '@mui/material';

const extractJSONFromText = (text) => {
    let braceCount = 0, startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        if (text[i] === '}' && --braceCount === 0) {
            try {
                return JSON.parse(text.slice(startIndex, i + 1));
            } catch {
                return null;
            }
        }
    }
    return null;
}

const parseCommands = (text) => {
    return text.match(/\/\w+\("([^"]+)"\)/g) || [];
}

// do NOT useState() directly in this function, it is not a React component
const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
    const JSONData = extractJSONFromText(content);
    const commands = parseCommands(content);
    
    if (JSONData?.type === 'JOB_COMPLETED') {
        return <JsonView value={JSONData} />
    }
    
    if (commands.length > 0) {
        return commands.map((cmd, i) => (
            <Chip key={i} label={cmd} size="small" />
        ));
    }

    // return undefined to use default message render
};

const Header = ({ setRenderSettings }) => {
    useEffect(() => {
        setRenderSettings({
            inputLabelsQuickSend: true,
            disableBalanceView: false,
            disableSentLabel: false,
            disableChatAvatar: false,
            disableChatModelsSelect: false,
            disableContextItems: false,
            disableCopyButton: false,
            disableEmojiButton: false,
            disableTextToSpeechButton: false,
            disableMobileLeftButton: false,
        });
    }, [setRenderSettings]);
}

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;