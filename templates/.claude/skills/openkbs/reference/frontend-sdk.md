# Frontend SDK Reference

OpenKBS frontend is a React 18 application. Customize through `src/Frontend/contentRender.js`.

## Built-in Libraries (No Install Needed)

These libraries are provided by OpenKBS and marked with `(fixed)` in `contentRender.json`:

- React 18 (`react`, `react-dom`)
- Material-UI (`@mui/material`, `@mui/icons-material`)
- Emotion (`@emotion/react`, `@emotion/styled`)

## contentRender.js Exports

| Export | Purpose |
|--------|---------|
| `onRenderChatMessage` | Custom message rendering |
| `Header` | Custom header component |

## onRenderChatMessage

Receives each message and returns custom rendering:

```javascript
const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];
    const { msgIndex, messages, markdownHandler } = params;

    // Return null for default markdown rendering
    // Return React component for custom rendering
    // Return JSON.stringify({ type: 'HIDDEN_MESSAGE' }) to hide

    return null;
};
```

### Parameters

- `params.messages` - All messages in conversation
- `params.msgIndex` - Current message index
- `params.markdownHandler` - Function to render markdown
- `params.setSystemAlert({ severity, message })` - Show alerts (success, error, warning, info)
- `params.setBlockingLoading(bool)` - Show loading overlay
- `params.RequestChatAPI(messages)` - Send messages to LLM
- `params.kbUserData()` - Get user info
- `params.generateMsgId()` - Generate unique message ID
- `params.theme` - Current MUI theme

### Return Values

```javascript
// Default rendering
return null;

// Custom component
return <div>Custom content</div>;

// Hide message
return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
```

## Header Component

Customize the chat header. **Important:** Receive `openkbs` and `setSystemAlert` as props!

```javascript
const Header = ({ setRenderSettings, openkbs, setSystemAlert }) => {
    useEffect(() => {
        setRenderSettings({
            disableShareButton: true,
            disableBalanceView: true
        });
    }, [setRenderSettings]);

    // Now you can use openkbs.Files, openkbs.createItem, etc.
    // Pass openkbs to child components that need it

    return <div>Custom Header</div>;
};
```

### Available Header Props

| Prop | Type | Description |
|------|------|-------------|
| `setRenderSettings` | function | Configure UI options |
| `openkbs` | object | SDK object with Files, createItem, etc. |
| `setSystemAlert` | function | Show alerts: `{ severity: 'success'/'error', message }` |
| `setBlockingLoading` | function | Show/hide loading overlay |

## Command Rendering Pattern

Define commands with icons:

```javascript
// commands.js
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';

export const COMMANDS = {
    googleSearch: { icon: SearchIcon },
    createAIImage: { icon: ImageIcon },
    cleanupMemory: { icon: ClearIcon, selfClosing: true }
};

// Generate regex patterns
export const COMMAND_PATTERNS = Object.entries(COMMANDS).map(([name, config]) => {
    if (config.selfClosing) {
        return new RegExp(`<${name}\\s*\\/>`);
    }
    return new RegExp(`<${name}>[\\s\\S]*?<\\/${name}>`);
});
```

## Command Circle Component

Render commands as interactive icons:

```javascript
const CommandCircle = ({ command, response }) => {
    const IconComponent = COMMANDS[command.name]?.icon || BoltIcon;
    const isSuccess = response && !response.error;

    return (
        <Tooltip title={getTooltipContent()}>
            <Box sx={{
                width: 36, height: 36,
                borderRadius: '50%',
                backgroundColor: isSuccess ? 'rgba(76, 175, 80, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                border: '2px solid',
                borderColor: isSuccess ? 'rgba(76, 175, 80, 0.3)' : 'rgba(0, 0, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <IconComponent sx={{ fontSize: 18 }} />
            </Box>
        </Tooltip>
    );
};
```

## Image Display with Download

```javascript
const ImageWithDownload = ({ imageUrl }) => {
    const [isLoading, setIsLoading] = useState(true);

    const handleDownload = async () => {
        const link = document.createElement('a');
        link.download = 'image.png';

        const response = await fetch(imageUrl);
        const blob = await response.blob();
        link.href = URL.createObjectURL(blob);
        link.click();
    };

    return (
        <div>
            <img
                src={imageUrl}
                onLoad={() => setIsLoading(false)}
                style={{ maxWidth: '100%', borderRadius: 8 }}
            />
            {!isLoading && (
                <button onClick={handleDownload}>
                    <DownloadIcon /> Download
                </button>
            )}
        </div>
    );
};
```

## Parsing JSON Results

```javascript
const onRenderChatMessage = async (params) => {
    const { content } = params.messages[params.msgIndex];

    let JSONData;
    try { JSONData = JSON.parse(content); } catch (e) {}

    // Handle CHAT_IMAGE result
    if (JSONData?.type === 'CHAT_IMAGE' && JSONData?.data?.imageUrl) {
        return <ImageWithDownload imageUrl={JSONData.data.imageUrl} />;
    }

    // Hide CONTINUE messages
    if (JSONData?.type === 'CONTINUE') {
        return JSON.stringify({ type: 'HIDDEN_MESSAGE' });
    }

    return null;
};
```

## contentRender.json

Declare dependencies:

```json
{
  "dependencies": {
    "react": "^18.2.0 (fixed)",
    "react-dom": "^18.2.0 (fixed)",
    "@mui/material": "^5.16.1 (fixed)",
    "@mui/icons-material": "^5.16.1 (fixed)",
    "@emotion/react": "^11.10.6 (fixed)",
    "@emotion/styled": "^11.10.6 (fixed)"
  }
}
```

The `(fixed)` suffix indicates built-in libraries that don't need bundling.

## Frontend openkbs Object

**IMPORTANT:** The `openkbs` object is passed as a **prop** to Header and other components - it is NOT a global variable.

```javascript
// CORRECT - receive openkbs as prop
const Header = ({ setRenderSettings, openkbs, setSystemAlert }) => {
    // Now you can use openkbs.Files, openkbs.createItem, etc.
};

// WRONG - openkbs is not global in frontend
const Header = ({ setRenderSettings }) => {
    await openkbs.Files.listFiles(); // ERROR: openkbs is undefined
};
```

Always destructure `openkbs` from props before using it.

### Item CRUD

```javascript
// Create item
await openkbs.createItem({
    itemType: 'memory',
    itemId: 'memory_key',
    body: { value: 'data' }
});

// Update item
await openkbs.updateItem({
    itemType: 'memory',
    itemId: 'memory_key',
    body: { value: 'updated' }
});

// Get single item
const item = await openkbs.getItem('memory_key');
console.log(item.item.body.value);

// Fetch multiple items
const items = await openkbs.fetchItems({
    itemType: 'memory',
    beginsWith: 'memory_',
    limit: 100
});

// Delete item
await openkbs.deleteItem('memory_key');
```

### Files API

```javascript
// List files
const files = await openkbs.Files.listFiles('files');
// Returns: [{ Key, Size, LastModified }, ...]

// Upload with progress
const onProgress = (percent) => console.log(`${percent}%`);
await openkbs.Files.uploadFileAPI(fileObject, 'files', onProgress);

// Delete file
await openkbs.Files.deleteRawKBFile('filename.jpg', 'files');

// Rename file
await openkbs.Files.renameFile('old.jpg', 'new.jpg', 'files');
```

### Sharing API

```javascript
// Share KB
await openkbs.KBAPI.shareKBWith('user@example.com');

// Get shares
const shares = await openkbs.KBAPI.getKBShares();
// Returns: { sharedWith: ['email1', 'email2'] }

// Remove share
await openkbs.KBAPI.unshareKBWith('user@example.com');
```

### Properties

```javascript
openkbs.kbId       // Current KB ID
openkbs.isMobile   // Boolean - is mobile device
openkbs.KBData     // KB metadata
```

## Debug Mode

Add `?debug=1` to URL to see raw messages:

```
https://YOUR_KB_ID.apps.openkbs.com?debug=1
```

## Mobile Detection

```javascript
const isMobile = window.innerWidth < 960;
// Or use: openkbs.isMobile
```

## Complete Example

See [examples/ai-marketing-agent/src/Frontend/](../examples/ai-marketing-agent/src/Frontend/) for a full implementation.
