import pg from 'pg';
import crypto from 'crypto';
const { Client } = pg;

const db = new Client({ connectionString: process.env.DATABASE_URL });
let dbConnected = false;

async function connectDB() {
    if (!dbConnected) {
        await db.connect();
        dbConnected = true;

        // Create users table with private_channel for secure messaging
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                private_channel VARCHAR(64) UNIQUE NOT NULL,
                avatar_color VARCHAR(7) DEFAULT '#007bff',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Add private_channel column if missing (migration)
        await db.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS private_channel VARCHAR(64) UNIQUE
        `);
        await db.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#007bff'
        `);
    }
}

// Generate unpredictable channel ID for secure private messaging
function generatePrivateChannel() {
    return crypto.randomBytes(32).toString('hex');
}

// Generate random avatar color
function generateAvatarColor() {
    const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get a Pulse token for WebSocket authentication
 * Calls lambda-kb to get a signed JWT token
 * Uses OPENKBS_API_KEY for authentication
 */
async function getPulseToken(userId) {
    const kbId = process.env.OPENKBS_KB_ID || process.env.PULSE_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    if (!kbId) {
        console.log('OPENKBS_KB_ID not set, skipping pulse token');
        return null;
    }

    if (!apiKey) {
        console.log('OPENKBS_API_KEY not set, skipping pulse token');
        return null;
    }

    try {
        const response = await fetch('https://kb.openkbs.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createPulseToken',
                kbId,
                apiKey,
                userId: String(userId)
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('Pulse token error:', data.error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Failed to get pulse token:', e);
        return null;
    }
}

export async function handler(event) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS preflight
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        await connectDB();

        const body = JSON.parse(event.body || '{}');
        const { action, email, password, name } = body;

        if (action === 'register') {
            // Check if user exists
            const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email already registered' })
                };
            }

            // Generate unique private channel for secure messaging
            const privateChannel = generatePrivateChannel();
            const avatarColor = generateAvatarColor();

            // Create user with private channel
            const result = await db.query(
                'INSERT INTO users (name, email, password, private_channel, avatar_color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, private_channel, avatar_color, created_at',
                [name, email, password, privateChannel, avatarColor]
            );

            const user = result.rows[0];

            // Get Pulse token for real-time features
            const pulseData = await getPulseToken(user.id);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        avatarColor: user.avatar_color,
                        // Private channel is SECRET - only this user knows it
                        privateChannel: user.private_channel,
                        pulseToken: pulseData?.token || null,
                        pulseEndpoint: pulseData?.endpoint || null
                    }
                })
            };
        }

        if (action === 'login') {
            const result = await db.query(
                'SELECT id, name, email, private_channel, avatar_color FROM users WHERE email = $1 AND password = $2',
                [email, password]
            );

            if (result.rows.length === 0) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid email or password' })
                };
            }

            const user = result.rows[0];

            // Generate private channel if missing (for existing users)
            let privateChannel = user.private_channel;
            if (!privateChannel) {
                privateChannel = generatePrivateChannel();
                await db.query('UPDATE users SET private_channel = $1 WHERE id = $2', [privateChannel, user.id]);
            }

            // Get Pulse token for real-time features
            const pulseData = await getPulseToken(user.id);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        avatarColor: user.avatar_color || '#007bff',
                        privateChannel: privateChannel,
                        pulseToken: pulseData?.token || null,
                        pulseEndpoint: pulseData?.endpoint || null
                    }
                })
            };
        }

        // Get list of users (for chat) - WITHOUT exposing private channels
        if (action === 'users') {
            const result = await db.query(
                'SELECT id, name, avatar_color FROM users ORDER BY name'
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    users: result.rows.map(u => ({
                        id: u.id,
                        name: u.name,
                        avatarColor: u.avatar_color || '#007bff'
                    }))
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
        };

    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}
