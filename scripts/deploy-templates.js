#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET = 'openkbs-downloads';
const TEMPLATES_DIR = path.join(__dirname, '../templates');

async function uploadDirectory(localPath, s3Prefix) {
    const items = await fs.readdir(localPath, { withFileTypes: true });
    
    for (const item of items) {
        const itemPath = path.join(localPath, item.name);
        const s3Key = `${s3Prefix}/${item.name}`;
        
        if (item.isDirectory()) {
            await uploadDirectory(itemPath, s3Key);
        } else {
            const fileContent = await fs.readFile(itemPath);
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                Body: fileContent
            }));
            console.log(`Uploaded: ${s3Key}`);
        }
    }
}

async function deployTemplates() {
    try {
        console.log('Deploying templates to S3...');
        await uploadDirectory(TEMPLATES_DIR, 'templates');
        console.log('Templates deployed successfully!');
    } catch (error) {
        console.error('Error deploying templates:', error);
        process.exit(1);
    }
}

deployTemplates();