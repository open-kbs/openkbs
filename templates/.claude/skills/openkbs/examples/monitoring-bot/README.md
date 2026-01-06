# Monitoring Bot Example

A simplified monitoring agent that demonstrates:
- **Cronjob** with pulse interval control
- **Telegram webhook** integration
- **Memory system** with reference images
- **Weather API** integration

## Features

- Monitors external data sources every N minutes
- Receives commands via Telegram
- Stores reference images for comparison
- Hibernation/sleep mode
- Weather data injection

## Quick Start

```bash
cd monitoring-bot
openkbs push
```

Then setup Telegram webhook:
```
https://chat.openkbs.com/publicAPIRequest?kbId=YOUR_KB_ID&setupTelegramWebhook=true
```

## File Structure

```
monitoring-bot/
├── app/
│   ├── settings.json       # Agent config
│   └── instructions.txt    # System prompt
├── src/
│   ├── Events/
│   │   ├── actions.js      # Command handlers
│   │   ├── onCronjob.js    # Scheduled monitoring
│   │   ├── onPublicAPIRequest.js  # Telegram webhook
│   │   ├── memoryHelpers.js       # Memory utilities
│   │   ├── handler.js      # Response parser
│   │   ├── onRequest.js
│   │   └── onResponse.js
│   └── Frontend/
│       └── contentRender.js
└── openkbs.json
```

## Commands

- `<setMemory>` - Store values
- `<hibernateAgent>` - Sleep until time
- `<setAgentSettings>` - Change pulse interval
- `<sendToTelegramChannel>` - Send messages
