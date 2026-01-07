const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');
const { exec, execSync } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
    fetchLocalKBData, fetchKBJWT, createAccountIdFromPublicKey, signPayload, getUserProfile, getKB,
    fetchAndSaveSettings, downloadFiles, downloadIcon, updateKB, uploadFiles, generateKey, generateMnemonic,
    reset, bold, red, yellow, green, createKB, saveLocalKBData, listKBs, deleteKBFile,
    deleteKB, buildPackage, replacePlaceholderInFiles, buildNodePackage, initByTemplateAction, modifyKB,
    listKBsSharedWithMe, downloadTemplates, KB_API_URL, makePostRequest
} = require("./utils");

const TEMPLATE_DIR = path.join(os.homedir(), '.openkbs', 'templates');
const jwtPath = path.join(os.homedir(), '.openkbs', 'clientJWT');
const generateTransactionId = () => `${+new Date()}-${Math.floor(100000 + Math.random() * 900000)}`;

// Service registry for OpenKBS AI services (image generation)
const SERVICES = {
    // Short aliases (recommended)
    "gpt-image": { accountId: "e69424d275873af94993240df041ed78", model: "gpt-image-1" },
    "gemini-image": { accountId: "bc7ab06216fa2bf6db5d8e573d4d2415", model: "gemini-2.5-flash-image" },
    // Full names
    "gpt-image-1": { accountId: "e69424d275873af94993240df041ed78", model: "gpt-image-1" },
    "gemini-2.5-flash-image": { accountId: "bc7ab06216fa2bf6db5d8e573d4d2415", model: "gemini-2.5-flash-image" }
};

/**
 * Find settings from settings.json - checks current dir, then functions/ or site/ subdirs
 * Returns full settings object with kbId, region, etc.
 */
function findSettings() {
    const paths = [
        path.join(process.cwd(), 'settings.json'),
        path.join(process.cwd(), 'app', 'settings.json'),
        path.join(process.cwd(), 'functions', 'settings.json'),
        path.join(process.cwd(), 'site', 'settings.json')
    ];

    for (const settingsPath of paths) {
        if (fs.existsSync(settingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.kbId) return settings;
            } catch (e) {}
        }
    }
    return null;
}

/**
 * Find kbId from settings.json - checks current dir, then functions/ or site/ subdirs
 */
function findKbId() {
    const settings = findSettings();
    return settings?.kbId || null;
}

/**
 * Find region from settings.json - checks current dir, then functions/ or site/ subdirs
 * Default: 'us-east-1'
 */
function findRegion() {
    const settings = findSettings();
    return settings?.region || 'us-east-1';
}

// MIME types for common file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Read JSON payload from --data option or stdin
 */
async function getPayloadFromInput(dataOption) {
    if (dataOption) {
        return JSON.parse(dataOption);
    }

    // Read from stdin if not a TTY
    if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString('utf8').trim();
        if (input) {
            return JSON.parse(input);
        }
    }

    throw new Error('No payload provided. Use --data or pipe JSON to stdin.');
}

/**
 * Call OpenKBS AI services directly with transactionJWT
 */
async function serviceAction(options) {
    try {
        // 1. Get and validate payload
        let payload;
        try {
            payload = await getPayloadFromInput(options.data);
        } catch (e) {
            console.red(`Error parsing payload: ${e.message}`);
            process.exit(1);
        }

        // 2. Validate model
        const model = options.model;
        if (!SERVICES[model]) {
            console.red(`Unknown model: ${model}`);
            console.log(`Available models: ${Object.keys(SERVICES).join(', ')}`);
            process.exit(1);
        }

        // 3. Add model to payload if not present (use actual model name from registry)
        if (!payload.model) {
            payload.model = SERVICES[model].model;
        }

        // 4. Get user profile and generate transactionJWT
        const userProfile = await getUserProfile();
        const publicKey = userProfile.walletPublicKey;
        const privateKey = userProfile.walletPrivateKey;
        const accountId = createAccountIdFromPublicKey(publicKey);

        if (!publicKey || !privateKey) {
            console.red('Wallet keys not found. Please login first with: openkbs login');
            process.exit(1);
        }

        const txPayload = {
            operation: "transfer",
            resourceId: "credits",
            transactionId: generateTransactionId(),
            fromAccountId: accountId,
            fromAccountPublicKey: publicKey,
            toAccountId: SERVICES[model].accountId,
            message: "",
            maxAmount: parseInt(options.maxAmount || '300000'),
            iat: Math.floor(Date.now() / 1000)
        };

        // Create private key object for jwt.sign()
        const privateKeyObj = crypto.createPrivateKey({
            key: Buffer.from(privateKey, 'base64'),
            format: 'der',
            type: 'pkcs8'
        });

        const transactionJWT = jwt.sign(txPayload, privateKeyObj, {
            algorithm: 'ES256',
            expiresIn: 60
        });

        // 5. Make POST request to openai.openkbs.com
        const response = await fetch('https://openai.openkbs.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'transaction-jwt': transactionJWT
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 6. Handle errors
        if (!response.ok) {
            if (response.status === 498) {
                console.red('Invalid service transaction');
            } else if (response.status === 499) {
                console.red('Insufficient credits. Check your balance at https://openkbs.com');
            } else {
                console.red(`Service error (${response.status}): ${JSON.stringify(data)}`);
            }
            process.exit(1);
        }

        // 7. Handle image output - save to file if -o specified
        // Support both {data:[{b64_json}]} and [{b64_json}] formats
        const imageData = data?.data?.[0]?.b64_json || data?.[0]?.b64_json;
        if (options.output && imageData) {
            const buffer = Buffer.from(imageData, 'base64');
            const outputPath = path.resolve(options.output);

            // Ensure directory exists
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, buffer);

            console.green(`Image saved: ${outputPath}`);
            console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
            return;
        }

        // 8. Output response as JSON (for non-image or no -o flag)
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.red(`Error: ${error.message}`);
        process.exit(1);
    }
}

async function signAction(options) {
    try {
        const userProfile = await getUserProfile();
        const publicKey = userProfile.walletPublicKey;
        const privateKey = userProfile.walletPrivateKey;
        const accountId = createAccountIdFromPublicKey(publicKey);

        if (!publicKey || !privateKey) {
            console.red('Public and private keys are required. Please login first.');
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
        console.red('Error:', error);
    }
}

async function logoutAction() {
    try {
        await fs.access(jwtPath);
        await fs.unlink(jwtPath);
        console.log('Logout successful. JWT file deleted.');
    } catch (error) {
        console.warn('You are already logged out. No session file found.');
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
            console.green('Login successful!');
            server.close();
        } else {
            res.send('Login failed. No token received.');
            console.red('Login failed. No token received.');
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

async function pullAction(location = 'origin', targetFile) {
    try {
        // Remove './' prefix if present
        targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;
        // Remove 'src/' prefix if present
        targetFile = targetFile && targetFile.startsWith('src/') ? targetFile.slice(4) : targetFile;

        const localKBData = await fetchLocalKBData();
        const { kbId } = localKBData;
        if (!kbId) return console.red('No KB found. Please push the KB first using the command "openkbs push".');

        console.log(`Initiating KB ${kbId} download...`);
        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.red(`KB ${kbId} does not exist on the remote service`);

        if (location === 'cache') {
            await downloadFiles(['functions', 'frontend'], kbId, res.kbToken, location, targetFile, true);
            return console.green('Dist files downloaded!');
        }

         if (!targetFile) {
            await fetchAndSaveSettings(localKBData, kbId, res.kbToken);
            await downloadIcon(kbId);
            await downloadFiles(['functions', 'frontend'], kbId, res.kbToken, location, targetFile);
            console.green('Synchronization complete: All changes have been successfully downloaded!');
        } else if (targetFile === 'app/settings.json' || targetFile === 'app/instructions.txt') {
            await fetchAndSaveSettings(localKBData, kbId, res.kbToken);
        } else if (targetFile === 'app/icon.png') {
            await downloadIcon(kbId);
        } else {
            const fileDownloaded = await downloadFiles(['functions', 'frontend'], kbId, res.kbToken, location, targetFile);
            if (fileDownloaded) {
                console.green(`File ${targetFile} synchronized successfully.`);
            } else {
                console.red(`Invalid path ${targetFile}`);
            }
        }
    } catch (error) {
        console.error('Error during pull operation:', error.message);
    }
}

function isModulePresent(moduleName) {
    const eventPath = path.join(process.cwd(), 'src', 'Events', `${moduleName}.js`);
    const frontendPath = path.join(process.cwd(), 'src', 'Frontend', `${moduleName}.js`);
    return fs.existsSync(eventPath) || fs.existsSync(frontendPath);
}

async function deployAction(moduleName) {
    const validModules = ['contentRender', 'onRequest', 'onResponse', 'onAddMessages', 'onPublicAPIRequest', 'onCronjob'];

    if (moduleName && !validModules.includes(moduleName)) {
        return console.error(`Invalid module name ${moduleName} (valid options: 'contentRender', 'onRequest', 'onResponse', 'onAddMessages', 'onPublicAPIRequest', 'onCronjob')`);
    }

    const modulesToDeploy = moduleName ? [moduleName] : validModules.filter(isModulePresent);

    if (modulesToDeploy.length === 0) {
        return console.log('No valid modules found to deploy.');
    }

    const localKBData = await fetchLocalKBData();
    const kbId = localKBData?.kbId;

    let remainingPackages = modulesToDeploy.length;

    const buildPromises = modulesToDeploy.map(async (module) => {
        const namespace = module === 'contentRender' ? 'frontend' : 'functions';
        const res = await buildPackage(namespace, kbId, module);
        console.log(res);

        // Decrement the remaining packages count and log it
        remainingPackages--;
        console.log(`${remainingPackages} more packages left, please wait ...`);
    });

    await Promise.all(buildPromises);
    console.log('All modules built successfully.');
}

async function pushAction(location = 'origin', targetFile, options) {
    if (!['origin', 'localstack', 'aws', 'cache'].includes(location)) return console.red(`Invalid location ${location} (valid options: 'origin', 'localstack', 'aws')`);
    try {
        // Remove './' prefix if present
        targetFile = targetFile && targetFile.startsWith('./') ? targetFile.slice(2) : targetFile;
        // Remove 'src/' prefix if present
        targetFile = targetFile && targetFile.startsWith('src/') ? targetFile.slice(4) : targetFile;

        if (targetFile === 'app/icon.png') return console.log(`Try the following command instead:\n\nopenkbs push origin app\n`);

        const localKBData = await fetchLocalKBData();
        const kbId = localKBData?.kbId;

        if (kbId && options?.selfManagedKeys) {
            console.log('Warning: The self-managed keys mode can only be enabled during the initial push before the remote KB is created.');
        }

        if (!localKBData?.kbId) return await registerKBAndPush(options)

        if (location !== 'cache') {
            console.log(`Initiating KB ${kbId} upload ...`);
        } else {
            console.log(`Initiating KB ${kbId} upload from cache ...`);
        }

        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.red(`KB ${kbId} does not exist on the remote service`);

        const kbToken = res?.kbToken;
        const KBData = await getKB(kbToken);

        if (location === 'cache') {
            await Promise.all([
                uploadFiles(['functions', 'frontend'], kbId, kbToken, location, targetFile, true),
                uploadFiles(['functions', 'frontend'], kbId, kbToken, location, targetFile)
            ]);
            return console.green(`KB creation complete: All changes have been successfully uploaded to https://${kbId}.apps.openkbs.com`);
        }

        if (!targetFile) {
            await updateKB(localKBData, KBData, kbToken);
            await uploadFiles(['functions', 'frontend'], kbId, kbToken, location, targetFile);
            if (location === 'origin') {
                console.log(`Building and deploying source code to remote service ...`);
                await deployAction();
                console.green(`KB update complete: All changes have been successfully uploaded to https://${kbId}.apps.openkbs.com`);
            } else if (location === 'localstack') {
                const modulesToDeploy = ['onRequest', 'onResponse', 'onAddMessages', 'onPublicAPIRequest', 'onCronjob'].filter(isModulePresent);

                const originalDir = process.cwd();
                for (const module of modulesToDeploy) {
                    await buildNodePackage('functions', kbId, module, location, originalDir);
                }

                console.green(`KB update complete: All changes have been successfully uploaded to http://${kbId}.apps.localhost:38593/`);
            }
        } else if (targetFile === 'app/settings.json' || targetFile === 'app/instructions.txt') {
            await updateKB(localKBData, KBData, kbToken, false);
            console.log('KB Settings updated.');
        } else if (targetFile === 'app/icon.png') {
            await updateKB(localKBData, KBData, kbToken);
            console.log('KB Settings updated.');
            console.log('KB app/icon.png updated.');
        } else {
            const fileUploaded = await uploadFiles(['functions', 'frontend'], kbId, kbToken, location, targetFile);
            if (fileUploaded) {
                console.green(`File ${targetFile} uploaded successfully.`);
            } else {
                console.red(`Invalid path ${targetFile}`);
            }
        }
    } catch (error) {
        console.error('Error during push operation:', error.message);
    }
}

async function cloneAction(kbId) {
    // Store the original directory so we can restore it if needed
    const originalDir = process.cwd();
    
    try {
        // Create a subdirectory with the name of the kbId
        const targetDir = path.join(originalDir, kbId);
        
        // Check if directory already exists
        if (fs.existsSync(targetDir)) {
            console.red(`Directory ${kbId} already exists.`);
            return;
        }
        
        // Create the subdirectory
        fs.mkdirSync(targetDir);
        
        // Change to the new directory
        process.chdir(targetDir);
        
        const localKBData = await fetchLocalKBData({forceInit: true});

        if (localKBData?.kbId) {
            console.red(`KB ${localKBData?.kbId} already saved in settings.json.`);
            console.yellow(`To pull the changes from OpenKBS remote use "openkbs pull"`);
            process.chdir(originalDir); // Change back to original directory
            return;
        }

        console.log('Cloning KB ' + kbId + ' ...');
        const { kbToken } = await fetchKBJWT(kbId);
        if (!fs.existsSync('app')) fs.mkdirSync('app');
        await fetchAndSaveSettings({ kbId }, kbId, kbToken);
        await downloadIcon(kbId);
        await downloadFiles(['functions', 'frontend'], kbId, kbToken);
        console.green(`Cloning complete! Files created in directory: ${kbId}`);
    } catch (error) {
        console.error('Error during clone operation:', error.message);
        // Make sure we return to the original directory in case of error
        if (process.cwd() !== originalDir) {
            process.chdir(originalDir);
        }
    } finally {
        // Always ensure we return to the original directory
        if (process.cwd() !== originalDir) {
            process.chdir(originalDir);
        }
    }
}

async function createByTemplateAction(name) {
    try {
        // Download templates from S3 first
        await downloadTemplates();
        
        const targetDir = path.join(process.cwd(), name);

        if (fs.existsSync(targetDir)) {
            console.error(`Error: Directory ${name} already exists.`);
            process.exit(1);
        }
        fs.copySync(TEMPLATE_DIR, targetDir);
        replacePlaceholderInFiles(targetDir, name);

        console.log(`Application ${name} created successfully.`);
    } catch (error) {
        console.error(`Error during create operation:`, error.message);
    }
}

async function registerKBAndPush(options) {
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

        console.log('Initiating KB creation...');
        const { kbId } = await createKB(localKBData, AESKey, options?.selfManagedKeys);

        await saveLocalKBData({ ...localKBData, kbId });
        console.log(`KB ${kbId} created!`);
        await pushAction(fs.existsSync(path.join(process.cwd(), 'cache')) ? 'cache' : undefined);
    } catch (error) {
        console.error(`Error during create operation:`, error.message);
    }
}

async function lsAction(kbId, prop) {
    try {
        const apps = await listKBs();
        const sharedApps = await listKBsSharedWithMe();

        if (kbId) {
            // Look in both owned and shared apps
            const app = [...apps, ...sharedApps].find(app => app.kbId === kbId);
            if (app) {
                if (prop) {
                    if (app[prop] === undefined) return console.red('Non existing property ' + prop);
                    console.log(['string'].includes(typeof app[prop]) ? app[prop] : JSON.stringify(app[prop], null, 2));
                } else {
                    console.log(JSON.stringify({kbId: app.kbId, ...app}, null, 2));
                }
            } else {
                console.red(`KB with ID ${kbId} not found on the remote service.`);
            }
        } else {
            // Combine and mark owned vs shared apps
            const allApps = [
                ...apps.map(app => ({ ...app, type: 'owned' })),
                ...sharedApps.map(app => ({ ...app, type: 'shared' }))
            ];

            const maxTitleLength = Math.max(...allApps.map(app => app.kbTitle.length));

            allApps.forEach(app => {
                const date = new Date(app.createdAt).toISOString().replace('T', ' ').replace(/\..+/, '');
                const paddedTitle = app.kbTitle.padEnd(maxTitleLength, ' ');
                const typeIndicator = app.type === 'shared' ? '[shared]' : '       ';
                console.log(`${date}  ${paddedTitle}  ${app.kbId}  ${typeIndicator}`);
            });
        }
    } catch (error) {
        console.red('Error:', error);
    }
}

async function deleteKBAction(kbId) {
    try {
        await deleteKB(kbId);
        console.green(`KB with ID ${kbId} has been deleted.`);
    } catch (error) {
        console.red('Failed to delete KB');
    }
}

async function modifyAction(prompt, files, options) {
    // Check if MODIFY.md file exists in current directory
    const modifyFilePath = path.join(process.cwd(), 'MODIFY.md');
    const modifyFileExists = await fs.pathExists(modifyFilePath);
    
    // If MODIFY.md doesn't exist, download it first
    if (!modifyFileExists) {
        console.yellow('MODIFY.md file not found. Downloading it first...');
        try {
            await downloadModifyAction();
        } catch (error) {
            console.yellow('Could not download MODIFY.md, continuing without it...');
        }
    }
    
    const { kbId } = await fetchLocalKBData();
    const {kbToken} = await fetchKBJWT(kbId);
    const kbData = await getKB(kbToken);

    try {
        await modifyKB(kbToken, kbData, prompt, files, options);
    } catch (error) {
        console.red('Failed to modify KB');
    }
}

async function deleteFileAction(kbId, filePath) {
    try {
        const namespace = filePath.startsWith('Frontend/') ? 'frontend' : 'functions';
        await deleteKBFile(kbId, namespace, filePath);
        console.green(`File ${filePath} in KB with ID ${kbId} has been deleted.`);
    } catch (error) {
        console.red('Failed to delete file!');
    }
}

async function describeAction() {
    try {
        const {kbId, kbTitle} = await fetchLocalKBData();

        if (kbId) {
            console.green(JSON.stringify({kbId, kbTitle}, null, 2))
        } else {
            console.red('No KB found');
        }
    } catch (error) {
        console.red('Error fetching the current KB ID:', error.message);
    }
}

// Define the action function
function installFrontendPackageAction(packageName) {
    if (!packageName) {
        console.error('Please provide a package name to install.');
        process.exit(1);
    }

    // Install the package using npm
    try {
        console.log(`Installing package: ${packageName}...`);
        execSync(`npm install ${packageName}`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to install package: ${packageName}.`);
        process.exit(1);
    }

    // Load package-lock.json to get exact versions
    const packageLockPath = path.resolve('package-lock.json');
    let packageLock;
    try {
        packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    } catch (error) {
        console.error('Cannot read package-lock.json');
        process.exit(1);
    }

    // Prepare contentRender.json path
    const contentRenderPath = path.resolve('./src/Frontend/contentRender.json');

    // Check if contentRender.json exists; if not, create it with a default template
    let contentRender;
    if (fs.existsSync(contentRenderPath)) {
        try {
            contentRender = JSON.parse(fs.readFileSync(contentRenderPath, 'utf8'));
        } catch (error) {
            console.error('Cannot read contentRender.json. Please ensure it is a valid JSON file.');
            process.exit(1);
        }
    } else {
        // Create default contentRender.json
        contentRender = { dependencies: {} };
        fs.mkdirSync(path.dirname(contentRenderPath), { recursive: true });
    }

    // Add package to contentRender.json
    const packagePath = `node_modules/${packageName}`;
    const version = packageLock.packages[packagePath]?.version;
    if (!version) {
        console.error(`Cannot find version for ${packageName} in package-lock.json`);
        return;
    }

    if (!contentRender.dependencies[packageName]) {
        contentRender.dependencies[packageName] = `^${version}`;
        console.log(`Added ${packageName}: "^${version}" to contentRender.json`);
        fs.writeFileSync(contentRenderPath, JSON.stringify(contentRender, null, 2));
    } else {
        console.log(`${packageName} is already in contentRender.json`);
    }
}

async function downloadModifyAction() {
    const url = 'https://raw.githubusercontent.com/open-kbs/openkbs/refs/heads/main/MODIFY.md';
    const filePath = path.join(process.cwd(), 'MODIFY.md');
    
    console.log(`Downloading MODIFY.md template from GitHub...`);
    
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(filePath);
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.green(`Successfully downloaded MODIFY.md to ${filePath}`);
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(filePath, () => {}); // Delete the file if there was an error
                    console.red(`Error writing to file: ${err.message}`);
                    reject(err);
                });
            } else if (response.statusCode === 404) {
                console.red(`File not found at ${url}`);
                reject(new Error('File not found'));
            } else {
                console.red(`Failed to download file. Status code: ${response.statusCode}`);
                reject(new Error(`HTTP Status Code: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            console.red(`Error downloading file: ${err.message}`);
            reject(err);
        });
    });
}

async function updateSkillsAction(silent = false) {
    try {
        const skillsDir = path.join(process.cwd(), '.claude', 'skills', 'openkbs');
        const metadataPath = path.join(skillsDir, 'metadata.json');

        // Get local metadata version
        let localVersion = null;
        if (fs.existsSync(metadataPath)) {
            try {
                const localMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                localVersion = localMetadata.version;
            } catch (error) {
                if (!silent) {
                    console.red('Error reading local metadata.json:', error.message);
                }
            }
        }

        // Check remote version from S3
        const https = require('https');
        const bucket = 'openkbs-downloads';
        const remoteMetadataKey = 'templates/.claude/skills/openkbs/metadata.json';

        let remoteVersion = null;
        try {
            const fileUrl = `https://${bucket}.s3.amazonaws.com/${remoteMetadataKey}`;
            const remoteMetadataContent = await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            });

            const remoteMetadata = JSON.parse(remoteMetadataContent);
            remoteVersion = remoteMetadata.version;
        } catch (error) {
            if (!silent) {
                console.red('Error fetching remote metadata:', error.message);
            }
            return;
        }

        // Compare versions
        if (localVersion === remoteVersion) {
            console.green('OpenKBS skill is already up to date.');
            return;
        }

        console.log(`Updating OpenKBS skill from version ${localVersion || 'not installed'} to ${remoteVersion}...`);

        // Download updated skill files from S3
        await downloadSkillsFromS3(skillsDir);

        console.green('OpenKBS skill updated successfully!');

    } catch (error) {
        if (!silent) {
            console.red('Error updating skills:', error.message);
        }
    }
}

async function updateCliAction() {
    try {
        const packageJson = require('../package.json');
        const currentVersion = packageJson.version;

        console.log(`Current OpenKBS CLI version: ${currentVersion}`);
        console.log('Checking for updates...');

        // Check remote version from S3
        const https = require('https');
        const bucket = 'openkbs-downloads';
        const versionMetadataKey = 'cli/version.json';

        let remoteVersionData = null;
        let cliUpdateAvailable = false;

        try {
            const fileUrl = `https://${bucket}.s3.amazonaws.com/${versionMetadataKey}`;
            const remoteVersionContent = await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    if (res.statusCode === 404) {
                        reject(new Error('Version metadata not found on remote server'));
                        return;
                    }
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            });

            remoteVersionData = JSON.parse(remoteVersionContent);
            const remoteVersion = remoteVersionData.version;

            // Compare versions using semantic versioning
            if (compareVersions(currentVersion, remoteVersion) < 0) {
                cliUpdateAvailable = true;
                console.log(`New CLI version available: ${remoteVersion}`);
                console.log('Updating automatically...');

                // Spawn npm update as detached child process
                const { spawn } = require('child_process');
                const updateProcess = spawn('npm', ['update', '-g', 'openkbs'], {
                    detached: true,
                    stdio: 'inherit',
                    shell: true
                });

                updateProcess.unref(); // Allow parent to exit

                console.green(`Update started! OpenKBS CLI will be updated to version ${remoteVersion}.`);
                console.log('The update will complete in the background.');
            } else {
                console.green('OpenKBS CLI is already up to date.');
            }
        } catch (error) {
            console.red('Error fetching CLI version metadata:', error.message);
        }

        // Also update skills silently
        await updateSkillsAction(true);

    } catch (error) {
        console.red('Error updating CLI:', error.message);
    }
}

async function publishAction(domain) {
    try {
        const localKBData = await fetchLocalKBData();
        const { kbId } = localKBData;
        if (!kbId) return console.red('No KB found. Please push the KB first using the command "openkbs push".');

        console.log(`Publishing KB ${kbId} to domain ${domain}...`);
        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.red(`KB ${kbId} does not exist on the remote service`);

        const response = await makePostRequest(KB_API_URL, {
            token: res.kbToken,
            action: 'publish',
            domain: domain
        });

        console.green(`KB ${kbId} successfully published to ${domain}`);
        return response;
    } catch (error) {
        console.red('Error during publish operation:', error.message);
    }
}

async function unpublishAction(domain) {
    try {
        const localKBData = await fetchLocalKBData();
        const { kbId } = localKBData;
        if (!kbId) return console.red('No KB found. Please push the KB first using the command "openkbs push".');

        console.log(`Unpublishing KB ${kbId} from domain ${domain}...`);
        const res = await fetchKBJWT(kbId);

        if (!res?.kbToken) return console.red(`KB ${kbId} does not exist on the remote service`);

        const response = await makePostRequest(KB_API_URL, {
            token: res.kbToken,
            action: 'unpublish',
            domain: domain
        });

        console.green(`KB ${kbId} successfully unpublished from ${domain}`);
        return response;
    } catch (error) {
        console.red('Error during unpublish operation:', error.message);
    }
}

function compareVersions(version1, version2) {
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    
    return 0;
}


async function downloadSkillsFromS3(targetDir) {
    const https = require('https');
    const bucket = 'openkbs-downloads';
    const prefix = 'templates/.claude/skills/openkbs/';
    const baseUrl = `https://${bucket}.s3.amazonaws.com`;

    try {
        // Ensure directory exists
        await fs.ensureDir(targetDir);

        // List all objects in skills folder
        const listUrl = `${baseUrl}/?list-type=2&prefix=${prefix}`;
        const listXml = await new Promise((resolve, reject) => {
            https.get(listUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        // Parse XML to extract object keys
        const keyMatches = listXml.match(/<Key>([^<]+)<\/Key>/g) || [];
        const keys = keyMatches.map(match => match.replace(/<\/?Key>/g, ''));

        if (keys.length === 0) {
            console.yellow('No skill files found in remote repository.');
            return;
        }

        // Download all files in parallel
        const downloadPromises = keys.map(async (key) => {
            const relativePath = key.substring(prefix.length);

            // Skip if it's a directory marker
            if (relativePath.endsWith('/') || relativePath === '') return;

            const localPath = path.join(targetDir, relativePath);

            // Ensure directory exists
            await fs.ensureDir(path.dirname(localPath));

            // Download file
            const fileUrl = `${baseUrl}/${key}`;
            const fileContent = await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', reject);
            });
            await fs.writeFile(localPath, fileContent);

            console.log(`Downloaded: ${relativePath}`);
        });

        await Promise.all(downloadPromises);

    } catch (error) {
        console.red('Error downloading skill files from S3:', error.message);
        throw error;
    }
}

// ===== Elastic Functions Commands =====

async function fnAction(subCommand, args = []) {
    // Find kbId from settings.json (current dir, app/, functions/, site/)
    let kbId = findKbId();

    if (!kbId) {
        // Fallback to standard KB lookup
        const localKBData = await fetchLocalKBData();
        kbId = localKBData?.kbId;
    }

    if (!kbId) {
        return console.red('No KB found. Create settings.json with {"kbId": "..."} or run from a KB project directory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'list':
            return await fnListAction(kbToken);
        case 'push':
            return await fnDeployAction(kbToken, args[0], args.slice(1));
        case 'delete':
            return await fnDeleteAction(kbToken, args[0]);
        case 'logs':
            return await fnLogsAction(kbToken, args[0], args.slice(1));
        case 'env':
            return await fnEnvAction(kbToken, args[0], args.slice(1));
        case 'invoke':
            return await fnInvokeAction(kbToken, args[0], args.slice(1));
        default:
            console.log('Usage: openkbs fn <command> [options]');
            console.log('');
            console.log('Commands:');
            console.log('  list                    List all elastic functions');
            console.log('  push <name>             Push a function from ./functions/<name>/');
            console.log('  delete <name>           Delete a function');
            console.log('  logs <name>             View function logs');
            console.log('  env <name> [KEY=value]  View or set environment variables');
            console.log('  invoke <name> [payload] Invoke a function');
            console.log('');
            console.log('Options for push:');
            console.log('  --region <region>       Region (us-east-1, eu-central-1, ap-southeast-1)');
            console.log('  --memory <mb>           Memory size (128-3008 MB)');
            console.log('  --timeout <seconds>     Timeout (1-900 seconds)');
    }
}

async function fnListAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'listElasticFunctions'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        const functions = response.functions || [];

        if (functions.length === 0) {
            console.log('No elastic functions found.');
            console.log('');
            console.log('Create a function:');
            console.log('  1. Create directory: mkdir -p functions/hello');
            console.log('  2. Create handler: echo "export const handler = async (event) => ({ body: \'Hello!\' });" > functions/hello/index.mjs');
            console.log('  3. Deploy: openkbs fn deploy hello --region us-east-1');
            return;
        }

        console.log('Elastic Functions:\n');
        const maxNameLen = Math.max(...functions.map(f => f.functionName.length), 10);

        functions.forEach(f => {
            const name = f.functionName.padEnd(maxNameLen);
            const region = f.region || 'unknown';
            const url = f.customUrl || f.functionUrl || 'N/A';
            console.log(`  ${name}  ${region}  ${url}`);
        });
    } catch (error) {
        console.red('Error listing functions:', error.message);
    }
}

async function fnDeployAction(kbToken, functionName, args) {
    if (!functionName) {
        return console.red('Function name required. Usage: openkbs fn deploy <name>');
    }

    // Parse arguments - region defaults to settings.json or us-east-1
    let region = findRegion();
    let memorySize = 256;
    let timeout = 30;
    let runtime = null;  // null = use default (nodejs24.x)
    let handler = null;  // null = use default (index.handler)

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--region' && args[i + 1]) {
            region = args[++i];
        } else if (args[i] === '--memory' && args[i + 1]) {
            memorySize = parseInt(args[++i]);
        } else if (args[i] === '--timeout' && args[i + 1]) {
            timeout = parseInt(args[++i]);
        } else if (args[i] === '--runtime' && args[i + 1]) {
            runtime = args[++i];
        } else if (args[i] === '--handler' && args[i + 1]) {
            handler = args[++i];
        }
    }

    // Try to find the function directory in order:
    // 1. ./functionName (if running from functions/ directory)
    // 2. ./functions/functionName (if running from project root)
    let functionDir = path.join(process.cwd(), functionName);
    if (!await fs.pathExists(functionDir)) {
        functionDir = path.join(process.cwd(), 'functions', functionName);
    }

    if (!await fs.pathExists(functionDir)) {
        return console.red(`Function directory not found. Tried:\n  - ./${functionName}\n  - ./functions/${functionName}`);
    }

    console.log(`Deploying function '${functionName}' to ${region}...`);

    try {
        // Check if package.json exists and run npm install
        const packageJsonPath = path.join(functionDir, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            console.log('Installing dependencies...');
            execSync('npm install --production', { cwd: functionDir, stdio: 'inherit' });
        }

        // Create a zip of the function directory
        const archiver = require('archiver');
        const { PassThrough } = require('stream');

        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks = [];
        const passThrough = new PassThrough();

        passThrough.on('data', chunk => chunks.push(chunk));

        await new Promise((resolve, reject) => {
            passThrough.on('end', resolve);
            passThrough.on('error', reject);
            archive.on('error', reject);

            archive.pipe(passThrough);
            archive.directory(functionDir, false);
            archive.finalize();
        });

        const zipBuffer = Buffer.concat(chunks);
        const code = zipBuffer.toString('base64');

        // Check if function exists
        const listResponse = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'listElasticFunctions'
        });

        const existingFunc = listResponse.functions?.find(f => f.functionName === functionName);

        let response;
        if (existingFunc) {
            // Update existing function
            console.log('Updating existing function...');
            response = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'updateElasticFunction',
                functionName,
                code
            });
        } else {
            // Create new function
            console.log('Creating new function...');
            const createParams = {
                token: kbToken,
                action: 'createElasticFunction',
                functionName,
                code,
                region,
                memorySize,
                timeout
            };
            if (runtime) createParams.runtime = runtime;
            if (handler) createParams.handler = handler;
            response = await makePostRequest(KB_API_URL, createParams);
        }

        if (response.error) {
            return console.red('Deploy failed:', response.error);
        }

        console.green('Deploy successful!');
        if (response.functionUrl) {
            console.log(`Lambda URL: ${response.functionUrl}`);
        }
        if (response.customUrl) {
            console.log(`Custom URL: ${response.customUrl}`);
        }
    } catch (error) {
        console.red('Deploy failed:', error.message);
    }
}

async function fnDeleteAction(kbToken, functionName) {
    if (!functionName) {
        return console.red('Function name required. Usage: openkbs fn delete <name>');
    }

    try {
        console.log(`Deleting function '${functionName}'...`);

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'deleteElasticFunction',
            functionName
        });

        if (response.error) {
            return console.red('Delete failed:', response.error);
        }

        console.green(`Function '${functionName}' deleted successfully.`);
    } catch (error) {
        console.red('Delete failed:', error.message);
    }
}

async function fnLogsAction(kbToken, functionName, args) {
    if (!functionName) {
        return console.red('Function name required. Usage: openkbs fn logs <name>');
    }

    try {
        let limit = 50;
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--limit' && args[i + 1]) {
                limit = parseInt(args[++i]);
            }
        }

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getElasticFunctionLogs',
            functionName,
            limit
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (!response.events || response.events.length === 0) {
            console.log('No logs found. Function may not have been invoked yet.');
            return;
        }

        console.log(`Logs for '${functionName}':\n`);
        response.events.forEach(event => {
            const time = new Date(event.timestamp).toISOString();
            console.log(`[${time}] ${event.message}`);
        });
    } catch (error) {
        console.red('Error fetching logs:', error.message);
    }
}

async function fnEnvAction(kbToken, functionName, args) {
    if (!functionName) {
        return console.red('Function name required. Usage: openkbs fn env <name> [KEY=value ...]');
    }

    try {
        if (args.length === 0) {
            // Show current env vars
            const response = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'getElasticFunction',
                functionName
            });

            if (response.error) {
                return console.red('Error:', response.error);
            }

            console.log(`Environment variables for '${functionName}':\n`);
            const env = response.env || {};
            if (Object.keys(env).length === 0) {
                console.log('  (none)');
            } else {
                Object.entries(env).forEach(([key, value]) => {
                    console.log(`  ${key}=${value}`);
                });
            }
        } else {
            // Set env vars
            const env = {};
            args.forEach(arg => {
                const [key, ...valueParts] = arg.split('=');
                if (key && valueParts.length > 0) {
                    env[key] = valueParts.join('=');
                }
            });

            if (Object.keys(env).length === 0) {
                return console.red('Invalid format. Use: openkbs fn env <name> KEY=value');
            }

            console.log(`Setting environment variables for '${functionName}'...`);

            const response = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'setElasticFunctionEnv',
                functionName,
                env
            });

            if (response.error) {
                return console.red('Error:', response.error);
            }

            console.green('Environment variables updated.');
        }
    } catch (error) {
        console.red('Error:', error.message);
    }
}

async function fnInvokeAction(kbToken, functionName, args) {
    if (!functionName) {
        return console.red('Function name required. Usage: openkbs fn invoke <name> [payload]');
    }

    try {
        let payload = {};
        if (args.length > 0) {
            try {
                payload = JSON.parse(args.join(' '));
            } catch (e) {
                return console.red('Invalid JSON payload');
            }
        }

        console.log(`Invoking '${functionName}'...`);

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'invokeElasticFunction',
            functionName,
            payload
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.log('\nResponse:');
        console.log(JSON.stringify(response.payload, null, 2));

        if (response.functionError) {
            console.red('\nFunction Error:', response.functionError);
        }
    } catch (error) {
        console.red('Error invoking function:', error.message);
    }
}

// ===== Elastic Storage Commands =====

async function storageAction(subCommand, args = []) {
    // Find kbId from settings.json (current dir, app/, functions/, site/)
    let kbId = findKbId();

    if (!kbId) {
        const localKBData = await fetchLocalKBData();
        kbId = localKBData?.kbId;
    }

    if (!kbId) {
        return console.red('No KB found. Create settings.json with {"kbId": "..."} or run from a KB project directory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'enable':
            return await storageEnableAction(kbToken);
        case 'status':
            return await storageStatusAction(kbToken);
        case 'ls':
        case 'list':
            return await storageListAction(kbToken, args[0]);
        case 'put':
        case 'upload':
            return await storageUploadAction(kbToken, args[0], args[1]);
        case 'get':
        case 'download':
            return await storageDownloadAction(kbToken, args[0], args[1]);
        case 'rm':
        case 'delete':
            return await storageDeleteAction(kbToken, args[0]);
        case 'disable':
            return await storageDisableAction(kbToken, args);
        case 'cloudfront':
        case 'cf':
            return await storageCloudFrontAction(kbToken, args[0], args[1]);
        case 'public':
            return await storagePublicAction(kbToken, args[0]);
        default:
            console.log('Usage: openkbs storage <command> [options]');
            console.log('');
            console.log('Commands:');
            console.log('  enable                  Enable elastic storage for this KB');
            console.log('  status                  Show storage status and info');
            console.log('  public <true|false>     Make storage publicly readable');
            console.log('  ls [prefix]             List objects in storage');
            console.log('  put <local> <remote>    Upload a file to storage');
            console.log('  get <remote> <local>    Download a file from storage');
            console.log('  rm <key>                Delete an object from storage');
            console.log('  disable [--force]       Disable storage (deletes bucket)');
            console.log('  cloudfront <path>       Add storage to CloudFront at path (e.g., /media)');
            console.log('  cloudfront remove <path> Remove storage from CloudFront');
    }
}

async function storageEnableAction(kbToken) {
    try {
        console.log('Enabling elastic storage...');

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'enableElasticStorage'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (response.alreadyEnabled) {
            console.yellow('Storage is already enabled.');
        } else {
            console.green('Storage enabled successfully!');
        }

        console.log(`  Bucket: ${response.bucket}`);
        console.log(`  Region: ${response.region}`);

        if (response.functionsUpdated > 0) {
            console.log(`  Updated ${response.functionsUpdated} function(s) with STORAGE_BUCKET env var`);
        }
    } catch (error) {
        console.red('Error enabling storage:', error.message);
    }
}

async function storageStatusAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getElasticStorage'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (!response.enabled) {
            console.log('Elastic Storage: disabled');
            console.log('');
            console.log('Enable with: openkbs storage enable');
            return;
        }

        console.log('Elastic Storage: enabled');
        console.log(`  Bucket: ${response.bucket}`);
        console.log(`  Region: ${response.region}`);
        console.log(`  Public: ${response.public ? 'yes' : 'no'}`);
        if (response.publicUrl) {
            console.log(`  Public URL: ${response.publicUrl}`);
        }
    } catch (error) {
        console.red('Error getting storage status:', error.message);
    }
}

async function storageListAction(kbToken, prefix = '') {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'listStorageObjects',
            prefix: prefix || ''
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        const objects = response.objects || [];

        if (objects.length === 0) {
            console.log('No objects found.');
            return;
        }

        console.log(`Objects${prefix ? ` (prefix: ${prefix})` : ''}:\n`);

        objects.forEach(obj => {
            const size = formatBytes(obj.size);
            const date = new Date(obj.lastModified).toISOString().split('T')[0];
            console.log(`  ${date}  ${size.padStart(10)}  ${obj.key}`);
        });

        if (response.isTruncated) {
            console.log('\n  (more objects exist, use prefix to filter)');
        }
    } catch (error) {
        console.red('Error listing objects:', error.message);
    }
}

async function storageUploadAction(kbToken, localPath, remoteKey) {
    if (!localPath) {
        return console.red('Usage: openkbs storage put <local-file> [remote-key]');
    }

    const fullLocalPath = path.resolve(localPath);

    if (!fs.existsSync(fullLocalPath)) {
        return console.red(`File not found: ${fullLocalPath}`);
    }

    // Use filename if remote key not specified
    if (!remoteKey) {
        remoteKey = path.basename(localPath);
    }

    try {
        console.log(`Uploading ${localPath} to ${remoteKey}...`);

        // Get presigned upload URL
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getStorageUploadUrl',
            storageKey: remoteKey
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        // Upload file using presigned URL
        const fileContent = fs.readFileSync(fullLocalPath);
        await fetch(response.uploadUrl, {
            method: 'PUT',
            body: fileContent
        });

        console.green(`Uploaded: ${remoteKey}`);

        if (response.publicUrl) {
            console.log(`Public URL: ${response.publicUrl}`);
        }
    } catch (error) {
        console.red('Upload failed:', error.message);
    }
}

async function storageDownloadAction(kbToken, remoteKey, localPath) {
    if (!remoteKey) {
        return console.red('Usage: openkbs storage get <remote-key> [local-file]');
    }

    // Use remote filename if local path not specified
    if (!localPath) {
        localPath = path.basename(remoteKey);
    }

    try {
        console.log(`Downloading ${remoteKey} to ${localPath}...`);

        // Get presigned download URL
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getStorageDownloadUrl',
            storageKey: remoteKey
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        // Download file
        const fetchResponse = await fetch(response.downloadUrl);
        if (!fetchResponse.ok) {
            return console.red(`Download failed: ${fetchResponse.statusText}`);
        }

        const buffer = await fetchResponse.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(buffer));

        console.green(`Downloaded: ${localPath}`);
    } catch (error) {
        console.red('Download failed:', error.message);
    }
}

async function storageDeleteAction(kbToken, key) {
    if (!key) {
        return console.red('Usage: openkbs storage rm <key>');
    }

    try {
        console.log(`Deleting ${key}...`);

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'deleteStorageObject',
            storageKey: key
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.green(`Deleted: ${key}`);
    } catch (error) {
        console.red('Delete failed:', error.message);
    }
}

async function storageDisableAction(kbToken, args) {
    const force = args.includes('--force');

    try {
        console.log('Disabling elastic storage...');

        if (!force) {
            console.yellow('Warning: This will delete the storage bucket.');
            console.yellow('Use --force to delete all objects and the bucket.');
            return;
        }

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'deleteElasticStorage',
            force: true
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.green('Storage disabled successfully.');

        if (response.functionsUpdated > 0) {
            console.log(`Removed STORAGE_BUCKET from ${response.functionsUpdated} function(s)`);
        }
    } catch (error) {
        console.red('Error disabling storage:', error.message);
    }
}

async function storagePublicAction(kbToken, value) {
    if (!value || !['true', 'false'].includes(value.toLowerCase())) {
        return console.red('Usage: openkbs storage public <true|false>');
    }

    const makePublic = value.toLowerCase() === 'true';

    try {
        console.log(makePublic ? 'Making storage public...' : 'Making storage private...');

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'setElasticStoragePublic',
            isPublic: makePublic
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (makePublic) {
            console.green('Storage is now public!');
            console.log(`Public URL: ${response.publicUrl}`);
        } else {
            console.green('Storage is now private.');
        }
    } catch (error) {
        console.red('Error:', error.message);
    }
}

async function storageCloudFrontAction(kbToken, pathOrRemove, pathArg) {
    // Handle "storage cloudfront remove <path>" vs "storage cloudfront <path>"
    let pathPrefix;
    let enable = true;

    if (pathOrRemove === 'remove' || pathOrRemove === 'rm') {
        if (!pathArg) {
            return console.red('Usage: openkbs storage cloudfront remove <path>');
        }
        pathPrefix = pathArg;
        enable = false;
    } else {
        if (!pathOrRemove) {
            console.log('Usage: openkbs storage cloudfront <path>');
            console.log('       openkbs storage cloudfront remove <path>');
            console.log('');
            console.log('Examples:');
            console.log('  openkbs storage cloudfront media    # Makes storage available at /media/*');
            console.log('  openkbs storage cloudfront files    # Makes storage available at /files/*');
            console.log('  openkbs storage cloudfront remove media  # Remove from CloudFront');
            return;
        }
        pathPrefix = pathOrRemove;
    }

    try {
        if (enable) {
            console.log(`Adding storage to CloudFront at /${pathPrefix}/*...`);
        } else {
            console.log(`Removing storage from CloudFront at /${pathPrefix}/*...`);
        }

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'setStorageCloudFront',
            pathPrefix,
            enable
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (enable) {
            console.green('Storage added to CloudFront!');
            console.log(`  Custom URL: ${response.customUrl}`);
            console.log(`  Path: /${response.path}/*`);
            console.yellow('\n  Note: CloudFront changes take 2-5 minutes to propagate.');
        } else {
            console.green('Storage removed from CloudFront.');
            console.yellow('  Note: CloudFront changes take 2-5 minutes to propagate.');
        }
    } catch (error) {
        console.red('Error:', error.message);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== Elastic Postgres Commands =====

async function postgresAction(subCommand, args = []) {
    // Find kbId from settings.json (current dir, app/, functions/, site/)
    let kbId = findKbId();

    if (!kbId) {
        const localKBData = await fetchLocalKBData();
        kbId = localKBData?.kbId;
    }

    if (!kbId) {
        return console.red('No KB found. Create settings.json with {"kbId": "..."} or run from a KB project directory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'enable':
            return await postgresEnableAction(kbToken);
        case 'status':
            return await postgresStatusAction(kbToken);
        case 'connection':
        case 'conn':
            return await postgresConnectionAction(kbToken);
        case 'disable':
            return await postgresDisableAction(kbToken);
        default:
            console.log('Usage: openkbs postgres <command>');
            console.log('');
            console.log('Commands:');
            console.log('  enable      Enable Postgres database for this KB');
            console.log('  status      Show Postgres status and info');
            console.log('  connection  Show connection string');
            console.log('  disable     Disable Postgres (deletes database)');
    }
}

async function postgresEnableAction(kbToken) {
    try {
        const region = findRegion();
        console.log(`Enabling Elastic Postgres in ${region}...`);

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'enableElasticPostgres',
            region
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (response.alreadyEnabled) {
            console.yellow('Postgres already enabled.');
        } else {
            console.green('Postgres enabled successfully!');
        }

        console.log(`  Host: ${response.host}`);
        console.log(`  Port: ${response.port}`);
        console.log(`  Database: ${response.dbName}`);
        console.log(`  Region: ${response.region}`);

        if (response.functionsUpdated > 0) {
            console.log(`  Updated ${response.functionsUpdated} function(s) with DATABASE_URL`);
        }
    } catch (error) {
        console.red('Error enabling Postgres:', error.message);
    }
}

async function postgresStatusAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getElasticPostgres'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (!response.enabled) {
            console.yellow('Postgres is not enabled.');
            console.log('Run: openkbs postgres enable');
            return;
        }

        console.green('Postgres Status: Enabled');
        console.log(`  Host: ${response.host}`);
        console.log(`  Port: ${response.port}`);
        console.log(`  Database: ${response.dbName}`);
        console.log(`  Region: ${response.region}`);
        console.log(`  Project: ${response.projectId}`);
    } catch (error) {
        console.red('Error getting Postgres status:', error.message);
    }
}

async function postgresConnectionAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getElasticPostgresConnection'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.log('Connection String:');
        console.log(response.connectionString);
    } catch (error) {
        console.red('Error getting connection:', error.message);
    }
}

async function postgresDisableAction(kbToken) {
    try {
        console.log('Disabling Elastic Postgres...');
        console.yellow('Warning: This will permanently delete the database and all data!');

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'deleteElasticPostgres'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.green('Postgres disabled successfully.');

        if (response.functionsUpdated > 0) {
            console.log(`Removed DATABASE_URL from ${response.functionsUpdated} function(s)`);
        }
    } catch (error) {
        console.red('Error disabling Postgres:', error.message);
    }
}

// ===== Site Commands =====

async function siteAction(subCommand, args = []) {
    // Find kbId and site directory
    let kbId = findKbId();
    let siteDir = process.cwd();

    // If no settings.json in current dir, check site/ subdirectory
    if (!fs.existsSync(path.join(process.cwd(), 'settings.json'))) {
        const siteDirPath = path.join(process.cwd(), 'site');
        const siteSettingsPath = path.join(siteDirPath, 'settings.json');
        if (fs.existsSync(siteSettingsPath)) {
            siteDir = siteDirPath;
            try {
                const settings = JSON.parse(fs.readFileSync(siteSettingsPath, 'utf8'));
                kbId = settings.kbId;
            } catch (e) {}
        }
    }

    if (!kbId) {
        const localKBData = await fetchLocalKBData();
        kbId = localKBData?.kbId;
    }

    if (!kbId) {
        return console.red('No KB found. Create settings.json with {"kbId": "..."} in current dir or site/ subdirectory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'push':
            // If a folder path is provided, use it
            if (args.length > 0 && args[0] && !args[0].startsWith('-')) {
                const customDir = path.resolve(process.cwd(), args[0]);
                if (fs.existsSync(customDir) && fs.statSync(customDir).isDirectory()) {
                    siteDir = customDir;
                } else {
                    return console.red(`Directory not found: ${args[0]}`);
                }
            }
            return await siteDeployAction(kbToken, kbId, siteDir, args);
        default:
            console.log('Site management commands:\n');
            console.log('  openkbs site push [folder]    Upload files to S3 (defaults to current dir or site/)');
            console.log('\nRun from a folder containing settings.json with kbId, or from parent with site/ subdirectory');
    }
}

async function siteDeployAction(kbToken, kbId, siteDir, args) {

    // Walk directory and get all files (excluding settings.json and hidden files)
    const walkDir = async (dir, baseDir = dir) => {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            // Skip hidden files, settings.json, and node_modules
            if (entry.name.startsWith('.') ||
                entry.name === 'settings.json' ||
                entry.name === 'node_modules') {
                continue;
            }

            if (entry.isDirectory()) {
                files.push(...await walkDir(fullPath, baseDir));
            } else {
                files.push(relativePath);
            }
        }
        return files;
    };

    try {
        console.log(`Uploading site files for KB ${kbId}...`);

        const files = await walkDir(siteDir);

        if (files.length === 0) {
            return console.yellow('No files found to upload.');
        }

        console.log(`Found ${files.length} files to upload.`);

        let uploaded = 0;
        for (const file of files) {
            const filePath = path.join(siteDir, file);
            const fileContent = fs.readFileSync(filePath);

            // Get presigned URL for 'files' namespace with correct Content-Type
            const contentType = getMimeType(file);
            const response = await makePostRequest(KB_API_URL, {
                token: kbToken,
                namespace: 'files',
                kbId,
                fileName: file,
                fileType: contentType,
                presignedOperation: 'putObject',
                action: 'createPresignedURL'
            });

            if (response.error) {
                console.red(`Failed to get presigned URL for ${file}:`, response.error);
                continue;
            }

            // Upload file with correct Content-Type
            await fetch(response, {
                method: 'PUT',
                body: fileContent,
                headers: { 'Content-Type': contentType }
            });
            uploaded++;
            console.log(`Uploaded: ${file} (${contentType})`);
        }

        console.green(`\nUpload complete! ${uploaded}/${files.length} files uploaded.`);
        // console.log(`Files accessible at: https://files.openkbs.com/${kbId}/`);

    } catch (error) {
        console.red('Upload failed:', error.message);
    }
}

// ===== Elastic Pulse Commands =====

async function pulseAction(subCommand, args = []) {
    // Find kbId from settings.json (current dir, app/, functions/, site/)
    let kbId = findKbId();

    if (!kbId) {
        const localKBData = await fetchLocalKBData();
        kbId = localKBData?.kbId;
    }

    if (!kbId) {
        return console.red('No KB found. Create settings.json with {"kbId": "..."} or run from a KB project directory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'enable':
            return await pulseEnableAction(kbToken);
        case 'status':
            return await pulseStatusAction(kbToken);
        case 'disable':
            return await pulseDisableAction(kbToken);
        case 'channels':
            return await pulseChannelsAction(kbToken);
        case 'presence':
            return await pulsePresenceAction(kbToken, args[0]);
        case 'publish':
        case 'send':
            return await pulsePublishAction(kbToken, args[0], args.slice(1).join(' '));
        default:
            console.log('Usage: openkbs pulse <command>');
            console.log('');
            console.log('Commands:');
            console.log('  enable                Enable Pulse (WebSocket) for this KB');
            console.log('  status                Show Pulse status and endpoint');
            console.log('  disable               Disable Pulse');
            console.log('  channels              List active channels');
            console.log('  presence <channel>    Show connected clients in channel');
            console.log('  publish <channel> <message>  Send message to channel');
    }
}

async function pulseEnableAction(kbToken) {
    try {
        console.log('Enabling Elastic Pulse...');

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'enableElasticPulse'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (response.alreadyEnabled) {
            console.yellow('Pulse already enabled.');
        } else {
            console.green('Pulse enabled successfully!');
        }

        console.log(`  Endpoint: ${response.endpoint}`);
        console.log(`  Region: ${response.region}`);
    } catch (error) {
        console.red('Error enabling Pulse:', error.message);
    }
}

async function pulseStatusAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'getElasticPulse'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (!response.enabled) {
            console.log('Elastic Pulse: disabled');
            console.log('  Use "openkbs pulse enable" to enable WebSocket messaging.');
            return;
        }

        console.log('Elastic Pulse: enabled');
        console.log(`  Endpoint: ${response.endpoint}`);
        console.log(`  Region: ${response.region}`);
    } catch (error) {
        console.red('Error getting Pulse status:', error.message);
    }
}

async function pulseDisableAction(kbToken) {
    try {
        console.log('Disabling Elastic Pulse...');

        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'disableElasticPulse'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.green('Pulse disabled successfully.');
    } catch (error) {
        console.red('Error disabling Pulse:', error.message);
    }
}

async function pulseChannelsAction(kbToken) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'pulseChannels'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        if (!response.channels || response.channels.length === 0) {
            console.log('No active channels');
            return;
        }

        console.log(`Active channels (${response.totalConnections} total connections):\n`);
        for (const ch of response.channels) {
            console.log(`  ${ch.channel}: ${ch.count} connection(s)`);
        }
    } catch (error) {
        console.red('Error getting channels:', error.message);
    }
}

async function pulsePresenceAction(kbToken, channel) {
    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'pulsePresence',
            channel: channel || 'default'
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.log(`Channel: ${response.channel}`);
        console.log(`Connected: ${response.count}`);

        if (response.members && response.members.length > 0) {
            console.log('\nMembers:');
            for (const m of response.members) {
                const time = new Date(m.connectedAt).toISOString();
                console.log(`  ${m.userId || 'anonymous'} (since ${time})`);
            }
        }
    } catch (error) {
        console.red('Error getting presence:', error.message);
    }
}

async function pulsePublishAction(kbToken, channel, message) {
    if (!channel || !message) {
        return console.red('Usage: openkbs pulse publish <channel> <message>');
    }

    try {
        const response = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'pulsePublish',
            channel,
            message
        });

        if (response.error) {
            return console.red('Error:', response.error);
        }

        console.green(`Message sent to ${response.sent} client(s) on channel "${response.channel}"`);
    } catch (error) {
        console.red('Error publishing message:', error.message);
    }
}

/**
 * Deploy from openkbs.json config file
 * Enables elastic services and deploys functions/site
 */
async function elasticDeployAction() {
    // Find openkbs.json
    const configPaths = [
        path.join(process.cwd(), 'openkbs.json'),
        path.join(process.cwd(), '..', 'openkbs.json')
    ];

    let configPath = null;
    for (const p of configPaths) {
        if (fs.existsSync(p)) {
            configPath = p;
            break;
        }
    }

    if (!configPath) {
        return console.red('openkbs.json not found. Create one with your deployment config.');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const projectDir = path.dirname(configPath);
    const region = config.region || findRegion() || 'us-east-1';

    console.log(`Deploying ${config.name || 'project'} to ${region}...`);

    // Get KB token
    const settings = findSettings();
    if (!settings?.kbId) {
        return console.red('No kbId found. Run from a directory with settings.json');
    }

    const res = await fetchKBJWT(settings.kbId);
    if (!res?.kbToken) {
        return console.red(`KB ${settings.kbId} not found`);
    }
    const kbToken = res.kbToken;

    // Deploy elastic services if configured
    if (config.elastic) {
        console.log('\nEnabling Elastic services...');
        const elasticRes = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'deployElastic',
            elastic: config.elastic
        });

        if (elasticRes.error) {
            console.red('Elastic deploy error:', elasticRes.error);
        } else {
            if (elasticRes.pulse?.enabled || elasticRes.pulse?.alreadyEnabled) console.green('  ✓ Pulse enabled');
            if (elasticRes.pulse?.error) console.yellow('  ⚠ Pulse:', elasticRes.pulse.error);
            if (elasticRes.postgres?.enabled || elasticRes.postgres?.alreadyEnabled || elasticRes.postgres?.host) console.green('  ✓ Postgres enabled');
            if (elasticRes.postgres?.error) console.yellow('  ⚠ Postgres:', elasticRes.postgres.error);
            if (elasticRes.storage?.enabled || elasticRes.storage?.alreadyEnabled || elasticRes.storage?.bucket) console.green('  ✓ Storage enabled');
            if (elasticRes.storage?.error) console.yellow('  ⚠ Storage:', elasticRes.storage.error);
            if (elasticRes.storage?.cloudfront) console.green('  ✓ CloudFront configured');
        }
    }

    // Deploy functions if configured
    if (config.functions && config.functions.length > 0) {
        console.log('\nDeploying functions...');
        for (const fnName of config.functions) {
            const fnConfig = typeof fnName === 'object' ? fnName : { name: fnName };
            const name = fnConfig.name || fnName;

            const args = ['--region', region];
            if (fnConfig.memory) args.push('--memory', String(fnConfig.memory));
            if (fnConfig.timeout) args.push('--timeout', String(fnConfig.timeout));
            if (fnConfig.runtime) args.push('--runtime', fnConfig.runtime);
            if (fnConfig.handler) args.push('--handler', fnConfig.handler);

            console.log(`  Deploying ${name}...`);
            await fnDeployAction(kbToken, name, args);
        }
    }

    // Deploy site if configured
    if (config.site) {
        console.log('\nDeploying site...');
        const sitePath = path.resolve(projectDir, config.site);
        await siteDeployAction(kbToken, settings.kbId, sitePath, []);
    }

    console.green('\nDeploy complete!');
}

/**
 * Destroy all resources defined in openkbs.json
 */
async function elasticDestroyAction() {
    // Find openkbs.json
    const configPaths = [
        path.join(process.cwd(), 'openkbs.json'),
        path.join(process.cwd(), '..', 'openkbs.json')
    ];

    let configPath = null;
    for (const p of configPaths) {
        if (fs.existsSync(p)) {
            configPath = p;
            break;
        }
    }

    if (!configPath) {
        return console.red('openkbs.json not found.');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log(`Destroying ${config.name || 'project'} resources...`);
    console.yellow('Warning: This will permanently delete all resources!\n');

    // Get KB token
    const settings = findSettings();
    if (!settings?.kbId) {
        return console.red('No kbId found. Run from a directory with settings.json');
    }

    const res = await fetchKBJWT(settings.kbId);
    if (!res?.kbToken) {
        return console.red(`KB ${settings.kbId} not found`);
    }
    const kbToken = res.kbToken;

    // Delete functions
    if (config.functions && config.functions.length > 0) {
        console.log('Deleting functions...');
        for (const fnName of config.functions) {
            const name = typeof fnName === 'object' ? fnName.name : fnName;
            try {
                await fnDeleteAction(kbToken, name);
                console.green(`  ✓ Deleted ${name}`);
            } catch (e) {
                console.yellow(`  ⚠ ${name}: ${e.message}`);
            }
        }
    }

    // Disable elastic services
    if (config.elastic) {
        console.log('\nDisabling Elastic services...');

        if (config.elastic.storage) {
            // First remove CloudFront behavior/origin if configured
            const cloudfrontPath = typeof config.elastic.storage === 'object'
                ? config.elastic.storage.cloudfront
                : null;

            if (cloudfrontPath) {
                try {
                    await makePostRequest(KB_API_URL, {
                        token: kbToken,
                        action: 'setStorageCloudFront',
                        pathPrefix: cloudfrontPath,
                        enable: false
                    });
                    console.green(`  ✓ CloudFront behavior removed (/${cloudfrontPath}/*)`);
                } catch (e) {
                    console.yellow(`  ⚠ CloudFront: ${e.message}`);
                }
            }

            // Then delete storage bucket
            try {
                const storageRes = await makePostRequest(KB_API_URL, {
                    token: kbToken,
                    action: 'deleteElasticStorage',
                    force: true
                });
                if (storageRes.error) {
                    console.yellow(`  ⚠ Storage: ${storageRes.error}`);
                } else {
                    console.green('  ✓ Storage disabled');
                }
            } catch (e) {
                console.yellow(`  ⚠ Storage: ${e.message}`);
            }
        }

        if (config.elastic.postgres) {
            try {
                await makePostRequest(KB_API_URL, {
                    token: kbToken,
                    action: 'deleteElasticPostgres'
                });
                console.green('  ✓ Postgres disabled');
            } catch (e) {
                console.yellow(`  ⚠ Postgres: ${e.message}`);
            }
        }

        if (config.elastic.pulse) {
            try {
                await makePostRequest(KB_API_URL, {
                    token: kbToken,
                    action: 'disableElasticPulse'
                });
                console.green('  ✓ Pulse disabled');
            } catch (e) {
                console.yellow(`  ⚠ Pulse: ${e.message}`);
            }
        }
    }

    console.green('\nDestroy complete!');
}

/**
 * Show status of all resources defined in openkbs.json
 */
async function elasticStatusAction() {
    // Find openkbs.json
    const configPaths = [
        path.join(process.cwd(), 'openkbs.json'),
        path.join(process.cwd(), '..', 'openkbs.json')
    ];

    let configPath = null;
    for (const p of configPaths) {
        if (fs.existsSync(p)) {
            configPath = p;
            break;
        }
    }

    if (!configPath) {
        return console.red('openkbs.json not found.');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log(`Stack: ${config.name || 'unnamed'}`);
    console.log(`Region: ${config.region || 'us-east-1'}\n`);

    // Get KB token
    const settings = findSettings();
    if (!settings?.kbId) {
        return console.red('No kbId found. Run from a directory with settings.json');
    }

    const res = await fetchKBJWT(settings.kbId);
    if (!res?.kbToken) {
        return console.red(`KB ${settings.kbId} not found`);
    }
    const kbToken = res.kbToken;

    // Check functions
    if (config.functions && config.functions.length > 0) {
        console.log('Functions:');
        const listRes = await makePostRequest(KB_API_URL, {
            token: kbToken,
            action: 'listElasticFunctions'
        });
        const deployed = listRes.functions?.map(f => f.functionName) || [];

        for (const fnName of config.functions) {
            const name = typeof fnName === 'object' ? fnName.name : fnName;
            if (deployed.includes(name)) {
                const fn = listRes.functions.find(f => f.functionName === name);
                console.green(`  ✓ ${name} (${fn.customUrl || fn.functionUrl})`);
            } else {
                console.yellow(`  ○ ${name} (not deployed)`);
            }
        }
        console.log('');
    }

    // Check elastic services
    if (config.elastic) {
        console.log('Elastic Services:');

        if (config.elastic.storage) {
            const storageRes = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'getElasticStorage'
            });
            if (storageRes.enabled) {
                console.green(`  ✓ Storage (${storageRes.bucket})`);
            } else {
                console.yellow('  ○ Storage (not enabled)');
            }
        }

        if (config.elastic.postgres) {
            const pgRes = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'getElasticPostgres'
            });
            if (pgRes.enabled) {
                console.green(`  ✓ Postgres (${pgRes.host})`);
            } else {
                console.yellow('  ○ Postgres (not enabled)');
            }
        }

        if (config.elastic.pulse) {
            const pulseRes = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'getElasticPulse'
            });
            if (pulseRes.enabled) {
                console.green(`  ✓ Pulse (${pulseRes.endpoint})`);
            } else {
                console.yellow('  ○ Pulse (not enabled)');
            }
        }
    }

    // Site info
    if (config.site) {
        console.log('');
        console.log(`Site: https://files.openkbs.com/${settings.kbId}/`);
    }
}

/**
 * Stack command handler
 */
async function stackAction(subCommand, args = []) {
    switch (subCommand) {
        case 'create':
            const stackName = args[0];
            if (!stackName) {
                console.red('Error: Stack name is required');
                console.log('Usage: openkbs stack create <name>');
                process.exit(1);
            }
            return await stackCreateAction(stackName);
        case 'deploy':
            return await elasticDeployAction();
        case 'destroy':
            return await elasticDestroyAction();
        case 'status':
            return await elasticStatusAction();
        default:
            console.log('Usage: openkbs stack <command>');
            console.log('');
            console.log('Commands:');
            console.log('  deploy     Deploy all resources from openkbs.json');
            console.log('  destroy    Delete all resources (DANGEROUS)');
            console.log('  create     Create new platform stack');
            console.log('  status     Show status of all resources');
    }
}

/**
 * Create a new platform stack from template
 */
async function stackCreateAction(name) {
    try {
        // Download templates from S3 first
        await downloadTemplates();

        const platformTemplateDir = path.join(TEMPLATE_DIR, 'platform');
        const targetDir = path.join(process.cwd(), name);

        if (!fs.existsSync(platformTemplateDir)) {
            console.red('Error: Platform template not found. Run "openkbs update" first.');
            process.exit(1);
        }

        if (fs.existsSync(targetDir)) {
            console.red(`Error: Directory ${name} already exists.`);
            process.exit(1);
        }

        // Copy platform template
        fs.copySync(platformTemplateDir, targetDir);

        // Copy .claude folder with skills
        const claudeTemplateDir = path.join(TEMPLATE_DIR, '.claude');
        const claudeTargetDir = path.join(targetDir, '.claude');
        if (fs.existsSync(claudeTemplateDir)) {
            fs.copySync(claudeTemplateDir, claudeTargetDir);
        }

        // Replace placeholders in all files
        replacePlaceholderInFiles(targetDir, name);

        console.green(`\nPlatform stack "${name}" created successfully!\n`);
        console.log('Structure:');
        console.log(`  ${name}/`);
        console.log('  ├── agents/           # AI agents (each with app/ and src/)');
        console.log('  ├── functions/        # Serverless Lambda functions');
        console.log('  ├── site/             # Static site for whitelabel');
        console.log('  └── openkbs.json      # Elastic services config\n');
        console.log('Next steps:');
        console.log(`  cd ${name}`);
        console.log('  openkbs deploy        # Deploy elastic services');
        console.log('  openkbs fn push api   # Deploy the API function');
    } catch (error) {
        console.red(`Error during stack create:`, error.message);
    }
}

module.exports = {
    signAction,
    serviceAction,
    loginAction,
    pullAction,
    pushAction,
    cloneAction,
    lsAction,
    deleteKBAction,
    deleteFileAction,
    describeAction,
    deployAction,
    createByTemplateAction,
    initByTemplateAction,
    logoutAction,
    installFrontendPackageAction,
    modifyAction,
    downloadModifyAction,
    updateSkillsAction,
    updateCliAction,
    publishAction,
    unpublishAction,
    fnAction,
    siteAction,
    storageAction,
    postgresAction,
    pulseAction,
    stackAction,
    elasticDeployAction,
    elasticDestroyAction
};