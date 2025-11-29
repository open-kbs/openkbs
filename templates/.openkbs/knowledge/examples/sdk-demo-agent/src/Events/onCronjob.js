// onCronjob - Scheduled task execution
// Runs at intervals defined by handler.CRON_SCHEDULE

export const handler = async (event) => {
    console.log('Cronjob executed at:', new Date().toISOString());

    // Example: Cleanup expired memory items
    const result = await openkbs.fetchItems({
        beginsWith: 'memory_',
        limit: 100
    });

    if (result?.items) {
        const now = new Date();
        let cleaned = 0;

        for (const item of result.items) {
            if (item.item?.body?.exp) {
                const expDate = new Date(item.item.body.exp);
                if (expDate < now) {
                    await openkbs.deleteItem(item.meta.itemId);
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned ${cleaned} expired memory items`);
        }
    }

    // Example: Send daily notification (uncomment to enable)
    /*
    await openkbs.chats({
        chatTitle: 'Daily Report',
        message: JSON.stringify([{
            type: "text",
            text: "Daily automated report generated at " + new Date().toISOString()
        }])
    });
    */

    return { success: true };
};

// Schedule: Run every hour at minute 0
// Cron format: minute hour day month weekday
// Examples:
//   "* * * * *"     - Every minute
//   "*/5 * * * *"   - Every 5 minutes
//   "0 * * * *"     - Every hour at :00
//   "0 0 * * *"     - Every day at midnight
//   "0 9 * * 1"     - Every Monday at 9:00 AM
handler.CRON_SCHEDULE = "0 * * * *";
