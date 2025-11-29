// SDK Demo Agent - Comprehensive Backend SDK Examples

// ============================================================================
// MEMORY HELPERS - Atomic operations pattern
// ============================================================================

/**
 * Upsert pattern - update or create if not exists
 */
async function upsertItem(itemType, itemId, body) {
    try {
        await openkbs.updateItem({ itemType, itemId, body });
    } catch (e) {
        await openkbs.createItem({ itemType, itemId, body });
    }
    return { success: true, itemId };
}

/**
 * Set memory value with optional expiration
 */
async function setMemoryValue(itemId, value, expirationInMinutes = null) {
    if (!itemId.startsWith('memory_')) {
        throw new Error(`Invalid memory itemId: "${itemId}". Must start with "memory_"`);
    }

    const body = {
        value,
        updatedAt: new Date().toISOString()
    };

    if (expirationInMinutes != null) {
        body.exp = new Date(Date.now() + expirationInMinutes * 60 * 1000).toISOString();
    }

    return upsertItem('memory', itemId, body);
}

/**
 * Cleanup expired items of a specific type
 */
async function cleanupExpiredItems(itemType, limit = 200) {
    const result = await openkbs.fetchItems({
        beginsWith: `${itemType}_`,
        limit,
        field: 'itemId'
    });

    if (!result?.items) return { cleaned: 0 };

    let cleaned = 0;
    const now = new Date();

    for (const item of result.items) {
        if (item.item?.body?.exp) {
            const expDate = new Date(item.item.body.exp);
            if (expDate < now) {
                await openkbs.deleteItem(item.meta.itemId);
                cleaned++;
            }
        }
    }

    return { cleaned };
}

// ============================================================================
// TELEGRAM INTEGRATION EXAMPLE
// ============================================================================

const TELEGRAM_BOT_TOKEN = '{{secrets.telegramBotToken}}';
const TELEGRAM_CHANNEL_ID = '{{secrets.telegramChannelID}}';

async function sendToTelegram(message, options = {}) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHANNEL_ID,
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

// ============================================================================
// ACTIONS
// ============================================================================

export const getActions = (meta, event) => [
    // =========================================================================
    // MEMORY MANAGEMENT
    // =========================================================================

    /**
     * Set memory with optional expiration
     * Usage: <setMemory>{"itemId": "memory_key", "value": "data", "expirationInMinutes": 60}</setMemory>
     */
    [/<setMemory>([\s\S]*?)<\/setMemory>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await setMemoryValue(data.itemId, data.value, data.expirationInMinutes);
            return {
                type: "MEMORY_UPDATED",
                itemId: data.itemId,
                expires: data.expirationInMinutes ? `in ${data.expirationInMinutes} minutes` : 'never',
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { type: "MEMORY_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * Delete any item by ID
     * Usage: <deleteItem>{"itemId": "memory_key"}</deleteItem>
     */
    [/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.deleteItem(data.itemId);
            return { type: "ITEM_DELETED", itemId: data.itemId, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { type: "DELETE_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * Cleanup expired memory items
     * Usage: <cleanupMemory/>
     */
    [/<cleanupMemory\s*\/>/s, async () => {
        try {
            const result = await cleanupExpiredItems('memory');
            return { type: "CLEANUP_COMPLETE", cleaned: result.cleaned, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { type: "CLEANUP_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // VIEW IMAGE (adds to LLM vision context)
    // =========================================================================

    /**
     * View image in LLM context
     * Usage: <viewImage>{"url": "https://example.com/image.jpg"}</viewImage>
     */
    [/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            return {
                data: [
                    { type: "text", text: `Viewing image: ${data.url}` },
                    { type: "image_url", image_url: { url: data.url } }
                ],
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { type: "VIEW_IMAGE_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // AI IMAGE GENERATION
    // =========================================================================

    /**
     * Generate AI image with Gemini or GPT-Image-1
     * Usage: <createAIImage>{"prompt": "description", "model": "gemini-2.5-flash-image", "aspect_ratio": "16:9"}</createAIImage>
     */
    [/<createAIImage>([\s\S]*?)<\/createAIImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const model = data.model || "gemini-2.5-flash-image";
            const params = { model, n: 1 };

            // Reference images for editing (Gemini only)
            if (data.imageUrls?.length > 0) params.imageUrls = data.imageUrls;

            if (model === 'gpt-image-1') {
                const validSizes = ["1024x1024", "1536x1024", "1024x1536", "auto"];
                params.size = validSizes.includes(data.size) ? data.size : "1024x1024";
                params.quality = "high";
            } else if (model === 'gemini-2.5-flash-image') {
                const validRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
                params.aspect_ratio = validRatios.includes(data.aspect_ratio) ? data.aspect_ratio : "1:1";
            }

            const image = await openkbs.generateImage(data.prompt, params);

            // Upload to storage
            const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
            const uploadResult = await openkbs.uploadImage(image[0].b64_json, fileName, 'image/png');

            return { type: 'CHAT_IMAGE', data: { imageUrl: uploadResult.url }, ...meta, _meta_actions: [] };
        } catch (e) {
            return { error: e.message || 'Image creation failed', ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // FILE UPLOAD FROM URL
    // =========================================================================

    /**
     * Upload file from URL to KB storage
     * Usage: <uploadFile>{"url": "https://example.com/file.jpg", "filename": "custom-name.jpg"}</uploadFile>
     */
    [/<uploadFile>([\s\S]*?)<\/uploadFile>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());

            // Download file
            const fileResponse = await axios.get(data.url, { responseType: 'arraybuffer' });
            const fileBuffer = fileResponse.data;

            // Determine filename
            let filename = data.filename;
            if (!filename) {
                const urlPath = new URL(data.url).pathname;
                filename = urlPath.split('/').pop() || `file_${Date.now()}`;
            }

            // Get content type
            const contentType = fileResponse.headers['content-type'] || 'application/octet-stream';

            // Get presigned URL
            const presigned = await openkbs.kb({
                action: 'createPresignedURL',
                namespace: 'files',
                fileName: filename,
                fileType: contentType,
                presignedOperation: 'putObject'
            });

            // Upload
            await axios.put(presigned, fileBuffer, {
                headers: { 'Content-Type': contentType, 'Content-Length': fileBuffer.length }
            });

            const publicUrl = `https://web.file.vpc1.us/files/${openkbs.kbId}/${filename}`;

            return {
                type: "FILE_UPLOADED",
                data: { url: publicUrl, filename, size: fileBuffer.length },
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { type: "UPLOAD_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // SCHEDULED TASKS
    // =========================================================================

    /**
     * Schedule a task for future execution
     * Usage: <scheduleTask>{"message": "reminder text", "delay": "1h"}</scheduleTask>
     * delay formats: "30m" (30 minutes), "2h" (2 hours), "1d" (1 day)
     * or use "time": "2024-12-25T10:00:00Z" for specific time
     */
    [/<scheduleTask>([\s\S]*?)<\/scheduleTask>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let scheduledTime;

            if (data.time) {
                let isoTimeStr = data.time.replace(' ', 'T');
                if (!isoTimeStr.includes('Z') && !isoTimeStr.includes('+')) isoTimeStr += 'Z';
                scheduledTime = new Date(isoTimeStr).getTime();
            } else if (data.delay) {
                let delayMs = 0;
                if (data.delay.endsWith('h')) delayMs = parseFloat(data.delay) * 3600000;
                else if (data.delay.endsWith('d')) delayMs = parseFloat(data.delay) * 86400000;
                else delayMs = parseFloat(data.delay) * 60000; // default minutes
                scheduledTime = Date.now() + delayMs;
            } else {
                scheduledTime = Date.now() + 3600000; // default 1 hour
            }

            const response = await openkbs.kb({
                action: 'createScheduledTask',
                scheduledTime: Math.floor(scheduledTime / 60000) * 60000, // round to minute
                taskPayload: {
                    message: `[SCHEDULED_TASK] ${data.message}`,
                    createdAt: Date.now()
                },
                description: data.message.substring(0, 50)
            });

            return {
                type: 'TASK_SCHEDULED',
                data: { scheduledTime: new Date(scheduledTime).toISOString(), taskId: response.taskId },
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * List all scheduled tasks
     * Usage: <getScheduledTasks/>
     */
    [/<getScheduledTasks\s*\/>/s, async () => {
        try {
            const response = await openkbs.kb({ action: 'getScheduledTasks' });
            return { type: 'SCHEDULED_TASKS_LIST', data: response, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * Delete a scheduled task
     * Usage: <deleteScheduledTask>{"timestamp": 1704067200000}</deleteScheduledTask>
     */
    [/<deleteScheduledTask>([\s\S]*?)<\/deleteScheduledTask>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.kb({ action: 'deleteScheduledTask', timestamp: data.timestamp });
            return { type: 'TASK_DELETED', timestamp: data.timestamp, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // COMMUNICATION
    // =========================================================================

    /**
     * Send email
     * Usage: <sendMail>{"to": "user@example.com", "subject": "Hello", "body": "<h1>Hi</h1>"}</sendMail>
     */
    [/<sendMail>([\s\S]*?)<\/sendMail>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.sendMail(data.to, data.subject, data.body);
            return { type: 'EMAIL_SENT', data: { to: data.to, subject: data.subject }, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * Send to Telegram channel (requires secrets.telegramBotToken and secrets.telegramChannelID)
     * Usage: <sendToTelegram>{"message": "Hello!", "silent": false}</sendToTelegram>
     */
    [/<sendToTelegram>([\s\S]*?)<\/sendToTelegram>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const result = await sendToTelegram(data.message, { silent: data.silent });
            return {
                type: "TELEGRAM_SENT",
                success: result.success,
                messageId: result.messageId,
                error: result.error,
                ...meta,
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        } catch (e) {
            return { type: "TELEGRAM_ERROR", error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    // =========================================================================
    // CHAT OPERATIONS
    // =========================================================================

    /**
     * Update current chat title and icon
     * Usage: <updateChat>{"title": "New Title", "icon": "🔥"}</updateChat>
     */
    [/<updateChat>([\s\S]*?)<\/updateChat>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());

            if (event?.payload?.chatId) {
                await openkbs.chats({
                    action: "updateChat",
                    title: await openkbs.encrypt(data.title),
                    chatIcon: data.icon || '💬',
                    chatId: event.payload.chatId
                });
                return { type: 'CHAT_UPDATED', ...meta, _meta_actions: [] };
            }
            return { error: 'No chatId available', ...meta, _meta_actions: [] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: [] };
        }
    }],

    /**
     * Create a new chat (for notifications)
     * Usage: <createChat>{"title": "Alert", "message": "Something happened"}</createChat>
     */
    [/<createChat>([\s\S]*?)<\/createChat>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.chats({
                chatTitle: data.title,
                message: JSON.stringify([{ type: "text", text: data.message }])
            });
            return { type: 'CHAT_CREATED', title: data.title, ...meta, _meta_actions: [] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: [] };
        }
    }],

    // =========================================================================
    // SEARCH & CONTENT
    // =========================================================================

    /**
     * Google search
     * Usage: <googleSearch>{"query": "search terms"}</googleSearch>
     */
    [/<googleSearch>([\s\S]*?)<\/googleSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query);
            const results = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet, image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data: results, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * Extract text from webpage
     * Usage: <webpageToText>{"url": "https://example.com"}</webpageToText>
     */
    [/<webpageToText>([\s\S]*?)<\/webpageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.webpageToText(data.url);
            // Limit content to avoid token overflow
            if (response?.content?.length > 5000) {
                response.content = response.content.substring(0, 5000) + '... [truncated]';
            }
            return { data: response, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }],

    /**
     * OCR - extract text from image
     * Usage: <imageToText>{"url": "https://example.com/document.jpg"}</imageToText>
     */
    [/<imageToText>([\s\S]*?)<\/imageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const ocr = await openkbs.imageToText(data.url);
            return { data: { text: ocr?.results }, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        } catch (e) {
            return { error: e.message, ...meta, _meta_actions: ["REQUEST_CHAT_MODEL"] };
        }
    }]
];
