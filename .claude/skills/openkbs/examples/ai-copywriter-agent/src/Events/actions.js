const extractJSONFromText = (text) => {
    let braceCount = 0, startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        if (text[i] === '}' && --braceCount === 0) {
            try {
                return JSON.parse(text.slice(startIndex, i + 1));
            } catch {
                return null;
            }
        }
    }
    return null;
}

export const getActions = (meta) => [
    // IMPORTANT: Actions returning JOB_COMPLETED or JOB_FAILED stop agent execution and return final result
    [/[\s\S]*"type"\s*:\s*"JOB_COMPLETED"[\s\S]*/, async (match, event) => {
        const parsedData = extractJSONFromText(match[0]);
        if (parsedData && parsedData.type === "JOB_COMPLETED") {
            await openkbs.chats({
                action: "updateChat",
                title: await openkbs.encrypt(parsedData?.name),
                chatIcon: '🟢',
                chatId: event?.payload?.chatId
            })

            return parsedData;
        }
    }],

    [/[\s\S]*"type"\s*:\s*"JOB_FAILED"[\s\S]*/, async (match, event) => {
        const parsedData = extractJSONFromText(match[0]);
        if (parsedData && parsedData.type === "JOB_FAILED") {
            await openkbs.chats({
                action: "updateChat",
                title: await openkbs.encrypt(parsedData.reason),
                chatIcon: '🔴',
                chatId: event?.payload?.chatId
            })
            return parsedData;
        }
    }],

    // Google Search with XML+JSON format
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

    // YouTube Search with XML+JSON format
    [/<youtubeSearch>([\s\S]*?)<\/youtubeSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query + ' site:youtube.com', { videoOnly: true });
            const results = response?.map(({ title, link, snippet, pagemap }) => ({
                title,
                link: link.replace('www.youtube.com/watch?v=', 'youtu.be/'),
                snippet,
                thumbnail: pagemap?.videoobject?.[0]?.thumbnailurl || pagemap?.metatags?.[0]?.["og:image"],
                duration: pagemap?.videoobject?.[0]?.duration,
                channel: pagemap?.metatags?.[0]?.["og:site_name"],
            })).filter(item => item.link.includes('youtu'));
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Google Image Search with XML+JSON format
    [/<googleImageSearch>([\s\S]*?)<\/googleImageSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query, { searchType: 'image' });
            const results = response?.map(({ title, link, snippet, pagemap }) => {
                const imageObj = pagemap?.cse_image?.[0];
                const thumbnail = imageObj?.src || pagemap?.metatags?.[0]?.["og:image"] || link;
                return { title, link, snippet, image: thumbnail };
            });
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],

    // Webpage to Text with XML+JSON format
    [/<webpageToText>([\s\S]*?)<\/webpageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.webpageToText(data.url);
            if (!response?.url) return { data: { error: "Unable to read website" }, ...meta };
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response?.data || e.message, ...meta };
        }
    }],

    // Document to Text with XML+JSON format
    [/<documentToText>([\s\S]*?)<\/documentToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.documentToText(data.url);
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response?.data || e.message, ...meta };
        }
    }],

    // Image to Text (OCR) with XML+JSON format
    [/<imageToText>([\s\S]*?)<\/imageToText>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            let response = await openkbs.imageToText(data.url);
            if (response?.detections?.[0]?.txt) {
                response = { detections: response?.detections?.[0]?.txt };
            }
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response?.data || e.message, ...meta };
        }
    }],
];
