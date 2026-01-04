/**
 * Example API function for {{APP_NAME}} platform
 *
 * Endpoint: https://fn.openkbs.com/YOUR_KB_ID/api
 *
 * This function has access to:
 * - process.env.POSTGRES_URL (if postgres enabled)
 * - process.env.KB_ID (your whitelabel kbId)
 */

export const handler = async (event) => {
    const body = JSON.parse(event.body || '{}');
    const { action, data } = body;

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        switch (action) {
            case 'hello':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Hello from {{APP_NAME}} API!',
                        timestamp: new Date().toISOString(),
                        input: data
                    })
                };

            case 'health':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'healthy',
                        kbId: process.env.KB_ID,
                        hasPostgres: !!process.env.POSTGRES_URL
                    })
                };

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Unknown action',
                        availableActions: ['hello', 'health']
                    })
                };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
