const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const express = require('express');
const { exec, execSync } = require('child_process');
const https = require('https');

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

async function updateKnowledgeAction(silent = false) {
    try {
        const knowledgeDir = path.join(process.cwd(), '.openkbs', 'knowledge');
        const metadataPath = path.join(knowledgeDir, 'metadata.json');
        const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
        
        // Check if .openkbs/knowledge directory exists
        if (!fs.existsSync(knowledgeDir)) {
            if (!silent) {
                console.red('Knowledge directory not found. Please ensure you are in an OpenKBS project directory.');
            }
            return;
        }
        
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
                return;
            }
        }
        
        // Check remote version from S3
        const https = require('https');
        const bucket = 'openkbs-downloads';
        const remoteMetadataKey = 'templates/.openkbs/knowledge/metadata.json';
        
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
            console.green('Knowledge base is already up to date.');
            return;
        }
        
        console.log(`Updating knowledge base from version ${localVersion || 'unknown'} to ${remoteVersion}...`);
        
        // Download updated knowledge files from S3
        await downloadKnowledgeFromS3(knowledgeDir);
        
        // Download CLAUDE.md file from S3
        await downloadClaudeMdFromS3(claudeMdPath);
        
        console.green('Knowledge base updated successfully!');
        
    } catch (error) {
        if (!silent) {
            console.red('Error updating knowledge base:', error.message);
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
                    stdio: 'inherit'
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

        // Also update knowledge base silently if it exists
        await updateKnowledgeAction(true);

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


async function downloadKnowledgeFromS3(targetDir) {
    const https = require('https');
    const bucket = 'openkbs-downloads';
    const prefix = 'templates/.openkbs/knowledge/';
    const baseUrl = `https://${bucket}.s3.amazonaws.com`;
    
    try {
        // List all objects in knowledge folder
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
            console.yellow('No knowledge files found in remote repository.');
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
        console.red('Error downloading knowledge files from S3:', error.message);
        throw error;
    }
}

async function downloadClaudeMdFromS3(claudeMdPath) {
    const https = require('https');
    const bucket = 'openkbs-downloads';
    const claudeMdKey = 'templates/CLAUDE.md';
    
    try {
        // Download CLAUDE.md file from S3
        const fileUrl = `https://${bucket}.s3.amazonaws.com/${claudeMdKey}`;
        const fileContent = await new Promise((resolve, reject) => {
            https.get(fileUrl, (res) => {
                if (res.statusCode === 404) {
                    reject(new Error('NoSuchKey'));
                    return;
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });
        
        await fs.writeFile(claudeMdPath, fileContent);
        
        console.log('Downloaded: CLAUDE.md');
        
    } catch (error) {
        if (error.message === 'NoSuchKey') {
            console.yellow('CLAUDE.md not found in remote repository, skipping...');
        } else {
            console.red('Error downloading CLAUDE.md:', error.message);
            throw error;
        }
    }
}

// ===== Elastic Functions Commands =====

async function fnAction(subCommand, args = []) {
    const localKBData = await fetchLocalKBData();
    const kbId = localKBData?.kbId;

    if (!kbId) {
        return console.red('No KB found. Please run this command in a KB project directory.');
    }

    const { kbToken } = await fetchKBJWT(kbId);

    switch (subCommand) {
        case 'list':
            return await fnListAction(kbToken);
        case 'deploy':
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
            console.log('  deploy <name>           Deploy a function from ./functions/<name>/');
            console.log('  delete <name>           Delete a function');
            console.log('  logs <name>             View function logs');
            console.log('  env <name> [KEY=value]  View or set environment variables');
            console.log('  invoke <name> [payload] Invoke a function');
            console.log('');
            console.log('Options for deploy:');
            console.log('  --region <region>       Region (us-east-2, eu-central-1, ap-southeast-1)');
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
            console.log('  3. Deploy: openkbs fn deploy hello --region us-east-2');
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

    // Parse arguments
    let region = 'us-east-2';
    let memorySize = 256;
    let timeout = 30;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--region' && args[i + 1]) {
            region = args[++i];
        } else if (args[i] === '--memory' && args[i + 1]) {
            memorySize = parseInt(args[++i]);
        } else if (args[i] === '--timeout' && args[i + 1]) {
            timeout = parseInt(args[++i]);
        }
    }

    const functionDir = path.join(process.cwd(), 'functions', functionName);

    if (!await fs.pathExists(functionDir)) {
        return console.red(`Function directory not found: ${functionDir}`);
    }

    console.log(`Deploying function '${functionName}' to ${region}...`);

    try {
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
            response = await makePostRequest(KB_API_URL, {
                token: kbToken,
                action: 'createElasticFunction',
                functionName,
                code,
                region,
                memorySize,
                timeout
            });
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

module.exports = {
    signAction,
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
    updateKnowledgeAction,
    updateCliAction,
    publishAction,
    unpublishAction,
    fnAction
};