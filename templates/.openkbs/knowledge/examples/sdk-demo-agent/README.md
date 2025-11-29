# SDK Demo Agent

A comprehensive demonstration of OpenKBS SDK features including frontend and backend capabilities.

## Features Demonstrated

### Backend SDK (`src/Events/actions.js`)
- **Memory CRUD** - Create, read, update, delete items with expiration
- **Image Generation** - Gemini and GPT-Image-1 models
- **File Upload** - Presigned URL upload pattern
- **Scheduled Tasks** - Create, list, delete scheduled tasks
- **External APIs** - Telegram integration example
- **Chat Operations** - Create chats, update title/icon

### Frontend SDK (`src/Frontend/contentRender.js`)
- **Memory Management UI** - List, edit, create, delete memory items
- **Files API** - List, upload, delete, rename files
- **Sharing API** - Share KB with users, list shares
- **Custom Header** - Settings panel with openkbs object access
- **Custom Message Rendering** - Hide system messages, render commands as icons

## Command Format

All commands use XML tags with JSON content:
```xml
<commandName>
{
  "param1": "value1"
}
</commandName>
```

## Available Commands

### Memory
- `<setMemory>` - Save to memory with optional expiration
- `<deleteItem>` - Delete any item by ID
- `<cleanupMemory/>` - Remove expired items

### Content
- `<createAIImage>` - Generate image
- `<uploadFile>` - Upload file from URL
- `<viewImage>` - View image in LLM context

### Tasks
- `<scheduleTask>` - Schedule future task
- `<getScheduledTasks/>` - List all tasks
- `<deleteScheduledTask>` - Delete task

### Communication
- `<sendMail>` - Send email
- `<sendToTelegram>` - Send to Telegram channel

## Architecture

```
src/
├── Events/
│   ├── actions.js       # Command implementations
│   ├── onRequest.js     # User message handler
│   ├── onResponse.js    # LLM response handler
│   └── onCronjob.js     # Scheduled execution
└── Frontend/
    ├── contentRender.js # UI customization
    └── ManagePanel.js   # Files/Memory/Sharing panel
```

## Deployment

```bash
openkbs push
```
