export const getActions = (meta) => [
    [/\/?googleSearch\("(.*)"\)/, async (match) => {
        const q = match[1];
        try {
            const noSecrets = '{{secrets.googlesearch_api_key}}'.includes('secrets.googlesearch_api_key');
            const params = { q, ...(noSecrets ? {} : { key: '{{secrets.googlesearch_api_key}}', cx: '{{secrets.googlesearch_engine_id}}' }) };
            const response = noSecrets
                ? await openkbs.googleSearch(params.q, params)
                : (await axios.get('https://www.googleapis.com/customsearch/v1', { params }))?.data?.items;
            const data = response?.map(({ title, link, snippet, pagemap }) => ({
                title, link, snippet, image: pagemap?.metatags?.[0]?.["og:image"]
            }));
            return { data, ...meta };
        } catch (e) {
            return { error: e.response.data, ...meta };
        }
    }],
    [/\/?textToImage\("(.*)"\)/, async (match) => {
        try {
            const response = await axios.get(`http://localhost:8080/pipe/stabilityai--stable-diffusion-3-medium-diffusers--default?prompt=${encodeURIComponent(match[1])}`, {
                responseType: 'arraybuffer'
            });

            const base64Data = Buffer.from(response.data, 'binary').toString('base64');
            const contentType = response.headers['content-type'];
            const imageSrc = `data:${contentType};base64,${base64Data}`;

            return { type: 'SAVED_CHAT_IMAGE', imageSrc, ...meta };
        } catch (error) {
            console.error('Error fetching image:', error);
            throw error; // or handle the error as needed
        }
    }]
];