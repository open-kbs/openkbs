# OpenKBS Framework - LLM Development Guide

This guide provides a comprehensive overview of the OpenKBS framework for AI agents and applications, focusing on practical development patterns and key functionality.

> **Note**: Full source code for reference applications is available at the URLs listed at the end of this document. You can examine these implementations for detailed examples.

## Core Concepts

OpenKBS is a framework for building and deploying AI agents with:
- Custom event handlers for processing messages
- Extensible frontend and backend
- Built-in SDKs for popular AI services
- Secure API endpoints for third-party integration

## Development Workflow

```bash
# Install the CLI
npm install -g openkbs

# Create a new app
openkbs create my-agent
cd my-agent

# Initialize Git repository
git init && git stage . && git commit -m "First commit"

# Deploy the app
openkbs login
openkbs push

# Clone an existing app
openkbs ls
openkbs clone <id-from-ls-output>

# Modify app functionality using AI
openkbs modify "Implement getContent backend tool that returns text or JSON from a given URL"

# Install frontend dependencies
openkbs contentRender i react-markdown
```

## Directory Structure

```
src/
├── Events/                 # Backend handlers
│   ├── actions.js          # Common backend actions
│   ├── onRequest.js        # Pre-LLM processing
│   ├── onResponse.js       # Post-LLM processing
│   ├── onPublicAPIRequest.js # Public API handler
│   ├── onAddMessages.js    # Message handling
│   └── *.json              # Dependencies for handlers
└── Frontend/
    ├── contentRender.js    # UI customizations
    └── contentRender.json  # Frontend dependencies

app/
├── icon.png                # Application icon
├── settings.json           # Application settings
└── instructions.txt        # LLM instructions
```

## Backend Development

### Event Handlers

Backend functionality is implemented through event handlers:

**1. onRequest.js** - Process user messages before they reach the LLM
```javascript
import {getActions} from './actions.js';

export const handler = async (event) => {
    const actions = getActions({});
    
    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
        const match = lastMessage?.match(regex);
        if (match) return await action(match);
    }
    
    return { type: 'CONTINUE' };
};
```

**2. onResponse.js** - Process LLM responses before sending to user
```javascript
import {getActions} from './actions.js';

export const handler = async (event) => {
    const actions = getActions({_meta_actions: ["REQUEST_CHAT_MODEL"]});
    
    for (let [regex, action] of actions) {
        const lastMessage = event.payload.messages[event.payload.messages.length - 1].content;
        const match = lastMessage?.match(regex);
        if (match) return await action(match);
    }
    
    return { type: 'CONTINUE' };
};
```

**3. actions.js** - Define custom commands and tools
```javascript
export const getActions = (meta) => [
    // Command pattern: regex pattern and handler function
    [/\/?textToImage\("(.*)"\)/, async (match) => {
        const response = await openkbs.textToImage(match[1]);
        const imageSrc = `data:${response.ContentType};base64,${response.base64Data}`;
        return { type: 'SAVED_CHAT_IMAGE', imageSrc, ...meta };
    }],
    
    [/\/?webpageToText\("(.*)"\)/, async (match) => {
        let response = await openkbs.webpageToText(match[1]);
        if (response?.content?.length > 5000) {
            response.content = response.content.substring(0, 5000);
        }
        return { data: response, ...meta };
    }],
    
    // Add more command patterns here
];
```

**4. onPublicAPIRequest.js** - Define public API endpoints
```javascript
const handler = async ({ payload }) => {
    const { item, attributes, itemType, action, kbId } = payload;
    
    if (!kbId) return { error: "kbId is not provided" }

    try {
        const myItem = {};
        for (const attribute of attributes) {
            const { attrName, encrypted } = attribute;
            if (encrypted && item[attrName] !== undefined) {
                myItem[attrName] = await openkbs.encrypt(item[attrName]);
            } else {
                myItem[attrName] = item[attrName];
            }
        }

        return await openkbs.items({ action, itemType, attributes, item: myItem, kbId });
    } catch (error) {
        return { error: error.message };
    }
};

module.exports = { handler };
```

### Meta Actions

Control conversation flow with meta actions in your event handlers:

```javascript
// Prompt LLM for another response
return { data: responseData, _meta_actions: ["REQUEST_CHAT_MODEL"] };

// Save an image in chat
return { type: 'SAVED_CHAT_IMAGE', imageSrc: imageDataUrl };
```

### SDK Functions

The `openkbs` object provides built-in functionality:

```javascript
// AI services
await openkbs.textToImage("a cute cat", { serviceId: 'stability.sd3Medium' });
await openkbs.webpageToText("https://example.com");
await openkbs.documentToText("https://example.com/document.pdf");
await openkbs.imageToText("https://example.com/image.jpg");
await openkbs.speechToText("https://example.com/audio.mp3");
await openkbs.textToSpeech("Hello world", { languageCode: "en-US" });
await openkbs.googleSearch("search query");

// Data storage and retrieval
await openkbs.items({ action: "createItem", itemType, attributes, item });
await openkbs.items({ action: "getItem", itemType, itemId });
await openkbs.items({ action: "updateItem", itemType, itemId, item });
await openkbs.items({ action: "deleteItem", itemType, itemId });

// Chat interactions
await openkbs.chats({ action: "getChatMessages", chatId });

// Security
await openkbs.encrypt(plaintext);
await openkbs.decrypt(ciphertext);

// Client information
const clientIP = openkbs.clientHeaders['x-forwarded-for'];
const clientCountry = openkbs.clientHeaders['cloudfront-viewer-country-name'];
```

## Frontend Development

### Content Rendering

Customize the UI with `contentRender.js`:

```javascript
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import { MoreVert as MenuIcon } from '@mui/icons-material';

// Custom message renderer
const onRenderChatMessage = async (params) => {
    const { content, role } = params.messages[params.msgIndex];
    
    // Handle JSON content
    if (role === 'assistant' && content.includes('{')) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return <pre>{JSON.stringify(data, null, 2)}</pre>;
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    }
    
    // Render markdown
    return <ReactMarkdown>{content}</ReactMarkdown>;
};

// Custom header component
const Header = (props) => {
    return (
        <AppBar position="absolute" style={{ zIndex: 1300, flexGrow: 1 }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" style={{ marginRight: '16px' }}>
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" style={{ flexGrow: 1 }}>
                    My Agent
                </Typography>
            </Toolbar>
        </AppBar>
    );
};

const exports = { onRenderChatMessage, Header };
window.contentRender = exports;
export default exports;
```

### Important Frontend Parameters

The `params` object passed to `onRenderChatMessage` contains:

```javascript
const {
    // Message data
    msgIndex,                  // Current message index
    messages,                  // All chat messages
    setMessages,               // Function to update messages
    
    // UI references
    chatContainerRef,          // Reference to chat container
    sendButtonRef,             // Reference to send button
    sendButtonRippleRef,       // Reference to send button ripple effect
    
    // API functionality
    RequestChatAPI,            // Function to send messages to API
    setSystemAlert,            // Function to show system alerts
    setBlockingLoading,        // Function to show loading indicator
    blockingLoading,           // Loading state
    setInputValue,             // Function to set input value
    
    // Utilities and state
    renderSettings,            // Rendering settings object
    axios,                     // Axios for HTTP requests
    itemsAPI,                  // API for KB items
    indexedDB,                 // IndexedDB wrapper
    chatAPI,                   // API for chat operations
    generateMsgId,             // Generate message ID
    kbUserData,                // Get user data
    executeNodejs,             // Execute Node.js code in VM
    KB                         // Knowledge Base data
} = params;
```

### Render Settings

Control UI behavior with `setRenderSettings`:

```javascript
setRenderSettings({
    setMessageWidth: (content) => isContentHTML(content) ? '90%' : undefined,
    enableGenerationModelsSelect: false,
    disableShareButton: true,
    disableBalanceView: false,
    disableSentLabel: false,
    disableChatAvatar: false,
    disableChatModelsSelect: false,
    disableContextItems: true,
    chatContainerHeight: window.innerHeight - 300,
    instructionSuffix: "Additional context for the LLM",
});
```

## Application Examples

### 1. AI Tools & Web Services

```javascript
// Add a web scraping tool
[/\/?webpageToText\("(.*)"\)/, async (match) => {
    let response = await openkbs.webpageToText(match[1]);
    if (response?.content?.length > 5000) {
        response.content = response.content.substring(0, 5000);
    }
    return { data: response, ...meta };
}],
```

> Reference: Full implementation available at https://openkbs.com/apps/ai-tools/

### 2. Data Collection & Form Processing

```javascript
// Create a subscription form
const formItem = {
    action: "createItem",
    kbId: "${KB.kbId}",
    itemType: "subscribeForm",
    attributes: [
        { attrType: "keyword1", attrName: "name", encrypted: true },
        { attrType: "keyword2", attrName: "email", encrypted: true }
    ],
    item: {
        name: formData.get('name'),
        email: formData.get('email')
    }
};

axios.post('https://chat.openkbs.com/publicAPIRequest', formItem)
    .then(response => {
        // Handle success
    });
```

> Reference: Form implementations available in https://openkbs.com/apps/ai-web-maker/

### 3. Tracking Applications (Calorie Counter Example)

```javascript
// Aggregate user data from IndexedDB
const foodItems = indexedDB.useQuery(() => {
    return indexedDB?.db?.['food']?.where('updatedAt')
        .between(...getTimestampRangeForDate(selectedDate)).toItems();
}, [selectedDate, blockingLoading]);

// Store user profile data
const { itemId } = await itemsAPI.createItem({ 
    itemId: 'profile', 
    itemType: 'profile', 
    KBData: KB, 
    attributes, 
    item: formData 
});
```

> Reference: Complete tracking implementation at https://openkbs.com/apps/calorie-counter/

### 4. Document Processing (Invoice Reader)

```javascript
// Extract and display structured data from documents
const jsonResult = extractJSONFromContent(content);
if (jsonResult && jsonResult.data.invoice) {
    return <InvoiceEditor 
        invoiceData={jsonResult.data} 
        onSave={async (updatedData) => {
            await RequestChatAPI([...messages, {
                role: 'user',
                content: JSON.stringify({
                    type: "SAVE_INVOICE_REQUEST",
                    ...updatedData
                }),
                userId: kbUserData().chatUsername,
                msgId: generateMsgId()
            }]);
        }}
    />;
}
```

> Reference: Full invoice processing implementation at https://openkbs.com/apps/ai-invoice/

### 5. Web Development Tools

```javascript
// Web builder with GrapesJS
const initializeEditor = useCallback((content) => {
    if (grapesjs) {
        const editor = grapesjs.init({
            container: editorContainerRef.current,
            components: content,
            plugins: [grapesjsPresetWebpage, grapesjsBlocksBasic],
            assetManager: {
                uploadFile: async (event) => {
                    const files = event.dataTransfer ? 
                        event.dataTransfer.files : event.target.files;
                    for (const file of files) {
                        editor.AssetManager.add({
                            src: await uploadAsset(file)
                        });
                    }
                }
            }
        });
        
        // Enable image generation for websites
        editor.on('block:drag:stop', (component, block) => {
            const msg = `Make the "${block.get('label')}" a natural part of this website`;
            setInputValue(prev => prev ? prev + msg : msg);
        });
    }
}, [grapesjs]);
```

> Reference: Complete web builder implementation at https://openkbs.com/apps/ai-web-maker/

### 6. Cloud Automation (Cloud Master Example)

```javascript
// Execute Node.js code with AWS SDK
const runCode = async () => {
    try {
        const code = source.includes('module.exports') 
            ? source 
            : `const handler = async () => { ${source} }; module.exports = { handler };`;
        
        const response = await executeNodejs(code, KB);
        setResponse(JSON.stringify(response.data));
    } catch (error) {
        setResponse(`Error: ${error.message}`);
    }
};
```

> Reference: Full cloud automation implementation at https://openkbs.com/apps/ai-cloud-master/


## LLM Instructions

Define LLM behavior in `app/instructions.txt`:

```
You are an AI assistant.

You can execute the following commands:

/googleSearch("query")
Description: """
Get results from Google Search API.
"""
$InputLabel = """Let me Search in Google!"""
$InputValue = """Search in google for the latest news"""

/webpageToText("URL")
Description: """
Extract text content from a webpage.
"""

/textToImage("prompt")
Description: """
Generate an image based on the prompt.
"""

$Comment = """
This comment will be removed before sending to the LLM.
It can contain notes for developers.
"""
```

Use special directives for UI features:
- `$InputLabel` - Creates a clickable shortcut in the chat interface
- `$InputValue` - Pre-fills the chat input when shortcut is clicked
- `$Comment` - Adds developer notes that aren't sent to the LLM

## API Integration

Integrate with the OpenKBS platform:

```javascript
// Create public chat tokens for third-party integration
const requestBody = {
  action: "createPublicChatToken",
  kbId: "YOUR_KB_ID",
  apiKey: "YOUR_API_KEY",
  title: "Chat Title", // must be encrypted
  variables: {
    publicUserName: "User's Name",
    publicUserId: "User's ID",
    publicUserEmail: "User's Email"
  },
  maxMessages: 50,
  maxTokens: 64000,
  tokenExpiration: 3600000 // in milliseconds
};

// Access these variables in your handlers
const userName = '{{variables.publicUserName}}';
```

## Security & Encryption

Secure sensitive data:

```javascript
// Encrypting data
const encryptedValue = await openkbs.encrypt(sensitiveData);

// Decrypting data
const decryptedValue = await openkbs.decrypt(encryptedValue);
```

## Best Practices

1. **Error Handling**: Always include try/catch blocks in async operations
2. **Data Validation**: Validate user inputs before processing
3. **Token Management**: Avoid excessive token usage with message zipping
4. **Security**: Use encryption for sensitive data
5. **UI Responsiveness**: Check `window.openkbs.isMobile` for mobile-friendly UIs
6. **Code Organization**: Use `actions.js` for shared logic

## Common Patterns

### State Management

```javascript
const [state, setState] = useState(initialState);
useEffect(() => {
    // Update state based on changes
}, [dependencies]);
```

### Data Retrieval

```javascript
// Fetch items from IndexedDB
const items = indexedDB.useQuery(() => {
    return indexedDB?.db?.[itemType]?.toItems();
}, [dependencies]);

// Get specific item by ID
const item = await itemsAPI.getItem({ itemId, KBData: KB, itemType });
```

### Custom UI Components

```javascript
// Create reusable components
const CustomComponent = (props) => {
    return (
        <Box sx={{ width: '100%' }}>
            <Typography>{props.title}</Typography>
            {props.children}
        </Box>
    );
};
```

### Command Registration

```javascript
// Register in actions.js
[/\/?customCommand\("(.*)"\)/, async (match) => {
    // Implementation
    return { data: result, ...meta };
}],

// Add to instructions.txt
/customCommand("parameter")
Description: """
Description of what the command does.
"""
$InputLabel = """Custom Command"""
$InputValue = """Example usage"""
```

You can visit all application URLs to view and explore the complete source code for each application. Studying these implementations will provide practical examples of the patterns and techniques described in this guide.

This guide provides practical knowledge for developing with the OpenKBS framework. Refer to specific examples for implementation details of various application types.