import React, { useEffect } from 'react';
import { Box, Tooltip, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LanguageIcon from '@mui/icons-material/Language';
import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MemoryIcon from '@mui/icons-material/Memory';
import PublishIcon from '@mui/icons-material/Publish';

// Command patterns to detect
const COMMAND_PATTERNS = [
    /<createAIImage>[\s\S]*?<\/createAIImage>/,
    /<createAIVideo>[\s\S]*?<\/createAIVideo>/,
    /<continueVideoPolling>[\s\S]*?<\/continueVideoPolling>/,
    /<googleSearch>[\s\S]*?<\/googleSearch>/,
    /<googleImageSearch>[\s\S]*?<\/googleImageSearch>/,
    /<viewImage>[\s\S]*?<\/viewImage>/,
    /<webpageToText>[\s\S]*?<\/webpageToText>/,
    /<sendMail>[\s\S]*?<\/sendMail>/,
    /<scheduleTask>[\s\S]*?<\/scheduleTask>/,
    /<getScheduledTasks\s*\/>/,
    /<setMemory>[\s\S]*?<\/setMemory>/,
    /<deleteItem>[\s\S]*?<\/deleteItem>/,
    /<publishWebPage>[\s\S]*?<\/publishWebPage>/
];

// Icon mapping for commands
const commandIcons = {
    createAIImage: ImageIcon,
    createAIVideo: VideoLibraryIcon,
    continueVideoPolling: VideoLibraryIcon,
    googleSearch: SearchIcon,
    googleImageSearch: SearchIcon,
    viewImage: ImageIcon,
    webpageToText: LanguageIcon,
    sendMail: EmailIcon,
    scheduleTask: ScheduleIcon,
    getScheduledTasks: ScheduleIcon,
    setMemory: MemoryIcon,
    deleteItem: MemoryIcon,
    publishWebPage: PublishIcon
};

// Parse commands from content
const parseCommands = (content) => {
    const commands = [];
    const regex = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\s*\/>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1] || match[3];
        let data = match[2] || '';
        try {
            data = data.trim() ? JSON.parse(data.trim()) : {};
        } catch (e) {
            data = data.trim();
        }
        commands.push({ name, data });
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
                    <pre style={{ margin: 0, fontSize: '10px', maxWidth: 300, overflow: 'auto' }}>
                        {typeof command.data === 'object' ? JSON.stringify(command.data, null, 2) : command.data}
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
                '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.2)', transform: 'scale(1.1)' },
                transition: 'all 0.2s'
            }}>
                <Icon sx={{ fontSize: 16, color: '#4CAF50' }} />
            </Box>
        </Tooltip>
    );
};

// Image renderer
const ImageWithDownload = ({ imageUrl }) => (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <img
            src={imageUrl}
            alt="Generated"
            style={{ maxWidth: '100%', borderRadius: 8 }}
        />
    </Box>
);

// do NOT useState() directly in this function, it is not a React component
const onRenderChatMessage = async (params) => {
    let { content, role } = params.messages[params.msgIndex];
    const { msgIndex, messages } = params;

    let JSONData;
    try {
        JSONData = JSON.parse(content);
    } catch (e) {}

    // Hide CONTINUE type system messages
    if (JSONData?.type === 'CONTINUE') {
        return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
    }

    // Handle CHAT_IMAGE type
    if (JSONData?.type === 'CHAT_IMAGE' && JSONData?.data?.imageUrl) {
        return <ImageWithDownload imageUrl={JSONData.data.imageUrl} />;
    }

    // Hide system response if previous message had a command
    if (role === 'system' && JSONData &&
        (JSONData._meta_type === 'EVENT_STARTED' || JSONData._meta_type === 'EVENT_FINISHED')) {
        const hasSpecialRendering = JSONData.type === 'CHAT_IMAGE' || JSONData.type === 'CHAT_VIDEO';
        if (!hasSpecialRendering && msgIndex > 0) {
            const prevMessage = messages[msgIndex - 1];
            const prevHasCommand = COMMAND_PATTERNS.some(p => p.test(prevMessage.content));
            if (prevHasCommand) return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
        }
    }

    // Render commands as icons
    const hasCommand = COMMAND_PATTERNS.some(p => p.test(content));
    if (hasCommand) {
        const commands = parseCommands(content);
        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {commands.map((cmd, i) => <CommandIcon key={i} command={cmd} />)}
            </Box>
        );
    }

    return null; // Use default rendering
};

const Header = ({ setRenderSettings }) => {
    useEffect(() => {
        setRenderSettings({
            inputLabelsQuickSend: true,
            disableBalanceView: false,
            disableEmojiButton: true,
            disableChatModelsSelect: false,
            backgroundOpacity: 0.02
        });
    }, [setRenderSettings]);

    return null;
};

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
