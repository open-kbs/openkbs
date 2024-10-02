#!/usr/bin/env node
const { program } = require('commander');
const packageJson = require('../package.json');
const fs = require('fs-extra');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../templates');

const {
    signAction,
    loginAction,
    pullAction,
    pushAction,
    cloneAction,
    createKBAction,
    lsAction,
    deleteKBAction,
    deleteFileAction,
    describeAction, deployAction
} = require('./actions');


const getPushPullHelpText = (command) => `
Examples:
  $ openkbs ${command} origin app/settings.json
  $ openkbs ${command} origin app/instructions.txt
  $ openkbs ${command} origin app/icon.png
  $ openkbs ${command} origin Frontend/contentRender.js
  $ openkbs ${command} origin Events/onRequest.js

Parameters:
  location    The location where the files are ${command === 'push' ? 'uploaded' : 'pulled'}. Possible values are:
              - origin: Use the OpenKBS cloud service for ${command === 'push' ? 'uploading' : 'pulling'} files.
              - aws: Use AWS S3 (in your own AWS account) for ${command === 'push' ? 'uploading' : 'pulling'} files.
              - localstack: Use LocalStack for local S3 emulation.

  targetFile  (Optional) The specific file to ${command}. If not provided, all files will be ${command === 'push' ? 'pushed' : 'pulled'}.
`;

program.version(packageJson.version);

program
    .command('login')
    .description('Login to OpenKBS and store session locally.')
    .action(loginAction);

program
    .command('pull [location] [targetFile]')
    .description('Pull KB settings, instructions and source code to local KB')
    .action(pullAction)
    .addHelpText('after', getPushPullHelpText('pull'));

program
    .command('push [location] [targetFile]')
    .description('Push KB settings, instructions and source code to remote KB.')
    .action(pushAction)
    .addHelpText('after', getPushPullHelpText('push'));

program
    .command('deploy [moduleName]')
    .description('Builds and deploys a specified moduleName to OpenKBS Cloud "dist" module folder. If moduleName is not provided, deploys all modules.')
    .action(deployAction)
    .addHelpText('after', `
Examples:
  $ openkbs deploy
  $ openkbs deploy onRequest
  $ openkbs deploy onResponse
  $ openkbs deploy onAddMessages
  $ openkbs deploy contentRender
`);

program
    .command('clone <kbId>')
    .description('Clone existing KB locally by provided kbId')
    .action(cloneAction);

program
    .command('create kb')
    .description('Create new KB')
    .option('-s, --self-managed-keys', 'Enable self-managed keys mode')
    .option('-f, --force', 'Force KB creation')
    .action(createKBAction);

program
    .command('ls [kbId] [field]')
    .description('List all KBs or show detailed information for a specific KB by providing kbId')
    .action(lsAction);

program
    .command('delete <kbId>')
    .description('Delete a KB by providing kbId')
    .action(deleteKBAction);

program
    .command('delete-file <kbId> <filePath>')
    .description(`Delete a file inside the "src" folder by providing kbId and filePath (example: openkbs delete-file 1234567890ab Frontend/test.js)`)
    .action(deleteFileAction);

program
    .command('describe')
    .description('Display the current local KB details')
    .action(describeAction);

program
    .command('sign')
    .description('Signs a transaction to request OpenKBS service')
    .requiredOption('-a, --toAccountId <toAccountId>', 'Receiver account ID')
    .option('-e, --expires <expiresInSeconds>', 'Expiration time in seconds', '60')
    .option('-m, --maxAmount <maxAmount>', 'Maximum authorized charge', '300000')
    .option('-r, --resourceId <resourceId>', 'Resource ID', 'credits')
    .option('-p, --payload <payload>', 'Payload')
    .action(signAction);

program
    .command('create <app-name>')
    .description('Create a new application')
    .action((appName) => {
        const targetDir = path.join(process.cwd(), appName);

        if (fs.existsSync(targetDir)) {
            console.error(`Error: Directory ${appName} already exists.`);
            process.exit(1);
        }

        fs.copySync(TEMPLATE_DIR, targetDir);

        // Function to replace {{{openkbsAppName}}} in files that contain it
        const replacePlaceholderInFiles = (dir) => {
            const files = fs.readdirSync(dir);

            files.forEach((file) => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    replacePlaceholderInFiles(filePath);
                } else if (stat.isFile()) {
                    let content = fs.readFileSync(filePath, 'utf8');
                    if (content.includes('{{{openkbsAppName}}}')) {
                        content = content.replace(/{{{openkbsAppName}}}/g, appName);
                        fs.writeFileSync(filePath, content, 'utf8');
                    }
                }
            })
        }

        // Replace {{{openkbsAppName}}} in files that contain it
        replacePlaceholderInFiles(targetDir);

        console.log(`Application ${appName} created successfully.`);
    });

program
    .command('init')
    .description('Initialize the current directory with missing template files')
    .action(() => {
        const targetDir = process.cwd();

        // Copy all files and folders, skipping existing ones
        fs.readdirSync(TEMPLATE_DIR).forEach(item => {
            const srcPath = path.join(TEMPLATE_DIR, item);
            const destPath = path.join(targetDir, item);

            if (fs.existsSync(destPath)) {
                console.log(`Skipping existing item: ${item}`);
            } else {
                fs.copySync(srcPath, destPath);
                console.log(`Copied: ${item}`);
            }
        });

        console.log('Initialization complete.');
    });


program.parse(process.argv);