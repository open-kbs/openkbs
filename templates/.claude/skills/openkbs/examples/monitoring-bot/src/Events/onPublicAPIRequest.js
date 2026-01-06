import {
    setAgentSetting,
    getAgentSetting,
    storeTelegramMessage,
    getTelegramMessage,
    deleteTelegramMessage
} from './memoryHelpers.js';

const AUTONOMOUS_CHAT_RULES = `**Autonomous Chat Rules:**
This chat has NO USER listening. ONLY output commands.
To communicate: Use sendToTelegramChannel command.
Plain text "END" to finish.`;

const BOT_TOKEN = '{{secrets.telegramBotToken}}';

async function getChannelId() {
    const secretsId = '{{secrets.telegramChannelID}}';
    if (secretsId && !secretsId.includes('{{')) return secretsId;
    return await getAgentSetting('agent_telegramChannelID');
}

export const handler = async ({ payload, queryStringParameters, headers }) => {
    try {
        let CHANNEL_ID = await getChannelId();

        // Webhook setup
        if (queryStringParameters?.setupTelegramWebhook === 'true') {
            const existing = await getAgentSetting('agent_telegramWebhookSetup');
            if (existing) {
                return { ok: false, error: 'Already configured', setupDate: existing };
            }

            const SECRET_TOKEN = crypto.createHash('sha256')
                .update(BOT_TOKEN).digest('hex').substring(0, 32);

            const WEBHOOK_URL = `https://chat.openkbs.com/publicAPIRequest?kbId=${openkbs.kbId}&source=telegram`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
            const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
                url: WEBHOOK_URL,
                allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post'],
                drop_pending_updates: true,
                secret_token: SECRET_TOKEN
            });

            if (!response.data.ok) throw new Error(response.data.description);

            const setupDate = new Date().toISOString();
            await setAgentSetting('agent_telegramWebhookSetup', setupDate);

            return { ok: true, webhookUrl: WEBHOOK_URL, setupDate };
        }

        // Webhook removal
        if (queryStringParameters?.removeTelegramWebhook === 'true') {
            const existing = await getAgentSetting('agent_telegramWebhookSetup');
            if (existing) {
                return { ok: false, error: 'Remove internally first' };
            }
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
            return { ok: true, message: 'Removed' };
        }

        // Validate secret token
        const expectedToken = crypto.createHash('sha256')
            .update(BOT_TOKEN).digest('hex').substring(0, 32);
        const receivedToken = headers?.[
            Object.keys(headers || {}).find(k => k.toLowerCase() === 'x-telegram-bot-api-secret-token')
        ];
        if (receivedToken && receivedToken !== expectedToken) {
            return { ok: false, error: 'Invalid token' };
        }

        const { message, channel_post, edited_message, edited_channel_post } = payload;

        // Handle channel post
        if (channel_post) {
            const text = channel_post.text || channel_post.caption || '';
            const messageId = channel_post.message_id;
            const chatId = channel_post.chat.id;

            if (!CHANNEL_ID) {
                await setAgentSetting('agent_telegramChannelID', chatId.toString());
            }

            const existing = await getTelegramMessage(messageId);
            if (existing) return { ok: true, duplicate: true };

            const senderName = channel_post.from?.username ||
                               channel_post.author_signature ||
                               'Unknown';

            await storeTelegramMessage(messageId, {
                text: text.substring(0, 50000),
                date: channel_post.date,
                from: senderName,
                chatId
            });

            const timeStr = new Date(channel_post.date * 1000)
                .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            await openkbs.chats({
                chatTitle: `TG: ${senderName} - ${timeStr}`,
                message: `PROCESS_TELEGRAM_MESSAGE from ${senderName}\n\n"${text}"\n\n${AUTONOMOUS_CHAT_RULES}`
            });

            return { ok: true, processed: 'channel_post' };
        }

        // Handle direct message
        if (message) {
            const text = message.text || '';
            const messageId = message.message_id;
            const userName = message.from.username || message.from.first_name;

            const existing = await getTelegramMessage(messageId);
            if (existing) return { ok: true, duplicate: true };

            await storeTelegramMessage(messageId, {
                text: text.substring(0, 20000),
                date: message.date,
                from: userName,
                chatId: message.chat.id
            });

            await openkbs.chats({
                chatTitle: `TG DM: ${userName}`,
                message: `TELEGRAM DM from ${userName}\n\n"${text}"\n\n${AUTONOMOUS_CHAT_RULES}`
            });

            return { ok: true, processed: 'message' };
        }

        // Handle edits
        if (edited_channel_post || edited_message) {
            const edited = edited_channel_post || edited_message;
            const messageId = edited.message_id;
            const newText = edited.text;

            const existing = await getTelegramMessage(messageId);
            if (!existing) return { ok: true, note: 'Not found' };

            const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;

            if (newText?.trim().toLowerCase().startsWith('_delete')) {
                await deleteTelegramMessage(itemId);
                return { ok: true, action: 'deleted' };
            }

            await storeTelegramMessage(messageId, {
                ...existing,
                text: newText,
                edited: true
            });

            return { ok: true, action: 'edited' };
        }

        return { ok: true, message: 'Not handled' };

    } catch (error) {
        return { ok: true, error: error.message };
    }
};
