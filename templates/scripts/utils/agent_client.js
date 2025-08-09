const https = require('https');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

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

    async runJob(message, options = {}) {
        const apiKey = await this.getApiKey();

        if (!this.settings.kbId) {
            throw new Error('First use: "openkbs push" to create the agent');
        }

        const chatTitle = options.chatTitle || `Task ${new Date().getTime()}`;
        const chatId = await this.startJob(chatTitle, message, { kbId: this.settings.kbId, apiKey });

        console.log(`Job ${chatId} created.\nWorking ...`);

        if (options.poll !== false) {
            return this.pollForMessages(chatId, { kbId: this.settings.kbId, apiKey });
        }

        return chatId;
    }

    async startJob(chatTitle, data, app) {
        const response = await this.makeRequest('https://chat.openkbs.com/', {
            ...app,
            chatTitle,
            message: data
        });

        try {
            return JSON.parse(response)[0].createdChatId;
        } catch (error) {
            if (fs.existsSync(this.secretsPath)) {
                fs.unlinkSync(this.secretsPath);
            }
            throw new Error('Authentication failed.');
        }
    }

    makeRequest(url, payload) {
        return new Promise((resolve, reject) => {
            const { hostname, pathname } = new URL(url);
            const req = https.request({
                hostname,
                path: pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);

            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    parseJSONFromText(text) {
        let braceCount = 0, startIndex = text.indexOf('{');
        if (startIndex === -1) return null;

        for (let i = startIndex; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            if (text[i] === '}' && --braceCount === 0) {
                try {
                    return JSON.parse(text.slice(startIndex, i + 1));
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    async pollForMessages(chatId, app) {
        const payload = {
            ...app,
            action: 'getChatMessages',
            chatId,
            decryptContent: true
        };

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                this.makeRequest('https://chat.openkbs.com/', payload)
                    .then(jsonString => {
                        const messages = JSON.parse(jsonString)[0].data.messages;

                        for (const message of messages) {
                            if (message.role === 'system') {
                                try {
                                    const contentData = this.parseJSONFromText(message.content);
                                    const { _meta_actions, _meta_type, _event, data, type } = contentData;

                                    // Skip if execution continues
                                    if (_meta_actions?.includes?.("REQUEST_CHAT_MODEL")) continue;

                                    // onResponse finished without tool calls - return LLM response
                                    if (_meta_type === 'EVENT_FINISHED' && type === 'CONTINUE' && _event === 'onResponse') {
                                        const lastAssistantMessage = messages.slice().reverse().find(msg => msg.role === 'assistant');
                                        if (lastAssistantMessage) {
                                            clearInterval(interval);
                                            resolve(
                                                this.parseJSONFromText(lastAssistantMessage.content) ||
                                                { type: 'FREE_TEXT_RESPONSE', content: lastAssistantMessage.content }
                                            );
                                            return;
                                        }
                                    }

                                    const result = data?.find?.(item =>
                                        item.type === 'JOB_COMPLETED' || item.type === 'JOB_FAILED'
                                    ) || contentData;
                                    clearInterval(interval);
                                    resolve(result);
                                    return;

                                } catch (e) {
                                    // Continue if message content is not valid JSON
                                }
                            }
                        }
                    })
                    .catch(console.error);
            }, 1000);
        });
    }
}

module.exports = OpenKBSAgentClient;