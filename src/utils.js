const https = require('https');
const http = require('http');
const crypto = require('crypto');
const path = require("path");
const fs = require("fs-extra");
const os = require("os");
const { generateMnemonic } = require('bip39');
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { exec } = require('child_process');
const readline = require('readline');
const Spinner = require('cli-spinner').Spinner;

const TEMPLATE_DIR = path.join(__dirname, '../templates');

/**
 * Encrypts the given text using AES encryption with a passphrase.
 * This function mimics the CryptoJS.AES.encrypt function and is compatible with it.
 *
 * @param {string} text - The plaintext to encrypt.
 * @param {string} passphrase - The passphrase used for encryption.
 * @returns {string} The encrypted text, base64 encoded.
 */
function encrypt(text, passphrase) {
    const salt = crypto.randomBytes(8); // Generate an 8-byte salt
    const password = Buffer.from(passphrase, 'utf8');

    // Derive key and IV using the custom EVP key derivation function
    const { key, iv } = evpKDF(password, salt, 32, 16); // AES-256-CBC key size is 32 bytes, IV is 16 bytes

    // Perform AES encryption
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    // Prepend 'Salted__' and the salt to the encrypted data (mimics OpenSSL format used by CryptoJS)
    const encryptedData = Buffer.concat([Buffer.from('Salted__'), salt, encrypted]);

    // Return the base64-encoded encrypted data
    return encryptedData.toString('base64');
}

/**
 * Decrypts the given ciphertext using AES decryption with a passphrase.
 * This function mimics the CryptoJS.AES.decrypt function and is compatible with it.
 *
 * @param {string} ciphertext - The base64 encoded ciphertext to decrypt.
 * @param {string} passphrase - The passphrase used for decryption.
 * @returns {string} The decrypted plaintext.
 */
function decrypt(ciphertext, passphrase) {
    const input = Buffer.from(ciphertext, 'base64');
    const password = Buffer.from(passphrase, 'utf8');

    // Check for the 'Salted__' prefix
    if (input.slice(0, 8).toString('utf8') !== 'Salted__') {
        throw new Error('Unsupported encryption format');
    }

    // Extract salt and encrypted data
    const salt = input.slice(8, 16);
    const encrypted = input.slice(16);

    // Derive key and IV using the custom EVP key derivation function
    const { key, iv } = evpKDF(password, salt, 32, 16);

    // Perform AES decryption
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Return the decrypted plaintext
    return decrypted.toString('utf8');
}

/**
 * Key derivation function similar to OpenSSL's EVP_BytesToKey.
 * It uses MD5 hash iterations to derive the key and IV from the password and salt.
 */
function evpKDF(password, salt, keySize, ivSize) {
    let key = Buffer.alloc(0);
    let hash = Buffer.alloc(0);
    const totalSize = keySize + ivSize;

    while (key.length < totalSize) {
        hash = crypto.createHash('md5').update(Buffer.concat([hash, password, salt])).digest();
        key = Buffer.concat([key, hash]);
    }

    return {
        key: key.slice(0, keySize),
        iv: key.slice(keySize, totalSize),
    };
}

const reset = "\x1b[0m";
const bold = "\x1b[1m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const green = "\x1b[32m";
const cyan = "\x1b[36m";

console.red = (data) =>  console.log(`${red}${data}${reset}`)
console.green = (data) =>  console.log(`${green}${data}${reset}`)
console.yellow = (data) =>  console.log(`${yellow}${bold}${data}${reset}`)

const getS3Client = (location) => new S3Client({
    region: 'us-east-1',
    endpoint: location === 'localstack' ? 'http://localhost:4566' : undefined,
    forcePathStyle: true
});

const decryptKBItem = (item, AESKey) => {
    if (item === undefined) return item;

    try {
        const decryptedItem = AESKey ? decrypt(item, AESKey) : item;

        if (decryptedItem.startsWith('__OPENKBS__NUM__')) {
            return parseFloat(decryptedItem.replace('__OPENKBS__NUM__', ''));
        }
        return decryptedItem;
    } catch (e) {
        return item;
    }
};

const decryptKBFields = (kb) => {
    const data = {...kb};

    if (kb.kbTitle) data.kbTitle = decryptKBItem(kb.kbTitle, kb.key);
    if (kb.kbDescription) data.kbDescription = decryptKBItem(kb.kbDescription, kb.key);
    if (kb.kbInstructions) data.kbInstructions = decryptKBItem(kb.kbInstructions, kb.key);
    if (kb.OpenAIAPIKey) data.OpenAIAPIKey = decryptKBItem(kb.OpenAIAPIKey, kb.key);

    return data;
}

function makePostRequest(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const protocol = urlObj.protocol === 'http:' ? http : https;

        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 401) {
                    console.red(`It appears you are not logged in. Please use the command 'openkbs login' to log in.`);
                    process.exit(1);
                }

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = JSON.parse(body);
                    resolve(data);
                } else {
                    try {
                        if (JSON.parse(body).error) {
                            console.red(JSON.parse(body).error);
                        } else {
                            console.red(`Invalid Request`);
                        }
                    } catch (e) {
                        console.red(`Invalid Request`);
                    }

                    process.exit(1);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}

const KB_API_URL = 'https://kb.openkbs.com/';
const AUTH_API_URL = 'https://auth.openkbs.com/';
const CHAT_API_URL = 'https://chat.openkbs.com/';

async function fetchLocalKBData(params) {
    const settingsPath = path.join(process.cwd(), 'app', 'settings.json');
    const instructionsPath = path.join(process.cwd(), 'app', 'instructions.txt');

    if (!await fs.pathExists(settingsPath)) {
        if (params?.forceInit) {
            await initByTemplateAction({silent: true});
        } else {
            console.red('KB project not found in the current directory.');
            console.yellow('Use "openkbs init" to initialize a new KB project.');
            process.exit(1);
        }
    }

    const settings = await fs.readJson(settingsPath);
    const kbId = settings?.kbId;
    const kbInstructions = await fs.readFile(instructionsPath, 'utf8');

    return {kbId, ...settings, kbInstructions}
}

async function getClientJWT() {
    try {
        const jwtToken = await fs.readFile(jwtPath, 'utf-8');

        // Split the JWT into its parts
        const parts = jwtToken.split('.');

        // Decode the payload (second part of the JWT)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

        const currentTime = Math.floor(Date.now() / 1000);

        // Check if the token is expired
        if (payload.exp && payload.exp < currentTime) {
            console.red('Session expired. Please log in again using "openkbs login"');
            process.exit(1);
        }

        return jwtToken;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.red('Use "openkbs login" to log in to OpenKBS.');
            process.exit(1);
        } else {
            console.red('An error occurred while reading the JWT file');
            process.exit(1);
        }
    }
}

async function getUserProfile(token = null) {
    try {
        if (!token) token = await getClientJWT();
        return await makePostRequest(AUTH_API_URL + 'getUserProfile', { token });
    } catch (error) {
        console.red('API request error:', error);
        throw error;
    }
}

async function saveLocalKBData(data) {
    const {kbInstructions, ...settings} = data;
    const settingsPath = path.join(process.cwd(), 'app', 'settings.json');
    const instructionsPath = path.join(process.cwd(), 'app', 'instructions.txt');
    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    // Write kbInstructions to instructions.txt
    await fs.writeFile(instructionsPath, kbInstructions);
}

const jwtPath = path.join(os.homedir(), '.openkbs', 'clientJWT');

async function fetchKBJWT(kbId) {
    const token = await getClientJWT();
    try {
        return await makePostRequest(AUTH_API_URL + 'fetchKBJWT', { token, kbId });
    } catch (error) {
        console.error('Unable to fetch access token');
        process.exit(1);
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const spinner = new Spinner({
    text: '%s',
    spinnerString: '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
});

// Start the spinner
const startLoading = () => {
    spinner.setSpinnerString('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏');
    spinner.start();
};

// Stop the spinner
const stopLoading = () => {
    spinner.stop(true);
};

const getAllFiles = async dir => {
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        return (await Promise.all(items.map(item => {
            const mypath = path.join(dir, item.name);
            return item.isDirectory()
                ? getAllFiles(mypath)
                : mypath.match(/\.(js|jsx|ts|tsx|css|scss|html|json|txt)$/) ? mypath : [];
        }))).flat();
    } catch (error) {
        console.error(`Error reading ${dir}:`, error);
        return [];
    }
};

async function modifyKB(kbToken, kbData, prompt, files, options) {
    const { kbId, key } = kbData;
    const url = options?.chatURL || CHAT_API_URL;

    if (!files || files.length === 0) {
        try {
            const srcFiles = await getAllFiles('./src');
            const appFiles = await getAllFiles('./app');
            files = [...srcFiles, ...appFiles];
        } catch (error) {
            console.error('Error getting files from directories:', error);
        }
    }

    const fileContents = await Promise.all(files.map(async (filePath) => {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return { filePath, content };
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return { filePath, content: null };
        }
    }));

    try {
        const fileContentString = fileContents.map(file => `${file.filePath}\n---\n${file.content}`).join('\n\n\n');
        const { onRequestHandler, onResponseHandler, chatModel, instructions, verbose, preserveChat } = options;

        const payload = {
            operation: 'modify',
            token: kbToken,
            message: encrypt(prompt + '\n\n###\n\n' + fileContentString, key),
            chatTitle: 'modification request',
            encrypted: true,
            AESKey: key,
            ...(chatModel && { operationModel: chatModel }),
            ...(instructions && { operationInstructions: instructions }),
            ...(onRequestHandler && { operationRequestHandler: await fs.readFile(onRequestHandler, 'utf8') }),
            ...(onResponseHandler && { operationResponseHandler: await fs.readFile(onResponseHandler, 'utf8') })
        };

        startLoading();
        const createChat = await makePostRequest(url, payload);
        const { createdChatId } = createChat.find(o => o?.createdChatId);
        if (verbose) {
            console.log('\nModification Chat Created:\n', createChat);
            console.log(`Modification chat ${createdChatId} created`);
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const getUserInput = async (query) => {
            stopLoading();
            const answer = await new Promise(resolve => rl.question(query, resolve));
            startLoading();
            return answer;
        };

        const sendMessage = async (message) => {
            return makePostRequest(url, {
                rootToken: kbToken,
                message: encrypt(message, key),
                chatId: createdChatId,
                encrypted: true,
                AESKey: key
            });
        };

        let lastProcessedAssistantMsgId = '';

        while (true) {
            const chatMessages = await makePostRequest(url, {
                action: 'getChatMessages',
                token: kbToken,
                chatId: createdChatId
            });

            const decryptedMessages = chatMessages?.data?.messages?.map(o => ({
                ...o,
                content: decryptKBItem(o?.content, key)
            }));

            const newAssistantMessage = decryptedMessages.findLast(message =>
                message.role === 'assistant' && message?.msgId > lastProcessedAssistantMsgId
            );

            if (newAssistantMessage?.content) {
                lastProcessedAssistantMsgId = newAssistantMessage?.msgId;
                const batchRegex = /(?:createModifyFile\s+(?<fileName>[^\s]+)\s*###(?<language>\w+)\s*(?<content>[\s\S]*?)###|\/?(?<actionType>metaResponse|modificationCompleted|modificationFailed|[a-zA-Z]{3,30})\((?<actionParams>[^()]*)\))/g;
                const blocks = Array.from(newAssistantMessage.content.matchAll(batchRegex), match => match.groups);

                const showResponse = () => {
                    console.green('\nAssistant:\n');
                    console.green(newAssistantMessage?.content);
                };

                if (!blocks?.length) {
                    showResponse();
                    await sendMessage(await getUserInput('\nYou: '));
                    continue;
                }

                for (const block of blocks) {
                    if (['modificationCompleted', 'modificationFailed'].includes(block?.actionType)) {
                        if (!preserveChat) await makePostRequest(url, {
                            action: 'deleteChat',
                            token: kbToken,
                            chatId: createdChatId
                        });

                        stopLoading();
                        if (verbose) console.log('\nMessages:\n', decryptedMessages);
                        console.log({ actionType: block.actionType, actionParams: JSON.parse(block.actionParams) });
                        process.exit(0);
                    } else if (block?.actionType === 'metaResponse' && block?.actionParams === 'execute_and_wait') {
                        showResponse();
                        await sendMessage(await getUserInput('\nYou: '));
                    } else if (block?.fileName && block?.content && blocks?.find(o => o?.actionType === 'modificationCompleted')) {
                        await fs.outputFile(block.fileName, block.content);
                        console.log(`File written: ${block.fileName}`);
                    }
                }
            }
            await sleep(1000);
        }
    } catch (error) {
        console.log(error);
        console.error('Unable to fetch access token');
        process.exit(1);
    }
}

function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function arrayBufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

function base64urlEncode(str) {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function createAccountIdFromPublicKey(publicKeyBase64) {
    return crypto.createHash('sha256').update(publicKeyBase64).digest('hex').substring(0, 32);
}

async function signPayload(payload, accountId, publicKey, privateKey, expiresInSeconds = 60) {
    const encoder = new TextEncoder();
    if (createAccountIdFromPublicKey(publicKey) !== accountId) throw 'Public key does not belong to this accountId ';

    const header = { alg: 'ES256', typ: 'JWT' };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify({ ...payload, exp: (Math.floor(Date.now() / 1000) + expiresInSeconds) }));

    const ecPrivateKey = await crypto.subtle.importKey(
        'pkcs8',
        str2ab(Buffer.from(privateKey, 'base64').toString('binary')),
        {
            name: 'ECDSA',
            namedCurve: 'P-256',
        },
        false,
        ['sign']
    );

    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);

    const signature = await crypto.subtle.sign(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' },
        },
        ecPrivateKey,
        data
    );

    const encodedSignature = base64urlEncode(arrayBufferToString(signature));

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

const buildPackage = async (namespace, kbId, moduleName) => {
    const token = await getClientJWT();

    return await makePostRequest('https://kb.openkbs.com/', {
        token,
        kbId,
        namespace,
        moduleName,
        action:  namespace === 'frontend' ? 'buildWebpackPackage' : 'buildNodePackage'
    });
}

// Helper functions
async function listFiles(namespace, kbId, kbJWT) {
    const response = await makePostRequest('https://kb.openkbs.com/', {
        token: kbJWT,
        namespace,
        kbId,
        action: 'listFiles',
    });

    if (response.error) {
        throw new Error(response.error);
    }

    return response; // Assuming response contains a 'files' array
}

async function getPresignedURL(namespace, kbId, fileName, presignedOperation, kbJWT) {

    const response = await makePostRequest('https://kb.openkbs.com/', {
        token: kbJWT,
        namespace,
        kbId,
        fileName,
        presignedOperation,
        action: 'createPresignedURL',
    });

    if (response.error) {
        throw new Error(response.error);
    }

    return response
}

async function downloadPublicFile(fromUrl, localImagePath) {
    const response = await fetch(fromUrl);
    if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(localImagePath, buffer);
}

async function downloadFile(urlStr) {
    try {
        const response = await fetch(urlStr);
        if (!response.ok) throw new Error(`Failed to download file. Status code: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        throw error;
    }
}

async function walkDirectory(dir) {
    let files = [];
    const baseDir = path.join(process.cwd(), 'src');

    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files = files.concat(await walkDirectory(fullPath, baseDir));
        } else {
            const relativePath = path.relative(baseDir, fullPath);
            files.push(`./${relativePath}`);
        }
    }

    return files;
}

async function getKB(kbJWT) {
    try {
        return await makePostRequest(KB_API_URL, { token: kbJWT, action: 'getKB' });
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

async function listKBs() {
    try {
        const clientJWT = await getClientJWT();
        const encryptedKBData = await makePostRequest(KB_API_URL, { token: clientJWT, action: 'list' });
        return encryptedKBData.map(KBData => decryptKBFields(KBData))
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// this is how the path looks like ${namespace}/${kbId}/${fileName}
// namespace is "frontend" for filePaths that starts with (Frontend/*) - example: Frontend/path/toSomeFileName.ext
// namespace is "functions" for any other filePaths
const deleteKBFile = async (kbId, namespace, filePath) => {
    const { kbToken } = await fetchKBJWT(kbId);

    const apiPayload = {
        token: kbToken,
        namespace,
        action: 'deleteKBFile',
        fileName: filePath,
    };

    return await makePostRequest(KB_API_URL, apiPayload);
}

async function deleteKB(kbId) {
    try {
        const clientJWT = await getClientJWT();
        return await makePostRequest(KB_API_URL, { token: clientJWT, kbId, action: 'delete' });
    } catch (error) {
        console.error('Failed to delete KB');
    }
}

async function fetchAndSaveSettings(localKBData, kbId, kbToken) {
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
    console.log(`Downloading: app/settings.json`);
    console.log(`Downloading: app/instructions.txt`);
}

async function downloadIcon(kbId) {
    console.log(`Downloading: app/icon.png`);
    await downloadPublicFile(`https://file.openkbs.com/kb-image/${kbId}.png`, path.join(process.cwd(), 'app' ,'icon.png'));
}

async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function downloadFiles(namespaces, kbId, kbToken, location = 'origin', targetFile, dist = false) {
    const baseDir = dist ? path.join(process.cwd(), 'cache') : path.join(process.cwd(), 'src');
    const filesMap = await buildFilesMap(namespaces, kbId, kbToken);
    let filesToDownload = [];

    if (targetFile) {
        const isDistFile = targetFile.startsWith('Events/dist') || targetFile.startsWith('Frontend/dist');
        if (filesMap[targetFile] && ((dist && isDistFile) || (!dist && !isDistFile))) {
            filesToDownload.push({ ...filesMap[targetFile], fileName: targetFile });
        } else {
            return false; // File not found or not in the correct folder
        }
    } else {
        filesToDownload = Object.keys(filesMap).filter(fileName => {
            const isDistFile = fileName.startsWith('Events/dist') || fileName.startsWith('Frontend/dist');
            return dist ? isDistFile : !isDistFile;
        }).map(fileName => {
            return { ...filesMap[fileName], fileName };
        });
    }

    await Promise.all(filesToDownload.map(async ({ namespace, file, fileName }) => {
        let fileContent;
        if (location === 'origin') {
            const presignedURL = await getPresignedURL(namespace, kbId, fileName, 'getObject', kbToken);
            fileContent = await downloadFile(presignedURL);
        } else {
            const response = await getS3Client(location).send(new GetObjectCommand({
                Bucket: 'openkbs-files',
                Key: `${namespace}/${kbId}/${fileName}`
            }));

            fileContent = await streamToBuffer(response.Body);
        }

        const localFilePath = path.join(baseDir, fileName);
        await fs.ensureDir(path.dirname(localFilePath));
        console.log(`Downloading: src/${fileName}`);
        await fs.writeFile(localFilePath, fileContent);
    }));

    return true; // Files downloaded successfully
}

async function buildFilesMap(namespaces, kbId, kbToken) {
    const filesMap = {};
    for (const namespace of namespaces) {
        const files = await listFiles(namespace, kbId, kbToken);
        for (const file of files) {
            const fileName = file?.Key?.split('/')?.slice(2)?.join('/'); // Relative file name
            filesMap[fileName] = { namespace, file };
        }
    }
    return filesMap;
}

async function createKB(localKBData, AESKey, isSelfManagedKey = false) {
    const {
        kbId, chatVendor, kbDescription, kbTitle, model, kbInstructions, inputTools, installation,
        itemTypes, embeddingModel, embeddingDimension, searchEngine
    } = localKBData;

    const token = await getClientJWT();
    const userProfile = await getUserProfile(token)
    const accountId = userProfile.accountId;

    const encryptedWalletPrivateKey = encrypt(userProfile.walletPrivateKey, AESKey);
    const walletPublicKey = userProfile.walletPublicKey;

    if (!await fs.pathExists('./app/icon.png')) {
        console.red('app/icon.png not found');
        process.exit(1);
    }

    const iconFile = await fs.readFile('./app/icon.png');
    const fileData = `data:image/png;base64,${iconFile.toString('base64')}`;

    const params = {
        fileData,
        token,
        action: 'create',
        kbTitle: encrypt(kbTitle, AESKey),
        kbDescription: encrypt(kbDescription, AESKey),
        kbInstructions: encrypt(kbInstructions, AESKey),
        inputTools,
        installation,
        chatVendor,
        model,
        accountId: accountId,
        walletPublicKey: walletPublicKey,
        walletPrivateKey: encryptedWalletPrivateKey,
        pwaName: kbTitle
    }

    if (!isSelfManagedKey) params.key = AESKey;

    if (itemTypes) params.itemTypes = itemTypes;

    if (embeddingModel !== undefined && embeddingDimension !== undefined && searchEngine !== undefined) {
        params.embeddingModel = embeddingModel;
        params.embeddingDimension = embeddingDimension;
        params.searchEngine = searchEngine;
    }

    return await makePostRequest(KB_API_URL, params);
}

async function updateKB(localKBData, KBData, kbToken, withIcon = true) {
    const {
        kbId, chatVendor, kbDescription, kbTitle, model, kbInstructions, inputTools, installation,
        itemTypes, embeddingModel, embeddingDimension, searchEngine
    } = localKBData;

    // Read and encode the icon file
    const iconFile = await fs.readFile('./app/icon.png');
    const fileData = `data:image/png;base64,${iconFile.toString('base64')}`;

    const params = {
        fileData: withIcon ? fileData : undefined,
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

    if (embeddingModel !== undefined && embeddingDimension !== undefined && searchEngine !== undefined) {
        params.embeddingModel = embeddingModel;
        params.embeddingDimension = embeddingDimension;
        params.searchEngine = searchEngine;
    }

    await makePostRequest(KB_API_URL, params);
}

const executeCommand = async (command) => {
    return new Promise((resolve, reject) => {
        const childProcess = exec(command, { env: process.env, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });

        childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        childProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
    });
};

const uploadDirectoryToS3 = async (directory, bucket, prefix, location) => {
    const files = await fs.readdir(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const fileKey = path.join(prefix, file);
        const fileContent = await fs.readFile(filePath);

        await getS3Client(location).send(new PutObjectCommand({
            Bucket: bucket,
            Key: fileKey,
            Body: fileContent
        }));
    }
};


const defaultNodeJson = `
{
  "dependencies": {
  
  }
}`;

const buildNodePackage = async (namespace, kbId, moduleName, location, originalDir) => {
    const safeFolder = 'Events';
    const srcDir = path.join(originalDir, 'src', safeFolder);

    // Secure moduleNames
    if (!['onRequest', 'onResponse', 'onAddMessages'].includes(moduleName)) return;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-'));
    process.chdir(tempDir);

    let combinedOutput = '';

    // Copy the .js file from the local directory
    combinedOutput += `\nProcess: ${moduleName}.js\n`;
    await fs.copyFile(path.join(srcDir, `${moduleName}.js`), path.join(tempDir, `${moduleName}.js`));

    // Check if the .json file exists, if not, create it using the default template
    const jsonFilePath = path.join(srcDir, `${moduleName}.json`);
    const packageJsonPath = path.join(tempDir, 'package.json');
    try {
        await fs.access(jsonFilePath);
        await fs.copyFile(jsonFilePath, packageJsonPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, create it using the default template
            await fs.writeFile(packageJsonPath, defaultNodeJson);
        } else {
            throw error;
        }
    }

    const packageJsonOutput = await executeCommand('cat package.json');
    combinedOutput += packageJsonOutput.stdout;
    combinedOutput += packageJsonOutput.stderr;
    // Copy all other files in the directory
    const files = await fs.readdir(srcDir);
    for (const file of files) {
        if (![`${moduleName}.js`, `${moduleName}.json`].includes(file) && !file.includes('dist/')) {
            combinedOutput += `\nProcess: ${file}\n`;
            await fs.copyFile(path.join(srcDir, file), path.join(tempDir, file));
        } else {
            combinedOutput += `\nSkip: ${file}\n`;
        }
    }

    // Install npm packages and run webpack
    combinedOutput += `\nnpm install\n`;
    const npmInstallOutput = await executeCommand('npm install');

    combinedOutput += `\nbuilding:\n`;
    const nccOutput = await executeCommand(`${originalDir}/node_modules/@vercel/ncc/dist/ncc/cli.js build ${moduleName}.js -o ${moduleName}`);
    combinedOutput += npmInstallOutput.stdout + npmInstallOutput.stderr + nccOutput.stdout + nccOutput.stderr;

    // Ensure the dist directory is clean before uploading
    const distDir = path.join(tempDir, moduleName);

    // Upload the dist directory back to S3
    combinedOutput += `\nDeploy dist folder\n`;
    const res = await uploadDirectoryToS3(distDir, 'openkbs-files', `${namespace}/${kbId}/Events/dist/${moduleName}`, location);

    // Clean up the temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return combinedOutput;
};


async function uploadFiles(namespaces, kbId, kbToken, location = 'origin', targetFile, dist = false) {
    const localDir = dist ? path.join(process.cwd(), 'cache') : path.join(process.cwd(), 'src');
    const filesMap = await buildLocalFilesMap(localDir, namespaces);
    let filesToUpload = [];

    if (targetFile) {
        const isDistFile = targetFile.startsWith('Events/dist') || targetFile.startsWith('Frontend/dist');
        if (filesMap[targetFile] && ((dist && isDistFile) || (!dist && !isDistFile))) {
            filesToUpload.push({ ...filesMap[targetFile], fileName: targetFile });
        } else {
            return false; // File not found locally or not in the correct folder
        }
    } else {
        // No target file, upload all files based on the dist parameter
        filesToUpload = Object.keys(filesMap).filter(fileName => {
            const isDistFile = fileName.startsWith('Events/dist') || fileName.startsWith('Frontend/dist');
            return dist ? isDistFile : !isDistFile;
        }).map(fileName => {
            return { ...filesMap[fileName], fileName };
        });
    }

    const uploadPromises = filesToUpload.map(async ({ namespace, filePath, fileName }) => {
        const fileContent = await fs.readFile(filePath);
        console.log(`Uploading: ${fileName}`);
        if (location === 'origin') {
            const presignedURL = await getPresignedURL(namespace, kbId, fileName, 'putObject', kbToken);
            await fetch(presignedURL, { method: 'PUT', body: fileContent });
        } else {
            await getS3Client(location).send(new PutObjectCommand({
                Bucket: 'openkbs-files',
                Key: `${namespace}/${kbId}/${fileName}`,
                Body: fileContent
            }));
        }
    });

    await Promise.all(uploadPromises);
    return true; // Files uploaded successfully
}

async function buildLocalFilesMap(localDir, namespaces) {
    const filesMap = {};
    const files = await walkDirectory(localDir);
    for (const file of files) {
        const filePath = path.join(localDir, file);
        const relativePath = path.relative(localDir, filePath).replace(/\\/g, '/');
        const namespace = relativePath.startsWith('frontend/') || relativePath.startsWith('Frontend/') ? 'frontend' : 'functions';
        if (namespaces.includes(namespace)) {
            filesMap[relativePath] = { namespace, filePath };
        }
    }
    return filesMap;
}

const generateKey = (passphrase) => {
    const salt = 'salt';
    const iterations = 1000;
    const keySize = 32;
    const digest = 'sha256';
    const passphraseBuffer = Buffer.from(passphrase, 'latin1');
    const saltBuffer = Buffer.from(salt, 'latin1');
    const key = crypto.pbkdf2Sync(passphraseBuffer, saltBuffer, iterations, keySize, digest);
    return key.toString('hex');
};

const replacePlaceholderInFiles = (dir, name) => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            replacePlaceholderInFiles(filePath, name);
        } else if (stat.isFile()) {
            let content = fs.readFileSync(filePath, 'utf8');

            if (content.includes('{{{openkbsAppName}}}')) {
                content = content.replace(/{{{openkbsAppName}}}/g, name);
                fs.writeFileSync(filePath, content, 'utf8');
            }
        }
    })
}

async function initByTemplateAction(params) {
    try {
        const targetDir = process.cwd();

        // Copy all files and folders, skipping existing ones
        fs.readdirSync(TEMPLATE_DIR).forEach(item => {
            const srcPath = path.join(TEMPLATE_DIR, item);
            const destPath = path.join(targetDir, item);

            if (fs.existsSync(destPath)) {
                if (!params?.silent) console.log(`Skipping existing item: ${item}`);
            } else {
                fs.copySync(srcPath, destPath);
                if (!params?.silent) console.log(`Copied: ${item}`);
            }
        });
    } catch (error) {
        console.red(`Error during create operation:`, error.message);
    }
}

module.exports = {
    KB_API_URL, AUTH_API_URL, decryptKBFields, fetchLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload,
    listFiles, getUserProfile, getKB, fetchAndSaveSettings, downloadIcon, downloadFiles, updateKB, uploadFiles, generateKey,
    generateMnemonic, reset, bold, red, yellow, green, cyan, createKB, getClientJWT, saveLocalKBData, listKBs, deleteKBFile,
    deleteKB, buildPackage, replacePlaceholderInFiles, buildNodePackage, initByTemplateAction, modifyKB
}