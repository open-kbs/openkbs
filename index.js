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
    fetchAndSaveSettings, downloadFiles, downloadIcon, updateKB, uploadFiles, generateKey, generateMnemonic,
    reset, bold, red, yellow, green, cyan, createKB, getClientJWT, saveLocalKBData, listKBs, deleteKBFile,
    deleteKB
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
                res.send('Login successful!');
                console.log('Login successful!');
                server.close();
            } else {
                res.send('Login failed. No token received.');
                console.log('Login failed. No token received.');
            }
        });

        const server = app.listen(port, async () => {
            console.log('Waiting to complete the login...');
            const start = (process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' :
                    'xdg-open');

            exec(`${start} https://openkbs.com/signup?from_cli=1`);
        });
    });

program
    .command('pull [targetFile]')
    .description('Pull KB app details and files using kbId from app/settings.json')
    .action(async (targetFile) => {
        try {
            targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

            console.log('Initiating Knowledge Base pull...');
            const localKBData = await fetchLocalKBData();
            const { kbId } = localKBData;
            const { kbToken } = await fetchKBJWT(kbId);

            if (!targetFile) {
                await fetchAndSaveSettings(localKBData, kbId, kbToken);
                await downloadIcon(kbId);
                await downloadFiles(['functions', 'frontend'], kbId, kbToken);
                console.log('Synchronization complete: All changes have been successfully downloaded!');
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
    .description('Push app details and files from settings.json and local files to update remote KB.')
    .action(async (targetFile) => {
        try {
            targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

            if (targetFile === 'icon.png') return console.error(`Try the following command instead:\n\nopenkbs push settings.json\n`);

            console.log('Initiating Knowledge Base push...');
            const localKBData = await fetchLocalKBData();
            const kbId = localKBData?.kbId;
            const res = await fetchKBJWT(kbId);

            if (!res?.kbToken) {
                console.log(`${bold}${red}KB app ${kbId} stored in settings.json does not exist on remote.${reset}`);
                console.log(`${bold}${yellow}Delete "kbId" key from settings.json and create a new KB using "openkbs create"${reset}`);
                return;
            }

            const kbToken = res?.kbToken
            const KBData = await getKB(kbToken);

            if (!targetFile) {
                await updateKB(localKBData, KBData, kbToken);
                await uploadFiles(['functions', 'frontend'], kbId, kbToken);
                console.log('Knowledge Base update complete: All changes have been successfully uploaded!');
            } else if (targetFile === 'settings.json') {
                await updateKB(localKBData, KBData, kbToken);
                console.log('Settings updated.');
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

program
    .command('clone <kbId>')
    .description('Clone existing KB app locally by provided kbId')
    .action(async (kbId) => {
        try {
            const localKBData = await fetchLocalKBData();

            if (localKBData?.kbId) {
                console.log(`${yellow}KB app ${green}${localKBData?.kbId}${reset}${yellow} already saved in settings.json.${reset}`);
                console.log(`${bold}${yellow}To pull the changes from OpenKBS remote use "openkbs pull"${reset}`);
                return;
            }

            console.log('Initiating Knowledge Base cloning...');
            const { kbToken } = await fetchKBJWT(kbId);
            if (!fs.existsSync('app')) fs.mkdirSync('app');
            await fetchAndSaveSettings({ kbId }, kbId, kbToken);
            await downloadIcon(kbId);
            await downloadFiles(['functions', 'frontend'], kbId, kbToken);
            console.log('Cloning complete!');
        } catch (error) {
            console.error('Error during clone operation:', error.message);
        }
    });

program
    .command('create app')
    .description('Create new KB app')
    .option('-s, --self-managed-keys', 'Enable self-managed keys mode')
    .action(async (options) => {
        try {
            const mnemonic = generateMnemonic(128);
            const AESKey = generateKey(mnemonic);

            if (options?.selfManagedKeys) {
                console.log(`${bold}${red}*** Please store the mnemonic phrase securely and create a backup. ***`);
                console.log(`${bold}${yellow}\nYour mnemonic phrase:${reset}`);
                console.log(`${green}\n${mnemonic}\n${reset}`);
                console.log(`${bold}${yellow}\nIMPORTANT SECURITY INFORMATION:${reset}`);
                console.log(`${yellow}\nAll KB instructions, chat messages, database entries, and user-related data are encrypted client-side using your AES-256 key and stored securely in OpenKBS utilizing zero-knowledge architecture. By choosing the --self-managed-keys option, you are responsible for managing your own keys. Loss of your mnemonic phrase will result in permanent inaccessibility to your encrypted content, as we implement full end-to-end encryption without key escrow. This cryptographic approach ensures data integrity and confidentiality, mitigating risks of unauthorized access or data breaches at the server level.\n${reset}`);
            }

            const localKBData = await fetchLocalKBData();

            if (localKBData?.kbId) {
                console.log(`${yellow}KB app ${green}${localKBData?.kbId}${reset}${yellow} saved in settings.json.${reset}`);
                console.log(`${bold}${yellow}To push the changes to OpenKBS remote use "openkbs push"${reset}`);
                return;
            }

            console.log('Initiating Knowledge Base creation...');
            const token = await getClientJWT();
            const {kbId} = await createKB(localKBData, AESKey, token, options?.selfManagedKeys)

            await saveLocalKBData({...localKBData, kbId});
            console.log(`KB app ${green}${kbId}${reset} created!`);
        } catch (error) {
            console.error(`${bold}${red}Error during create operation:${reset}`, error.message);
        }
    });

const app = program.command('app').description('Manage KB apps');

app.command('ls [kbId] [field]')
    .description('List all KB apps or show detailed information for a specific KB by providing kbId')
    .action(async (kbId, prop) => {
        try {
            const apps = await listKBs();
            if (kbId) {
                const app = apps.find(app => app.kbId === kbId);
                if (app) {
                    if (prop) {
                        if (app[prop] === undefined) return console.log('Non existing property ' + prop)
                        console.log(['string'].includes(typeof app[prop]) ? app[prop] : JSON.stringify(app[prop], null, 2));
                    } else {
                        console.log(JSON.stringify(app, null, 2));
                    }
                } else {
                    console.log(`KB app with ID ${kbId} not found.`);
                }
            } else {
                const maxTitleLength = Math.max(...apps.map(app => app.kbTitle.length));
                apps.forEach(app => {
                    const date = new Date(app.createdAt).toISOString().replace('T', ' ').replace(/\..+/, '');
                    const paddedTitle = app.kbTitle.padEnd(maxTitleLength, ' ');
                    console.log(`${date}  ${paddedTitle}  kbId: ${app.kbId}`);
                });
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

app.command('delete <kbId>')
    .description('Delete a KB app by providing kbId')
    .action(async (kbId) => {
        try {
            await deleteKB(kbId);
            console.log(`KB app with ID ${kbId} has been deleted.`);
        } catch (error) {
            console.error('Failed to delete KB');
        }
    });

app.command('delete-file <kbId> <filePath>')
    .description(`Delete a file inside the "src" folder by providing kbId and filePath (example: openkbs delete-file 1234567890ab Frontend/test.js)`)
    .action(async (kbId, filePath) => {
        try {
            const namespace = filePath.startsWith('Frontend/') ? 'frontend' : 'functions';
            await deleteKBFile(kbId, namespace, filePath);
            console.log(`File ${filePath} in KB app with ID ${kbId} has been deleted.`);
        } catch (error) {
            console.error('Failed to delete file!');
        }
    });

app
    .command('describe')
    .description('Display the current local KB Application details')
    .action(async () => {
        try {
            const localKBData = await fetchLocalKBData();
            const kbId = localKBData?.kbId;
            console.log(kbId ? JSON.stringify(localKBData, null, 2) :  'No Knowledge Base')
        } catch (error) {
            console.error('Error fetching the current Knowledge Base ID:', error.message);
        }
    });

program.parse(process.argv);