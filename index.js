#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const packageJson = require('./package.json');
const {
    makePostRequest, KB_API_URL, decryptKBFields, encrypt, fetchLocalKBData,
    saveLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload, getPresignedURL, downloadFile, walkDirectory,
    listFiles, downloadPublicFile, getUserProfile
} = require("./utils");

const jwtPath = path.join(os.homedir(), '.openkbs', 'clientJWT');

async function getKB(kbJWT) {
    try {
        const response = await makePostRequest(KB_API_URL, { token: kbJWT, action: 'getKB' });
        return response;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

const generateTransactionId = () => `${+new Date()}-${Math.floor(100000 + Math.random() * 900000)}`;

program
    .version(packageJson.version);

program
    .command('sign')
    .description('Signs a transaction.')
    .requiredOption('-a, --toAccountId <toAccountId>', 'Receiver account ID')
    .option('-e, --expires <expiresInSeconds>', 'Expiration time in seconds', '60')
    .option('-m, --maxAmount <maxAmount>', 'Maximum authorized charge', '300000')
    .option('-r, --resourceId <resourceId>', 'Resource ID', 'credits')
    .option('-p, --payload <payload>', 'Payload')
    .action(async (options) => {
        try {
            const userProfile = await getUserProfile();
            const publicKey = userProfile.walletPublicKey;
            const privateKey = userProfile.walletPrivateKey;
            const accountId = createAccountIdFromPublicKey(publicKey);

            if (!publicKey || !privateKey) {
                console.error('Public and private keys are required. Please login first.');
                process.exit(1);
            }

            let payload = {
                operation: "transfer",
                resourceId: "credits",
                transactionId: generateTransactionId(),
                fromAccountId: accountId,
                fromAccountPublicKey: publicKey,
                toAccountId: options.toAccountId,
                "message": "",
                "maxAmount": parseInt(options.maxAmount)
            };

            if (options.payload) {
                payload = JSON.parse(options.payload);
            }

            console.log(await signPayload(payload, accountId, publicKey, privateKey, parseInt(options.expires)));
        } catch (error) {
            console.error('Error:', error);
        }
    });

program
    .command('login')
    .description('Login to OpenKBS and store session locally.')
    .action(async () => {
        const app = express();
        const port = 38591;

        app.get('/capture-token', async (req, res) => {
            const { clientJWT } = req.query;
            if (clientJWT) {
                await fs.ensureDir(path.dirname(jwtPath));
                await fs.writeFile(jwtPath, clientJWT, 'utf8');
                res.send('ok');
                console.log('Login successful!');
                server.close();
            } else {
                res.send('failed');
                console.log('Login failed. No token received.');
            }
        });

        const server = app.listen(port, async () => {
            console.log(`Waiting to complete the login...`);
            const start = (process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' :
                    'xdg-open');

            exec(`${start} https://openkbs.com/signup?from_cli=1`);
        });
    });

program
    .command('pull')
    .description('Pull application details and files using kbId from app/settings.json.')
    .action(async () => {
        try {
            console.log('Initiating Knowledge Base Synchronization...');
            const localKBData = await fetchLocalKBData();
            const { kbId } = localKBData;
            const { kbToken } = await fetchKBJWT(kbId);

            const KBData = await getKB(kbToken);

            const {
                chatVendor, kbDescription, kbTitle, model, kbInstructions, inputTools,
                installation,
                itemTypes,
                embeddingModel, embeddingDimension, searchEngine
            } = decryptKBFields(KBData);

            const params = {
                ...localKBData,
                chatVendor,
                kbDescription,
                kbInstructions,
                kbTitle,
                model,
                inputTools,
                installation,
            }

            if (embeddingModel && embeddingDimension && searchEngine) {
                params.embeddingModel = embeddingModel;
                params.embeddingDimension = embeddingDimension;
                params.searchEngine = searchEngine;
            }

            if (itemTypes) params.itemTypes = itemTypes;

            await saveLocalKBData(params);

            console.log('Configuration Settings Fetched Successfully.');

            console.log(`Downloading: icon.png`);
            await downloadPublicFile(`https://file.openkbs.com/kb-image/${kbId}.png`, path.join(process.cwd(), 'icon.png'))

            // Now proceed to pull files
            const namespaces = ['functions', 'frontend'];
            for (const namespace of namespaces) {
                let localDir = path.join(process.cwd(), 'src');
                const files = await listFiles(namespace, kbId, kbToken);
                for (const file of files) {
                    const fileName = file?.Key?.split('/')?.slice(2)?.join('/');
                    const presignedURL = await getPresignedURL(namespace, kbId, fileName, 'getObject', kbToken);
                    const fileContent = await downloadFile(presignedURL);
                    const localFilePath = path.join(localDir, fileName);
                    await fs.ensureDir(path.dirname(localFilePath));
                    console.log(`Downloading: ${fileName}`);
                    await fs.writeFile(localFilePath, fileContent);
                }
            }

            console.log('Synchronization Complete: All changes have been successfully pulled!');
        } catch (error) {
            console.error('Error during pull operation:', error.message);
        }
    });

program
    .command('push')
    .description('Push application details and files from settings.json and local files to update the KB.')
    .action(async () => {
        try {
            console.log('Initiating Knowledge Base Update...');
            const {
                kbId, chatVendor, kbDescription, kbTitle, model, kbInstructions, inputTools, installation,
                itemTypes, embeddingModel, embeddingDimension, searchEngine
            } = await fetchLocalKBData();
            const { kbToken } = await fetchKBJWT(kbId);
            const KBData = await getKB(kbToken);

            // Read and encode the icon file
            const iconFile = await fs.readFile('./icon.png');
            const fileData = `data:image/png;base64,${iconFile.toString('base64')}`;

            const params = {
                fileData,
                token: kbToken,
                action: 'update',
                kbTitle: encrypt(kbTitle, KBData.key),
                kbDescription: encrypt(kbDescription, KBData.key),
                kbInstructions: encrypt(kbInstructions, KBData.key),
                inputTools,
                installation,
                chatVendor,
                model,
                pwaName: kbTitle
            };

            if (itemTypes) params.itemTypes = itemTypes;

            if (embeddingModel && embeddingDimension && searchEngine) {
                params.embeddingModel = embeddingModel
                params.embeddingDimension = embeddingDimension
                params.searchEngine = searchEngine
            }

            await makePostRequest(KB_API_URL, params);

            console.log('Configuration Settings Updated Successfully.');

            const localDir = path.join(process.cwd(), 'src');
            const files = await walkDirectory(localDir);

            for (const file of files) {
                const relativePath = path.relative(localDir, path.join(localDir, file)).replace(/\\/g, '/');
                const namespace = relativePath.startsWith('Frontend/') ? 'frontend' : 'functions';
                const presignedURL = await getPresignedURL(namespace, kbId, relativePath, 'putObject', kbToken);
                const fileContent = await fs.readFile(path.join(localDir, file));
                console.log(`Uploading: ${relativePath}`);
                await fetch(presignedURL, { method: 'PUT', body: fileContent });
            }

            console.log('Knowledge Base Update Complete: All changes have been successfully pushed!');
        } catch (error) {
            console.error('Error during push operation:', error.message);
        }
    });

program.parse(process.argv);