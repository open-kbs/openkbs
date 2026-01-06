# Telegram Webhook Pattern

Complete working code for receiving and processing Telegram messages via webhook.

## Concept

Full Telegram bot integration with:
- Webhook setup/removal via query params
- Secret token validation
- Channel posts and direct messages
- Photo upload to OpenKBS storage
- Message editing and deletion
- Duplicate detection
- Autonomous chat processing

## onPublicAPIRequest.js

```javascript
import {
    setAgentSetting,
    getAgentSetting,
    storeTelegramMessage,
    getTelegramMessage,
    deleteTelegramMessage
} from './memoryHelpers.js';

const AUTONOMOUS_CHAT_RULES = `**Autonomous Chat Rules:**
This chat has NO USER listening. You MUST:
1. ONLY output commands - no explanatory text
2. To communicate with user: Use sendToTelegramChannel command
3. Plain text "END" to finish the chat`;

export const handler = async ({ payload, queryStringParameters, headers }) => {
    try {
        const BOT_TOKEN = '{{secrets.telegramBotToken}}';

        // Get channel ID from secrets or saved setting
        let CHANNEL_ID = '{{secrets.telegramChannelID}}';
        if (!CHANNEL_ID || CHANNEL_ID.includes('{{')) {
            CHANNEL_ID = await getAgentSetting('agent_telegramChannelID');
        }

        // === WEBHOOK SETUP ===
        if (queryStringParameters?.setupTelegramWebhook === 'true') {
            return await setupWebhook(BOT_TOKEN, CHANNEL_ID);
        }

        // === WEBHOOK REMOVAL ===
        if (queryStringParameters?.removeTelegramWebhook === 'true') {
            return await removeWebhook(BOT_TOKEN);
        }

        // === VALIDATE SECRET TOKEN ===
        const expectedToken = crypto.createHash('sha256')
            .update(BOT_TOKEN).digest('hex').substring(0, 32);

        const receivedToken = headers?.[
            Object.keys(headers || {}).find(key =>
                key.toLowerCase() === 'x-telegram-bot-api-secret-token'
            )
        ];

        if (receivedToken && receivedToken !== expectedToken) {
            return { ok: false, error: 'Invalid secret token' };
        }

        // === PROCESS UPDATES ===
        const { message, channel_post, edited_message, edited_channel_post, callback_query } = payload;

        // Handle channel posts
        if (channel_post) {
            return await handleChannelPost(channel_post, BOT_TOKEN, CHANNEL_ID);
        }

        // Handle direct messages
        if (message) {
            return await handleDirectMessage(message, BOT_TOKEN);
        }

        // Handle edited messages
        if (edited_channel_post) {
            return await handleEditedMessage(edited_channel_post);
        }

        if (edited_message) {
            return await handleEditedMessage(edited_message);
        }

        // Handle button callbacks
        if (callback_query) {
            return { ok: true, processed: 'callback', data: callback_query.data };
        }

        return { ok: true, message: 'Update type not handled' };

    } catch (error) {
        // Always return ok:true to prevent Telegram retries
        return { ok: true, error: error.message };
    }
};
```

## Webhook Setup/Removal

```javascript
async function setupWebhook(BOT_TOKEN, CHANNEL_ID) {
    // Check if already configured
    const existing = await getAgentSetting('agent_telegramWebhookSetup');
    if (existing) {
        return { ok: false, error: 'Webhook already configured', setupDate: existing };
    }

    try {
        // Generate secret token
        const SECRET_TOKEN = crypto.createHash('sha256')
            .update(BOT_TOKEN).digest('hex').substring(0, 32);

        const WEBHOOK_URL = `https://chat.openkbs.com/publicAPIRequest?kbId=${openkbs.kbId}&source=telegram`;

        // Remove any existing webhook first
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);

        // Set new webhook
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            url: WEBHOOK_URL,
            allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query'],
            drop_pending_updates: true,
            secret_token: SECRET_TOKEN
        });

        if (!response.data.ok) {
            throw new Error(response.data.description);
        }

        // Save setup flag
        const setupDate = new Date().toISOString();
        await setAgentSetting('agent_telegramWebhookSetup', setupDate);

        // Send test message
        if (CHANNEL_ID) {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: CHANNEL_ID,
                text: '✅ *Telegram Integration Active*\n\nWebhook configured successfully!',
                parse_mode: 'Markdown'
            });
        }

        return {
            ok: true,
            message: 'Webhook configured',
            webhookUrl: WEBHOOK_URL,
            setupDate
        };

    } catch (error) {
        return { ok: false, error: error.message };
    }
}

async function removeWebhook(BOT_TOKEN) {
    const webhookSetup = await getAgentSetting('agent_telegramWebhookSetup');
    if (webhookSetup) {
        return { ok: false, error: 'Cannot remove active webhook. Remove internally first.' };
    }

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
        drop_pending_updates: true
    });

    return { ok: true, message: 'Webhook removed' };
}
```

## Message Handlers

```javascript
async function handleChannelPost(post, BOT_TOKEN, CHANNEL_ID) {
    const text = post.text || post.caption || '';
    const photo = post.photo;
    const messageId = post.message_id;
    const chatId = post.chat.id;
    const date = post.date;

    // Auto-save channel ID on first message
    if (!CHANNEL_ID) {
        await setAgentSetting('agent_telegramChannelID', chatId.toString());
    }

    // Get sender info
    let senderName = post.from?.username ||
                     post.from?.first_name ||
                     post.author_signature ||
                     post.sender_chat?.title ||
                     'Unknown';

    // Check for duplicate
    const existing = await getTelegramMessage(messageId);
    if (existing) {
        return { ok: true, duplicate: true, messageId };
    }

    // Upload photo if present
    let uploadedImageUrl = null;
    if (photo?.length > 0) {
        uploadedImageUrl = await uploadTelegramPhoto(photo, BOT_TOKEN);
    }

    // Store message
    await storeTelegramMessage(messageId, {
        text: text.substring(0, 100000),
        date,
        type: 'channel',
        from: senderName,
        chatId,
        ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
    });

    // Build LLM message
    let chatMessage;
    if (uploadedImageUrl) {
        chatMessage = JSON.stringify([
            { type: "text", text: `PROCESS_TELEGRAM_MESSAGE from ${senderName}\n\n${text || '[image]'}\n\n${AUTONOMOUS_CHAT_RULES}` },
            { type: "image_url", image_url: { url: uploadedImageUrl } }
        ]);
    } else {
        chatMessage = `PROCESS_TELEGRAM_MESSAGE from ${senderName}\n\n${senderName} wrote:\n"""\n${text}\n"""\n\n${AUTONOMOUS_CHAT_RULES}`;
    }

    // Create chat for processing
    const timeStr = new Date(date * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    await openkbs.chats({
        chatTitle: `TG: ${senderName} - ${timeStr}`,
        message: chatMessage
    });

    return { ok: true, processed: 'channel_post', messageId };
}

async function handleDirectMessage(message, BOT_TOKEN) {
    const text = message.text || message.caption || '';
    const photo = message.photo;
    const messageId = message.message_id;
    const userName = message.from.username || message.from.first_name;

    // Check duplicate
    const existing = await getTelegramMessage(messageId);
    if (existing) {
        return { ok: true, duplicate: true };
    }

    // Upload photo
    let uploadedImageUrl = null;
    if (photo?.length > 0) {
        uploadedImageUrl = await uploadTelegramPhoto(photo, BOT_TOKEN);
    }

    // Store message
    await storeTelegramMessage(messageId, {
        text: text.substring(0, 20000),
        date: message.date,
        type: 'direct',
        from: userName,
        chatId: message.chat.id,
        userId: message.from.id,
        ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
    });

    // Create chat
    const content = [
        { type: "text", text: `TELEGRAM DM from ${userName}\n\n"${text}"\n\n${AUTONOMOUS_CHAT_RULES}` }
    ];
    if (uploadedImageUrl) {
        content.push({ type: "image_url", image_url: { url: uploadedImageUrl } });
    }

    await openkbs.chats({
        chatTitle: `TG DM: ${userName}`,
        message: JSON.stringify(content)
    });

    return { ok: true, processed: 'message' };
}
```

## Photo Upload Helper

```javascript
async function uploadTelegramPhoto(photo, BOT_TOKEN) {
    try {
        // Get largest photo
        const largestPhoto = photo[photo.length - 1];

        // Get file path from Telegram
        const fileInfo = await axios.get(
            `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${largestPhoto.file_id}`
        );
        const filePath = fileInfo.data.result.file_path;

        // Download file
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
        const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });

        // Generate filename
        const timestamp = Date.now();
        const ext = filePath.split('.').pop() || 'jpg';
        const filename = `telegram_photo_${timestamp}.${ext}`;

        // Get presigned URL and upload
        const presignedUrl = await openkbs.kb({
            action: 'createPresignedURL',
            namespace: 'files',
            fileName: filename,
            fileType: 'image/jpeg',
            presignedOperation: 'putObject'
        });

        await axios.put(presignedUrl, fileResponse.data, {
            headers: { 'Content-Type': 'image/jpeg', 'Content-Length': fileResponse.data.length }
        });

        return `https://yourdomain.com/media/${filename}`;

    } catch (error) {
        console.error('Photo upload failed:', error);
        return null;
    }
}
```

## Edited Message Handler

```javascript
async function handleEditedMessage(edited) {
    const messageId = edited.message_id;
    const newText = edited.text;
    const editDate = edited.edit_date;

    const existing = await getTelegramMessage(messageId);
    if (!existing) {
        return { ok: true, note: 'Message not found' };
    }

    const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;

    // Special: "_delete" prefix removes message from history
    if (newText?.trim().toLowerCase().startsWith('_delete')) {
        await deleteTelegramMessage(itemId);
        return { ok: true, action: 'deleted' };
    }

    // Update message
    await storeTelegramMessage(messageId, {
        ...existing,
        text: newText,
        edited: true,
        editedAt: editDate,
        originalText: existing.originalText || existing.text
    });

    return { ok: true, action: 'edited' };
}
```

## memoryHelpers.js

```javascript
export async function storeTelegramMessage(messageId, data) {
    // Zero-pad for proper DynamoDB sorting
    const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;
    const body = { ...data, storedAt: new Date().toISOString() };

    try {
        await openkbs.updateItem({ itemType: 'telegram', itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType: 'telegram', itemId, body });
    }
}

export async function getTelegramMessage(messageId) {
    const itemId = `telegram_${messageId.toString().padStart(12, '0')}`;
    try {
        const result = await openkbs.getItem(itemId);
        return result?.item?.body;
    } catch (e) {
        return null;
    }
}

export async function deleteTelegramMessage(itemId) {
    try {
        await openkbs.deleteItem(itemId);
    } catch (e) {}
}
```

## settings.json - Priority Items

```json
{
  "options": {
    "priorityItems": [
      { "limit": 100, "prefix": "memory" },
      { "limit": 100, "prefix": "telegram" }
    ]
  }
}
```

## Setup URL

```
https://chat.openkbs.com/publicAPIRequest?kbId=YOUR_KB_ID&setupTelegramWebhook=true
```

## Key Points

1. **Webhook setup via query param** - `?setupTelegramWebhook=true`
2. **Secret token validation** - SHA256 hash of bot token
3. **Always return `ok: true`** - Prevents Telegram retries
4. **Photo upload** - Download from Telegram, upload to OpenKBS storage
5. **Duplicate detection** - Check `getTelegramMessage` before processing
6. **Zero-padded messageId** - For proper DynamoDB string sorting
7. **Autonomous chat rules** - Tell LLM how to behave without user
8. **Edit as delete** - `_delete` prefix removes from history
