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

    // MCP (Model Context Protocol) Tool Handler
    // Automatically handles all MCP tool calls: <mcp_{server}_{toolName}>{params}</mcp_{server}_{toolName}>
    // Configure MCP servers in settings.json: { "options": { "mcpServers": { "github": {} } } }
    // Add required secrets (e.g., GITHUB_PERSONAL_ACCESS_TOKEN) in KB secrets
    [/<mcp_([a-z0-9-]+)_([a-z0-9_]+)>([\s\S]*?)<\/mcp_\1_\2>/s, async (match) => {
        try {
            const server = match[1];
            const toolName = match[2];
            const args = match[3].trim() ? JSON.parse(match[3].trim()) : {};

            const result = await openkbs.mcp.callTool(server, toolName, args);
            return {
                type: 'MCP_RESULT',
                server,
                tool: toolName,
                data: result?.content || [],
                ...meta,
                _meta_actions: ['REQUEST_CHAT_MODEL']
            };
        } catch (e) {
            return {
                type: 'MCP_ERROR',
                error: e.message,
                ...meta,
                _meta_actions: ['REQUEST_CHAT_MODEL']
            };
        }
    }],

    // add more actions here
];