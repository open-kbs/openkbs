// This is a template code
export const getActions = (meta) => [
    [/\/?googleSearch\("(.*?)"\)/, async (match) => {
        const q = match[1];
        try {
            const response = await openkbs.googleSearch(q, {});
            const data = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet, image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data };
        } catch (e) {
            return { error: e.message };
        }
    }],
    // write more actions here
];