# Cronjob Monitoring Pattern

Complete working code for continuous monitoring with pulse interval control.

## Concept

Monitor external sources (cameras, APIs, sensors) with:
- Pulse interval control (execute every N minutes)
- Sleep/hibernation mode
- Weather/sensor data injection
- Reference image comparison
- Multi-source parallel fetching

## onCronjob.js

```javascript
import { getAgentSetting, setAgentSetting, setMemoryValue } from './memoryHelpers.js';

// Check if agent should execute this minute
async function shouldExecute() {
    try {
        // Check sleep mode
        const sleepUntil = await getAgentSetting('agent_sleepUntil');
        if (sleepUntil) {
            const sleepUntilDate = new Date(sleepUntil);
            if (sleepUntilDate > new Date()) {
                return { execute: false, reason: 'sleeping' };
            }
        }

        // Check pulse interval (default: every minute)
        const pulseInterval = (await getAgentSetting('agent_pulseInterval')) || 1;
        const currentMinute = new Date().getMinutes();

        if (currentMinute % pulseInterval !== 0) {
            return { execute: false, reason: 'pulse_interval' };
        }

        return { execute: true, interval: pulseInterval };
    } catch (e) {
        return { execute: true, interval: 1 };
    }
}

export const handler = async (event) => {
    try {
        // Check execution conditions
        const status = await shouldExecute();
        if (!status.execute) {
            return { success: true, skipped: true, reason: status.reason };
        }

        // Fetch all data sources in parallel
        const [cameraData, weatherData, sensorData] = await Promise.all([
            fetchCameraImages(),
            fetchWeatherData(),
            fetchSensorReadings()
        ]);

        // Build message for LLM analysis
        const message = [];

        message.push({
            type: "text",
            text: "PROCESS_MONITORING_CHECK"
        });

        // Add camera images
        for (const camera of cameraData) {
            message.push({
                type: "text",
                text: `\n📹 ${camera.name} - ${camera.timestamp}`
            });
            message.push({
                type: "image_url",
                image_url: { url: camera.imageUrl }
            });
        }

        // Add reference images from memory
        await injectReferenceImages(message);

        // Add weather data periodically (every hour)
        const currentMinute = new Date().getMinutes();
        if (currentMinute === 0) {
            await injectWeatherData(message, weatherData);
        }

        // Create analysis chat
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Sofia'
        });

        await openkbs.chats({
            chatTitle: `Monitoring - ${timeStr}`,
            message: JSON.stringify(message)
        });

        return { success: true, sources: cameraData.length };

    } catch (error) {
        return { success: false, error: error.message };
    }
};

handler.CRON_SCHEDULE = "* * * * *";
```

## Data Fetching Helpers

```javascript
// Fetch latest images from cameras
async function fetchCameraImages() {
    const cameras = [
        { name: 'Camera-North', url: 'https://cdn.example.com/cam1/' },
        { name: 'Camera-South', url: 'https://cdn.example.com/cam2/' },
        { name: 'Camera-East', url: 'https://cdn.example.com/cam3/' },
        { name: 'Camera-West', url: 'https://cdn.example.com/cam4/' }
    ];

    const results = await Promise.all(cameras.map(async (cam) => {
        try {
            // Fetch directory listing
            const response = await fetch(cam.url);
            const html = await response.text();

            // Parse image filenames (adjust regex for your CDN format)
            const matches = html.match(/href="([^"]+\.jpg)"/g) || [];
            const files = matches.map(m => m.match(/href="([^"]+)"/)[1]);

            // Get latest image
            const latest = files.sort().pop();

            return {
                name: cam.name,
                imageUrl: `${cam.url}${latest}`,
                timestamp: extractTimestamp(latest)
            };
        } catch (e) {
            return { name: cam.name, error: e.message };
        }
    }));

    return results.filter(r => r.imageUrl);
}

// Extract timestamp from filename (e.g., "20250104_143022.jpg")
function extractTimestamp(filename) {
    const match = filename.match(/(\d{8})_(\d{6})/);
    if (match) {
        const [_, date, time] = match;
        return `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)} ${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;
    }
    return 'Unknown';
}
```

## Reference Image Injection

```javascript
// Inject stored reference images for comparison
async function injectReferenceImages(message) {
    try {
        const imageMemories = await openkbs.fetchItems({
            beginsWith: 'memory_with_image_',
            limit: 50,
            field: 'itemId'
        });

        if (imageMemories?.items?.length > 0) {
            message.push({
                type: "text",
                text: `\n📸 REFERENCE IMAGES (${imageMemories.items.length})\nUse these for comparison with current state.`
            });

            for (const item of imageMemories.items) {
                const value = item.item?.body?.value;
                if (value?.imageUrl) {
                    const description = value.description || 'Reference';

                    message.push({
                        type: "text",
                        text: `\n🏷️ ${description}`
                    });
                    message.push({
                        type: "image_url",
                        image_url: { url: value.imageUrl }
                    });
                }
            }
        }
    } catch (e) {
        console.error('Failed to fetch reference images:', e.message);
    }
}
```

## Weather Data Injection

```javascript
async function injectWeatherData(message, weatherData) {
    message.push({
        type: 'text',
        text: `\n📊 WEATHER DATA\nAnalyze conditions and include weatherSummary in your assessment.`
    });

    // Add weather graphs/images if available
    if (weatherData.graphs) {
        for (const graph of weatherData.graphs) {
            message.push({
                type: "image_url",
                image_url: { url: graph.url }
            });
        }
    }

    // Fetch current weather for multiple locations
    const locations = [
        { name: 'Location-A', lat: 42.20, lon: 22.81 },
        { name: 'Location-B', lat: 42.06, lon: 22.77 }
    ];

    const weatherPromises = locations.map(async (loc) => {
        try {
            const response = await axios.get('https://webtools.openkbs.com/weather', {
                params: { lat: loc.lat, lon: loc.lon }
            });
            return {
                name: loc.name,
                temp: response.data.main?.temp,
                humidity: response.data.main?.humidity,
                wind: response.data.wind?.speed,
                condition: response.data.weather?.[0]?.main
            };
        } catch (e) {
            return { name: loc.name, error: e.message };
        }
    });

    const locationWeather = await Promise.all(weatherPromises);

    // Store in memory for context
    await setMemoryValue('memory_locations_weather', locationWeather);
}
```

## Agent Control Commands (actions.js)

```javascript
// Hibernate agent until specific time
[/<hibernateAgent>([\\s\\S]*?)<\\/hibernateAgent>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());
        let sleepUntil;

        if (data.hours) {
            sleepUntil = new Date(Date.now() + data.hours * 60 * 60 * 1000);
        } else if (data.days) {
            sleepUntil = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000);
        } else if (data.until) {
            sleepUntil = new Date(data.until);
        } else {
            throw new Error('Specify hours, days, or until (ISO timestamp)');
        }

        await setAgentSetting('agent_sleepUntil', sleepUntil.toISOString());

        return {
            type: "AGENT_HIBERNATING",
            sleepUntil: sleepUntil.toISOString(),
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return { type: "HIBERNATE_ERROR", error: e.message, _meta_actions: ["REQUEST_CHAT_MODEL"] };
    }
}],

// Set pulse interval (how often to execute)
[/<setAgentSettings>([\\s\\S]*?)<\\/setAgentSettings>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        if (data.pulseInterval !== undefined) {
            const interval = Math.max(1, Math.min(60, parseInt(data.pulseInterval)));
            await setAgentSetting('agent_pulseInterval', interval);
        }

        if (data.wakeUp === true) {
            await setAgentSetting('agent_sleepUntil', null);
        }

        return {
            type: "AGENT_SETTINGS_UPDATED",
            settings: data,
            _meta_actions: ["REQUEST_CHAT_MODEL"]
        };
    } catch (e) {
        return { type: "SETTINGS_ERROR", error: e.message, _meta_actions: ["REQUEST_CHAT_MODEL"] };
    }
}]
```

## instructions.txt (LLM prompt)

```
Monitoring Commands:

Hibernate agent:
<hibernateAgent>{"hours": 24}</hibernateAgent>
<hibernateAgent>{"days": 7}</hibernateAgent>
<hibernateAgent>{"until": "2025-01-15T08:00:00Z"}</hibernateAgent>

Change pulse interval (1-60 minutes):
<setAgentSettings>{"pulseInterval": 5}</setAgentSettings>

Wake up agent:
<setAgentSettings>{"wakeUp": true}</setAgentSettings>

Store reference image:
<setMemory>{
  "itemId": "memory_with_image_camera1_sunset",
  "value": {
    "imageUrl": "https://...",
    "description": "Normal sunset glow - not fire",
    "camera": "Camera-North"
  }
}</setMemory>
```

## Key Points

1. **Pulse interval** - Control execution frequency (every N minutes)
2. **Sleep mode** - Hibernate until specific time
3. **Parallel fetching** - Fetch all sources simultaneously
4. **Reference images** - Store `memory_with_image_*` for comparison
5. **Weather injection** - Add contextual data periodically
6. **Timezone handling** - Use proper timezone for display
7. **CRON_SCHEDULE** - Runs every minute, agent controls actual execution
