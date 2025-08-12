import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logVerbose, logCommand, logInfo, logSuccess, logError, logWarning, setVerbose } from '../utils/logger.js';

const execAsync = promisify(exec);

export const resetCommand = new Command('reset')
  .description('Reset volumes and containers for a fresh start')
  .option('-v, --verbose', 'enable verbose output')
  .option('--volumes', 'reset volumes only (keep containers)')
  .option('--all', 'reset everything (containers and volumes)')
  .option('-y, --yes', 'skip confirmation prompts')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  })
  .action(async (options) => {
    try {
      console.log(chalk.yellow('⚠️  Blueprint Reset Tool'));
      console.log(chalk.gray('This will help you reset containers and volumes for a fresh start.\n'));

      // Determine what to reset
      let resetVolumes = options.volumes || options.all;
      let resetContainers = options.all;

      if (!resetVolumes && !resetContainers) {
        const { resetType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'resetType',
            message: 'What would you like to reset?',
            choices: [
              { name: 'Volumes only (keep containers, reset data)', value: 'volumes' },
              { name: 'Everything (containers and volumes)', value: 'all' },
              { name: 'Cancel', value: 'cancel' }
            ]
          }
        ]);

        if (resetType === 'cancel') {
          console.log(chalk.gray('Reset cancelled.'));
          return;
        }

        resetVolumes = resetType === 'volumes' || resetType === 'all';
        resetContainers = resetType === 'all';
      }

      // Show what will be reset
      console.log(chalk.yellow('\n📋 Reset Plan:'));
      if (resetContainers) {
        console.log(chalk.red('  • Stop and remove all containers'));
        console.log(chalk.red('  • Remove all volumes (data will be lost)'));
      } else if (resetVolumes) {
        console.log(chalk.yellow('  • Stop containers'));
        console.log(chalk.red('  • Remove all volumes (data will be lost)'));
        console.log(chalk.green('  • Restart containers (will reinitialize)'));
      }

      // Confirm unless --yes flag
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('⚠️  This will permanently delete all data. Continue?'),
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.gray('Reset cancelled.'));
          return;
        }
      }

      // Execute reset
      if (resetContainers) {
        await resetEverything();
      } else if (resetVolumes) {
        await resetVolumesOnly();
      }

      console.log(chalk.green('\n✅ Reset completed successfully!'));
      console.log(chalk.cyan('💡 You can now restart your services with fresh data.'));

    } catch (error) {
      logError('Reset failed:', error);
      process.exit(1);
    }
  });

async function resetVolumesOnly() {
  console.log(chalk.blue('\n🔄 Stopping containers...'));
  
  const containers = ['caddy.container', 'authelia.container', 'authelia-postgres.container'];
  
  for (const container of containers) {
    try {
      const cmd = `systemctl --user stop ${container}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Stopped ${container}`);
    } catch (error: any) {
      // Container might not be running, that's ok
      logVerbose(`${container} was not running`);
    }
  }

  console.log(chalk.blue('\n🗑️  Removing volumes...'));
  
  const volumes = [
    'authelia-postgres-data',
    'authelia-data',
    'caddy-data',
    'caddy-config'
  ];

  for (const volume of volumes) {
    try {
      const cmd = `podman volume rm ${volume}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Removed volume: ${volume}`);
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('no such volume')) {
        logVerbose(`Volume ${volume} doesn't exist, skipping`);
      } else {
        logWarning(`Failed to remove volume ${volume}: ${error.message}`);
      }
    }
  }

  console.log(chalk.blue('\n🔄 Restarting containers...'));
  
  // Start in dependency order
  const startOrder = ['authelia-postgres.container', 'authelia.container', 'caddy.container'];
  
  for (const container of startOrder) {
    try {
      const cmd = `systemctl --user start ${container}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Started ${container}`);
      
      // Wait a moment between starts
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      logError(`Failed to start ${container}:`, error);
    }
  }
}

async function resetEverything() {
  console.log(chalk.blue('\n🔄 Stopping all services...'));
  
  const services = [
    'caddy.container',
    'authelia.container', 
    'authelia-postgres.container',
    'core-network.service',
    'addon-network.service'
  ];
  
  for (const service of services) {
    try {
      const cmd = `systemctl --user stop ${service}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Stopped ${service}`);
    } catch (error: any) {
      logVerbose(`${service} was not running`);
    }
  }

  console.log(chalk.blue('\n🗑️  Removing containers...'));
  
  const containers = ['caddy', 'authelia', 'authelia-postgres'];
  
  for (const container of containers) {
    try {
      const cmd = `podman rm -f ${container}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Removed container: ${container}`);
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('no such container')) {
        logVerbose(`Container ${container} doesn't exist, skipping`);
      } else {
        logWarning(`Failed to remove container ${container}: ${error.message}`);
      }
    }
  }

  console.log(chalk.blue('\n🗑️  Removing volumes...'));
  
  const volumes = [
    'authelia-postgres-data',
    'authelia-data', 
    'caddy-data',
    'caddy-config'
  ];

  for (const volume of volumes) {
    try {
      const cmd = `podman volume rm ${volume}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Removed volume: ${volume}`);
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('no such volume')) {
        logVerbose(`Volume ${volume} doesn't exist, skipping`);
      } else {
        logWarning(`Failed to remove volume ${volume}: ${error.message}`);
      }
    }
  }

  console.log(chalk.blue('\n🗑️  Removing networks...'));
  
  const networks = ['core', 'addon'];
  
  for (const network of networks) {
    try {
      const cmd = `podman network rm ${network}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Removed network: ${network}`);
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('network not found')) {
        logVerbose(`Network ${network} doesn't exist, skipping`);
      } else {
        logWarning(`Failed to remove network ${network}: ${error.message}`);
      }
    }
  }
}