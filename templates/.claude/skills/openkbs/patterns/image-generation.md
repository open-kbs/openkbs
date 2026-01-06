# Image Generation Pattern

Complete working code for AI image generation with proper upload and display.

## actions.js

```javascript
// Helper - reuse across all image generation commands
const uploadGeneratedImage = async (base64Data, meta) => {
    const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const uploadResult = await openkbs.uploadImage(base64Data, fileName, 'image/png');
    return {
        type: 'CHAT_IMAGE',  // Core magic type - renders image in chat
        data: { imageUrl: uploadResult.url },
        ...meta
    };
};

// Command handler
[/<createAIImage>([\s\S]*?)<\/createAIImage>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        const model = data.model || 'gemini-2.5-flash-image';
        const params = { model, n: 1 };

        // Gemini-specific params
        if (model.includes('gemini')) {
            const validAspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
            params.aspect_ratio = validAspectRatios.includes(data.aspect_ratio) ? data.aspect_ratio : '1:1';
            if (data.imageUrls?.length > 0) params.imageUrls = data.imageUrls;
        }

        // GPT-specific params
        if (model.includes('gpt')) {
            const validSizes = ['1024x1024', '1536x1024', '1024x1536', 'auto'];
            params.size = validSizes.includes(data.size) ? data.size : '1024x1024';
            params.quality = 'high';
        }

        const images = await openkbs.generateImage(data.prompt, params);
        return await uploadGeneratedImage(images[0].b64_json, meta);
    } catch (error) {
        return { error: error.message || 'Image creation failed', ...meta };
    }
}]
```

## contentRender.js

```javascript
import ImageWithDownload from './ImageWithDownload';

// In isVisualResult function
const isVisualResult = (r) => {
    return (r?.type === 'CHAT_IMAGE' && r?.data?.imageUrl);
};

// In renderVisualResults function
if (item?.type === 'CHAT_IMAGE' && item?.data?.imageUrl) {
    return (
        <div key={`img-${idx}`} style={{ flex: '1 1 calc(50% - 6px)', minWidth: 200, maxWidth: 400 }}>
            <ImageWithDownload imageUrl={item.data.imageUrl} />
        </div>
    );
}
```

## ImageWithDownload.js Component

```javascript
import React from 'react';
import { IconButton, Box } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

const ImageWithDownload = ({ imageUrl }) => {
    const handleDownload = async () => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `image-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    return (
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <img
                src={imageUrl}
                alt="Generated"
                style={{ maxWidth: '100%', borderRadius: 8 }}
            />
            <IconButton
                onClick={handleDownload}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    '&:hover': { backgroundColor: 'white' }
                }}
            >
                <DownloadIcon />
            </IconButton>
        </Box>
    );
};

export default ImageWithDownload;
```

## instructions.txt (LLM prompt)

```
To generate an image:
<createAIImage>{"prompt": "detailed description", "model": "gemini-2.5-flash-image", "aspect_ratio": "16:9"}</createAIImage>

Models:
- gemini-2.5-flash-image: General images, supports editing with imageUrls
- gpt-image-1: Better for text in images

Gemini params: aspect_ratio (1:1, 16:9, 9:16, etc.), imageUrls (for editing)
GPT params: size (1024x1024, 1536x1024, 1024x1536)
```

## Key Points

1. **Always use helper** - `uploadGeneratedImage` converts base64 → URL → CHAT_IMAGE
2. **CHAT_IMAGE is core magic** - OpenKBS renders it automatically as image
3. **Spread ...meta** - Preserves message context for proper rendering
4. **Error handling** - Return error object with ...meta, not throw
