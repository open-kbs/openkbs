import { setMemoryValue, deleteItem, setAgentSetting, getAgentSetting } from './memoryHelpers.js';

const meta = { _meta_actions: ["REQUEST_CHAT_MODEL"] };

const TELEGRAM_BOT_TOKEN = '{{secrets.telegramBotToken}}';

async function getTelegramChannelId() {
    const secretsId = '{{secrets.telegramChannelID}}';
    if (secretsId && !secretsId.includes('{{')) return secretsId;
    return await getAgentSetting('agent_telegramChannelID');
}

export default [
    // Set memory
    [/<setMemory>([\s\S]*?)<\/setMemory>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            if (!data.itemId?.startsWith('memory_')) {
                return { type: "MEMORY_ERROR", error: "itemId must start with 'memory_'", ...meta };
            }
            await setMemoryValue(data.itemId, data.value, data.expirationInMinutes);
            return { type: "MEMORY_UPDATED", itemId: data.itemId, ...meta };
        } catch (e) {
            return { type: "MEMORY_ERROR", error: e.message, ...meta };
        }
    }],

    // Delete item
    [/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await deleteItem(data.itemId);
            return { type: "ITEM_DELETED", itemId: data.itemId, ...meta };
        } catch (e) {
            return { type: "DELETE_ERROR", error: e.message, ...meta };
        }
    }],

    // Hibernate agent
    [/<hibernateAgent>([\s\S]*?)<\/hibernateAgent>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let sleepUntil;

            if (data.hours) {
                sleepUntil = new Date(Date.now() + data.hours * 60 * 60 * 1000);
            } else if (data.days) {
                sleepUntil = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000);
            } else if (data.until) {
                sleepUntil = new Date(data.until);
            } else {
                throw new Error('Specify hours, days, or until');
            }

            await setAgentSetting('agent_sleepUntil', sleepUntil.toISOString());
            return { type: "AGENT_HIBERNATING", sleepUntil: sleepUntil.toISOString(), ...meta };
        } catch (e) {
            return { type: "HIBERNATE_ERROR", error: e.message, ...meta };
        }
    }],

    // Agent settings
    [/<setAgentSettings>([\s\S]*?)<\/setAgentSettings>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());

            if (data.pulseInterval !== undefined) {
                const interval = Math.max(1, Math.min(60, parseInt(data.pulseInterval)));
                await setAgentSetting('agent_pulseInterval', interval);
            }

            if (data.wakeUp === true) {
                await setAgentSetting('agent_sleepUntil', null);
            }

            return { type: "SETTINGS_UPDATED", settings: data, ...meta };
        } catch (e) {
            return { type: "SETTINGS_ERROR", error: e.message, ...meta };
        }
    }],

    // Send to Telegram
    [/<sendToTelegramChannel>([\s\S]*?)<\/sendToTelegramChannel>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const channelId = await getTelegramChannelId();

            if (!channelId) {
                throw new Error('Telegram channel ID not configured');
            }

            const response = await axios.post(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    chat_id: channelId,
                    text: data.message,
                    parse_mode: 'Markdown',
                    disable_notification: data.silent || false
                }
            );

            if (!response.data.ok) {
                throw new Error(response.data.description);
            }

            return { type: "TELEGRAM_SENT", messageId: response.data.result.message_id, ...meta };
        } catch (e) {
            return { type: "TELEGRAM_ERROR", error: e.message, ...meta };
        }
    }],

    // Send photo to Telegram
    [/<sendPhotoToTelegramChannel>([\s\S]*?)<\/sendPhotoToTelegramChannel>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const channelId = await getTelegramChannelId();

            if (!channelId) {
                throw new Error('Telegram channel ID not configured');
            }

            const response = await axios.post(
                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
                {
                    chat_id: channelId,
                    photo: data.photoUrl,
                    caption: data.caption || '',
                    parse_mode: 'Markdown'
                }
            );

            if (!response.data.ok) {
                throw new Error(response.data.description);
            }

            return { type: "TELEGRAM_PHOTO_SENT", messageId: response.data.result.message_id, ...meta };
        } catch (e) {
            return { type: "TELEGRAM_ERROR", error: e.message, ...meta };
        }
    }]
];
