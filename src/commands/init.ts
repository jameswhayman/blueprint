import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { generateSystemdUnits } from '../services/systemd.js';
import { generateCaddyfile } from '../services/caddy.js';
import { generateAutheliaConfig } from '../services/authelia.js';
import { randomBytes } from 'crypto';

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
      console.log(chalk.cyan(`\nNext steps:`));
      console.log(`  1. cd ${deployDir}`);
      console.log(`  2. systemctl --user daemon-reload`);
      console.log(`  3. systemctl --user start caddy.container authelia-postgres.container authelia.container`);
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