# Video Generation Pattern

Complete working code for AI video generation with async polling.

## actions.js

```javascript
// Create video - returns pending status, requires polling
[/<createAIVideo>([\s\S]*?)<\/createAIVideo>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        const videoModel = data.model || 'sora-2';
        const prompt = data.prompt;

        // Validate seconds (4, 8, or 12 only)
        const validSeconds = [4, 8, 12];
        const seconds = validSeconds.includes(data.seconds) ? data.seconds :
            validSeconds.reduce((prev, curr) =>
                Math.abs(curr - data.seconds) < Math.abs(prev - data.seconds) ? curr : prev);

        const params = {
            video_model: videoModel,
            seconds: seconds
        };

        // Reference image OR size (not both)
        if (data.input_reference_url) {
            params.input_reference_url = data.input_reference_url;
        } else {
            const validSizes = ['720x1280', '1280x720'];
            params.size = validSizes.includes(data.size) ? data.size : '1280x720';
        }

        const videoData = await openkbs.generateVideo(prompt, params);

        // Video generation is async - check status
        if (videoData?.[0]?.status === 'pending') {
            return {
                type: 'VIDEO_PENDING',
                data: {
                    videoId: videoData[0].video_id,
                    message: 'Video generation in progress. Use continueVideoPolling to check status.'
                },
                ...meta
            };
        }

        // Immediate completion (rare)
        if (videoData?.[0]?.video_url) {
            return {
                type: 'CHAT_VIDEO',
                data: { videoUrl: videoData[0].video_url },
                ...meta
            };
        }

        return { error: 'Video generation failed - no response', ...meta };
    } catch (error) {
        return { error: error.message || 'Video creation failed', ...meta };
    }
}],

// Poll for video completion
[/<continueVideoPolling>([\s\S]*?)<\/continueVideoPolling>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());
        const videoId = data.videoId;

        const videoData = await openkbs.checkVideoStatus(videoId);

        if (videoData?.[0]?.status === 'completed' && videoData[0].video_url) {
            return {
                type: 'CHAT_VIDEO',
                data: { videoUrl: videoData[0].video_url },
                ...meta
            };
        }

        if (videoData?.[0]?.status === 'pending') {
            return {
                type: 'VIDEO_PENDING',
                data: {
                    videoId: videoId,
                    message: 'Video still generating. Continue polling.'
                },
                ...meta
            };
        }

        if (videoData?.[0]?.status === 'failed') {
            return { error: 'Video generation failed', ...meta };
        }

        return { error: 'Unable to get video status', ...meta };
    } catch (error) {
        return { error: error.message || 'Failed to check video status', ...meta };
    }
}]
```

## contentRender.js

```javascript
// In isVisualResult function
const isVisualResult = (r) => {
    return (r?.type === 'CHAT_VIDEO' && r?.data?.videoUrl) ||
           r?.type === 'VIDEO_PENDING';
};

// In renderVisualResults function
if (item?.type === 'CHAT_VIDEO' && item?.data?.videoUrl) {
    return (
        <div key={`vid-${idx}`} style={{ flex: '1 1 100%' }}>
            <video
                src={item.data.videoUrl}
                controls
                style={{ width: '100%', maxWidth: 600, borderRadius: 8 }}
            />
        </div>
    );
}
```

## instructions.txt (LLM prompt)

```
To generate a video:
<createAIVideo>{"prompt": "scene description", "model": "sora-2", "seconds": 8, "size": "1280x720"}</createAIVideo>

Video generation takes time. When you receive VIDEO_PENDING, poll with:
<continueVideoPolling>{"videoId": "the-video-id"}</continueVideoPolling>

Models: sora-2 (standard), sora-2-pro (higher quality)
Duration: 4, 8, or 12 seconds
Size: 1280x720 (landscape), 720x1280 (portrait)
Optional: input_reference_url for image-to-video
```

## Key Points

1. **Async by nature** - Video generation returns `VIDEO_PENDING`, not immediate result
2. **Polling required** - LLM must call `continueVideoPolling` to check completion
3. **CHAT_VIDEO is core magic** - Renders as video player automatically
4. **Two commands** - Create and poll are separate for clean flow
