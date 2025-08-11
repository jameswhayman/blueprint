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
      
      logVerbose('Setting up systemd symlinks...');
      
      // 1. Handle containers directory - backup existing and replace with symlink
      await handleContainersDirectory(homeDir, cwd);
      
      // 2. Handle sockets - symlink individual files
      await handleSocketFiles(homeDir, cwd);
      
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

async function handleContainersDirectory(homeDir: string, cwd: string): Promise<void> {
  const source = path.join(cwd, 'containers');
  const target = path.join(homeDir, '.config', 'containers', 'systemd');
  
  logVerbose('Processing containers...');
  
  // Check if source exists
  if (!fs.existsSync(source)) {
    logWarning(`Source directory ${source} does not exist, skipping containers`);
    return;
  }
  
  // Create backup if target exists and is not a symlink
  if (fs.existsSync(target)) {
    const stats = fs.lstatSync(target);
    if (!stats.isSymbolicLink()) {
      const backupDir = path.join(cwd, 'backups');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(backupDir, `containers-systemd-${timestamp}`);
      
      logVerbose(`Creating backup: ${target} -> ${backupPath}`);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.cpSync(target, backupPath, { recursive: true });
      logInfo(`Backed up existing systemd directory to: ${backupPath}`);
      
      // Remove the original directory
      logVerbose(`Removing existing directory: ${target}`);
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      // It's already a symlink, remove it
      logVerbose(`Removing existing symlink: ${target}`);
      fs.unlinkSync(target);
    }
  }
  
  // Create parent directory if needed
  const targetParent = path.dirname(target);
  if (!fs.existsSync(targetParent)) {
    logVerbose(`Creating parent directory: ${targetParent}`);
    fs.mkdirSync(targetParent, { recursive: true });
  }
  
  // Create the symlink
  logVerbose(`Creating symlink: ${target} -> ${source}`);
  fs.symlinkSync(source, target, 'dir');
  logSuccess(`Linked container unit files: ${target}`);
}

async function handleSocketFiles(homeDir: string, cwd: string): Promise<void> {
  const source = path.join(cwd, 'user');
  const target = path.join(homeDir, '.config', 'systemd', 'user');
  
  logVerbose('Processing sockets...');
  
  // Check if source exists
  if (!fs.existsSync(source)) {
    logWarning(`Source directory ${source} does not exist, skipping sockets`);
    return;
  }
  
  // Create target directory if it doesn't exist
  if (!fs.existsSync(target)) {
    logVerbose(`Creating directory: ${target}`);
    fs.mkdirSync(target, { recursive: true });
  }
  
  // Get all files in source directory
  const files = fs.readdirSync(source, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isFile()) {
      const sourceFile = path.join(source, file.name);
      const targetFile = path.join(target, file.name);
      
      // Remove existing file/symlink if it exists
      if (fs.existsSync(targetFile)) {
        const stats = fs.lstatSync(targetFile);
        if (stats.isSymbolicLink()) {
          logVerbose(`Removing existing symlink: ${targetFile}`);
          fs.unlinkSync(targetFile);
        } else {
          logVerbose(`Removing existing file: ${targetFile}`);
          fs.unlinkSync(targetFile);
        }
      }
      
      // Create symlink to individual file
      logVerbose(`Creating file symlink: ${targetFile} -> ${sourceFile}`);
      fs.symlinkSync(sourceFile, targetFile, 'file');
      logSuccess(`Linked socket file: ${file.name}`);
    }
  }
}

