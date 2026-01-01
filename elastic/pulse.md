# Tutorial 14: Real-time with Pulse

Add real-time features to your app with Pulse WebSocket messaging. Build live updates, chat, presence tracking, and collaborative features.

## Enable Pulse

```bash
openkbs pulse enable
```

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser 1  │     │    Pulse     │     │   Browser 2  │
│              │────▶│   Server     │────▶│              │
│  Subscribe   │     │              │     │  Receive     │
│  to 'posts'  │     │              │     │  message     │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │ Publish
                     ┌──────────────┐
                     │   Lambda     │
                     │   Function   │
                     └──────────────┘
```

1. Clients connect via WebSocket and subscribe to channels
2. Your Lambda publishes events to channels
3. All subscribers receive the message instantly

## Client SDK (Browser)

### Install

```html
<script src="https://unpkg.com/openkbs-pulse@2.0.1/pulse.js"></script>
```

Or with npm:
```bash
npm install openkbs-pulse
```

### Connect

```javascript
// Get token from your API (see Server SDK below)
const { token, endpoint, kbId } = await fetch('/auth', {
    method: 'POST',
    body: JSON.stringify({ action: 'getPulseToken', userId: 'user123' })
}).then(r => r.json());

// Connect to Pulse
const realtime = new Pulse.Realtime({
    kbId,
    token,
    endpoint,
    clientId: 'user123'
});

// Connection events
realtime.connection.on('connected', () => console.log('Connected!'));
realtime.connection.on('disconnected', () => console.log('Disconnected'));
```

### Subscribe to Channel

```javascript
const channel = realtime.channels.get('posts');

// Subscribe to specific event
channel.subscribe('new_post', (message) => {
    console.log('New post:', message.data);
});

// Subscribe to all events
channel.subscribe((message) => {
    console.log('Event:', message.name, message.data);
});
```

### Presence (Who's Online)

```javascript
const channel = realtime.channels.get('posts');

// Enter presence with data
channel.presence.enter({ name: 'Alice', avatar: '/alice.jpg' });

// Get current members
channel.presence.get((members) => {
    console.log('Online:', members.length);
    members.forEach(m => console.log(m.data.name));
});

// Subscribe to presence changes
channel.presence.subscribe((members) => {
    console.log('Members updated:', members);
});

// Specific events
channel.presence.subscribe('enter', (member) => {
    console.log(`${member.data.name} joined`);
});

channel.presence.subscribe('leave', (member) => {
    console.log(`${member.data.name} left`);
});

// Leave when done
channel.presence.leave();
```

### Disconnect

```javascript
realtime.close();
```

## Server SDK (Lambda)

### Generate Token

Your Lambda must generate tokens for clients:

```javascript
import pulse from 'openkbs-pulse/server';

export async function handler(event) {
    const { action, userId } = JSON.parse(event.body || '{}');
    const kbId = process.env.OPENKBS_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    if (action === 'getPulseToken') {
        const tokenData = await pulse.getToken(kbId, apiKey, userId);
        return {
            statusCode: 200,
            body: JSON.stringify({
                token: tokenData.token,
                endpoint: tokenData.endpoint,
                kbId
            })
        };
    }
}
```

### Publish Events

```javascript
import pulse from 'openkbs-pulse/server';

export async function handler(event) {
    const { action, ...data } = JSON.parse(event.body || '{}');
    const kbId = process.env.OPENKBS_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    if (action === 'createPost') {
        // Save to database...
        const post = { id: 1, title: data.title, content: data.content };

        // Publish to all subscribers
        await pulse.publish('posts', 'new_post', { post }, { kbId, apiKey });

        return { statusCode: 200, body: JSON.stringify({ post }) };
    }
}
```

### Get Presence

```javascript
const presence = await pulse.presence('posts', { kbId, apiKey });
console.log('Online count:', presence.count);
console.log('Members:', presence.members);
```

## Complete Example

### Backend (posts/index.mjs)

```javascript
import pg from 'pg';
import pulse from 'openkbs-pulse/server';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let connected = false;

export async function handler(event) {
    if (!connected) {
        await db.connect();
        connected = true;
        await db.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                user_name TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const { action, ...data } = JSON.parse(event.body || '{}');
    const kbId = process.env.OPENKBS_KB_ID;
    const apiKey = process.env.OPENKBS_API_KEY;

    switch (action) {
        case 'getPulseToken': {
            const tokenData = await pulse.getToken(kbId, apiKey, data.userId);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ...tokenData, kbId })
            };
        }

        case 'list': {
            const { rows } = await db.query(
                'SELECT * FROM posts ORDER BY created_at DESC LIMIT 50'
            );
            return { statusCode: 200, headers, body: JSON.stringify({ posts: rows }) };
        }

        case 'create': {
            const result = await db.query(
                'INSERT INTO posts (user_name, content) VALUES ($1, $2) RETURNING *',
                [data.userName, data.content]
            );
            const post = result.rows[0];

            // Broadcast to all subscribers
            await pulse.publish('posts', 'new_post', { post }, { kbId, apiKey });

            return { statusCode: 200, headers, body: JSON.stringify({ post }) };
        }

        case 'presence': {
            const result = await pulse.presence('posts', { kbId, apiKey });
            return { statusCode: 200, headers, body: JSON.stringify(result) };
        }

        default:
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }
}
```

### Frontend

```html
<!DOCTYPE html>
<html>
<head>
    <title>Live Posts</title>
    <script src="https://unpkg.com/openkbs-pulse@2.0.1/pulse.js"></script>
</head>
<body>
    <div id="online">Online: 0</div>
    <div id="posts"></div>

    <form id="form">
        <input type="text" id="content" placeholder="What's on your mind?">
        <button type="submit">Post</button>
    </form>

    <script>
        const userId = 'user_' + Math.random().toString(36).substr(2, 9);
        let realtime;

        async function init() {
            // Load existing posts
            const { posts } = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list' })
            }).then(r => r.json());

            posts.forEach(addPost);

            // Get Pulse token
            const { token, endpoint, kbId } = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getPulseToken', userId })
            }).then(r => r.json());

            // Connect
            realtime = new Pulse.Realtime({ kbId, token, endpoint, clientId: userId });

            const channel = realtime.channels.get('posts');

            // Subscribe to new posts
            channel.subscribe('new_post', (msg) => {
                addPost(msg.data.post);
            });

            // Presence
            channel.presence.enter({ name: userId });
            channel.presence.subscribe((members) => {
                document.getElementById('online').textContent = 'Online: ' + members.length;
            });
        }

        function addPost(post) {
            const div = document.createElement('div');
            div.innerHTML = `<b>${post.user_name}</b>: ${post.content}`;
            document.getElementById('posts').prepend(div);
        }

        document.getElementById('form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = document.getElementById('content').value;
            if (!content) return;

            await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', content, userName: userId })
            });

            document.getElementById('content').value = '';
        });

        init();
    </script>
</body>
</html>
```

## Private Channels

For private messaging, use secret channel IDs:

```javascript
// Generate unique channel ID per user (store in database)
const privateChannel = crypto.randomBytes(32).toString('hex');

// User subscribes to their own private channel
const myChannel = realtime.channels.get(user.privateChannel);
myChannel.subscribe('message', (msg) => {
    console.log('Private message:', msg.data);
});

// Server publishes to recipient's channel
await pulse.publish(recipient.privateChannel, 'message', {
    from: sender.name,
    text: 'Hello!'
}, { kbId, apiKey });
```

## CLI Reference

```bash
openkbs pulse enable               # Enable Pulse
openkbs pulse status               # Check status
openkbs pulse channels             # List active channels
openkbs pulse presence <channel>   # View presence
openkbs pulse publish <ch> "msg"   # Publish message
openkbs pulse disable              # Disable
```

## Tips

1. **Generate Tokens Server-Side** - Never expose your API key in frontend code.

2. **Use Presence for Online Status** - Built-in, no database needed.

3. **Private Channels** - Use random IDs for 1:1 messaging.

4. **Reconnection** - SDK auto-reconnects with exponential backoff.

## Next Steps

- [Tutorial 15: Node.js Full Example](./15-nodejs-example.md)
- [Tutorial 16: Java Example](./16-java-example.md)
