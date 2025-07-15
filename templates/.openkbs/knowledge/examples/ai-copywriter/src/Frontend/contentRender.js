import React, { useEffect } from "react";

const onRenderChatMessage = async (params) => {
    return;
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