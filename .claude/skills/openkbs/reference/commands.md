# XML Commands Reference

Commands are XML tags with JSON content that the LLM outputs. The backend parses these and executes corresponding functions.

## Command Pattern

```xml
<commandName>
{"param": "value"}
</commandName>
```

Self-closing commands (no parameters):

```xml
<commandName/>
```

## How Commands Work

```
LLM outputs: "Let me search. <googleSearch>{"query": "..."}</googleSearch>"
                                    ↓
handler.js parses XML tags
Matches against regex patterns in actions.js
Executes the async function
                                    ↓
Result returned with _meta_actions:
  - ["REQUEST_CHAT_MODEL"] → send back to LLM
  - [] → display to user, stop
```

## Implementing Commands

### In actions.js

```javascript
export const getActions = (meta, event) => [
    // Standard command
    [/<commandName>([\s\S]*?)<\/commandName>/s, async (match) => {
        const data = JSON.parse(match[1].trim());
        // Execute logic
        return {
            type: 'RESULT_TYPE',
            data: result,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    }],

    // Self-closing command
    [/<commandName\s*\/>/s, async () => {
        // Execute logic
        return { type: 'RESULT', _meta_actions: [] };
    }]
];
```

### In instructions.txt

```text
<commandName>
{
  "param1": "description",
  "param2": "description"
}
</commandName>
Description: What this command does.
```

## Standard Commands

### googleSearch

Search the web.

```xml
<googleSearch>
{"query": "search terms"}
</googleSearch>
```

### webpageToText

Extract text from a webpage.

```xml
<webpageToText>
{"url": "https://example.com"}
</webpageToText>
```

### createAIImage

Generate an AI image.

```xml
<createAIImage>
{
  "prompt": "image description",
  "aspect_ratio": "16:9"
}
</createAIImage>
```

Aspect ratios: `1:1`, `16:9`, `9:16`, `4:3`

### setMemory

Save data to memory.

```xml
<setMemory>
{
  "itemId": "memory_key_name",
  "value": {"any": "data"},
  "expirationInMinutes": 1440
}
</setMemory>
```

### deleteItem

Delete a memory item.

```xml
<deleteItem>
{"itemId": "memory_key_name"}
</deleteItem>
```

### cleanupMemory

Remove expired memory items.

```xml
<cleanupMemory/>
```

### scheduleTask

Schedule a future task.

```xml
<scheduleTask>
{
  "message": "Reminder text",
  "delay": "2h"
}
</scheduleTask>
```

Delay formats: `30m` (minutes), `2h` (hours), `1d` (days)
Or specific time: `"time": "2024-12-25 10:00"`

### getScheduledTasks

List pending scheduled tasks.

```xml
<getScheduledTasks/>
```

### deleteScheduledTask

Cancel a scheduled task.

```xml
<deleteScheduledTask>
{"timestamp": 1704067200000}
</deleteScheduledTask>
```

### sendTelegram

Send a Telegram message (requires Telegram integration).

```xml
<sendTelegram>
{"text": "Hello from agent!"}
</sendTelegram>
```

### sendTelegramPhoto

Send a photo to Telegram.

```xml
<sendTelegramPhoto>
{"url": "https://example.com/image.png", "caption": "Photo caption"}
</sendTelegramPhoto>
```

### createAIVideo

Generate an AI video.

```xml
<createAIVideo>
{
  "prompt": "cinematic sunset timelapse",
  "model": "sora-2",
  "seconds": 8,
  "size": "1280x720"
}
</createAIVideo>
```

Models: `sora-2`, `sora-2-pro`
Seconds: `4`, `8`, `12`
Sizes: `1280x720` (landscape), `720x1280` (portrait)

### continueVideoPolling

Check video generation status.

```xml
<continueVideoPolling>
{"videoId": "video_123456"}
</continueVideoPolling>
```

### deepResearch

Start autonomous research (5-20 minutes).

```xml
<deepResearch>
{
  "query": "AI market trends 2025",
  "previous_interaction_id": "optional_for_followup"
}
</deepResearch>
```

### continueDeepResearchPolling

Check research status.

```xml
<continueDeepResearchPolling>
{
  "interactionId": "interaction_123",
  "prepaidCredits": 50
}
</continueDeepResearchPolling>
```

### viewImage

Load image into LLM vision context.

```xml
<viewImage>
{"url": "https://example.com/image.jpg"}
</viewImage>
```

### archiveItems

Move items to VectorDB long-term storage.

```xml
<archiveItems>
["memory_item1", "memory_item2"]
</archiveItems>
```

### searchArchive

Semantic search in VectorDB.

```xml
<searchArchive>
{
  "query": "find marketing strategies",
  "topK": 10,
  "minScore": 0
}
</searchArchive>
```

### publishWebPage

Publish HTML as static page.

```xml
<publishWebPage>
<!DOCTYPE html>
<html>
<head><title>My Page</title></head>
<body>Content here</body>
</html>
</publishWebPage>
```

## MCP Commands

MCP tools use a dynamic pattern:

```xml
<mcp_{server}_{toolName}>
{"param": "value"}
</mcp_{server}_{toolName}>
```

### Brave Search

```xml
<mcp_brave-search_brave_web_search>
{"query": "search terms", "count": 10}
</mcp_brave-search_brave_web_search>
```

### GitHub

```xml
<mcp_github_search_repositories>
{"query": "language:typescript stars:>1000"}
</mcp_github_search_repositories>
```

## Meta Actions

Control what happens after command execution:

```javascript
// Send result to LLM for follow-up
return { data: result, _meta_actions: ["REQUEST_CHAT_MODEL"] };

// Display to user, stop conversation
return { data: result, _meta_actions: [] };
```

Use `["REQUEST_CHAT_MODEL"]` when:
- LLM needs to process the result
- Multi-step workflows
- Error handling

Use `[]` when:
- Final output (images, confirmations)
- No further processing needed

## Parallel Execution

Multiple commands in a single message execute in parallel via `Promise.all`:

```text
<googleSearch>{"query": "topic 1"}</googleSearch>
<googleSearch>{"query": "topic 2"}</googleSearch>
```

Both searches run simultaneously.

## Error Handling

Return errors in a consistent format:

```javascript
try {
    // Execute command
} catch (e) {
    return {
        type: "ERROR",
        error: e.message,
        _meta_actions: ["REQUEST_CHAT_MODEL"]
    };
}
```

The LLM receives the error and can inform the user or retry.
