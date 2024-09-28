#!/usr/bin/env node
const { program } = require('commander');
const packageJson = require('./package.json');
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
    describeAction
} = require('./actions');

const getPushPullHelpText = (command) => `
Examples:
  $ openkbs ${command} origin
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
    .description('Pull KB details and files using kbId from app/settings.json')
    .action(pullAction)
    .addHelpText('after', getPushPullHelpText('pull'));

program
    .command('push [location] [targetFile]')
    .description('Push KB details and files from settings.json and local files to update remote KB.')
    .action(pushAction)
    .addHelpText('after', getPushPullHelpText('push'));

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

program.parse(process.argv);