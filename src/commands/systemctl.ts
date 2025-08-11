import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logVerbose, logCommand, logSuccess, logError, logWarning, logInfo, setVerbose } from '../utils/logger.js';

const execAsync = promisify(exec);

export const systemctlCommand = new Command('reload')
  .description('Reload service configurations')
  .option('-v, --verbose', 'enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  })
  .action(async () => {
    try {
      const cmd = 'systemctl --user daemon-reload';
      logCommand(cmd);
      logVerbose('Reloading systemd daemon configuration');
      await execAsync(cmd);
      logSuccess('Service configurations reloaded');
    } catch (error) {
      logError('Error reloading configurations:', error);
    }
  });

// Alternative: Keep it as 'system' command with simplified subcommands
export const systemCommand = new Command('system')
  .description('System management commands')
  .option('-v, --verbose', 'enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  });

systemCommand
  .command('reload')
  .description('Reload service configurations after changes')
  .action(async () => {
    try {
      const cmd = 'systemctl --user daemon-reload';
      logCommand(cmd);
      logVerbose('Reloading systemd daemon configuration');
      await execAsync(cmd);
      logSuccess('Service configurations reloaded');
    } catch (error) {
      logError('Error reloading configurations:', error);
    }
  });

systemCommand
  .command('enable <services...>')
  .description('Enable services to start automatically')
  .action(async (services) => {
    for (const service of services) {
      try {
        const serviceName = service.includes('.') ? service : `${service}.container`;
        const cmd = `systemctl --user enable ${serviceName}`;
        logCommand(cmd);
        logVerbose(`Enabling service: ${serviceName}`);
        await execAsync(cmd);
        logSuccess(`${service} will start automatically`);
      } catch (error) {
        logError(`Error enabling ${service}:`, error);
      }
    }
  });

systemCommand
  .command('disable <services...>')
  .description('Disable automatic startup for services')
  .action(async (services) => {
    for (const service of services) {
      try {
        const serviceName = service.includes('.') ? service : `${service}.container`;
        const cmd = `systemctl --user disable ${serviceName}`;
        logCommand(cmd);
        logVerbose(`Disabling service: ${serviceName}`);
        await execAsync(cmd);
        logWarning(`${service} will not start automatically`);
      } catch (error) {
        logError(`Error disabling ${service}:`, error);
      }
    }
  });

systemCommand
  .command('reset-failed [service]')
  .description('Clear failed state of services')
  .action(async (service) => {
    try {
      if (service) {
        const serviceName = service.includes('.') ? service : `${service}.container`;
        const cmd = `systemctl --user reset-failed ${serviceName}`;
        logCommand(cmd);
        logVerbose(`Resetting failed state for: ${serviceName}`);
        await execAsync(cmd);
        logSuccess(`Cleared failed state for ${service}`);
      } else {
        const cmd = 'systemctl --user reset-failed';
        logCommand(cmd);
        logVerbose('Resetting failed state for all services');
        await execAsync(cmd);
        logSuccess('Cleared failed state for all services');
      }
    } catch (error) {
      logError('Error clearing failed state:', error);
    }
  });

systemCommand
  .command('setup-links')
  .description('Create systemd symlinks for containers, sockets, and secrets')
  .action(async () => {
    try {
      const homeDir = os.homedir();
      const cwd = process.cwd();
      
      // Define source and target paths
      const links = [
        {
          name: 'containers',
          source: path.join(cwd, 'containers'),
          target: path.join(homeDir, '.config', 'containers', 'systemd'),
          description: 'Container unit files'
        },
        {
          name: 'sockets',
          source: path.join(cwd, 'user'),
          target: path.join(homeDir, '.config', 'systemd', 'user'),
          description: 'Socket unit files'
        },
        {
          name: 'secrets',
          source: path.join(cwd, 'secrets'),
          target: path.join(homeDir, '.config', 'containers', 'secrets'),
          description: 'Secret files'
        }
      ];
      
      logVerbose('Setting up systemd symlinks...');
      
      for (const link of links) {
        logVerbose(`Processing ${link.name}...`);
        
        // Check if source exists
        if (!fs.existsSync(link.source)) {
          logWarning(`Source directory ${link.source} does not exist, skipping ${link.name}`);
          continue;
        }
        
        // Create target parent directory if it doesn't exist
        const targetParent = path.dirname(link.target);
        if (!fs.existsSync(targetParent)) {
          logVerbose(`Creating parent directory: ${targetParent}`);
          fs.mkdirSync(targetParent, { recursive: true });
        }
        
        // Remove existing target if it exists
        if (fs.existsSync(link.target)) {
          const stats = fs.lstatSync(link.target);
          if (stats.isSymbolicLink()) {
            logVerbose(`Removing existing symlink: ${link.target}`);
            fs.unlinkSync(link.target);
          } else {
            logWarning(`Target ${link.target} exists and is not a symlink - skipping ${link.name}`);
            continue;
          }
        }
        
        // Create the symlink
        logVerbose(`Creating symlink: ${link.target} -> ${link.source}`);
        fs.symlinkSync(link.source, link.target, 'dir');
        logSuccess(`Linked ${link.description}: ${link.target}`);
      }
      
      // Reload systemd daemon to pick up new units
      logVerbose('Reloading systemd daemon to detect new units...');
      const cmd = 'systemctl --user daemon-reload';
      logCommand(cmd);
      await execAsync(cmd);
      
      logSuccess('Systemd symlinks created successfully');
      logInfo('You can now manage services with systemctl --user commands');
      
    } catch (error) {
      logError('Error setting up symlinks:', error);
    }
  });