#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const packageJson = require('./package.json');
const {
    fetchLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload, getUserProfile, getKB,
    fetchAndSaveSettings, downloadFiles, downloadIcon, pushSettings, uploadIcon, uploadFiles
} = require("./utils");

const jwtPath = path.join(os.homedir(), '.openkbs', 'clientJWT');

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
    .command('pull [targetFile]')
    .description('Pull app details and files using kbId from app/settings.json')
    .action(async (targetFile) => {
        try {
            targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

            console.log('Initiating Knowledge Base Synchronization...');
            const localKBData = await fetchLocalKBData();
            const { kbId } = localKBData;
            const { kbToken } = await fetchKBJWT(kbId);

            if (!targetFile) {
                await fetchAndSaveSettings(localKBData, kbId, kbToken);
                await downloadIcon(kbId);
                await downloadFiles(['functions', 'frontend'], kbId, kbToken);
                console.log('Synchronization Complete: All changes have been successfully pulled!');
            } else if (targetFile === 'settings.json') {
                await fetchAndSaveSettings(localKBData, kbId, kbToken);
            } else if (targetFile === 'icon.png') {
                await downloadIcon(kbId);
            } else {
                // Pull specific file if it exists in the list
                const fileDownloaded = await downloadFiles(['functions', 'frontend'], kbId, kbToken, targetFile);
                if (fileDownloaded) {
                    console.log(`File ${targetFile} synchronized successfully.`);
                } else {
                    console.error(`File ${targetFile} not found in the knowledge base.`);
                }
            }
        } catch (error) {
            console.error('Error during pull operation:', error.message);
        }
    });

program
    .command('push [targetFile]')
    .description('Push app details and files from settings.json and local files to update the KB.')
    .action(async (targetFile) => {
        try {
            targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

            console.log('Initiating Knowledge Base Update...');
            const localKBData = await fetchLocalKBData();
            const kbId = localKBData?.kbId;
            const { kbToken } = await fetchKBJWT(kbId);
            const KBData = await getKB(kbToken);

            if (!targetFile) {
                await pushSettings(localKBData, KBData, kbToken);
                await uploadIcon(kbId, kbToken);
                await uploadFiles(['functions', 'frontend'], kbId, kbToken);
                console.log('Knowledge Base Update Complete: All changes have been successfully pushed!');
            } else if (targetFile === 'settings.json') {
                await pushSettings(localKBData, KBData, kbToken);
                console.log('Configuration Settings Updated Successfully.');
            } else if (targetFile === 'icon.png') {
                await uploadIcon(kbId, kbToken);
                console.log('Icon Updated Successfully.');
            } else {
                const fileUploaded = await uploadFiles(['functions', 'frontend'], kbId, kbToken, targetFile);
                if (fileUploaded) {
                    console.log(`File ${targetFile} uploaded successfully.`);
                } else {
                    console.error(`File ${targetFile} not found in the local directory.`);
                }
            }
        } catch (error) {
            console.error('Error during push operation:', error.message);
        }
    });

program.parse(process.argv);