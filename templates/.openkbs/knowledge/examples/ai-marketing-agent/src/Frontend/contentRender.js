import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    extractHTMLContent,
    isContentHTML,
    generateFilename,
    getBaseURL, formatDate
} from "./utils";
import { 
    LinearProgress,
    Menu, 
    MenuItem, 
    Box, 
    Chip 
} from '@mui/material';

const isMobile = window.innerWidth < 960;

const SimpleHTMLPreview = ({ htmlContent, params }) => {
    const previewRef = useRef(null);
    const { msgIndex, messages, setMessages, chatAPI, KB, uploadFileAPI, setBlockingLoading } = params;

    const currentHTMLContentRef = useRef(htmlContent);
    const [isPublishing, setIsPublishing] = useState(false);


    const uploadHTMLContent = useCallback(async (htmlContent) => {
        const html = extractHTMLContent(htmlContent);
        if (!html) return;
        try {
            const blob = new Blob([html], { type: 'text/html' });
            const file = new File([blob], generateFilename(htmlContent), { type: 'text/html' });
            const res = await uploadFileAPI(file, 'files')
            return getBaseURL(KB) + decodeURIComponent(res?.config.url.split('/').pop().split('?')[0]);
        } catch (e) {
            console.error('Error during upload:', e);
        }
    }, [uploadFileAPI]);

    const handlePublish = async () => {
        const html = extractHTMLContent(htmlContent);
        if (!html) return;
        
        try {
            setIsPublishing(true);
            setBlockingLoading({text: "Publishing website"});
            const url = await uploadHTMLContent(htmlContent);
            if (url) {
                window.open(url, '_blank');
            }
        } catch (e) {
            console.error('Error publishing:', e);
        } finally {
            setIsPublishing(false);
            setBlockingLoading(false);
        }
    };

    useEffect(() => {
        if (previewRef.current && htmlContent) {
            const html = extractHTMLContent(htmlContent);
            if (html) {
                const iframe = previewRef.current.querySelector('iframe');
                if (iframe) {
                    iframe.srcdoc = html;
                }
            }
        }
    }, [htmlContent]);




    const loaderStyle = { position: 'absolute', top: 14, left: 0, right: 0, height: 2, zIndex: 1000 };
    
    return (
        <>
            <div style={{ position: 'relative', height: 0, overflow: 'visible' }}>
                {isPublishing && (<LinearProgress style={loaderStyle} />)}
            </div>
            <div style={{ position: 'relative', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '10px', 
                    borderBottom: '1px solid #ddd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>Website Preview</span>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        style={{
                            color: '#ffffff',
                            backgroundColor: isPublishing ? '#ccc' : '#28a745',
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: isPublishing ? 'not-allowed' : 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        {isPublishing ? 'Publishing...' : 'Publish'}
                    </button>
                </div>
                <div ref={previewRef} style={{ height: '600px', width: '100%' }}>
                    <iframe 
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        sandbox="allow-scripts allow-same-origin"
                        srcdoc={extractHTMLContent(htmlContent) || ''}
                    />
                </div>
            </div>
        </>
    );
};

const helloMessage = `
Hello! I'm your personal AI Marketing Assistant for small businesses.
Let's start with a brief interview that you can interrupt at any time. This will help me provide you with personalized solutions and be useful to you in the future.
`
const getChatId = () => window?.location?.pathname?.split('/chat/')?.[1]

const checkInterviewExists = async (initDB, KB) => {
    try {
        const db = await initDB({KBData: KB});
        return await db['interview']?.count() > 0;
    } catch (e) {
        console.error('Error checking for existing interview:', e);
        return false;
    }
};

const onRenderChatMessage = async (params) => {
    let { content, role } = params.messages[params.msgIndex];
    const { initDB, KB, msgIndex, messages } = params;

    let JSONData;

    if (role === 'system') {
        try {
            JSONData = JSON.parse(content)
        } catch (e) {}
    }

    if (JSONData?.data?.itemId && msgIndex === messages?.length - 1) {
        const db = await initDB({KBData: KB});
        if (JSONData?.type === 'MEMORY_RECORD_DELETED') {
            await db['memoryRecord'].delete(JSONData?.data?.itemId)
        }
    }

    // Remove introductory interview blocks if they exist
    if (content.includes('__INTRODUCTORY_INTERVIEW_START__')) {
        return <>{helloMessage}
                <br />
                1. <strong>What would you like me to call you?</strong>
                </>
    }

    if (isContentHTML(content)) {
        const html = extractHTMLContent(content) || content;
        return <SimpleHTMLPreview htmlContent={html} params={params} />;
    }

    return null;
};

const QuickActionsBar = ({ RequestChatAPI, messages, kbUserData, interviewExists, setIsContextItemsOpen, navigateToChat }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [eventsAnchorEl, setEventsAnchorEl] = useState(null);
    
    const createActions = [
        // { label: "Целева страница", prompt: "Създай целева страница за моя бизнес" },
        { label: "Posting plan", prompt: "Create a posting plan for my business" },
        { label: "Facebook post", prompt: "Create a Facebook post for my business" },
        { label: "Email campaign", prompt: "Create an email campaign for my business" },
        { label: "Banner ad", prompt: "Create a banner ad for my business" }
    ];

    const getCurrentDate = () => {
        return new Date().toLocaleDateString('bg-BG');
    };

    const eventsActions = [
        {
            label: "Industry news",
            prompt: `Find the latest marketing news for my industry (today's date is ${getCurrentDate()})`
        },
        {
            label: "Upcoming events",
            prompt: `Suggest marketing events for my industry that I can attend (today's date is ${getCurrentDate()})`
        }
    ];

    const handleQuickAction = (prompt) => {
        if (RequestChatAPI) {
            navigateToChat(null);
            RequestChatAPI([{
                role: 'user',
                content: prompt,
                userId: kbUserData().chatUsername,
                msgId: `${+new Date()}-${Math.floor(100000 + Math.random() * 900000)}`
            }]);
        }
        setAnchorEl(null);
        setEventsAnchorEl(null);
    };

    const handleCreateClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleEventsClick = (event) => {
        setEventsAnchorEl(event.currentTarget);
    };

    const handleMemoriesClick = () => {
        setIsContextItemsOpen(true);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleEventsClose = () => {
        setEventsAnchorEl(null);
    };

    return (
        <Box 
            sx={{
                position: isMobile ? 'absolute' : undefined,
                display: 'flex',
                gap: 1,
                p: 1,
                left: isMobile ? '50%' : 0,
                transform: isMobile ? 'translateX(-50%) translateY(-53px)' : 'translateY(-30px)',
                overflow: 'hidden',
                maxWidth: !isMobile ? '250px' : undefined
            }}
        >
            <Chip 
                label="News"
                variant="outlined"
                clickable={!interviewExists}
                size="small"
                onClick={handleEventsClick}
                sx={{ 
                    cursor: 'pointer',
                    '&:hover': { 
                        backgroundColor: 'rgba(25, 118, 210, 0.04)' 
                    }
                }}
            />
            
            <Chip 
                label="Memory"
                variant="outlined"
                clickable={!interviewExists}
                size="small"
                onClick={handleMemoriesClick}
                sx={{ 
                    cursor: 'pointer',
                    '&:hover': { 
                        backgroundColor: 'rgba(25, 118, 210, 0.04)' 
                    }
                }}
            />
            
            <Chip 
                label="Create"
                variant="outlined"
                clickable={!interviewExists}
                size="small"
                onClick={handleCreateClick}
                sx={{ 
                    cursor: 'pointer',
                    '&:hover': { 
                        backgroundColor: 'rgba(25, 118, 210, 0.04)' 
                    }
                }}
            />
            
            <Menu
                anchorEl={eventsAnchorEl}
                open={Boolean(eventsAnchorEl)}
                onClose={handleEventsClose}
                elevation={3}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            minWidth: 180
                        }
                    }
                }}
            >
                {eventsActions.map((action, index) => (
                    <MenuItem 
                        key={index}
                        onClick={() => handleQuickAction(action.prompt)}
                        sx={{ fontSize: '0.875rem' }}
                    >
                        {action.label}
                    </MenuItem>
                ))}
            </Menu>
            
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                elevation={3}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            minWidth: 180
                        }
                    }
                }}
            >
                {createActions.map((action, index) => (
                    <MenuItem 
                        key={index}
                        onClick={() => handleQuickAction(action.prompt)}
                        sx={{ fontSize: '0.875rem' }}
                    >
                        {action.label}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

// RequestChatAPI([newMessage]).then();
const Header = ({ setRenderSettings, RequestChatAPI, messages, setMessages, chatAPI, initDB, KB, kbUserData,
                    setIsContextItemsOpen, navigateToChat }) => {
    const [interviewExists, setInterviewExists] = useState(null);

    useEffect(() => {
        let exists;
        const setInitialSettings = async () => {
            setRenderSettings({
                setMessageWidth: (content) => isContentHTML(content) ? '90%' : undefined,
                enableGenerationModelsSelect: false,
                disableBalanceView: false,
                disableEmojiButton: true,
                disableShareButton: true,
                disableMultichat: true,
                disableMobileLeftButton: true,
                disableSentLabel: false,
                onAddContextItemsToInstructions: ({ items, toYAML }) => {
                    const formattedItems = items.map(item => {
                        const data = { ...item.item, itemId: item.meta.itemId };
                        data.createdAt = formatDate(data.createdAt);
                        data.updatedAt = formatDate(data.updatedAt);
                        return toYAML(data);
                    }).join('\n\n###\n\n');

                    return `[KNOWLEDGE_BASE]\n\n${formattedItems}\n\n[/KNOWLEDGE_BASE]\n\n`;
                },
                disableChatModelsSelect: true,
                disableInitialScroll: true,
                backgroundOpacity: 0.02,
                contextItemsWindow: 32000,
                contextItemsMemoryLabel: 'Memory',
                contextItemsReindexTitle: 'Confirmation for reindexing all memory',
                contextItemsReindexContent: 'Reindex all items in memory?',
                contextItemsTokensLabel: 'tokens',
                hideContextItems: true,
                onContextItemCalculateDistance: (item, distance) => item?.itemType === 'interview' ? 0 : distance
            });

            exists = await checkInterviewExists(initDB, KB);
            setInterviewExists(exists);
        };

        setInitialSettings();

        // Create initial welcome message if no messages and chatId exist
        const createWelcomeMessage = async () => {
            if (!getChatId() && (!messages || messages.length === 0)) {
                const welcomeMessage = {
                    msgId: `${+new Date()-10000}-${Math.floor(100000 + Math.random() * 900000)}`,
                    role: 'assistant',
                    content: `
__INTRODUCTORY_INTERVIEW_START__

## Interview Guidelines
- Always ask questions one by one.
- save the interview at the end of the interview

## Structured Interview Approach

Basic business information:
- Business name and field of activity: Understand the main activity and industry in which the business operates.
- Description of products/services: Ask about the main products or services the business offers.

Current state analysis:
- Experience in marketing and advertising: Understand what marketing channels have been used so far and what the results have been.
- Current challenges: Ask about the main challenges the business is currently facing.

Goals and vision:
- Short-term and long-term goals: Clarify what the business goals are for the next 6 months and 1-3 years.
- Target audience: Understand who the main customers of the business are and what their needs and preferences are.

Marketing management:
- Internal management or agency: Find out whether marketing activities are managed internally or with the help of an agency. If with an agency, request contact for further communication.

Communication and collaboration:
- Preferred communication channels: Ask about preferred communication channels and whether there is an email address to send information to.

Conclusion:
- Save the interview
- end the interview with something like this
"Remember, you can always tell me if you want me to remember something extra. If you need help building a marketing strategy or have a specific question, just let me know!"

__INTRODUCTORY_INTERVIEW_END__
                
${helloMessage}

1. **What would you like me to call you?**
`
                };

                if (setMessages) {
                    setMessages([welcomeMessage]);
                }
            }
        };

        if (interviewExists === false) createWelcomeMessage();
    }, [setRenderSettings, messages, setMessages, chatAPI, initDB, KB, interviewExists]);

    return <QuickActionsBar {...{RequestChatAPI, messages, kbUserData, interviewExists, setIsContextItemsOpen, navigateToChat}} />;
};

const exports = {onRenderChatMessage, Header};
window.contentRender = exports;
export default exports;