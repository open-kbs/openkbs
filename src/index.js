#!/usr/bin/env node
const { program } = require('commander');
const packageJson = require('../package.json');

const {
    signAction,
    loginAction,
    pullAction,
    pushAction,
    cloneAction,
    lsAction,
    deleteKBAction,
    deleteFileAction,
    describeAction, deployAction, createByTemplateAction, initByTemplateAction,
    logoutAction, installFrontendPackageAction
} = require('./actions');


const getPushPullHelpText = (command) => `
Examples:
  $ openkbs ${command}
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
    .command('create <app-name>')
    .description('Create a new KB application')
    .action(createByTemplateAction);

program
    .command('init')
    .description('Initialize the current directory as a KB application (generates standard template files in the current folder)')
    .action(initByTemplateAction);

program
    .command('push [location] [targetFile]')
    .description('Push KB settings, instructions and source code to remote KB.')
    .option('-s, --self-managed-keys', 'Enable self-managed keys mode during the initial push before the remote KB is created.')
    .action(pushAction)
    .addHelpText('after', getPushPullHelpText('push'));

program
    .command('pull [location] [targetFile]')
    .description('Pull KB settings, instructions and source code to local KB')
    .action(pullAction)
    .addHelpText('after', getPushPullHelpText('pull'));

program
    .command('clone <kbId>')
    .description('Clone existing KB locally by provided kbId')
    .action(cloneAction);

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
    .command('deploy [moduleName]')
    .description('Builds and deploys a specified moduleName to "dist" module folder. If moduleName is not provided, deploys all modules.')
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
    .command('sign')
    .description('Signs a transaction to request OpenKBS service')
    .requiredOption('-a, --toAccountId <toAccountId>', 'Receiver account ID')
    .option('-e, --expires <expiresInSeconds>', 'Expiration time in seconds', '60')
    .option('-m, --maxAmount <maxAmount>', 'Maximum authorized charge', '300000')
    .option('-r, --resourceId <resourceId>', 'Resource ID', 'credits')
    .option('-p, --payload <payload>', 'Payload')
    .action(signAction);

// Set up the CLI program
program
    .command('contentRender install <packageName>')
    .alias('contentRender i')
    .description('Install a frontend package and update contentRender.json')
    .action((_,packageName) => installFrontendPackageAction(packageName));

program
    .command('logout')
    .description('Log out from OpenKBS by deleting the locally stored session token.')
    .action(logoutAction);

// program
//     .command('evolve <featureDescription>')
//     .description('Evolve the application by providing additional feature requirements before deployment.')
//     .action(evolveApplication)
//     .addHelpText('after', `
// Examples:
//   $ openkbs evolve "Add water tracking feature"
// `);

program.parse(process.argv);