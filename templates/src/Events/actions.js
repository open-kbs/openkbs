export const getActions = (meta, event) => [
    // Google Search with JSON
    // Usage: <googleSearch>{"query": "search terms"}</googleSearch>
    [/<googleSearch>([\s\S]*?)<\/googleSearch>/s, async (match) => {
        try {
            const data = JSON.parse(match[1].trim());
            const response = await openkbs.googleSearch(data.query);
            const results = response?.map(({ title, link, snippet, pagemap }) => ({
                title,
                link,
                snippet,
                image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data: results, ...meta };
        } catch (e) {
            return { error: e.message, ...meta };
        }
    }],
    // add more actions here
];