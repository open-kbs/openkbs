# Telegram Integration Pattern

Complete working code for Telegram bot messaging and webhooks.

## Setup

1. Create bot with @BotFather
2. Get bot token
3. Add to secrets: `{{secrets.telegramBotToken}}`
4. Optional: Set channel ID in secrets or detect automatically

## actions.js

```javascript
const TELEGRAM_BOT_TOKEN = '{{secrets.telegramBotToken}}';

// Helper to get channel ID from secrets or saved setting
async function getTelegramChannelId() {
    const secretsChannelId = '{{secrets.telegramChannelID}}';
    if (secretsChannelId && !secretsChannelId.includes('{{')) {
        return secretsChannelId;
    }
    // Fallback to saved setting
    return await getAgentSetting('agent_telegramChannelID');
}

// Send text message to Telegram channel
async function sendToTelegramChannel(message, options = {}) {
    try {
        const channelId = await getTelegramChannelId();
        if (!channelId) {
            throw new Error('Telegram channel ID not configured');
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: channelId,
            text: message,
            parse_mode: options.parse_mode || 'Markdown',
            disable_notification: options.silent || false
        });

        if (response.data.ok) {
            return { success: true, messageId: response.data.result.message_id };
        }
        throw new Error(response.data.description || 'Telegram error');
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Send photo to Telegram channel
async function sendPhotoToTelegramChannel(photoUrl, caption = '') {
    try {
        const channelId = await getTelegramChannelId();
        if (!channelId) {
            throw new Error('Telegram channel ID not configured');
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const response = await axios.post(url, {
            chat_id: channelId,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'Markdown'
        });

        if (response.data.ok) {
            return { success: true, messageId: response.data.result.message_id };
        }
        throw new Error(response.data.description || 'Telegram error');
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Command: Send message to Telegram
[/<sendToTelegramChannel>([\s\S]*?)<\/sendToTelegramChannel>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());
        const result = await sendToTelegramChannel(data.message, {
            parse_mode: data.parse_mode || 'Markdown',
            silent: data.silent || false
        });

        return {
            type: "TELEGRAM_MESSAGE_SENT",
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "TELEGRAM_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}],

// Command: Send photo to Telegram
[/<sendPhotoToTelegramChannel>([\s\S]*?)<\/sendPhotoToTelegramChannel>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());
        const result = await sendPhotoToTelegramChannel(data.photoUrl, data.caption || '');

        return {
            type: "TELEGRAM_PHOTO_SENT",
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return {
            type: "TELEGRAM_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}]
```

## Webhook Handler (onPublicAPIRequest.js)

Receive messages from Telegram:

```javascript
export const handler = async (event) => {
    const body = JSON.parse(event.body || '{}');

    // Telegram webhook payload
    if (body.message || body.channel_post) {
        const msg = body.message || body.channel_post;

        // Auto-detect and save channel ID
        if (msg.chat?.id && msg.chat?.type === 'channel') {
            await setAgentSetting('agent_telegramChannelID', String(msg.chat.id));
        }

        // Store message for context
        await storeTelegramMessage(msg.message_id, {
            text: msg.text || '',
            date: msg.date,
            from: msg.from?.username || msg.chat?.title || 'Unknown',
            chatId: msg.chat?.id,
            type: msg.photo ? 'photo' : 'text'
        });

        // Create chat with message for agent to process
        await openkbs.chats({
            chatTitle: `Telegram: ${msg.from?.username || 'Channel'}`,
            message: JSON.stringify([{
                type: "text",
                text: `[TELEGRAM] ${msg.from?.username || 'User'}: ${msg.text || '[media]'}`
            }])
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
    };
};
```

## memoryHelpers.js - Store Telegram Messages

```javascript
export async function storeTelegramMessage(messageId, data) {
    const itemId = `telegram_${messageId}`;
    const body = {
        ...data,
        storedAt: new Date().toISOString()
    };

    try {
        await openkbs.updateItem({ itemType: 'telegram', itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType: 'telegram', itemId, body });
    }
}
```

## settings.json - Priority Items for Telegram

```json
{
  "options": {
    "priorityItems": [
      { "limit": 100, "prefix": "memory" },
      { "limit": 50, "prefix": "telegram" }
    ]
  }
}
```

## instructions.txt (LLM prompt)

```
Telegram Commands:

Send message:
<sendToTelegramChannel>{"message": "*Bold* message with _italic_"}</sendToTelegramChannel>

Send photo:
<sendPhotoToTelegramChannel>{"photoUrl": "https://...", "caption": "Photo caption"}</sendPhotoToTelegramChannel>

Markdown supported: *bold*, _italic_, `code`, [link](url)

Incoming Telegram messages appear with [TELEGRAM] prefix.
```

## Key Points

1. **Bot token in secrets**: `{{secrets.telegramBotToken}}`
2. **Channel ID**: Auto-detected from first message or set in secrets
3. **Webhook setup**: Set webhook URL to your KB's public API endpoint
4. **Message storage**: Store in `telegram_` prefix for context injection
5. **Markdown mode**: Default parse_mode is Markdown
6. **Photo URL**: Must be publicly accessible URL
