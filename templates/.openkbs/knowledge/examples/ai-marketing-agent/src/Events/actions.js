// Memory helpers
const setMemoryValue = async (itemId, value, expirationInMinutes) => {
    const body = {
        value,
        lastUpdated: new Date().toISOString()
    };
    if (expirationInMinutes) {
        body.exp = new Date(Date.now() + expirationInMinutes * 60000).toISOString();
    }
    try {
        await openkbs.updateItem({ itemType: 'memory', itemId, body });
    } catch {
        await openkbs.createItem({ itemType: 'memory', itemId, body });
    }
};

// Upload generated image helper
const uploadGeneratedImage = async (base64Data, meta) => {
    const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const uploadResult = await openkbs.uploadImage(base64Data, fileName, 'image/png');
    return { type: 'CHAT_IMAGE', data: { imageUrl: uploadResult.url }, ...meta };
};

export const getActions = (meta) => [
    // Memory Management
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

    [/<deleteItem>([\s\S]*?)<\/deleteItem>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.deleteItem(data.itemId);
            return { type: "ITEM_DELETED", itemId: data.itemId, ...meta };
        } catch (e) {
            return { type: "DELETE_ERROR", error: e.message, ...meta };
        }
    }],

    // AI Image Generation
    [/<createAIImage>([\s\S]*?)<\/createAIImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const model = data.model || "gemini-2.5-flash-image";
            const params = { model, n: 1 };

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
            return await uploadGeneratedImage(image[0].b64_json, meta);
        } catch (e) {
            return { error: e.message || 'Image creation failed', ...meta };
        }
    }],

    // AI Video Generation
    [/<createAIVideo>([\s\S]*?)<\/createAIVideo>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const params = {
                video_model: data.model || "sora-2",
                seconds: [4, 8, 12].includes(data.seconds) ? data.seconds : 8
            };

            if (data.input_reference_url) {
                params.input_reference_url = data.input_reference_url;
            } else {
                params.size = ['720x1280', '1280x720'].includes(data.size) ? data.size : '1280x720';
            }

            const videoData = await openkbs.generateVideo(data.prompt, params);

            if (videoData?.[0]?.status === 'pending') {
                return { type: 'VIDEO_PENDING', data: { videoId: videoData[0].video_id }, ...meta };
            }
            if (videoData?.[0]?.video_url) {
                return { type: 'CHAT_VIDEO', data: { videoUrl: videoData[0].video_url }, ...meta };
            }
            return { error: 'Video generation failed', ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    [/<continueVideoPolling>([\s\S]*?)<\/continueVideoPolling>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const videoData = await openkbs.checkVideoStatus(data.videoId);

            if (videoData?.[0]?.status === 'completed' && videoData[0].video_url) {
                return { type: 'CHAT_VIDEO', data: { videoUrl: videoData[0].video_url }, ...meta };
            } else if (videoData?.[0]?.status === 'pending') {
                return { type: 'VIDEO_PENDING', data: { videoId: data.videoId }, ...meta };
            }
            return { error: 'Video generation failed', ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // View Image (adds to LLM vision context)
    [/<viewImage>([\s\S]*?)<\/viewImage>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            return {
                data: [
                    { type: "text", text: `Viewing: ${data.url}` },
                    { type: "image_url", image_url: { url: data.url } }
                ],
                ...meta
            };
        } catch (e) {
            return { type: "VIEW_IMAGE_ERROR", error: e.message, ...meta };
        }
    }],

    // Web scraping
    [/<webpageToText>([\s\S]*?)<\/webpageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.webpageToText(data.url);
            if (response?.content?.length > 5000) {
                response.content = response.content.substring(0, 5000);
            }
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Google Search
    [/<googleSearch>([\s\S]*?)<\/googleSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query);
            const results = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet, image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Google Image Search
    [/<googleImageSearch>([\s\S]*?)<\/googleImageSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query, { searchType: 'image' });
            const results = response?.map(({ title, link, pagemap }) => ({
                title, link, image: pagemap?.cse_image?.[0]?.src || link
            }))?.slice(0, data.limit || 10);
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Send Email
    [/<sendMail>([\s\S]*?)<\/sendMail>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            await openkbs.sendMail(data.to, data.subject, data.body);
            return { type: 'EMAIL_SENT', data: { to: data.to, subject: data.subject }, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Schedule Task
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
                else delayMs = parseFloat(data.delay) * 60000;
                scheduledTime = Date.now() + delayMs;
            } else {
                scheduledTime = Date.now() + 3600000;
            }

            const response = await openkbs.kb({
                action: 'createScheduledTask',
                scheduledTime: Math.floor(scheduledTime / 60000) * 60000,
                taskPayload: { message: `[SCHEDULED_TASK] ${data.message}`, createdAt: Date.now() },
                description: data.message.substring(0, 50)
            });

            return { type: 'TASK_SCHEDULED', data: { scheduledTime: new Date(scheduledTime).toISOString(), taskId: response.taskId }, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Get Scheduled Tasks
    [/<getScheduledTasks\s*\/>/s, async () => {
        try {
            const response = await openkbs.kb({ action: 'getScheduledTasks' });
            return { type: 'SCHEDULED_TASKS_LIST', data: response, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Web Page Publishing
    [/<publishWebPage>([\s\S]*?)<\/publishWebPage>/s, async (match) => {
        try {
            const htmlContent = match[1].trim();
            const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'Page';
            const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}.html`;

            const presignedUrl = await openkbs.kb({
                action: 'createPresignedURL',
                namespace: 'files',
                fileName: filename,
                fileType: 'text/html',
                presignedOperation: 'putObject'
            });

            const htmlBuffer = Buffer.from(htmlContent, 'utf8');
            await axios.put(presignedUrl, htmlBuffer, {
                headers: { 'Content-Type': 'text/html', 'Content-Length': htmlBuffer.length }
            });

            const publicUrl = `https://web.file.vpc1.us/files/${openkbs.kbId}/${filename}`;
            return { type: 'WEB_PAGE_PUBLISHED', data: { url: publicUrl, title }, ...meta };
        } catch (e) {
            return { type: 'PUBLISH_ERROR', error: e.message, ...meta };
        }
    }]
];
