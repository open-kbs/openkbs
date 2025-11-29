import React, { useEffect } from "react";
import JsonView from '@uiw/react-json-view';
import { Box, Tooltip, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LanguageIcon from '@mui/icons-material/Language';
import ImageIcon from '@mui/icons-material/Image';
import YouTubeIcon from '@mui/icons-material/YouTube';
import ArticleIcon from '@mui/icons-material/Article';

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

// Command patterns for XML+JSON format
const COMMAND_PATTERNS = [
    /<googleSearch>[\s\S]*?<\/googleSearch>/,
    /<youtubeSearch>[\s\S]*?<\/youtubeSearch>/,
    /<googleImageSearch>[\s\S]*?<\/googleImageSearch>/,
    /<webpageToText>[\s\S]*?<\/webpageToText>/,
    /<documentToText>[\s\S]*?<\/documentToText>/,
    /<imageToText>[\s\S]*?<\/imageToText>/
];

// Icon mapping for commands
const commandIcons = {
    googleSearch: SearchIcon,
    youtubeSearch: YouTubeIcon,
    googleImageSearch: ImageIcon,
    webpageToText: LanguageIcon,
    documentToText: ArticleIcon,
    imageToText: ImageIcon
};

// Parse commands from content
const parseCommands = (content) => {
    const commands = [];
    const regex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        try {
            commands.push({
                name: match[1],
                data: JSON.parse(match[2].trim())
            });
        } catch (e) {
            commands.push({ name: match[1], data: match[2].trim() });
        }
    }
    return commands;
};

// Render command as icon with tooltip
const CommandIcon = ({ command }) => {
    const Icon = commandIcons[command.name] || SearchIcon;
    return (
        <Tooltip
            title={
                <Box sx={{ p: 1 }}>
                    <Box sx={{ fontWeight: 'bold', color: '#4CAF50', mb: 0.5 }}>{command.name}</Box>
                    <pre style={{ margin: 0, fontSize: '10px' }}>
                        {typeof command.data === 'object'
                            ? JSON.stringify(command.data, null, 2)
                            : command.data}
                    </pre>
                </Box>
            }
            arrow
        >
            <Box sx={{
                display: 'inline-flex',
                width: 32, height: 32,
                borderRadius: '50%',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '2px solid rgba(76, 175, 80, 0.3)',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 0.5,
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    transform: 'scale(1.1)'
                },
                transition: 'all 0.2s'
            }}>
                <Icon sx={{ fontSize: 16, color: '#4CAF50' }} />
            </Box>
        </Tooltip>
    );
};

// do NOT useState() directly in this function, it is not a React component
const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
    const JSONData = extractJSONFromText(content);

    // Render JOB_COMPLETED as JSON view
    if (JSONData?.type === 'JOB_COMPLETED') {
        return <JsonView value={JSONData} />
    }

    // Check for commands in content
    const hasCommand = COMMAND_PATTERNS.some(p => p.test(content));
    if (hasCommand) {
        const commands = parseCommands(content);
        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {commands.map((cmd, i) => <CommandIcon key={i} command={cmd} />)}
            </Box>
        );
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
