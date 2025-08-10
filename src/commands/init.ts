import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { generateSystemdUnits } from '../utils/systemd.js';
import { generateCaddyfile } from '../utils/caddy.js';
import { generateAutheliaConfig } from '../utils/authelia.js';
import { randomBytes } from 'crypto';

export const initCommand = new Command('init')
  .description('Initialize a new deployment')
  .option('-n, --name <name>', 'Deployment name')
  .option('-d, --directory <dir>', 'Target directory', process.cwd())
  .option('--no-interactive', 'Skip interactive prompts')
  .action(async (options) => {
    let config: any = {
      name: options.name,
      directory: options.directory,
      services: {
        caddy: true,
        authelia: true
      },
      domain: 'example.local'
    };

    if (options.interactive !== false) {
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
          type: 'checkbox',
          name: 'services',
          message: 'Select core services to include:',
          choices: [
            { name: 'Caddy (Web Server)', value: 'caddy', checked: true },
            { name: 'Authelia (Authentication)', value: 'authelia', checked: true }
          ]
        },
        {
          type: 'input',
          name: 'smtpHost',
          message: 'SMTP Host (e.g., smtp.eu.mailgun.org):',
          validate: (input) => (input && input.length > 0) || 'SMTP host is required'
        },
        {
          type: 'number',
          name: 'smtpPort',
          message: 'SMTP Port:',
          default: 587,
          validate: (input) => (input && input > 0 && input <= 65535) || 'Port must be between 1 and 65535'
        },
        {
          type: 'input',
          name: 'smtpUsername',
          message: 'SMTP Username:',
          validate: (input) => (input && input.length > 0) || 'SMTP username is required'
        },
        {
          type: 'password',
          name: 'smtpPassword',
          message: 'SMTP Password:',
          validate: (input) => (input && input.length > 0) || 'SMTP password is required'
        },
        {
          type: 'input',
          name: 'smtpSender',
          message: 'From Email Address:',
          validate: (input) => (input && input.includes('@')) || 'Valid email address is required'
        }
      ]);

      config = { ...config, ...answers };
      config.services = {
        caddy: answers.services.includes('caddy'),
        authelia: answers.services.includes('authelia')
      };
      config.useHttps = true; // Always use HTTPS
      config.email = config.email || `admin@${config.domain}`;
    } else {
      // Non-interactive mode - use defaults (will need SMTP setup later)
      config.name = config.name || 'my-deployment';
      config.email = config.email || `admin@${config.domain}`;
      config.useHttps = true; // Always use HTTPS
      config.smtpHost = 'smtp.eu.mailgun.org';
      config.smtpPort = 587;
      config.smtpUsername = `postmaster@${config.domain}`;
      config.smtpPassword = 'your-mailgun-smtp-password';
      config.smtpSender = `noreply@${config.domain}`;
    }

    const deployDir = path.join(config.directory, config.name);

    console.log(chalk.blue('\n📦 Creating deployment structure...'));

    try {
      await fs.mkdir(deployDir, { recursive: true });
      await fs.mkdir(path.join(deployDir, 'containers'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'user'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'secrets'), { recursive: true });
      await fs.mkdir(path.join(deployDir, 'backup'), { recursive: true });

      if (config.services.caddy) {
        console.log(chalk.green('✓ Generating Caddy configuration...'));
        await generateCaddyfile(deployDir, config);
        await generateSystemdUnits(deployDir, 'caddy', config);
      }

      if (config.services.authelia) {
        console.log(chalk.green('✓ Generating Authelia configuration...'));
        await generateAutheliaConfig(deployDir, config);
        await generateSystemdUnits(deployDir, 'authelia', config);
        
        console.log(chalk.green('✓ Generating Authelia PostgreSQL database...'));
        await generateSystemdUnits(deployDir, 'authelia-postgres', config);
      }


      // Generate initial secrets with SMTP configuration
      console.log(chalk.green('✓ Generating initial secrets...'));
      await generateInitialSecrets(deployDir, config);

      console.log(chalk.green('\n✅ Deployment initialized successfully!'));
      console.log(chalk.cyan(`\nNext steps:`));
      console.log(`  1. cd ${deployDir}`);
      console.log(`  2. blueprint auth add-user`);
      console.log(`  3. systemctl --user daemon-reload`);
      
      let startCommand = 'systemctl --user start';
      if (config.services.caddy) startCommand += ' caddy.container';
      if (config.services.authelia) {
        startCommand += ' authelia-postgres.container';
        startCommand += ' authelia.container';
      }
      
      console.log(`  5. ${startCommand}`);
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
    SMTP_USERNAME: config.smtpUsername || `postmaster@${config.domain}`,
    SMTP_PASSWORD: config.smtpPassword || 'your-mailgun-smtp-password',
    SMTP_SENDER: config.smtpSender || `noreply@${config.domain}`
  };

  // Write each secret to its own file
  for (const [key, value] of Object.entries(secrets)) {
    const secretFile = path.join(secretsDir, `${key.toLowerCase()}.secret`);
    await fs.writeFile(secretFile, value, 'utf8');
    await fs.chmod(secretFile, 0o600); // Read/write for owner only
  }
}