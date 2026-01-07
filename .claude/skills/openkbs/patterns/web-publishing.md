# Web Publishing Pattern

Complete working code for publishing HTML pages to KB storage.

## actions.js

```javascript
// Publish HTML webpage
[/<publishWebPage>([\s\S]*?)<\/publishWebPage>/s, async (match) => {
    try {
        let htmlContent = match[1].trim();

        // Extract HTML if wrapped in markdown code block
        const codeBlockMatch = htmlContent.match(/```html\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            htmlContent = codeBlockMatch[1].trim();
        }

        // Validate HTML content
        if (!htmlContent || !htmlContent.includes('<html')) {
            return {
                type: "PUBLISH_ERROR",
                error: "No valid HTML content found. Must include <html> tag.",
                _meta_actions: ["REQUEST_CHAT_MODEL"]
            };
        }

        // Fix charset to UTF-8
        htmlContent = htmlContent.replace(
            /<meta\s+charset=["']?[^"'>]*["']?\s*\/?>/gi,
            '<meta charset="UTF-8">'
        );

        // Extract title for filename
        const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'page';

        // Generate filename from title
        const timestamp = Date.now();
        const baseName = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'page';
        const filename = `${baseName}_${timestamp}.html`;

        // Upload embedded images (optional - for CDN URLs)
        const cdnUrlRegex = /https:\/\/cdn\.example\.com\/[^\s"'<>]+/g;
        const cdnUrls = [...new Set(htmlContent.match(cdnUrlRegex) || [])];

        for (const cdnUrl of cdnUrls) {
            try {
                // Download and re-upload to permanent storage
                const fileResponse = await axios.get(cdnUrl, { responseType: 'arraybuffer' });
                const fileName = cdnUrl.split('/').pop();
                const fileType = fileResponse.headers['content-type'] || 'image/jpeg';

                const presigned = await openkbs.kb({
                    action: 'createPresignedURL',
                    namespace: 'files',
                    fileName: fileName,
                    fileType: fileType,
                    presignedOperation: 'putObject'
                });

                await axios.put(presigned, fileResponse.data, {
                    headers: { 'Content-Type': fileType, 'Content-Length': fileResponse.data.length }
                });

                const permanentUrl = `https://yourdomain.com/media/${fileName}`;
                htmlContent = htmlContent.split(cdnUrl).join(permanentUrl);
            } catch (err) {
                // Continue if image upload fails
            }
        }

        // Get presigned URL for HTML upload
        const presignedUrl = await openkbs.kb({
            action: 'createPresignedURL',
            namespace: 'files',
            fileName: filename,
            fileType: 'text/html',
            presignedOperation: 'putObject'
        });

        // Upload HTML as UTF-8 Buffer
        const htmlBuffer = Buffer.from(htmlContent, 'utf8');
        await axios.put(presignedUrl, htmlBuffer, {
            headers: {
                'Content-Type': 'text/html',
                'Content-Length': htmlBuffer.length
            }
        });

        const publicUrl = `https://yourdomain.com/media/${filename}`;

        return {
            type: "WEBSITE_PUBLISHED",
            filename: filename,
            url: publicUrl,
            size: htmlBuffer.length,
            title: title,
            message: `Website published at ${publicUrl}`,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };

    } catch (e) {
        return {
            type: "PUBLISH_ERROR",
            error: e.message,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }
}]
```

## Helper: Web Publishing Guide

Create `webPublishingGuide.js`:

```javascript
export const webPublishingGuide = `
# Web Publishing Guide

## HTML Structure
- Always include <!DOCTYPE html>
- Use <meta charset="UTF-8">
- Set viewport for mobile: <meta name="viewport" content="width=device-width, initial-scale=1.0">

## Responsive Design
- Use flexbox or CSS grid
- Mobile-first approach
- Test at 320px, 768px, 1024px widths

## Images
- Use CDN URLs that will be auto-converted to permanent storage
- Add alt text for accessibility
- Use lazy loading: loading="lazy"

## SEO
- Unique, descriptive <title>
- Meta description
- Semantic HTML (header, main, footer, article)
`;

// Command to read guide
[/<getWebPublishingGuide\s*\/>/s, async () => {
    return {
        type: 'WEB_PUBLISHING_GUIDE',
        content: webPublishingGuide,
        ...meta
    };
}]
```

## Example: Complete Landing Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Launch</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 80px 20px;
            text-align: center;
        }
        .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        .hero p { font-size: 1.2rem; opacity: 0.9; max-width: 600px; margin: 0 auto; }
        .cta {
            display: inline-block;
            margin-top: 2rem;
            padding: 15px 40px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 30px;
            font-weight: 600;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            padding: 60px 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .feature {
            text-align: center;
            padding: 20px;
        }
        .feature h3 { margin-bottom: 0.5rem; }
    </style>
</head>
<body>
    <section class="hero">
        <h1>Your Product Name</h1>
        <p>A compelling description of what makes your product amazing.</p>
        <a href="#" class="cta">Get Started</a>
    </section>
    <section class="features">
        <div class="feature">
            <h3>Feature One</h3>
            <p>Description of the first key feature.</p>
        </div>
        <div class="feature">
            <h3>Feature Two</h3>
            <p>Description of the second key feature.</p>
        </div>
        <div class="feature">
            <h3>Feature Three</h3>
            <p>Description of the third key feature.</p>
        </div>
    </section>
</body>
</html>
```

## instructions.txt (LLM prompt)

```
Web Publishing:

Publish an HTML page:
<publishWebPage>
<!DOCTYPE html>
<html lang="en">
...full HTML content...
</html>
</publishWebPage>

Get publishing guidelines:
<getWebPublishingGuide/>

Best practices:
- Always include DOCTYPE and charset
- Use inline CSS (no external stylesheets)
- Images from CDN are auto-converted to permanent URLs
- Title becomes filename (e.g., "My Page" → my_page_1234567890.html)
```

## Key Points

1. **Self-contained HTML**: Include all CSS inline, no external dependencies
2. **UTF-8 encoding**: Always set charset, upload as Buffer
3. **Auto-filename**: Generated from `<title>` with timestamp
4. **Image processing**: CDN URLs auto-converted to permanent storage
5. **CDN delivery**: Pages served via CloudFront at `/media/`
