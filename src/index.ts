#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { servicesCommand } from './commands/services.js';
import { authCommand } from './commands/auth.js';
import { secretsCommand } from './commands/secrets.js';
import { domainCommand } from './commands/domain.js';
import { systemctlCommand, systemCommand } from './commands/systemctl.js';
import { resetCommand } from './commands/reset.js';
import { setVerbose } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('blueprint')
  .description('CLI tool for scaffolding containerized deployments with Caddy and Authelia')
  .version(packageJson.version)
  .option('-v, --verbose', 'enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  });

program.addCommand(initCommand);
program.addCommand(servicesCommand);
program.addCommand(authCommand);
program.addCommand(secretsCommand);
program.addCommand(domainCommand);
program.addCommand(systemctlCommand);
program.addCommand(systemCommand);
program.addCommand(resetCommand);

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}