const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const platform = os.platform();
const arch = os.arch();
let url = '';

if (platform === 'linux' && arch === 'x64') {
    url = 'https://downloads.openkbs.com/cli/linux/openkbs';
} else if (platform === 'darwin' && arch === 'arm64') {
    url = 'https://downloads.openkbs.com/cli/macos/openkbs';
} else if (platform === 'darwin' && arch === 'x64') {
    url = 'https://downloads.openkbs.com/cli/macos/openkbs-x64';
} else if (platform === 'win32' && arch === 'x64') {
    url = 'https://downloads.openkbs.com/cli/windows/openkbs.exe';
} else if (platform === 'win32' && arch === 'arm64') {
    url = 'https://downloads.openkbs.com/cli/windows/openkbs-arm64.exe';
} else if (platform === 'linux' && arch === 'arm64') {
    url = 'https://downloads.openkbs.com/cli/linux/openkbs-arm64';
} else {
    console.error(`Unsupported platform: ${platform} ${arch}`);
    process.exit(1);
}

const downloadPath = path.join(__dirname, 'openkbs');
const file = fs.createWriteStream(downloadPath);

https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
        file.close(() => {
            if (platform !== 'win32') {
                fs.chmodSync(downloadPath, '755');
            }
            const targetPath = path.join(__dirname, 'node_modules', '.bin', 'openkbs');
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.renameSync(downloadPath, targetPath);
            console.log('openkbs CLI installed successfully.');
        });
    });
}).on('error', (err) => {
    fs.unlink(downloadPath, () => {});
    console.error(`Error downloading openkbs CLI: ${err.message}`);
    process.exit(1);
});