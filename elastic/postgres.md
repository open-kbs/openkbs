# Tutorial 11: PostgreSQL Database

Add a PostgreSQL database to your project with one command. Elastic Postgres uses Neon - a serverless PostgreSQL that scales automatically.

## Enable Postgres

```bash
openkbs postgres enable
```

That's it. Your database is ready.

## Check Status

```bash
openkbs postgres status
```

Output:
```
Postgres Status:
  Enabled: true
  Host: ep-xyz-123456.us-east-1.aws.neon.tech
  Database: neondb
  Region: us-east-1
```

## Get Connection String

```bash
openkbs postgres connection
```

Output:
```
postgresql://user:password@ep-xyz-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Use in Your Function

The `DATABASE_URL` environment variable is automatically injected into your Lambda functions.

### Node.js

```javascript
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let connected = false;

export async function handler(event) {
    // Connect once, reuse across invocations
    if (!connected) {
        await db.connect();
        connected = true;

        // Create tables on first run
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    const { action, ...data } = JSON.parse(event.body || '{}');

    switch (action) {
        case 'list':
            const { rows } = await db.query('SELECT * FROM users ORDER BY created_at DESC');
            return { statusCode: 200, body: JSON.stringify(rows) };

        case 'create':
            const result = await db.query(
                'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
                [data.name, data.email]
            );
            return { statusCode: 200, body: JSON.stringify(result.rows[0]) };

        case 'delete':
            await db.query('DELETE FROM users WHERE id = $1', [data.id]);
            return { statusCode: 200, body: JSON.stringify({ deleted: true }) };

        default:
            return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
}
```

`package.json`:
```json
{
  "type": "module",
  "dependencies": {
    "pg": "^8.11.3"
  }
}
```

### Python

```python
import json
import os
import psycopg2

conn = None

def handler(event, context):
    global conn
    if conn is None:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        with conn.cursor() as cur:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS items (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL
                )
            ''')
            conn.commit()

    body = json.loads(event.get('body', '{}'))
    action = body.get('action')

    with conn.cursor() as cur:
        if action == 'list':
            cur.execute('SELECT * FROM items')
            rows = cur.fetchall()
            return {'statusCode': 200, 'body': json.dumps(rows)}

        elif action == 'create':
            cur.execute('INSERT INTO items (name) VALUES (%s) RETURNING id', (body['name'],))
            conn.commit()
            return {'statusCode': 200, 'body': json.dumps({'id': cur.fetchone()[0]})}

    return {'statusCode': 400, 'body': json.dumps({'error': 'Unknown action'})}
```

### Java

```java
package com.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import java.sql.*;
import java.util.*;

public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private static Connection conn;
    private static final Gson gson = new Gson();

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        try {
            if (conn == null || conn.isClosed()) {
                conn = DriverManager.getConnection(System.getenv("DATABASE_URL"));
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)");
                }
            }

            String body = (String) event.get("body");
            Map<String, Object> request = gson.fromJson(body, Map.class);
            String action = (String) request.get("action");

            if ("list".equals(action)) {
                List<Map<String, Object>> items = new ArrayList<>();
                try (ResultSet rs = conn.createStatement().executeQuery("SELECT * FROM items")) {
                    while (rs.next()) {
                        items.add(Map.of("id", rs.getInt("id"), "name", rs.getString("name")));
                    }
                }
                return Map.of("statusCode", 200, "body", gson.toJson(items));
            }

            return Map.of("statusCode", 400, "body", "{\"error\":\"Unknown action\"}");
        } catch (Exception e) {
            return Map.of("statusCode", 500, "body", "{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
```

## Common Patterns

### Parameterized Queries (Prevent SQL Injection)

```javascript
// GOOD - parameterized
await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// BAD - string concatenation
await db.query(`SELECT * FROM users WHERE id = ${userId}`); // NEVER DO THIS
```

### Pagination

```javascript
const page = data.page || 1;
const limit = data.limit || 20;
const offset = (page - 1) * limit;

const { rows } = await db.query(
    'SELECT * FROM items ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
);

const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM items');

return { items: rows, total: parseInt(count), page, limit };
```

### Search

```javascript
const { rows } = await db.query(
    'SELECT * FROM items WHERE name ILIKE $1',
    [`%${data.query}%`]
);
```

### JSON Columns

```javascript
// Create table with JSONB column
await db.query(`
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT,
        metadata JSONB DEFAULT '{}'
    )
`);

// Query JSON
const { rows } = await db.query(
    "SELECT * FROM products WHERE metadata->>'category' = $1",
    ['electronics']
);

// Update JSON field
await db.query(
    "UPDATE products SET metadata = jsonb_set(metadata, '{stock}', $1) WHERE id = $2",
    [JSON.stringify(100), productId]
);
```

### Transactions

```javascript
try {
    await db.query('BEGIN');
    await db.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await db.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    await db.query('COMMIT');
} catch (e) {
    await db.query('ROLLBACK');
    throw e;
}
```

## CLI Reference

```bash
openkbs postgres enable              # Enable database
openkbs postgres status              # Check status
openkbs postgres connection          # Get connection string
openkbs postgres disable             # Disable (WARNING: deletes data)
```

## Tips

1. **Connection Reuse** - Keep `db.connect()` outside the handler. Lambda reuses the connection across invocations.

2. **Cold Starts** - Neon is serverless. First connection after idle may take 1-2 seconds.

3. **Create Tables on Init** - Use `CREATE TABLE IF NOT EXISTS` in your connection logic.

4. **Always Use Parameters** - Never concatenate user input into SQL strings.

## Next Steps

- [Tutorial 12: S3 Storage](./12-storage.md)
- [Tutorial 13: Serverless Functions](./13-functions.md)
