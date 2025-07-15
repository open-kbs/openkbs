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

export const getActions = (meta = {}) => [
    [/[\s\S]*"type"\s*:\s*"JOB_COMPLETED"[\s\S]*/, async (match, event) => {
        const parsedData = extractJSONFromText(match[0]);
        if (parsedData && parsedData.type === "JOB_COMPLETED") {
            await openkbs.chats({
                action: "updateChat",
                title: await openkbs.encrypt(parsedData?.name),
                chatIcon: '🟢',
                chatId: event?.payload?.chatId
            })

            return {...parsedData, ...meta};
        }
    }],


    [/[\s\S]*"type"\s*:\s*"JOB_FAILED"[\s\S]*/, async (match, event) => {
        const json = extractJSONFromText(match[0]);
        if (json && json.type === "JOB_FAILED") {
            await openkbs.chats({
                action: "updateChat",
                title: await openkbs.encrypt(json.reason),
                chatIcon: '🔴',
                chatId: event?.payload?.chatId
            })
        }
    }],

    [/\/?googleSearch\("(.*?)"\)/, async (match) => {
        const q = match[1];
        try {
            const response = await openkbs.googleSearch(q, {});
            const data = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet, image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data, ...meta };
        } catch (e) {
            return { error: e.message };
        }
    }],

    [/\/?youtubeSearch\("(.*?)"\)/, async (match) => {
        const q = match[1];
        try {
            const response = await openkbs.googleSearch(q + ' site:youtube.com', { videoOnly: true });
            const data = response?.map(({ title, link, snippet, pagemap }) => ({
                title,
                link: link.replace('www.youtube.com/watch?v=', 'youtu.be/'),
                snippet,
                thumbnail: pagemap?.videoobject?.[0]?.thumbnailurl || pagemap?.metatags?.[0]?.["og:image"],
                duration: pagemap?.videoobject?.[0]?.duration,
                channel: pagemap?.metatags?.[0]?.["og:site_name"],
            })).filter(item => item.link.includes('youtu'));
            return { data, ...meta };
        } catch (e) {
            return { error: e.message };
        }
    }],

    [/\/?googleImageSearch\("(.*?)"\)/, async (match) => {
        const q = match[1];
        try {
            const response = await openkbs.googleSearch(q, { searchType: 'image' });
            const data = response?.map(({ title, link, snippet, pagemap }) => {
                const imageObj = pagemap?.cse_image?.[0];
                const thumbnail = imageObj?.src || pagemap?.metatags?.[0]?.["og:image"] || link;
                return {
                    title,
                    link: link,
                    snippet,
                    image: thumbnail
                };
            });
            return { data, ...meta };
        } catch (e) {
            return { error: e.message };
        }
    }],

    [/\/?webpageToText\("(.*)"\)/, async (match) => {
        try {
            let response = await openkbs.webpageToText(match[1]);

            // limit output length
            if (response?.content?.length > 5000) {
                response.content = response.content.substring(0, 5000);
            }
            if(!response?.url) return { data: { error: "Unable to read website" } };
            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response?.data || e };
        }
    }],

    [/\/?documentToText\("(.*)"\)/, async (match) => {
        try {
            let response = await openkbs.documentToText(match[1]);

            // limit output length
            if (response?.text?.length > 5000) {
                response.text = response.text.substring(0, 5000);
            }

            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response.data };
        }
    }],

    [/\/?imageToText\("(.*)"\)/, async (match) => {
        try {
            let response = await openkbs.imageToText(match[1]);

            if (response?.detections?.[0]?.txt) {
                response = { detections: response?.detections?.[0]?.txt };
            }

            return { data: response, ...meta };
        } catch (e) {
            return { error: e.response.data };
        }
    }]
];