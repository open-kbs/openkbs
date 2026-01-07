# Public API Item Proxy Pattern

Complete working code for creating items via public API with geolocation capture.

## Concept

Accept external requests to create items with:
- Client geolocation from CloudFront headers
- IP address capture
- Automatic encryption of sensitive fields
- Item type validation

## onPublicAPIRequest.js

```javascript
export const handler = async ({ payload, headers }) => {
    const { item, attributes, itemType, action } = payload;

    if (action === 'createItem') {
        const enrichedItem = {};

        // Capture geolocation from CloudFront headers
        enrichedItem.country = openkbs.clientHeaders['cloudfront-viewer-country-name'];
        enrichedItem.countryCode = openkbs.clientHeaders['cloudfront-viewer-country'];
        enrichedItem.city = openkbs.clientHeaders['cloudfront-viewer-city'];
        enrichedItem.ip = openkbs.clientHeaders['x-forwarded-for'];

        // Add timestamp
        enrichedItem.createdAt = new Date().toISOString();

        // Process attributes with encryption
        for (const attribute of attributes) {
            const { attrName, encrypted } = attribute;

            if (item[attrName] !== undefined) {
                if (encrypted) {
                    enrichedItem[attrName] = await openkbs.encrypt(item[attrName]);
                } else {
                    enrichedItem[attrName] = item[attrName];
                }
            }
        }

        // Create the item
        return await openkbs.items({
            action,
            itemType,
            attributes,
            item: enrichedItem
        });
    }

    // Handle other actions
    if (action === 'getItem' || action === 'fetchItems') {
        return await openkbs.items(payload);
    }

    return { error: 'Action not allowed', action };
};

module.exports = { handler };
```

## Extended Version with Validation

```javascript
export const handler = async ({ payload, headers, queryStringParameters }) => {
    const { item, attributes, itemType, action } = payload;

    // Whitelist allowed item types
    const ALLOWED_TYPES = ['lead', 'contact', 'feedback'];

    if (!ALLOWED_TYPES.includes(itemType)) {
        return {
            statusCode: 403,
            body: { error: 'Item type not allowed' }
        };
    }

    // Rate limiting check (simple example)
    const ip = openkbs.clientHeaders['x-forwarded-for'];
    const rateLimitKey = `ratelimit_${ip}_${itemType}`;

    try {
        const rateLimit = await openkbs.getItem(rateLimitKey);
        const count = rateLimit?.item?.body?.count || 0;
        const lastReset = rateLimit?.item?.body?.lastReset;

        // Reset counter every hour
        const hourAgo = Date.now() - 3600000;
        if (lastReset && new Date(lastReset).getTime() > hourAgo && count >= 100) {
            return {
                statusCode: 429,
                body: { error: 'Rate limit exceeded', retryAfter: 3600 }
            };
        }
    } catch (e) {
        // No rate limit record yet
    }

    if (action === 'createItem') {
        const enrichedItem = {
            // Geolocation
            country: openkbs.clientHeaders['cloudfront-viewer-country-name'],
            countryCode: openkbs.clientHeaders['cloudfront-viewer-country'],
            region: openkbs.clientHeaders['cloudfront-viewer-country-region-name'],
            city: openkbs.clientHeaders['cloudfront-viewer-city'],
            ip: ip,

            // User agent
            userAgent: headers['user-agent'],

            // Timestamps
            createdAt: new Date().toISOString(),

            // Source tracking
            source: queryStringParameters?.source || 'api',
            referer: headers['referer']
        };

        // Process and encrypt fields
        for (const attribute of attributes) {
            const { attrName, encrypted } = attribute;

            if (item[attrName] !== undefined) {
                // Validate required fields
                if (attribute.required && !item[attrName]) {
                    return {
                        statusCode: 400,
                        body: { error: `Missing required field: ${attrName}` }
                    };
                }

                if (encrypted) {
                    enrichedItem[attrName] = await openkbs.encrypt(item[attrName]);
                } else {
                    enrichedItem[attrName] = item[attrName];
                }
            }
        }

        // Create the item
        const result = await openkbs.items({
            action,
            itemType,
            attributes,
            item: enrichedItem
        });

        // Update rate limit counter
        try {
            await openkbs.createItem({
                itemType: 'ratelimit',
                itemId: rateLimitKey,
                body: {
                    count: 1,
                    lastReset: new Date().toISOString()
                }
            });
        } catch (e) {
            // Update existing
            const existing = await openkbs.getItem(rateLimitKey);
            await openkbs.updateItem({
                itemType: 'ratelimit',
                itemId: rateLimitKey,
                body: {
                    count: (existing?.item?.body?.count || 0) + 1,
                    lastReset: existing?.item?.body?.lastReset || new Date().toISOString()
                }
            });
        }

        return result;
    }

    return { error: 'Action not supported' };
};
```

## Frontend Usage

```javascript
// From website form
async function submitLead(formData) {
    const response = await fetch(
        `https://chat.openkbs.com/publicAPIRequest?kbId=YOUR_KB_ID`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'createItem',
                itemType: 'lead',
                attributes: [
                    { attrName: 'itemId', attrType: 'itemId', encrypted: false },
                    { attrName: 'body', attrType: 'body', encrypted: true }
                ],
                item: {
                    itemId: `lead_${Date.now()}`,
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        message: formData.message
                    })
                }
            })
        }
    );

    return response.json();
}
```

## settings.json - Item Type Configuration

```json
{
  "itemTypes": {
    "lead": {
      "attributes": [
        { "attrName": "itemId", "attrType": "itemId", "encrypted": false },
        { "attrName": "body", "attrType": "body", "encrypted": true }
      ]
    }
  },
  "options": {
    "priorityItems": [
      { "limit": 100, "prefix": "lead" }
    ]
  }
}
```

## Available CloudFront Headers

```javascript
openkbs.clientHeaders['cloudfront-viewer-country']       // "US"
openkbs.clientHeaders['cloudfront-viewer-country-name']  // "United States"
openkbs.clientHeaders['cloudfront-viewer-country-region'] // "CA"
openkbs.clientHeaders['cloudfront-viewer-country-region-name'] // "California"
openkbs.clientHeaders['cloudfront-viewer-city']          // "Los Angeles"
openkbs.clientHeaders['cloudfront-viewer-latitude']      // "34.05"
openkbs.clientHeaders['cloudfront-viewer-longitude']     // "-118.24"
openkbs.clientHeaders['cloudfront-viewer-time-zone']     // "America/Los_Angeles"
openkbs.clientHeaders['x-forwarded-for']                 // "1.2.3.4"
```

## Key Points

1. **Geolocation from CloudFront** - Free, no external API needed
2. **Encryption for sensitive data** - Use `openkbs.encrypt()`
3. **Item type whitelisting** - Don't allow arbitrary types
4. **Rate limiting** - Prevent abuse
5. **Source tracking** - Query params for attribution
6. **Timestamp enrichment** - Add createdAt automatically
