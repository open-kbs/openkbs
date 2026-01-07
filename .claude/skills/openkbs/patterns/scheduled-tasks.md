# Scheduled Tasks Pattern

Complete working code for creating, listing, and deleting scheduled tasks.

## actions.js

```javascript
// Create scheduled task
[/<scheduleTask>([\s\S]*?)<\/scheduleTask>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        let scheduledTime;

        if (data.time) {
            // Parse specific ISO time
            let isoTimeStr = data.time.replace(' ', 'T');
            if (!isoTimeStr.includes('Z') && !isoTimeStr.includes('+')) {
                isoTimeStr += 'Z';
            }
            scheduledTime = new Date(isoTimeStr).getTime();
        } else if (data.delay) {
            // Parse relative delay: "30" (minutes), "2h" (hours), "1d" (days)
            let delayMs = 0;
            const delayStr = String(data.delay);
            if (delayStr.endsWith('h')) {
                delayMs = parseFloat(delayStr) * 60 * 60 * 1000;
            } else if (delayStr.endsWith('d')) {
                delayMs = parseFloat(delayStr) * 24 * 60 * 60 * 1000;
            } else {
                delayMs = parseFloat(delayStr) * 60 * 1000; // default minutes
            }
            scheduledTime = Date.now() + delayMs;
        } else {
            // Default: 1 hour from now
            scheduledTime = Date.now() + (60 * 60 * 1000);
        }

        // Round to nearest minute (required by scheduler)
        scheduledTime = Math.floor(scheduledTime / 60000) * 60000;

        const response = await openkbs.kb({
            action: 'createScheduledTask',
            scheduledTime: scheduledTime,
            taskPayload: {
                message: `[SCHEDULED_TASK] ${data.message}`,
                source: 'agent_scheduled',
                createdAt: Date.now()
            },
            description: data.message.substring(0, 100)
        });

        return {
            type: 'TASK_SCHEDULED',
            data: {
                scheduledTime: new Date(scheduledTime).toISOString(),
                taskId: response.taskId,
                message: data.message
            },
            ...meta
        };
    } catch (e) {
        return { error: e.message || 'Failed to schedule task', ...meta };
    }
}],

// List scheduled tasks
[/<getScheduledTasks\/>/s, async () => {
    try {
        const response = await openkbs.kb({ action: 'getScheduledTasks' });

        return {
            type: 'SCHEDULED_TASKS_LIST',
            data: response,
            ...meta
        };
    } catch (e) {
        return { error: e.message || 'Failed to get scheduled tasks', ...meta };
    }
}],

// Delete scheduled task
[/<deleteScheduledTask>([\s\S]*?)<\/deleteScheduledTask>/s, async (match) => {
    try {
        const data = JSON.parse(match[1].trim());

        await openkbs.kb({
            action: 'deleteScheduledTask',
            timestamp: data.timestamp
        });

        return {
            type: 'TASK_DELETED',
            data: {
                deletedTimestamp: data.timestamp,
                message: 'Task deleted successfully'
            },
            ...meta
        };
    } catch (e) {
        return { error: e.message || 'Failed to delete task', ...meta };
    }
}]
```

## onCronjob.js - Handle Scheduled Task Execution

```javascript
export const handler = async (event) => {
    // Scheduled task payload is in event.payload
    const taskPayload = event.payload;

    if (taskPayload?.message?.includes('[SCHEDULED_TASK]')) {
        // Create a new chat with the scheduled message
        await openkbs.chats({
            chatTitle: 'Scheduled Task',
            message: JSON.stringify([{
                type: "text",
                text: taskPayload.message.replace('[SCHEDULED_TASK] ', '')
            }])
        });
    }

    return { success: true };
};

// Define cron schedule - runs every minute to check for due tasks
handler.CRON_SCHEDULE = "* * * * *";
```

## instructions.txt (LLM prompt)

```
Scheduled Tasks:

Schedule task with delay:
<scheduleTask>{"message": "Send weekly report", "delay": "1h"}</scheduleTask>

Schedule at specific time:
<scheduleTask>{"message": "Meeting reminder", "time": "2025-01-15T10:00:00Z"}</scheduleTask>

Delay formats: "30" (minutes), "2h" (hours), "1d" (days)

List all scheduled tasks:
<getScheduledTasks/>

Delete a scheduled task:
<deleteScheduledTask>{"timestamp": 1704067200000}</deleteScheduledTask>
```

## Key Points

1. **Time precision** - Scheduler works at minute-level, times are rounded
2. **Task payload** - Use `[SCHEDULED_TASK]` prefix to identify in onCronjob
3. **Creates new chat** - Task execution creates new chat conversation
4. **Delete by timestamp** - Tasks are identified by their scheduled timestamp
5. **CRON_SCHEDULE** - Define at end of onCronjob.js file
