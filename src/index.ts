import { Command } from 'commander';
import { loginCommand, logoutCommand, authCommand } from './commands/auth.js';
import { lsCommand, createCommand } from './commands/project.js';
import { deployCommand } from './commands/deploy.js';
import { fnCommand } from './commands/fn.js';
import { siteCommand } from './commands/site.js';
import { storageCommand } from './commands/storage.js';
import { postgresCommand } from './commands/postgres.js';
import { mqttCommand } from './commands/mqtt.js';
import { emailCommand } from './commands/email.js';
import { domainCommand } from './commands/domain.js';
import { imageCommand } from './commands/image.js';
import { boardCommand } from './commands/board.js';
import { uiCommand } from './commands/ui.js';
import { checkForUpdate, CLI_VERSION, updateCommand } from './lib/updater.js';

function collect(val: string, arr: string[]): string[] {
  return [...arr, val];
}

function wrapAction(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name('openkbs')
  .description('OpenKBS Platform CLI')
  .version(CLI_VERSION);

program.command('login').description('Log in to OpenKBS').action(loginCommand);
program.command('logout').description('Log out').action(logoutCommand);
program.command('auth').description('Authenticate with a project token').argument('<token>').action(authCommand);
program.command('list').alias('ls').description('List projects').action(wrapAction(lsCommand));

program.command('create')
  .description('Create and scaffold a new project')
  .argument('[name]', 'Project name')
  .option('-r, --region <region>', 'Region', 'eu-central-1')
  .action(wrapAction(createCommand));

program.command('deploy').description('Deploy elastic services from openkbs.json').action(wrapAction(deployCommand));
program.command('update').description('Update CLI binary + download latest skill into project').action(updateCommand);

program.command('ui')
  .description('Start local development UI')
  .option('-p, --port <port>', 'Port', '3000')
  .option('--no-open', 'Do not open browser')
  .action(uiCommand);

// Functions
const fn = program.command('fn').description('Manage Lambda functions');
fn.command('create')
  .description('Create a new function')
  .argument('<name>')
  .option('-m, --memory <mb>', 'Memory in MB')
  .option('-t, --timeout <sec>', 'Timeout in seconds')
  .action(wrapAction(fnCommand.create));
fn.command('list').alias('ls').description('List functions').action(wrapAction(fnCommand.list));
fn.command('deploy')
  .description('Deploy a function')
  .argument('<name>')
  .option('-s, --schedule <expr>', 'Schedule expression (e.g., "rate(1 hour)")')
  .option('-m, --memory <mb>', 'Memory in MB')
  .option('-t, --timeout <sec>', 'Timeout in seconds')
  .option('--no-http', 'Disable HTTP access')
  .action(wrapAction(fnCommand.push));
fn.command('logs').description('View function logs').argument('<name>').action(wrapAction(fnCommand.logs));
fn.command('invoke')
  .description('Invoke a function')
  .argument('<name>')
  .option('-d, --data <json>', 'JSON payload')
  .action(wrapAction(fnCommand.invoke));
fn.command('destroy').description('Delete a function').argument('<name>').action(wrapAction(fnCommand.del));

// Site
const site = program.command('site').description('Manage static site');
site.command('deploy').description('Deploy static site').action(wrapAction(siteCommand.push));

// Storage
const stor = program.command('storage').description('Manage object storage');
stor.command('list').alias('ls').description('List objects').argument('[prefix]').action(wrapAction(storageCommand.ls));
stor.command('upload')
  .description('Upload a file')
  .argument('<local-path>')
  .argument('[remote-path]')
  .action(wrapAction(storageCommand.upload));
stor.command('download')
  .description('Download a file')
  .argument('<remote-path>')
  .argument('[local-path]')
  .action(wrapAction(storageCommand.download));
stor.command('rm').description('Delete objects').argument('<keys...>').action(wrapAction(storageCommand.rm));

// Postgres
const postgres = program.command('postgres').description('Manage PostgreSQL');
postgres.command('info').description('Show connection info').action(postgresCommand.info);
postgres.command('connection').description('Output connection string').action(postgresCommand.connection);

// MQTT
const mqtt = program.command('mqtt').description('Manage real-time messaging');
mqtt.command('info').description('Show MQTT status').action(mqttCommand.info);
mqtt.command('enable').description('Enable MQTT for this project').action(mqttCommand.enable);
mqtt.command('disable').description('Disable MQTT for this project').action(mqttCommand.disable);
mqtt.command('token')
  .description('Generate temporary credentials for client connection')
  .option('-u, --userId <userId>', 'User identifier')
  .action(mqttCommand.token);
mqtt.command('publish')
  .description('Publish a message')
  .argument('<channel>')
  .option('-d, --data <json>', 'JSON message payload')
  .action(mqttCommand.publish);

// Email
const eml = program.command('email').description('Manage email sending');
eml.command('enable').description('Enable email for this project').action(emailCommand.enable);
eml.command('info').description('Show email status').action(emailCommand.info);
eml.command('send')
  .description('Send an email')
  .argument('<to>')
  .option('-s, --subject <subject>', 'Email subject')
  .option('-b, --body <text>', 'Plain text body')
  .option('--html <html>', 'HTML body')
  .action(emailCommand.send);
eml.command('disable').description('Disable email').action(emailCommand.disable);
eml.command('verify-domain').description('Verify custom domain for email sending').argument('<domain>').action(emailCommand.verifyDomain);
eml.command('verify-status').description('Check domain verification status').action(emailCommand.verifyStatus);

// Domain
const dom = program.command('domain').description('Manage custom domain');
dom.command('add').description('Register a custom domain').argument('<domain>').action(domainCommand.add);
dom.command('verify').description('Check DNS/certificate status').action(domainCommand.verify);
dom.command('provision').description('Create CloudFront distribution').action(domainCommand.provision);
dom.command('info').description('Show domain configuration').action(domainCommand.info);
dom.command('remove').description('Remove custom domain').action(domainCommand.remove);

// Image generation
program.command('image')
  .description('Generate an image (supports reference images)')
  .argument('<prompt>')
  .option('-o, --output <file>', 'Output file', 'site/image.png')
  .option('--fast', 'Use fast model (quicker, lighter quality)')
  .option('--ref <file>', 'Reference image (repeatable)', collect, [])
  .option('--aspect-ratio <ratio>', 'Aspect ratio', '1:1')
  .option('--count <n>', 'Number of images (1-4)', '1')
  .action((prompt: string, opts: any) => imageCommand.generate(prompt, opts));

// Board (Task Management)
const board = program.command('board').description('Manage project board');
board.action(boardCommand.show); // `openkbs board` shows the board
board.command('create')
  .description('Create a card')
  .argument('<title>')
  .option('-c, --column <name>', 'Column name (default: Backlog)')
  .option('-t, --type <type>', 'Card type (task, bug, feature, paid-task)')
  .option('-p, --priority <priority>', 'Priority (low, medium, high, critical)')
  .option('-d, --description <text>', 'Card description')
  .action(boardCommand.create);
board.command('update')
  .description('Update a card')
  .argument('<cardId>')
  .option('--title <title>', 'New title')
  .option('--description <text>', 'New description')
  .option('--priority <priority>', 'New priority')
  .option('--status <status>', 'New status (open, resolved, archived)')
  .option('--type <type>', 'New type')
  .action(boardCommand.update);
board.command('move')
  .description('Move card to column')
  .argument('<cardId>')
  .argument('<columnName>')
  .action(boardCommand.move);
board.command('comment')
  .description('Add comment to card')
  .argument('<cardId>')
  .argument('<message>')
  .action(boardCommand.comment);
board.command('delete')
  .description('Delete a card')
  .argument('<cardId>')
  .action(boardCommand.del);

await checkForUpdate();
program.parse();
