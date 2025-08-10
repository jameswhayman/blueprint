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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('blueprint')
  .description('CLI tool for scaffolding containerized deployments with Caddy and Authelia')
  .version(packageJson.version);

program.addCommand(initCommand);
program.addCommand(servicesCommand);
program.addCommand(authCommand);
program.addCommand(secretsCommand);
program.addCommand(domainCommand);

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}