import React, {useEffect} from 'react';

// Inject custom styles
const style = document.createElement('style');
style.innerHTML = ``;
document.head.appendChild(style);


const isMobile = window.innerWidth < 960;


const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
}

const Header = ({ setRenderSettings}) => {
    useEffect(() => {
        setRenderSettings({
            disableEmojiButton: true,
            disableShareButton: true,
            disableTextToSpeechButton: true,
            disableCopyButton: true,
            disableChatAvatar: true,
            disableSentLabel: true,
            disableContextItems: true,
            disableMobileLeftButton: true,
            disableBalanceView: true,
            disableChatModelsSelect: true,
        });
    }, [setRenderSettings]);

}

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;