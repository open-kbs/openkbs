import { getAgentSetting, setMemoryValue, cleanupExpiredMemory } from './memoryHelpers.js';

async function shouldExecute() {
    try {
        // Check sleep mode
        const sleepUntil = await getAgentSetting('agent_sleepUntil');
        if (sleepUntil) {
            if (new Date(sleepUntil) > new Date()) {
                return { execute: false, reason: 'sleeping' };
            }
        }

        // Check pulse interval
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
        // Cleanup expired memory
        await cleanupExpiredMemory();

        // Check if should execute
        const status = await shouldExecute();
        if (!status.execute) {
            return { success: true, skipped: true, reason: status.reason };
        }

        // Build monitoring message
        const message = [];

        message.push({
            type: "text",
            text: "PROCESS_MONITORING_CHECK"
        });

        // === ADD YOUR DATA SOURCES HERE ===
        // Example: Fetch from API
        // const data = await axios.get('https://api.example.com/status');
        // message.push({ type: "text", text: `API Status: ${data.status}` });

        // Example: Add images
        // message.push({ type: "image_url", image_url: { url: "https://..." } });

        // Inject reference images from memory
        try {
            const imageMemories = await openkbs.fetchItems({
                beginsWith: 'memory_with_image_',
                limit: 20,
                field: 'itemId'
            });

            if (imageMemories?.items?.length > 0) {
                message.push({
                    type: "text",
                    text: `\n📸 REFERENCE IMAGES (${imageMemories.items.length})`
                });

                for (const item of imageMemories.items) {
                    const value = item.item?.body?.value;
                    if (value?.imageUrl) {
                        message.push({
                            type: "text",
                            text: `\n🏷️ ${value.description || 'Reference'}`
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

        // Create chat
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });

        await openkbs.chats({
            chatTitle: `Monitoring - ${timeStr}`,
            message: JSON.stringify(message)
        });

        return { success: true, timestamp: now.toISOString() };

    } catch (error) {
        return { success: false, error: error.message };
    }
};

handler.CRON_SCHEDULE = "* * * * *";
