# AI Marketing Agent

A comprehensive AI marketing assistant that can create content, generate images and videos, search the web, send emails, and schedule tasks.

## Features

- **AI Image Generation**: Gemini 2.5 Flash Image and GPT-Image-1 models
- **AI Video Generation**: Sora 2 and Sora 2 Pro models
- **Web Search**: Google Search and Image Search
- **Email Marketing**: Send emails directly from chat
- **Task Scheduling**: Schedule future reminders and tasks
- **Web Publishing**: Create and publish HTML landing pages
- **Memory System**: Persistent storage for user preferences and content

## Command Format

All commands use XML tags with JSON content:

```xml
<commandName>
{
  "param1": "value1",
  "param2": "value2"
}
</commandName>
```

## Available Commands

### Content Creation
- `<createAIImage>` - Generate images with AI
- `<createAIVideo>` - Generate videos with Sora 2
- `<publishWebPage>` - Publish HTML landing pages

### Search & Research
- `<googleSearch>` - Web search
- `<googleImageSearch>` - Image search
- `<webpageToText>` - Extract text from webpages
- `<viewImage>` - View image in context

### Communication
- `<sendMail>` - Send emails

### Task Management
- `<scheduleTask>` - Schedule future tasks
- `<getScheduledTasks/>` - List scheduled tasks

### Memory
- `<setMemory>` - Save to memory
- `<deleteItem>` - Delete from memory

## Architecture

- `src/Events/actions.js` - Command implementations
- `src/Events/onRequest.js` - User message handler
- `src/Events/onResponse.js` - LLM response handler
- `src/Frontend/contentRender.js` - UI customization
- `app/instructions.txt` - LLM instructions

## Deployment

```bash
openkbs push
```
