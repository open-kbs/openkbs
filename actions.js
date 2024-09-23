const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const {
    fetchLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload, getUserProfile, getKB,
    fetchAndSaveSettings, downloadFiles, downloadIcon, updateKB, uploadFiles, generateKey, generateMnemonic,
    reset, bold, red, yellow, green, cyan, createKB, getClientJWT, saveLocalKBData, listKBs, deleteKBFile,
    deleteKB
} = require("./utils");

const jwtPath = path.join(os.homedir(), '.openkbs', 'clientJWT');
const generateTransactionId = () => `${+new Date()}-${Math.floor(100000 + Math.random() * 900000)}`;

async function signAction(options) {
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
}

async function loginAction() {
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
}

async function pullAction(targetFile) {
    try {
        targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

        const localKBData = await fetchLocalKBData();
        const { kbId } = localKBData;
        console.log(`Initiating KB ${kbId} pull...`);
        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.log(`${red}KB ${kbId} does not exist on the remote service${reset} `);

        if (!targetFile) {
            await fetchAndSaveSettings(localKBData, kbId, res.kbToken);
            await downloadIcon(kbId);
            await downloadFiles(['functions', 'frontend'], kbId, res.kbToken);
            console.log('Synchronization complete: All changes have been successfully downloaded!');
        } else if (targetFile === 'settings.json') {
            await fetchAndSaveSettings(localKBData, kbId, res.kbToken);
        } else if (targetFile === 'icon.png') {
            await downloadIcon(kbId);
        } else {
            const fileDownloaded = await downloadFiles(['functions', 'frontend'], kbId, res.kbToken, targetFile);
            if (fileDownloaded) {
                console.log(`File ${targetFile} synchronized successfully.`);
            } else {
                console.error(`File ${targetFile} not found in the KB.`);
            }
        }
    } catch (error) {
        console.error('Error during pull operation:', error.message);
    }
}

async function pushAction(targetFile) {
    try {
        targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;

        if (targetFile === 'icon.png') return console.error(`Try the following command instead:\n\nopenkbs push settings.json\n`);

        const localKBData = await fetchLocalKBData();
        const kbId = localKBData?.kbId;
        console.log(`Initiating KB ${kbId} push...`);
        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.log(`${red}KB ${kbId} does not exist on the remote service${reset} `);
            
        const kbToken = res?.kbToken;
        const KBData = await getKB(kbToken);

        if (!targetFile) {
            await updateKB(localKBData, KBData, kbToken);
            await uploadFiles(['functions', 'frontend'], kbId, kbToken);
            console.log('KB update complete: All changes have been successfully uploaded!');
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
}

async function cloneAction(kbId) {
    try {
        const localKBData = await fetchLocalKBData();

        if (localKBData?.kbId) {
            console.log(`${yellow}KB ${green}${localKBData?.kbId}${reset}${yellow} already saved in settings.json.${reset}`);
            console.log(`${bold}${yellow}To pull the changes from OpenKBS remote use "openkbs pull"${reset}`);
            return;
        }

        console.log('Initiating KB cloning...');
        const { kbToken } = await fetchKBJWT(kbId);
        if (!fs.existsSync('app')) fs.mkdirSync('app');
        await fetchAndSaveSettings({ kbId }, kbId, kbToken);
        await downloadIcon(kbId);
        await downloadFiles(['functions', 'frontend'], kbId, kbToken);
        console.log('Cloning complete!');
    } catch (error) {
        console.error('Error during clone operation:', error.message);
    }
}

async function createKBAction(options) {
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
            console.log(`${yellow}KB ${green}${localKBData?.kbId}${reset}${yellow} saved in settings.json.${reset}`);
            console.log(`${bold}${yellow}To push the changes to OpenKBS remote use "openkbs push"${reset}`);
            return;
        }

        console.log('Initiating KB creation...');
        const token = await getClientJWT();
        const { kbId } = await createKB(localKBData, AESKey, token, options?.selfManagedKeys);

        await saveLocalKBData({ ...localKBData, kbId });
        console.log(`KB ${green}${kbId}${reset} created!`);
    } catch (error) {
        console.error(`${bold}${red}Error during create operation:${reset}`, error.message);
    }
}

async function lsAction(kbId, prop) {
    try {
        const apps = await listKBs();
        if (kbId) {
            const app = apps.find(app => app.kbId === kbId);
            if (app) {
                if (prop) {
                    if (app[prop] === undefined) return console.log('Non existing property ' + prop);
                    console.log(['string'].includes(typeof app[prop]) ? app[prop] : JSON.stringify(app[prop], null, 2));
                } else {
                    console.log(JSON.stringify(app, null, 2));
                }
            } else {
                console.log(`KB with ID ${kbId} not found.`);
            }
        } else {
            const maxTitleLength = Math.max(...apps.map(app => app.kbTitle.length));
            apps.forEach(app => {
                const date = new Date(app.createdAt).toISOString().replace('T', ' ').replace(/\..+/, '');
                const paddedTitle = app.kbTitle.padEnd(maxTitleLength, ' ');
                console.log(`${date}  ${paddedTitle}  ${app.kbId}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteKBAction(kbId) {
    try {
        await deleteKB(kbId);
        console.log(`KB with ID ${kbId} has been deleted.`);
    } catch (error) {
        console.error('Failed to delete KB');
    }
}

async function deleteFileAction(kbId, filePath) {
    try {
        const namespace = filePath.startsWith('Frontend/') ? 'frontend' : 'functions';
        await deleteKBFile(kbId, namespace, filePath);
        console.log(`File ${filePath} in KB with ID ${kbId} has been deleted.`);
    } catch (error) {
        console.error('Failed to delete file!');
    }
}

async function describeAction() {
    try {
        const localKBData = await fetchLocalKBData();
        const kbId = localKBData?.kbId;
        console.log(kbId ? JSON.stringify(localKBData, null, 2) : 'No KB found');
    } catch (error) {
        console.error('Error fetching the current KB ID:', error.message);
    }
}

module.exports = {
    signAction,
    loginAction,
    pullAction,
    pushAction,
    cloneAction,
    createKBAction,
    lsAction,
    deleteKBAction,
    deleteFileAction,
    describeAction
};