import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logVerbose, logCommand, logInfo, logSuccess, logError, logWarning, setVerbose } from '../utils/logger.js';

const execAsync = promisify(exec);

export const servicesCommand = new Command('services')
  .description('Manage deployed services')
  .option('-v, --verbose', 'enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  });

servicesCommand
  .command('list')
  .description('List all services')
  .action(async () => {
    try {
      // List all service and socket units
      const cmd = 'systemctl --user list-units --type=service,socket --all --no-pager';
      logCommand(cmd);
      const { stdout } = await execAsync(cmd);
      
      if (stdout.trim()) {
        logInfo('Services and Sockets:');
        console.log(stdout);
      } else {
        logWarning('No services or sockets found.');
      }
    } catch (error) {
      logError('Error listing services:', error);
    }
  });

servicesCommand
  .command('start <service>')
  .description('Start a service')
  .action(async (service) => {
    try {
      const serviceName = service.includes('.') ? service : `${service}.container`;
      const cmd = `systemctl --user start ${serviceName}`;
      logCommand(cmd);
      logVerbose(`Starting service: ${serviceName}`);
      await execAsync(cmd);
      logSuccess(`Started ${service}`);
    } catch (error) {
      logError(`Error starting ${service}:`, error);
    }
  });

servicesCommand
  .command('stop <service>')
  .description('Stop a service')
  .action(async (service) => {
    try {
      const serviceName = service.includes('.') ? service : `${service}.container`;
      const cmd = `systemctl --user stop ${serviceName}`;
      logCommand(cmd);
      logVerbose(`Stopping service: ${serviceName}`);
      await execAsync(cmd);
      logWarning(`Stopped ${service}`);
    } catch (error) {
      logError(`Error stopping ${service}:`, error);
    }
  });

servicesCommand
  .command('restart <service>')
  .description('Restart a service')
  .action(async (service) => {
    try {
      const serviceName = service.includes('.') ? service : `${service}.container`;
      const cmd = `systemctl --user restart ${serviceName}`;
      logCommand(cmd);
      logVerbose(`Restarting service: ${serviceName}`);
      await execAsync(cmd);
      logSuccess(`Restarted ${service}`);
    } catch (error) {
      logError(`Error restarting ${service}:`, error);
    }
  });

servicesCommand
  .command('status <service>')
  .description('Check service status')
  .action(async (service) => {
    try {
      const serviceName = service.includes('.') ? service : `${service}.container`;
      const cmd = `systemctl --user status ${serviceName} --no-pager`;
      logCommand(cmd);
      logVerbose(`Checking status of service: ${serviceName}`);
      const { stdout } = await execAsync(cmd);
      console.log(stdout);
    } catch (error: any) {
      if (error.code === 3) {
        logWarning(`Service ${service} is not active`);
        console.log(error.stdout);
      } else {
        logError(`Error checking ${service} status:`, error);
      }
    }
  });

servicesCommand
  .command('logs <service>')
  .description('View service logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(async (service, options) => {
    const serviceName = service.includes('.') ? service : `${service}.container`;
    const followFlag = options.follow ? '-f' : '';
    const cmd = `journalctl --user -u ${serviceName} -n ${options.lines} ${followFlag}`;
    logCommand(cmd);
    logVerbose(`Fetching logs for service: ${serviceName}`);
    
    if (options.follow) {
      logVerbose('Following log output (Ctrl+C to exit)');
      const { spawn } = require('child_process');
      const proc = spawn('journalctl', ['--user', '-u', serviceName, '-f'], {
        stdio: 'inherit'
      });
      
      process.on('SIGINT', () => {
        proc.kill();
        process.exit();
      });
    } else {
      try {
        const { stdout } = await execAsync(cmd);
        console.log(stdout);
      } catch (error) {
        logError(`Error fetching logs for ${service}:`, error);
      }
    }
  });