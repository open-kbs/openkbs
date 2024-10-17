import React, { useState, useEffect, useRef } from "react";
import { IconButton, Tooltip, LinearProgress } from '@mui/material';
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { FileCopy, PlayArrow } from "@mui/icons-material";
import { AppBar, Toolbar, Typography } from '@mui/material';
import { MoreVert as MenuIcon, AccountCircle as AccountIcon } from '@mui/icons-material';

// Inject custom styles
const style = document.createElement('style');
style.innerHTML = `
    .codeContainer, .codeContainer code {
        background-color: #0d0d0d !important;
        color: white !important;
        text-shadow: none !important;
        border-radius: 10px !important;
        font-size: 13px !important;
    }
    .codeContainer * {
        background-color: #0d0d0d !important;
    }
    @keyframes pulseButton {
        0% { transform: scale(1); }
        50% { transform: scale(1.5); }
        100% { transform: scale(1); }
    }
    .pulseButton {
        animation: 0.7s pulse 2;
    }
`;
document.head.appendChild(style);

// Utility function to parse JSON safely
function parseJSON(str) {
    try {
        if (str && typeof str === 'string' && (str[0] === '{' || str[0] === '[')) {
            return JSON.parse(str);
        }
    } catch {}
}

// Check if code contains ES6 syntax or JSX
export const containsES6SyntaxOrJSX = (code) => {
    const es6Patterns = [/\bimport\b/, /\bexport\b/];
    const jsxPattern = /<([A-Za-z][A-Za-z0-9]*)(\s+[A-Za-z0-9\-]+(\s*=\s*{[^}]*}|="[^"]*"|='[^']*'|=[^>\s]+)?)*\s*\/?>/;
    return es6Patterns.some(pattern => pattern.test(code)) || jsxPattern.test(code);
};

const isMobile = window.innerWidth < 960;

export function CodeViewer(props) {
    const [response, setResponse] = useState(null);
    const [codeRunLoading, setCodeRunLoading] = useState(false);
    const [isLongContent, setIsLongContent] = useState(false);
    const [prismHeight, setPrismHeight] = useState(0);
    const responseRef = useRef(null);
    const prismRef = useRef(null);
    const [tooltipOpen, setTooltipOpen] = useState(true);

    const handleTooltipClose = () => setTooltipOpen(false);
    const handleTooltipOpen = () => setTooltipOpen(true);

    const { source, onClose, styleCopy, noCopy, limitedWidth, styleClose, execute, ...restProps } = props;
    const { ReactPrismjs, APIResponseComponent, CopyToClipboard } = props.params;
    const { RequestChatAPI, kbUserData, generateMsgId, msgIndex, messages, setSystemAlert, KB, axios } = props.params;

    const isLastMessage = msgIndex >= (messages?.filter(msg => msg?.content)?.length - 1);
    const canExecute = execute && props?.language?.includes('javascript') && !containsES6SyntaxOrJSX(source);

    useEffect(() => {
        const lineCount = source ? source.split('\n').length : 0;
        setIsLongContent(lineCount > 25);
    }, [source]);

    useEffect(() => {
        if (response && responseRef.current) {
            responseRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [response]);

    useEffect(() => {
        if (prismRef.current) {
            setPrismHeight(prismRef.current.clientHeight);
        }
    }, [source]);

    const runCode = async () => {
        try {
            const code = source.includes('module.exports')
                ? source
                : `const handler = async (event) => { ${source} }; module.exports = { handler };`;
            setCodeRunLoading(true);
            const response = await axios.post(`http://localhost:38595`, {
                walletPrivateKey: KB?.walletPrivateKey,
                walletPublicKey: KB?.walletPublicKey,
                accountId: KB?.accountId,
                userCode:code,
                AESKey: KB?.key
            });

            setCodeRunLoading(false);
            setResponse(response?.data?.error ? JSON.stringify(response.data) : JSON.stringify(response.data));
        } catch (error) {
            setCodeRunLoading(false);
            setResponse(`Error: ${error?.response?.status || error.message}`);
        }
    };

    const preStyle = {
        whiteSpace: limitedWidth ? 'pre-wrap' : undefined,
        wordBreak: limitedWidth ? 'break-all' : undefined,
        ...restProps.style
    };
    const colorIcon = '#e7e7e7';
    const oneliner = !(source?.split?.('\n')?.length > 1);

    const handleOnCopy = () => {
        setSystemAlert && setSystemAlert({ msg: 'Copied to clipboard', type: 'success', duration: 1500 });
        props?.onCopy && props.onCopy();
    };

    const formattedResponse = parseJSON(response) || { response }

    return (
        <div style={{ paddingBottom: 2, position: 'relative', display: 'inline-block', maxWidth: '100%', minWidth: '350px', overflowX: 'auto' }}>
            {oneliner && <div style={{ height: '40px' }}></div>}
            {onClose && (
                <IconButton onClick={onClose} style={styleClose}>
                    <CloseIcon style={{ opacity: 0.7, fontSize: '1rem', color: colorIcon }} />
                </IconButton>
            )}
            <div ref={prismRef}>
                <ReactPrismjs {...{ source, style: preStyle, ...restProps }} />
            </div>
            {!codeRunLoading && (
                <>
                    <CopyToClipboard text={source || ''}>
                        <IconButton onClick={handleOnCopy} style={{ position: 'absolute', top: `${prismHeight - 30}px`, right: '0px', zIndex: 10, color: 'rgba(11, 11, 11, 0.54)' }}>
                            {!noCopy && <FileCopy style={{ opacity: 0.7, color: colorIcon }} />}
                        </IconButton>
                    </CopyToClipboard>
                    {canExecute && (
                        <Tooltip title="Execute" arrow onMouseEnter={handleTooltipClose} onMouseLeave={handleTooltipOpen} open={isLastMessage && !response && !codeRunLoading && tooltipOpen} placement={"top"}>
                            <IconButton onClick={runCode} style={{ position: 'absolute', top: `${prismHeight - 30}px`, right: '36px', animation: isLastMessage && !response && !codeRunLoading && 'pulseButton 1.5s infinite', ...styleCopy }}>
                                <PlayArrow style={{ color: '#e7e7e7' }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </>
            )}
            {codeRunLoading ? (
                <LinearProgress />
            ) : (
                response && (
                    <div ref={responseRef} style={{ position: 'relative', paddingTop: '30px' }}>
                        <APIResponseComponent open={false} showResponseSize={true} JSONData={formattedResponse} enableClipboard={true} />
                        <>
                            <CopyToClipboard text={response || ''}>
                                <IconButton onClick={handleOnCopy} style={{ position: 'absolute', top: '35px', right: '0px' }}>
                                    <FileCopy style={{ opacity: 0.7, color: '#3D86C9' }} />
                                </IconButton>
                            </CopyToClipboard>
                            {isLastMessage && (
                                <Tooltip title="Send Response" arrow open={isLastMessage} placement={"top"}>
                                    <IconButton onClick={async () => {
                                        await RequestChatAPI([...messages, {
                                            role: 'user',
                                            content: typeof response === 'number' ? response.toString() : response,
                                            userId: kbUserData().chatUsername,
                                            msgId: generateMsgId()
                                        }]);
                                    }} style={{ position: 'absolute', top: '35px', right: '36px', animation: 'pulseButton 1.5s infinite' }}>
                                        <SendIcon style={{ opacity: 0.9, color: '#3D86C9' }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>
                    </div>
                )
            )}
        </div>
    );
}

const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
    if (content.match(/```/)) {
        let language = null;
        const output = [];

        content.split('\n').forEach(line => {
            if (!language) {
                language = /```(?<language>\w+)/g.exec(line)?.groups?.language;
                output.push(language ? { language, code: '' } : line);
            } else if (line.match(/```/)) {
                language = null;
            } else {
                output[output.length - 1].code += line + '\n';
            }
        });

        return output.map((o, i) =>
            typeof o === 'string'
                ? <p key={`a${i}`} style={{ marginTop: '0px', marginBottom: '0px' }}>{o}</p>
                : <div key={`a${i}`}>
                    <CodeViewer
                        key={`ab${i}`}
                        params={{ ...params, i }}
                        limitedWidth={isMobile}
                        execute={true}
                        className="codeContainer"
                        language={o.language}
                        source={o.code}
                    />
                </div>
        );
    }
}

const Header = ({ setRenderSettings}) => {
    useEffect(() => {
        setRenderSettings({
            disableShareButton: true,
            disableBalanceView: true,
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

    return (
        <AppBar position="absolute" style={{ zIndex: 2000, flexGrow: 1, textAlign: 'left' }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: '16px' }}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    My PC Agent
                </Typography>
                <IconButton edge="end" color="inherit" aria-label="account">
                    <AccountIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
}

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;