#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const BUCKET = 'openkbs-downloads';
const TEMPLATES_DIR = path.join(__dirname, '../templates');

async function deployTemplates() {
    try {
        console.log('Syncing templates to S3...');
        
        const syncCommand = `aws s3 sync "${TEMPLATES_DIR}" s3://${BUCKET}/templates --delete`;
        execSync(syncCommand, { stdio: 'inherit' });
        
        console.log('Templates synced successfully!');
    } catch (error) {
        console.error('Error syncing templates:', error);
        process.exit(1);
    }
}

deployTemplates();