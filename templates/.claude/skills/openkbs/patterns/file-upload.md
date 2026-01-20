# File Upload Pattern

Complete working code for uploading files to KB storage using presigned URLs.

## actions.js

```javascript
// Upload files from URLs to permanent storage
[/<uploadFiles>([\s\S]*?)<\/uploadFiles>/s, async (match) => {
    try {
        const content = match[1].trim();

        // Parse URLs - support newline-separated or JSON array
        let fileUrls = [];
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) fileUrls = parsed;
        } catch (e) {
            // Not JSON, treat as newline-separated URLs
            fileUrls = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('http'));
        }

        if (fileUrls.length === 0) {
            return { error: 'No valid URLs found', ...meta };
        }

        const uploadResults = [];

        for (let i = 0; i < fileUrls.length; i++) {
            const fileUrl = fileUrls[i];

            try {
                // 1. Fetch the file
                const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                const fileBuffer = fileResponse.data;

                // 2. Determine filename and content type
                const urlPath = new URL(fileUrl).pathname;
                let filename = urlPath.split('/').pop();

                // Generate filename if none
                if (!filename || !filename.includes('.')) {
                    const contentType = fileResponse.headers['content-type'] || 'application/octet-stream';
                    const extMap = {
                        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
                        'image/webp': 'webp', 'video/mp4': 'mp4', 'application/pdf': 'pdf'
                    };
                    const ext = extMap[contentType] || 'bin';
                    filename = `file_${i + 1}.${ext}`;
                }

                // Add timestamp for uniqueness
                const timestamp = Date.now();
                const parts = filename.split('.');
                const ext = parts.pop();
                filename = `${parts.join('.')}_${timestamp}.${ext}`;

                const contentType = fileResponse.headers['content-type'] || 'application/octet-stream';

                // 3. Get presigned URL
                const presignedUrl = await openkbs.kb({
                    action: 'createPresignedURL',
                    namespace: 'files',
                    fileName: filename,
                    fileType: contentType,
                    presignedOperation: 'putObject'
                });

                // 4. Upload to S3
                await axios.put(presignedUrl, fileBuffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': fileBuffer.length
                    }
                });

                // 5. Construct public URL
                const publicUrl = `https://yourdomain.com/media/${filename}`;

                uploadResults.push({
                    sourceUrl: fileUrl,
                    status: 'success',
                    uploadedUrl: publicUrl,
                    filename,
                    size: fileBuffer.length
                });

            } catch (error) {
                uploadResults.push({
                    sourceUrl: fileUrl,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        const successCount = uploadResults.filter(r => r.status === 'success').length;

        return {
            type: "FILES_UPLOADED",
            summary: `Uploaded ${successCount} of ${fileUrls.length} files`,
            results: uploadResults,
            uploadedUrls: uploadResults.filter(r => r.status === 'success').map(r => r.uploadedUrl),
            ...meta
        };

    } catch (e) {
        return { error: e.message, ...meta };
    }
}]
```

## Direct Image Upload (from generateImage)

```javascript
// Helper for uploading generated images
const uploadGeneratedImage = async (base64Data, meta) => {
    const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const uploadResult = await openkbs.uploadImage(base64Data, fileName, 'image/png');
    return {
        type: 'CHAT_IMAGE',
        data: { imageUrl: uploadResult.url },
        ...meta
    };
};
```

## HTML/Text Upload

```javascript
// Upload HTML content
const uploadHtmlContent = async (htmlContent, filename) => {
    // Get presigned URL
    const presignedUrl = await openkbs.kb({
        action: 'createPresignedURL',
        namespace: 'files',
        fileName: filename,
        fileType: 'text/html',
        presignedOperation: 'putObject'
    });

    // Upload as UTF-8 Buffer
    const htmlBuffer = Buffer.from(htmlContent, 'utf8');
    await axios.put(presignedUrl, htmlBuffer, {
        headers: {
            'Content-Type': 'text/html',
            'Content-Length': htmlBuffer.length
        }
    });

    return `https://yourdomain.com/media/${filename}`;
};
```

## Frontend File Upload (contentRender.js)

**IMPORTANT:** `openkbs` is passed as a **prop** to components - it's NOT global!

```javascript
// File upload button component - receives openkbs as prop
const FileUploadButton = ({ openkbs, setSystemAlert }) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Upload file to storage with progress callback
            await openkbs.Files.uploadFileAPI(file, 'files', (percent) => {
                setProgress(percent);
            });

            setSystemAlert?.({ severity: 'success', message: `Uploaded ${file.name}` });
        } catch (error) {
            setSystemAlert?.({ severity: 'error', message: error.message });
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? `Uploading ${progress}%` : 'Upload File'}
            </button>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleUpload}
                style={{ display: 'none' }}
            />
        </div>
    );
};

// Header must pass openkbs to child components
const Header = ({ setRenderSettings, openkbs, setSystemAlert }) => {
    return (
        <div>
            <FileUploadButton openkbs={openkbs} setSystemAlert={setSystemAlert} />
        </div>
    );
};
```

### Other Files API Methods

```javascript
// List files (inside a component that receives openkbs as prop)
const files = await openkbs.Files.listFiles('files');
// Returns: [{ Key: 'files/kbId/filename.jpg', Size: 12345, LastModified }]

// Delete file
await openkbs.Files.deleteRawKBFile('filename.jpg', 'files');

// Rename file
await openkbs.Files.renameFile('old.jpg', 'new.jpg', 'files');
```

## instructions.txt (LLM prompt)

```
File Upload:

Upload files from URLs:
<uploadFiles>
https://example.com/image1.jpg
https://example.com/document.pdf
</uploadFiles>

Or as JSON array:
<uploadFiles>["https://example.com/file1.jpg", "https://example.com/file2.png"]</uploadFiles>

Files are stored permanently and accessible via CDN.
```

## Key Points

1. **Presigned URL flow**: Get URL → Upload to S3 → Construct public URL
2. **CDN access**: Files accessible at `yourdomain.com/media/filename`
3. **Content-Type matters**: Set correct MIME type for proper serving
4. **Buffer for text**: Use `Buffer.from(content, 'utf8')` for text/HTML
5. **Timestamps**: Add to filename for uniqueness
6. **openkbs.uploadImage**: Shortcut for base64 image upload
