# Cronjob Batch Processing Pattern

Complete working code for scheduled batch processing of files/documents.

## Concept

Process files from storage in batches with:
- Timestamp-based deduplication (prevents reprocessing)
- Configurable batch size limits
- Processing state persistence
- Early termination to avoid timeouts

## onCronjob.js

```javascript
export const handler = async (event) => {
    try {
        // Load or create agent config
        let agent;
        try {
            agent = await openkbs.getItem('agent');
            agent = agent.item.body;
        } catch (e) {
            // First run - create config
            const now = new Date();
            agent = {
                processingYear: String(now.getFullYear()),
                processingMonth: String(now.getMonth() + 1).padStart(2, '0'),
                batchSize: 10,
                processingStatus: 'RUNNING', // or 'PAUSED'
                lastProcessedTimestamp: null,
                currentBatchDocumentCount: 0,
                totalDocumentsProcessed: 0,
                lastUpdated: now.toISOString(),
                processingStartedAt: null
            };

            await openkbs.createItem({
                itemType: 'agent',
                itemId: 'agent',
                body: agent
            });
        }

        // Check if paused (optional - can use KB status instead)
        if (agent.processingStatus === 'PAUSED') {
            return { success: true, skipped: true, reason: 'paused' };
        }

        // Reset batch counter
        const now = new Date();
        agent.currentBatchDocumentCount = 0;
        agent.currentBatchStartedAt = now.toISOString();
        if (!agent.processingStartedAt) {
            agent.processingStartedAt = now.toISOString();
        }

        // Process files
        const result = await processFilesFromStorage(agent);

        // Update statistics
        agent.currentBatchDocumentCount = result.processed;
        agent.totalDocumentsProcessed += result.processed;
        agent.lastUpdated = now.toISOString();
        if (result.lastTimestamp) {
            agent.lastProcessedTimestamp = result.lastTimestamp;
        }

        // Save state
        await openkbs.updateItem({
            itemType: 'agent',
            itemId: 'agent',
            body: agent
        });

        return {
            success: true,
            documentsInBatch: result.processed,
            totalProcessed: agent.totalDocumentsProcessed
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
};

handler.CRON_SCHEDULE = "* * * * *"; // Every minute
```

## File Processing Logic

```javascript
async function processFilesFromStorage(agent) {
    // List files from storage
    const files = await openkbs.kb({
        action: 'listObjects',
        namespace: 'files',
        prefix: `invoices/${agent.processingYear}/${agent.processingMonth}/`
    });

    if (!files?.Contents?.length) {
        return { processed: 0, lastTimestamp: null };
    }

    // Filter by timestamp (skip already processed)
    const newFiles = files.Contents.filter(file => {
        if (!agent.lastProcessedTimestamp) return true;
        return file.LastModified > agent.lastProcessedTimestamp;
    });

    // Sort by timestamp (oldest first)
    newFiles.sort((a, b) => new Date(a.LastModified) - new Date(b.LastModified));

    // Limit to batch size
    const batch = newFiles.slice(0, agent.batchSize);

    let processed = 0;
    let lastTimestamp = agent.lastProcessedTimestamp;

    for (const file of batch) {
        try {
            // Parse folder structure: invoices/CompanyName-EIK/Year/Month/Type/
            const pathParts = file.Key.split('/');
            const companyFolder = pathParts[1]; // "CompanyName-123456789"
            const eik = companyFolder.split('-').pop();

            // Get file URL
            const fileUrl = await openkbs.kb({
                action: 'createPresignedURL',
                namespace: 'files',
                fileName: file.Key,
                fileType: 'image/jpeg',
                presignedOperation: 'getObject'
            });

            // Create chat for LLM processing
            await openkbs.chats({
                chatTitle: `Process: ${file.Key.split('/').pop()}`,
                message: JSON.stringify([
                    { type: "text", text: `PROCESS_DOCUMENT\nCompany EIK: ${eik}\nFile: ${file.Key}` },
                    { type: "image_url", image_url: { url: fileUrl } }
                ])
            });

            processed++;
            lastTimestamp = file.LastModified;

            // Early termination if approaching timeout
            if (processed >= agent.batchSize) {
                break;
            }

        } catch (e) {
            console.error(`Failed to process ${file.Key}:`, e.message);
            // Continue with next file
        }
    }

    return { processed, lastTimestamp };
}
```

## Agent State Management

```javascript
// Pause processing
async function pauseAgent() {
    const agent = await openkbs.getItem('agent');
    await openkbs.updateItem({
        itemType: 'agent',
        itemId: 'agent',
        body: {
            ...agent.item.body,
            processingStatus: 'PAUSED',
            lastUpdated: new Date().toISOString()
        }
    });
}

// Resume processing
async function resumeAgent() {
    const agent = await openkbs.getItem('agent');
    await openkbs.updateItem({
        itemType: 'agent',
        itemId: 'agent',
        body: {
            ...agent.item.body,
            processingStatus: 'RUNNING',
            lastUpdated: new Date().toISOString()
        }
    });
}

// Change processing period
async function setProcessingPeriod(year, month) {
    const agent = await openkbs.getItem('agent');
    await openkbs.updateItem({
        itemType: 'agent',
        itemId: 'agent',
        body: {
            ...agent.item.body,
            processingYear: String(year),
            processingMonth: String(month).padStart(2, '0'),
            lastProcessedTimestamp: null, // Reset for new period
            lastUpdated: new Date().toISOString()
        }
    });
}
```

## Frontend Status Display

```javascript
// In contentRender.js Header component
const AgentStatusBadge = () => {
    const [status, setStatus] = React.useState(null);

    React.useEffect(() => {
        const fetchStatus = async () => {
            try {
                const agent = await openkbs.items({ action: 'getItem', itemId: 'agent' });
                setStatus(agent?.item?.body);
            } catch (e) {}
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!status) return null;

    const isRunning = status.processingStatus === 'RUNNING';

    return (
        <div style={{
            padding: '4px 8px',
            borderRadius: '4px',
            background: isRunning ? '#4caf50' : '#ff9800',
            color: 'white',
            fontSize: '12px'
        }}>
            {isRunning ? '🟢 RUNNING' : '🟠 PAUSED'}
            <div style={{ fontSize: '10px' }}>
                {status.totalDocumentsProcessed} docs processed
            </div>
        </div>
    );
};
```

## instructions.txt (LLM prompt)

```
Batch Processing Commands:

Set processing period:
<setProcessingPeriod>{"year": 2025, "month": 1}</setProcessingPeriod>

Pause/resume:
<pauseAgent/>
<resumeAgent/>

Get status:
<getAgentStatus/>

Documents are processed automatically every minute when RUNNING.
Processing period determines which folder to scan.
```

## Key Points

1. **Timestamp deduplication** - `lastProcessedTimestamp` prevents reprocessing
2. **Batch limits** - Process max N files per run to avoid timeouts
3. **State persistence** - Agent config stored in `agent` item
4. **Folder structure** - Parse metadata from path (company, year, month)
5. **Early termination** - Stop when batch limit reached
6. **Error isolation** - One file failure doesn't stop the batch
7. **CRON_SCHEDULE** - Export handler property to set schedule
