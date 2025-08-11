import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateSystemdUnits } from '../services/systemd.js';
import { generateCaddyfile } from '../services/caddy.js';
import { generateAutheliaConfig } from '../services/authelia.js';
import { randomBytes } from 'crypto';
import { logVerbose, logCommand, logSuccess, logError, logInfo, setVerbose } from '../utils/logger.js';

const execAsync = promisify(exec);

function validateStrongPassword(password: string): boolean | string {
  if (!password || password.length < 12) {
    return 'Password must be at least 12 characters long';
  }
  
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasLowercase) {
    return 'Password must contain at least one lowercase letter';
  }
  
  if (!hasUppercase) {
    return 'Password must contain at least one uppercase letter';
  }
  
  if (!hasNumbers) {
    return 'Password must contain at least one number';
  }
  
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)';
  }
  
  return true;
}

export const initCommand = new Command('init')
  .description('Initialize a new deployment')
  .option('-n, --name <name>', 'Deployment name')
  .option('-d, --directory <dir>', 'Target directory', process.cwd())
  .option('--no-interactive', 'Skip interactive prompts')
  .option('-v, --verbose', 'enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
  })
  .action(async (options) => {
    let config: any = {
      name: options.name,
      directory: options.directory,
      domain: 'example.local'
    };

    if (options.interactive !== false) {
      // @ts-ignore - inquirer types are complex, but this works at runtime
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Deployment name:',
          default: config.name || 'my-deployment',
          when: !options.name
        },
        {
          type: 'input',
          name: 'domain',
          message: 'Primary domain:',
          default: 'example.local'
        },
        {
          type: 'input',
          name: 'email',
          message: 'Admin email:',
          default: (answers: any) => `admin@${answers.domain || 'example.local'}`
        },
        {
          type: 'input',
          name: 'adminDisplayName',
          message: 'Admin display name:',
          default: 'Administrator',
          validate: (input: string) => (input && input.trim().length > 0) || 'Display name is required'
        },
        {
          type: 'password',
          name: 'adminPassword',
          message: 'Admin password:',
          validate: validateStrongPassword
        },
        {
          type: 'input',
          name: 'smtpHost',
          message: 'SMTP Host:',
          default: 'smtp.eu.mailgun.org',
          validate: (input: string) => (input && input.length > 0) || 'SMTP host is required'
        },
        {
          type: 'number',
          name: 'smtpPort',
          message: 'SMTP Port:',
          default: 587,
          validate: (input: number) => (input && input > 0 && input <= 65535) || 'Port must be between 1 and 65535'
        },
        {
          type: 'input',
          name: 'smtpUsername',
          message: 'SMTP Username:',
          default: (answers: any) => `no-reply@mg.${answers.domain || 'example.local'}`,
          validate: (input: string) => (input && input.length > 0) || 'SMTP username is required'
        },
        {
          type: 'password',
          name: 'smtpPassword',
          message: 'SMTP Password:',
          validate: (input: string) => (input && input.length > 0) || 'SMTP password is required'
        },
        {
          type: 'input',
          name: 'smtpSender',
          message: 'From Email Address:',
          default: (answers: any) => `no-reply@mg.${answers.domain || 'example.local'}`,
          validate: (input: string) => (input && input.includes('@')) || 'Valid email address is required'
        }
      ]);

      config = { ...config, ...answers };
      config.useHttps = true; // Always use HTTPS
      config.email = config.email || `admin@${config.domain}`;
    } else {
      // Non-interactive mode - use defaults (will need SMTP setup later)
      config.name = config.name || 'my-deployment';
      config.email = config.email || `admin@${config.domain}`;
      config.useHttps = true; // Always use HTTPS
      config.smtpHost = 'smtp.eu.mailgun.org';
      config.smtpPort = 587;
      config.smtpUsername = `no-reply@mg.${config.domain}`;
      config.smtpPassword = 'your-mailgun-smtp-password';
      config.smtpSender = `no-reply@mg.${config.domain}`;
      config.adminDisplayName = 'Administrator';
      config.adminPassword = 'ChangeMeToAStrongPassword123!';
    }

    const deployDir = path.join(config.directory, config.name);

    console.log(chalk.blue('\n📦 Creating deployment structure...'));

    try {
      await fs.mkdir(deployDir, { recursive: true });
      await fs.mkdir(path.join(deployDir, 'containers'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'user'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'secrets'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'backup'), { recursive: true });

      console.log(chalk.green('✓ Generating Caddy configuration...'));
      await generateCaddyfile(deployDir, config);
      await generateSystemdUnits(deployDir, 'caddy', config);

      console.log(chalk.green('✓ Generating Authelia configuration...'));
      await generateAutheliaConfig(deployDir, config);
      await generateSystemdUnits(deployDir, 'authelia', config);
      
      console.log(chalk.green('✓ Generating Authelia PostgreSQL database...'));
      await generateSystemdUnits(deployDir, 'authelia-postgres', config);


      // Generate initial secrets with SMTP configuration
      console.log(chalk.green('✓ Generating initial secrets...'));
      await generateInitialSecrets(deployDir, config);

      console.log(chalk.green('\n✅ Deployment initialized successfully!'));
      console.log(chalk.blue(`\n📋 Admin Account Created:`));
      console.log(`   Username: admin`);
      console.log(`   Email: ${config.email}`);
      console.log(`   Display Name: ${config.adminDisplayName}`);
      
      // Prompt for automatic setup
      if (options.interactive !== false) {
        const { autoSetup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'autoSetup',
            message: 'Set up systemd links and start services now?',
            default: true
          }
        ]);
        
        if (autoSetup) {
          logInfo('Setting up deployment...');
          
          // Change to deployment directory for setup
          const originalDir = process.cwd();
          process.chdir(deployDir);
          
          try {
            // Create symlinks
            logVerbose('Creating systemd symlinks...');
            await setupSystemdLinks(deployDir);
            
            // Start services
            logInfo('Starting services...');
            await startServices();
            
            console.log(chalk.green('\n🎉 Deployment is ready!'));
            console.log(chalk.cyan(`Visit: https://${config.domain}`));
            
          } catch (error) {
            logError('Setup failed:', error);
            console.log(chalk.yellow('\nManual setup required:'));
            console.log(chalk.cyan(`  1. cd ${deployDir}`));
            console.log(chalk.cyan(`  2. blueprint system setup-links`));
            console.log(chalk.cyan(`  3. blueprint services start authelia-postgres authelia caddy`));
          } finally {
            process.chdir(originalDir);
          }
        } else {
          console.log(chalk.cyan(`\nManual setup:`));
          console.log(`  1. cd ${deployDir}`);
          console.log(`  2. blueprint system setup-links`);
          console.log(`  3. blueprint services start authelia-postgres authelia caddy`);
        }
      } else {
        console.log(chalk.cyan(`\nNext steps:`));
        console.log(`  1. cd ${deployDir}`);
        console.log(`  2. blueprint system setup-links`);
        console.log(`  3. blueprint services start authelia-postgres authelia caddy`);
      }
    } catch (error) {
      console.error(chalk.red('Error creating deployment:'), error);
      process.exit(1);
    }
  });

async function generateInitialSecrets(deployDir: string, config: any) {
  const secretsDir = path.join(deployDir, 'secrets');
  
  const secrets: Record<string, string> = {
    AUTHELIA_JWT_SECRET: randomBytes(64).toString('hex'),
    AUTHELIA_SESSION_SECRET: randomBytes(64).toString('hex'),
    AUTHELIA_STORAGE_ENCRYPTION_KEY: randomBytes(64).toString('hex'),
    AUTHELIA_POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
    AUTHELIA_POSTGRES_DB: 'authelia',
    AUTHELIA_POSTGRES_USER: 'authelia',
    SMTP_HOST: config.smtpHost || 'smtp.eu.mailgun.org',
    SMTP_PORT: (config.smtpPort || 587).toString(),
    SMTP_USERNAME: config.smtpUsername || `no-reply@mg.${config.domain}`,
    SMTP_PASSWORD: config.smtpPassword || 'your-mailgun-smtp-password',
    SMTP_SENDER: config.smtpSender || `no-reply@mg.${config.domain}`
  };

  // Write each secret to its own file
  for (const [key, value] of Object.entries(secrets)) {
    const secretFile = path.join(secretsDir, `${key.toLowerCase()}.secret`);
    await fs.writeFile(secretFile, value, 'utf8');
    await fs.chmod(secretFile, 0o600); // Read/write for owner only
  }
}

async function setupSystemdLinks(deployDir: string): Promise<void> {
  const homeDir = os.homedir();
  
  // Define source and target paths
  const links = [
    {
      name: 'containers',
      source: path.join(deployDir, 'containers'),
      target: path.join(homeDir, '.config', 'containers', 'systemd'),
      description: 'Container unit files'
    },
    {
      name: 'sockets',
      source: path.join(deployDir, 'user'),
      target: path.join(homeDir, '.config', 'systemd', 'user'),
      description: 'Socket unit files'
    },
    {
      name: 'secrets',
      source: path.join(deployDir, 'secrets'),
      target: path.join(homeDir, '.config', 'containers', 'secrets'),
      description: 'Secret files'
    }
  ];
  
  for (const link of links) {
    logVerbose(`Processing ${link.name}...`);
    
    // Check if source exists
    try {
      await fs.access(link.source);
    } catch {
      logVerbose(`Source directory ${link.source} does not exist, skipping ${link.name}`);
      continue;
    }
    
    // Create target parent directory if it doesn't exist
    const targetParent = path.dirname(link.target);
    try {
      await fs.access(targetParent);
    } catch {
      logVerbose(`Creating parent directory: ${targetParent}`);
      await fs.mkdir(targetParent, { recursive: true });
    }
    
    // Remove existing target if it exists and is a symlink
    try {
      const stats = await fs.lstat(link.target);
      if (stats.isSymbolicLink()) {
        logVerbose(`Removing existing symlink: ${link.target}`);
        await fs.unlink(link.target);
      } else {
        logVerbose(`Target ${link.target} exists and is not a symlink - skipping ${link.name}`);
        continue;
      }
    } catch {
      // Target doesn't exist, which is fine
    }
    
    // Create the symlink
    logVerbose(`Creating symlink: ${link.target} -> ${link.source}`);
    await fs.symlink(link.source, link.target, 'dir');
    logVerbose(`Linked ${link.description}`);
  }
  
  // Reload systemd daemon
  logVerbose('Reloading systemd daemon...');
  const cmd = 'systemctl --user daemon-reload';
  logCommand(cmd);
  await execAsync(cmd);
}

async function startServices(): Promise<void> {
  const services = ['authelia-postgres', 'authelia', 'caddy'];
  
  for (const service of services) {
    logVerbose(`Starting ${service}...`);
    const cmd = `systemctl --user start ${service}.container`;
    logCommand(cmd);
    await execAsync(cmd);
    logSuccess(`Started ${service}`);
  }
}