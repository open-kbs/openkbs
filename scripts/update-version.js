const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionJsonPath = path.join(__dirname, '..', 'version.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionData = {
    version: packageJson.version,
    releaseDate: new Date().toISOString().split('T')[0],
    releaseNotes: `OpenKBS CLI version ${packageJson.version}`
};

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));

console.log(`Updated version.json with version ${packageJson.version}`);