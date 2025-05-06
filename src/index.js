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
    logoutAction, installFrontendPackageAction, modifyAction, downloadModifyAction
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
    .description('Clone remote KB locally by provided kbId')
    .action(cloneAction);

program
    .command('modify <prompt> [targetFiles...]')
    .description('Enhance or alter an existing KB using AI. Results in a modified version of the application, potentially affecting one or multiple files.')
    .action(modifyAction)
    .option('-c, --chatURL <url>', 'Specify a custom URL for the chat service that will handle the modification request')
    .option('-m, --chatModel <modelId>', 'Specify a custom service id for the LLM to be used for the modification process')
    .option('-i, --instructions <instructions>', 'Provide specific instructions for the chat service to guide the modification request')
    .option('--verbose', 'Enables verbose mode')
    .option('--preserveChat', 'Keep the modification chat history intact instead of clearing it after completion')
    .option('--onRequestHandler <filePath>', 'Provide a custom onRequest handler to the modifier agent')
    .option('--onResponseHandler <filePath>', 'Provide a custom onResponse handler to the modifier agent')
    .addHelpText('after', () => `
Examples:
  $ openkbs modify "Improve the user interface"
  $ openkbs modify "Improve the user interface" src/Frontend/contentRender.js src/Frontend/contentRender.json
`);

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

// program
//     .command('sign')
//     .description('Signs a transaction to request OpenKBS service')
//     .requiredOption('-a, --toAccountId <toAccountId>', 'Receiver account ID')
//     .option('-e, --expires <expiresInSeconds>', 'Expiration time in seconds', '60')
//     .option('-m, --maxAmount <maxAmount>', 'Maximum authorized charge', '300000')
//     .option('-r, --resourceId <resourceId>', 'Resource ID', 'credits')
//     .option('-p, --payload <payload>', 'Payload')
//     .action(signAction);

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

program
    .command('init-modify')
    .description('Download the latest MODIFY.md template from GitHub to help with KB modifications')
    .action(downloadModifyAction)
    .addHelpText('after', `
Examples:
  $ openkbs init-modify
  
This will download the MODIFY.md template file from the OpenKBS GitHub repository to your current directory.
This file will be automatically included when you run the 'openkbs modify' command.
`);

program.parse(process.argv);