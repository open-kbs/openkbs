/**
 * {{APP_NAME}} API
 *
 * Endpoint: https://yourdomain.com/api
 *
 * Environment variables:
 * - DATABASE_URL (Postgres connection string)
 * - STORAGE_BUCKET (S3 bucket name)
 * - OPENKBS_KB_ID (your kbId)
 */

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {
            case 'hello':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Hello from {{APP_NAME}}!',
                        timestamp: new Date().toISOString()
                    })
                };

            case 'status':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        postgres: !!process.env.DATABASE_URL,
                        storage: !!process.env.STORAGE_BUCKET,
                        kbId: process.env.OPENKBS_KB_ID
                    })
                };

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Unknown action', available: ['hello', 'status'] })
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
