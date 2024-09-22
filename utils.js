const https = require('https');
const KB_API_URL = 'https://kb.openkbs.com/';
const AUTH_API_URL = 'https://auth.openkbs.com/';
const crypto = require('crypto');
const path = require("path");
const fs = require("fs-extra");
const os = require("os");

const decryptKBItem = (item, AESKey) => {
    if (item === undefined) return item;

    try {
        const decryptedItem = AESKey ? decrypt(item, AESKey) : item;
        // Check for the prefix and convert the value back to its original type
        if (decryptedItem.startsWith('__OPENKBS__NUM__')) return parseFloat(decryptedItem.replace('__OPENKBS__NUM__', ''));
        return decryptedItem;
    } catch (e) {
        // console.log('Unable to decryptKBItem', e.toString())
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
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 401) {
                    console.error('It appears you are not logged in. Please use "openkbs login" to log in.');
                    process.exit(1);
                }

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const data = JSON.parse(body);
                    resolve(data);
                } else {
                    console.error(`Request failed with status code ${res.statusCode}`);
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

async function fetchLocalKBData() {
    const settingsPath = path.join(process.cwd(), 'app', 'settings.json');
    const instructionsPath = path.join(process.cwd(), 'app', 'instructions.txt');

    if (!await fs.pathExists(settingsPath)) {
        console.error('settings.json file not found in app directory.');
        process.exit(1);
    }

    const settings = await fs.readJson(settingsPath);
    const kbId = settings?.kbId;
    const kbInstructions = await fs.readFile(instructionsPath, 'utf8');

    return {kbId, ...settings, kbInstructions}
}

async function getUserProfile() {
    try {
        const token = await fs.readFile(jwtPath, 'utf-8');
        return await makePostRequest(AUTH_API_URL + 'getUserProfile', { token });
    } catch (error) {
        console.error('API request error:', error);
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
    const token = await fs.readFile(jwtPath, 'utf-8');
    try {
        return await makePostRequest(AUTH_API_URL + 'fetchKBJWT', { token, kbId });
    } catch (error) {
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
        const response = await makePostRequest(KB_API_URL, { token: kbJWT, action: 'getKB' });
        return response;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
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
    console.log('Configuration Settings Fetched Successfully.');
}

async function downloadIcon(kbId) {
    console.log(`Downloading: icon.png`);
    await downloadPublicFile(`https://file.openkbs.com/kb-image/${kbId}.png`, path.join(process.cwd(), 'icon.png'));
}

async function downloadFiles(namespaces, kbId, kbToken, targetFile) {
    const localDir = path.join(process.cwd(), 'src');
    const filesMap = await buildFilesMap(namespaces, kbId, kbToken);
    let filesToDownload = [];

    if (targetFile) {
        if (filesMap[targetFile]) {
            filesToDownload.push({ ...filesMap[targetFile], fileName: targetFile });
        } else {
            return false; // File not found
        }
    } else {
        // No target file, download all files
        filesToDownload = Object.keys(filesMap).map(fileName => {
            return { ...filesMap[fileName], fileName };
        });
    }

    for (const { namespace, file, fileName } of filesToDownload) {
        const presignedURL = await getPresignedURL(namespace, kbId, fileName, 'getObject', kbToken);
        const fileContent = await downloadFile(presignedURL);
        const localFilePath = path.join(localDir, fileName);
        await fs.ensureDir(path.dirname(localFilePath));
        console.log(`Downloading: ${fileName}`);
        await fs.writeFile(localFilePath, fileContent);
    }
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

async function pushSettings(localKBData, KBData, kbToken) {
    const {
        kbId, chatVendor, kbDescription, kbTitle, model, kbInstructions, inputTools, installation,
        itemTypes, embeddingModel, embeddingDimension, searchEngine
    } = localKBData;

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
        params.embeddingModel = embeddingModel;
        params.embeddingDimension = embeddingDimension;
        params.searchEngine = searchEngine;
    }

    await makePostRequest(KB_API_URL, params);
}

async function uploadFiles(namespaces, kbId, kbToken, targetFile) {
    const localDir = path.join(process.cwd(), 'src');
    const filesMap = await buildLocalFilesMap(localDir, namespaces);
    let filesToUpload = [];

    if (targetFile) {
        if (filesMap[targetFile]) {
            filesToUpload.push({ ...filesMap[targetFile], fileName: targetFile });
        } else {
            return false; // File not found locally
        }
    } else {
        // No target file, upload all files
        filesToUpload = Object.keys(filesMap).map(fileName => {
            return { ...filesMap[fileName], fileName };
        });
    }

    for (const { namespace, filePath, fileName } of filesToUpload) {
        const presignedURL = await getPresignedURL(namespace, kbId, fileName, 'putObject', kbToken);
        const fileContent = await fs.readFile(filePath);
        console.log(`Uploading: ${fileName}`);
        await fetch(presignedURL, { method: 'PUT', body: fileContent });
    }
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



module.exports = {
    KB_API_URL, AUTH_API_URL, decryptKBFields, fetchLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload,
    listFiles, getUserProfile, getKB, fetchAndSaveSettings, downloadIcon, downloadFiles, pushSettings, uploadFiles
}