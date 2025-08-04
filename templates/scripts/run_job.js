// This boilerplate code is a starting point for development.

const OpenKBSAgentClient = require('./utils/agent_client');

async function main() {
    const client = new OpenKBSAgentClient();

    if (process.argv[2] === 'init') return await client.init();

    const message = `Today's Date: ${new Date().toLocaleDateString()}

PROCESS_PRODUCT:
    Product Name: iPhone 14 Pro Max
    Product Code: MQ9X3RX/A
    ID: 97649
    
    find at least 2 images and 2 videos
`;

    try {
        const result = await client.runJob(message);
        console.log('Job completed:', result);
    } catch (error) {
        console.error('Job failed:', error.message);
    }
}

main();