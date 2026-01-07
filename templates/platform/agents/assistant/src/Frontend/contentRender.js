import React, {useEffect} from 'react';

const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];
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

}

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;