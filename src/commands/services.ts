import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
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

servicesCommand
  .command('install <service>')
  .description('Install an addon service')
  .option('--shared-smtp', 'Use shared SMTP credentials', true)
  .action(async (service, options) => {
    try {
      const { serviceManager } = await import('../services/service-manager.js');
      
      // Import service definitions to register them
      await import('../services/umami-service.js');
      
      const deployDir = process.cwd();
      
      // Check if we're in a valid deployment directory
      try {
        await import('fs/promises').then(fs => fs.default.access(path.join(deployDir, 'containers')));
      } catch {
        logError('Not in a valid deployment directory');
        console.log(chalk.yellow('Please run this command from your deployment directory'));
        process.exit(1);
      }
      
      // Load existing config
      let config: any = {};
      try {
        const fs = await import('fs/promises');
        const caddyfile = await fs.default.readFile(path.join(deployDir, 'containers', 'Caddyfile'), 'utf8');
        const domainMatch = caddyfile.match(/^([a-zA-Z0-9.-]+) {/m);
        if (domainMatch) {
          config.domain = domainMatch[1];
        }
      } catch {
        logWarning('Could not read existing configuration');
      }
      
      // Check if already installed
      if (await serviceManager.isInstalled(service, deployDir)) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `${service} is already installed. Reinstall?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          process.exit(0);
        }
      }
      
      // Install the service
      await serviceManager.install(service, deployDir, config, options);
      
      if (service === 'umami') {
        console.log(chalk.cyan(`   Access at: https://analytics.${config.domain}`));
        console.log(chalk.yellow('   Default credentials: admin / umami'));
        console.log(chalk.yellow('   ⚠️  Change the default password immediately!'));
      }
      
    } catch (error) {
      logError(`Failed to install ${service}:`, error);
      process.exit(1);
    }
  });

servicesCommand
  .command('remove <service>')
  .description('Remove an addon service')
  .option('--keep-data', 'Keep data volumes', false)
  .action(async (service, options) => {
    try {
      const { serviceManager } = await import('../services/service-manager.js');
      
      // Import service definitions to register them
      await import('../services/umami-service.js');
      
      const deployDir = process.cwd();
      
      if (!(await serviceManager.isInstalled(service, deployDir))) {
        logWarning(`${service} is not installed`);
        process.exit(0);
      }
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove ${service}?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        process.exit(0);
      }
      
      await serviceManager.remove(service, deployDir, options);
      
    } catch (error) {
      logError(`Failed to remove ${service}:`, error);
      process.exit(1);
    }
  });