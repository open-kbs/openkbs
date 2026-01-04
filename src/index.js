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
    logoutAction, installFrontendPackageAction, modifyAction, downloadModifyAction,
    updateSkillsAction, updateCliAction, publishAction, unpublishAction,
    fnAction,
    siteAction,
    storageAction,
    postgresAction,
    pulseAction,
    stackAction,
    elasticDeployAction,
    elasticDestroyAction
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
    .command('deploy')
    .description('Deploy from openkbs.json - enables elastic services, deploys functions and site')
    .action(elasticDeployAction)
    .addHelpText('after', `
Examples:
  $ openkbs deploy

Reads openkbs.json and deploys:
  - Elastic services (pulse, postgres, storage)
  - Functions
  - Site
`);

program
    .command('destroy')
    .description('Destroy all resources from openkbs.json (DANGEROUS)')
    .action(elasticDestroyAction)
    .addHelpText('after', `
Examples:
  $ openkbs destroy

Reads openkbs.json and deletes:
  - Functions
  - Elastic services (storage, postgres, pulse)
`);

program
    .command('stack <subcommand> [args...]')
    .description('Manage stack resources (create, deploy, destroy, status)')
    .action((subCommand, args) => stackAction(subCommand, args))
    .addHelpText('after', `
Commands:
  create <name>  Create new platform stack from template
  deploy         Deploy all resources from openkbs.json
  destroy        Delete all resources (DANGEROUS)
  status         Show status of all resources

Examples:
  $ openkbs stack create my-platform
  $ openkbs stack deploy
  $ openkbs stack status
  $ openkbs stack destroy
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

program
    .command('update [target]')
    .description('Update OpenKBS CLI or skills (default: CLI)')
    .action((target) => {
        if (!target) {
            updateCliAction();
        } else if (target === 'skills') {
            updateSkillsAction();
        } else {
            console.error(`Unknown update target: ${target}. Supported: skills`);
            process.exit(1);
        }
    })
    .addHelpText('after', `
Examples:
  $ openkbs update
  Check for CLI updates and install them.

  $ openkbs update skills
  Update .claude/skills/openkbs/ with latest OpenKBS skill files.
`);

program
    .command('publish <domain>')
    .description('Publish KB to a custom domain')
    .action(publishAction)
    .addHelpText('after', `
Examples:
  $ openkbs publish example.com
  This will publish your KB to the domain example.com
`);

program
    .command('unpublish <domain>')
    .description('Unpublish KB from a custom domain')
    .action(unpublishAction)
    .addHelpText('after', `
Examples:
  $ openkbs unpublish example.com
  This will unpublish your KB from the domain example.com
`);

program
    .command('fn [subCommand] [args...]')
    .description('Manage Elastic Functions (serverless Lambda functions)')
    .allowUnknownOption()
    .action((subCommand, args) => fnAction(subCommand, args))
    .addHelpText('after', `
Examples:
  $ openkbs fn list                           List all functions
  $ openkbs fn push hello --region us-east-1  Push function from ./functions/hello/
  $ openkbs fn delete hello                   Delete a function
  $ openkbs fn logs hello                     View function logs
  $ openkbs fn env hello                      View environment variables
  $ openkbs fn env hello API_KEY=secret       Set environment variable
  $ openkbs fn invoke hello '{"test": true}'  Invoke a function
`);

program
    .command('site [subCommand] [args...]')
    .description('Manage static site files for whitelabel domains')
    .action((subCommand, args) => siteAction(subCommand, args))
    .addHelpText('after', `
Examples:
  $ openkbs site push              Push site/ folder (or current dir) to S3
  $ openkbs site push ./dist       Push specific folder to S3

Run from a directory containing settings.json with kbId.
`);

program
    .command('storage [subCommand] [args...]')
    .description('Manage Elastic Storage (S3 buckets for persistent file storage)')
    .allowUnknownOption()
    .action((subCommand, args) => storageAction(subCommand, args))
    .addHelpText('after', `
Examples:
  $ openkbs storage enable                    Enable storage for current KB
  $ openkbs storage status                    Show storage status
  $ openkbs storage ls [prefix]               List objects in bucket
  $ openkbs storage put <file> <key>          Upload a file
  $ openkbs storage get <key> <file>          Download a file
  $ openkbs storage rm <key>                  Delete an object
  $ openkbs storage disable                   Disable storage (delete bucket)
  $ openkbs storage cloudfront media          Add storage to CloudFront at /media/*
  $ openkbs storage cloudfront remove media   Remove storage from CloudFront
`);

program
    .command('postgres [subCommand]')
    .description('Manage Elastic Postgres (Neon PostgreSQL database)')
    .action((subCommand) => postgresAction(subCommand))
    .addHelpText('after', `
Examples:
  $ openkbs postgres enable                   Enable Postgres for current KB
  $ openkbs postgres status                   Show Postgres status
  $ openkbs postgres connection               Show connection string
  $ openkbs postgres disable                  Disable Postgres (delete database)
`);

program
    .command('pulse [subCommand] [args...]')
    .description('Manage Elastic Pulse (real-time WebSocket pub/sub)')
    .action((subCommand, args) => pulseAction(subCommand, args))
    .addHelpText('after', `
Examples:
  $ openkbs pulse enable                      Enable Pulse for current KB
  $ openkbs pulse status                      Show Pulse status and endpoint
  $ openkbs pulse channels                    List active channels
  $ openkbs pulse presence chat               Show clients connected to 'chat' channel
  $ openkbs pulse publish chat "Hello!"       Send message to 'chat' channel
  $ openkbs pulse disable                     Disable Pulse
`);

program.parse(process.argv);