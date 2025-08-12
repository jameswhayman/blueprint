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
  .option('--service <service>', 'reset specific service (postgres, authelia, caddy)')
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

      // Handle specific service reset
      if (options.service) {
        await resetSpecificService(options.service, options.yes);
        return;
      }

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
      
      if (resetVolumes && !resetContainers) {
        console.log(chalk.cyan('\n💡 Next steps:'));
        console.log(chalk.gray('   1. If services failed to start, run: blueprint setup-links'));
        console.log(chalk.gray('   2. Then start services manually or they should auto-restart'));
      } else {
        console.log(chalk.cyan('\n💡 Run your deployment setup again to recreate everything.'));
      }

    } catch (error) {
      logError('Reset failed:', error);
      process.exit(1);
    }
  });

async function resetSpecificService(service: string, skipConfirm: boolean = false) {
  const validServices = ['postgres', 'authelia', 'caddy'];
  
  if (!validServices.includes(service)) {
    logError(`Invalid service: ${service}. Valid options: ${validServices.join(', ')}`);
    return;
  }

  console.log(chalk.yellow(`\n📋 Reset Plan for ${service}:`));
  console.log(chalk.yellow('  • Stop service container'));
  console.log(chalk.red('  • Remove service container and volume (data will be lost)'));
  console.log(chalk.green('  • Restart service container'));

  if (!skipConfirm) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`⚠️  This will permanently delete ${service} data. Continue?`),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Reset cancelled.'));
      return;
    }
  }

  const serviceConfig = getServiceConfig(service);
  
  // Stop the service
  console.log(chalk.blue(`\n🔄 Stopping ${service} service...`));
  try {
    const cmd = `systemctl --user stop ${serviceConfig.systemdUnit}`;
    logCommand(cmd);
    await execAsync(cmd);
    logSuccess(`Stopped ${serviceConfig.systemdUnit}`);
  } catch (error: any) {
    logVerbose(`${serviceConfig.systemdUnit} was not running`);
  }

  // Remove container
  console.log(chalk.blue(`\n🗑️  Removing ${service} container...`));
  try {
    const cmd = `podman rm -f ${serviceConfig.containerName}`;
    logCommand(cmd);
    await execAsync(cmd);
    logSuccess(`Removed container: ${serviceConfig.containerName}`);
  } catch (error: any) {
    if (error.stderr && error.stderr.includes('no such container')) {
      logVerbose(`Container ${serviceConfig.containerName} doesn't exist, skipping`);
    } else {
      logWarning(`Failed to remove container: ${error.message}`);
    }
  }

  // Remove volumes
  console.log(chalk.blue(`\n🗑️  Removing ${service} volumes...`));
  for (const volume of serviceConfig.volumes) {
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

  // Restart service
  console.log(chalk.blue(`\n🔄 Restarting ${service} service...`));
  try {
    const cmd = `systemctl --user start ${serviceConfig.systemdUnit}`;
    logCommand(cmd);
    await execAsync(cmd);
    logSuccess(`Started ${serviceConfig.systemdUnit}`);
  } catch (error: any) {
    if (error.stderr && error.stderr.includes('Unit') && error.stderr.includes('not found')) {
      logWarning(`${serviceConfig.systemdUnit} unit not found. You may need to run 'blueprint setup-links' first.`);
    } else {
      logError(`Failed to start ${serviceConfig.systemdUnit}:`, error);
    }
  }

  console.log(chalk.green(`\n✅ ${service} reset completed successfully!`));
}

function getServiceConfig(service: string) {
  const configs = {
    postgres: {
      containerName: 'authelia-postgres',
      systemdUnit: 'authelia-postgres.container',
      volumes: ['authelia-postgres-data']
    },
    authelia: {
      containerName: 'authelia',
      systemdUnit: 'authelia.container',
      volumes: ['authelia-data']
    },
    caddy: {
      containerName: 'caddy',
      systemdUnit: 'caddy.container',
      volumes: ['caddy-data', 'caddy-config']
    }
  };
  
  return configs[service as keyof typeof configs];
}

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

  console.log(chalk.blue('\n🗑️  Removing containers to free volumes...'));
  
  const containerNames = ['caddy', 'authelia', 'authelia-postgres'];
  
  for (const containerName of containerNames) {
    try {
      const cmd = `podman rm -f ${containerName}`;
      logCommand(cmd);
      await execAsync(cmd);
      logSuccess(`Removed container: ${containerName}`);
    } catch (error: any) {
      if (error.stderr && error.stderr.includes('no such container')) {
        logVerbose(`Container ${containerName} doesn't exist, skipping`);
      } else {
        logWarning(`Failed to remove container ${containerName}: ${error.message}`);
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

  console.log(chalk.blue('\n🔗 Ensuring systemd links are set up...'));
  
  try {
    const cmd = 'systemctl --user daemon-reload';
    logCommand(cmd);
    await execAsync(cmd);
    logSuccess('Reloaded systemd daemon');
  } catch (error: any) {
    logWarning('Failed to reload systemd daemon:', error);
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
      if (error.stderr && error.stderr.includes('Unit') && error.stderr.includes('not found')) {
        logWarning(`${container} unit not found. You may need to run 'blueprint setup-links' first.`);
      } else {
        logError(`Failed to start ${container}:`, error);
      }
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