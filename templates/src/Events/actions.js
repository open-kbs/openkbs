// This boilerplate code is a starting point for development.
export const getActions = () => [
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
    // add more actions here
];