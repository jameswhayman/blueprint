import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const servicesCommand = new Command('services')
  .description('Manage deployed services');

servicesCommand
  .command('list')
  .description('List all services')
  .action(async () => {
    try {
      const { stdout } = await execAsync('systemctl --user list-units --type=container --all --no-pager');
      console.log(chalk.blue('🔧 Container Services:'));
      console.log(stdout);
    } catch (error) {
      console.error(chalk.red('Error listing services:'), error);
    }
  });

servicesCommand
  .command('start <service>')
  .description('Start a service')
  .action(async (service) => {
    try {
      await execAsync(`systemctl --user start ${service}.container`);
      console.log(chalk.green(`✓ Started ${service}`));
    } catch (error) {
      console.error(chalk.red(`Error starting ${service}:`), error);
    }
  });

servicesCommand
  .command('stop <service>')
  .description('Stop a service')
  .action(async (service) => {
    try {
      await execAsync(`systemctl --user stop ${service}.container`);
      console.log(chalk.yellow(`⏹ Stopped ${service}`));
    } catch (error) {
      console.error(chalk.red(`Error stopping ${service}:`), error);
    }
  });

servicesCommand
  .command('restart <service>')
  .description('Restart a service')
  .action(async (service) => {
    try {
      await execAsync(`systemctl --user restart ${service}.container`);
      console.log(chalk.green(`🔄 Restarted ${service}`));
    } catch (error) {
      console.error(chalk.red(`Error restarting ${service}:`), error);
    }
  });

servicesCommand
  .command('status <service>')
  .description('Check service status')
  .action(async (service) => {
    try {
      const { stdout } = await execAsync(`systemctl --user status ${service}.container --no-pager`);
      console.log(stdout);
    } catch (error: any) {
      if (error.code === 3) {
        console.log(chalk.yellow(`Service ${service} is not active`));
        console.log(error.stdout);
      } else {
        console.error(chalk.red(`Error checking ${service} status:`), error);
      }
    }
  });

servicesCommand
  .command('logs <service>')
  .description('View service logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(async (service, options) => {
    const followFlag = options.follow ? '-f' : '';
    const cmd = `journalctl --user -u ${service}.container -n ${options.lines} ${followFlag}`;
    
    if (options.follow) {
      const { spawn } = require('child_process');
      const proc = spawn('journalctl', ['--user', '-u', `${service}.container`, '-f'], {
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
        console.error(chalk.red(`Error fetching logs for ${service}:`), error);
      }
    }
  });