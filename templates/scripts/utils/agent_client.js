const https = require('https');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { URL } = require('url');

class OpenKBSAgentClient {
    constructor() {
        this.settings = this.findSettings();
        this.secretsPath = this.findSecretsPath();
        this.apiKey = null;
    }

    findSettings() {
        let currentDir = __dirname;

        while (currentDir !== path.parse(currentDir).root) {
            const settingsPath = path.join(currentDir, 'app', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            }
            currentDir = path.dirname(currentDir);
        }

        throw new Error('Could not find app/settings.json in parent directories');
    }

    findSecretsPath() {
        let currentDir = __dirname;

        while (currentDir !== path.parse(currentDir).root) {
            const settingsPath = path.join(currentDir, 'app', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const secretsPath = path.join(currentDir, '.openkbs', 'secrets.json');
                return secretsPath;
            }
            currentDir = path.dirname(currentDir);
        }

        throw new Error('Could not find agent directory with app/settings.json');
    }

    async getApiKey() {
        if (this.apiKey) return this.apiKey;

        if (fs.existsSync(this.secretsPath)) {
            const secrets = JSON.parse(fs.readFileSync(this.secretsPath, 'utf8'));
            this.apiKey = secrets.apiKey;
            return this.apiKey;
        }

        this.apiKey = await this.promptForApiKey();
        this.saveApiKey(this.apiKey);
        return this.apiKey;
    }

    async init() {
        await this.getApiKey();
    }

    async promptForApiKey() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            console.log(`Please generate an API key from: https://${this.settings.kbId}.apps.openkbs.com/?tab=access&createAPIKey=api-${+new Date()}`);

            rl.question('Enter your API key: ', (key) => {
                rl.close();
                resolve(key);
            });

            rl._writeToOutput = (str) => {
                if (str === '\n' || str === '\r\n') {
                    rl.output.write(str);
                } else if (str.match(/[\x08\x7f]/)) {
                    rl.output.write(str);
                } else if (rl.line && str.length === 1) {
                    rl.output.write('*');
                } else {
                    rl.output.write(str);
                }
            };
        });
    }

    saveApiKey(key) {
        const secretsDir = path.dirname(this.secretsPath);
        if (!fs.existsSync(secretsDir)) {
            fs.mkdirSync(secretsDir, { recursive: true });
        }
        fs.writeFileSync(this.secretsPath, JSON.stringify({ apiKey: key }, null, 2));
    }

    /**
     * Run a job and get response from the agent
     *
     * @param {string|Array} message - Either:
     *   - String: "Do something ..."
     *   - Array: [
     *       {type:"text", text:"Process this invoice"},
     *       {type:"image_url", image_url:{url:"https://files.openkbs.com/invoice.png"}}
     *     ]
     *
     * @returns {Promise<Object>} Response structure:
     *   {
     *     data: {
     *       type: 'TEXT' | 'CUSTOM_TYPE',
     *       content: '...' | data: {...}
     *     },
     *     chatId: 'xxx-xxx',
     *     msgId: 'msg_xxx'
     *   }
     */
    async runJob(message, options = {}) {
        const apiKey = await this.getApiKey();
        if (!this.settings.kbId) throw new Error('First use: "openkbs push" to create the agent');

        const payload = { message };
        Object.keys(options).forEach(key => {
            if (key === 'historyLimit') {
                payload[key] = Math.min(Math.max(1, options[key]), 100);
            } else if (options[key] !== undefined) {
                payload[key] = options[key];
            }
        });

        const response = await this.request(
            `https://${this.settings.kbId}.apps.openkbs.com/api`,
            payload,
            { Authorization: `Bearer ${apiKey}` }
        );

        if (response.chatId) this.lastChatId = response.chatId;
        return response;
    }

    async continueChat(message, chatId = null, options = {}) {
        const targetChatId = chatId || this.lastChatId;
        if (!targetChatId) throw new Error('No chatId provided and no previous chat to continue');

        return this.runJob(message, {
            ...options,
            chatId: targetChatId,
            includeHistory: options.includeHistory !== false
        });
    }

    async uploadFile(filePath, options = {}) {
        const apiKey = await this.getApiKey();
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

        const fileContent = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const fileName = options.fileName || `file-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        const fileType = options.fileType || this.getMimeType(filePath);

        const presignedResponse = await this.request('https://kb.openkbs.com/', {
            apiKey,
            kbId: this.settings.kbId,
            namespace: 'files',
            presignedOperation: 'putObject',
            action: 'createPresignedURL',
            fileName,
            fileType
        }, { Origin: `https://${this.settings.kbId}.apps.openkbs.com` });

        const presignedUrl = presignedResponse.presignedUrl || presignedResponse;

        await this.requestRaw(presignedUrl, fileContent, {
            'Content-Type': fileType,
            'Content-Length': fileContent.length
        }, 'PUT');

        return {
            fileName,
            uploaded: true,
            url: `https://file.openkbs.com/files/${this.settings.kbId}/${fileName}`
        };
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.xml': 'application/xml',
            '.zip': 'application/zip'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // Unified HTTP request helper
    async request(url, payload, headers = {}, method = 'POST') {
        return new Promise((resolve, reject) => {
            const { hostname, pathname, search } = new URL(url);
            const req = https.request({
                hostname,
                path: pathname + (search || ''),
                method,
                headers: { 'Content-Type': 'application/json', ...headers }
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (res.statusCode === 401) {
                            if (fs.existsSync(this.secretsPath)) fs.unlinkSync(this.secretsPath);
                            reject(new Error('Authentication failed. Please run "node scripts/run_job.js init" to reconfigure.'));
                        } else if (res.statusCode !== 200) {
                            reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            }).on('error', reject);

            req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
            req.end();
        });
    }

    // Raw request for binary data
    async requestRaw(url, data, headers = {}, method = 'PUT') {
        return new Promise((resolve, reject) => {
            const { hostname, pathname, search } = new URL(url);
            const req = https.request({
                hostname,
                path: pathname + (search || ''),
                method,
                headers
            }, res => {
                if (res.statusCode === 200 || res.statusCode === 204) {
                    resolve();
                } else {
                    let responseData = '';
                    res.on('data', chunk => responseData += chunk);
                    res.on('end', () => reject(new Error(`Request failed with status ${res.statusCode}: ${responseData}`)));
                }
            }).on('error', reject);

            req.write(data);
            req.end();
        });
    }
}

module.exports = OpenKBSAgentClient;