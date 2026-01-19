#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUCKET = 'openkbs-downloads';
const TEMPLATES_DIR = path.join(__dirname, '../templates');
const METADATA_PATH = path.join(TEMPLATES_DIR, '.claude/skills/openkbs/metadata.json');

function bumpVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
}

async function deployTemplates() {
    try {
        // Bump skill version
        const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
        const oldVersion = metadata.version;
        metadata.version = bumpVersion(oldVersion);
        fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2) + '\n');
        console.log(`Bumped skill version: ${oldVersion} -> ${metadata.version}`);

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