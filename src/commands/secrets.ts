import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';

export const secretsCommand = new Command('secrets')
  .description('Manage deployment secrets');

secretsCommand
  .command('setup')
  .description('Initialize secrets for the deployment')
  .option('--force', 'Overwrite existing secrets')
  .action(async (options) => {
    const secretsDir = path.join(process.cwd(), 'secrets');
    
    try {
      await fs.access(secretsDir);
    } catch {
      await fs.mkdir(secretsDir, { recursive: true });
    }

    // Load existing secrets from individual files
    let existingSecrets: Record<string, string> = {};
    try {
      const files = await fs.readdir(secretsDir);
      for (const file of files) {
        if (file.endsWith('.secret')) {
          const secretName = file.replace('.secret', '').toUpperCase();
          try {
            const content = await fs.readFile(path.join(secretsDir, file), 'utf8');
            existingSecrets[secretName] = content.trim();
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }

    // Check if we have a config file to get SMTP settings from
    let smtpConfig: any = {};
    try {
      const configPath = path.join(process.cwd(), 'containers', 'authelia-config', 'configuration.yml');
      // We'll get SMTP settings from the init config passed down, for now use defaults
    } catch {
      // Use defaults if no config found
    }

    const secrets: Record<string, string> = {
      AUTHELIA_JWT_SECRET: existingSecrets.AUTHELIA_JWT_SECRET || randomBytes(64).toString('hex'),
      AUTHELIA_SESSION_SECRET: existingSecrets.AUTHELIA_SESSION_SECRET || randomBytes(64).toString('hex'),
      AUTHELIA_STORAGE_ENCRYPTION_KEY: existingSecrets.AUTHELIA_STORAGE_ENCRYPTION_KEY || randomBytes(64).toString('hex'),
      AUTHELIA_POSTGRES_PASSWORD: existingSecrets.AUTHELIA_POSTGRES_PASSWORD || randomBytes(32).toString('hex'),
      AUTHELIA_POSTGRES_DB: existingSecrets.AUTHELIA_POSTGRES_DB || 'authelia',
      AUTHELIA_POSTGRES_USER: existingSecrets.AUTHELIA_POSTGRES_USER || 'authelia',
      SMTP_HOST: existingSecrets.SMTP_HOST || 'smtp.eu.mailgun.org',
      SMTP_PORT: existingSecrets.SMTP_PORT || '587',
      SMTP_USERNAME: existingSecrets.SMTP_USERNAME || 'postmaster@your-domain.com',
      SMTP_PASSWORD: existingSecrets.SMTP_PASSWORD || 'your-mailgun-smtp-password',
      SMTP_SENDER: existingSecrets.SMTP_SENDER || 'no-reply@mg.your-domain.com',
      ...existingSecrets
    };

    if (!options.force && Object.keys(existingSecrets).length > 0) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Secrets file exists. Do you want to update missing secrets only?',
          default: true
        }
      ]);

      if (!answer.overwrite) {
        console.log(chalk.yellow('Secrets setup cancelled'));
        return;
      }
    }

    // SMTP configuration is now handled during init, not here

    // Write each secret to its own file
    for (const [key, value] of Object.entries(secrets)) {
      const secretFile = path.join(secretsDir, `${key.toLowerCase()}.secret`);
      await fs.writeFile(secretFile, value, 'utf8');
      await fs.chmod(secretFile, 0o600); // Read/write for owner only
    }

    console.log(chalk.green('✓ Secrets initialized successfully'));
    console.log(chalk.blue(`📁 Secrets saved to: ${secretsDir}/`));
    console.log(chalk.cyan(`   Generated ${Object.keys(secrets).length} secret files`));
    console.log(chalk.yellow('⚠️  Keep your secret files secure and never commit them to version control'));
  });

secretsCommand
  .command('show')
  .description('Show current secrets (masked)')
  .action(async () => {
    try {
      const secretsDir = path.join(process.cwd(), 'secrets');
      const files = await fs.readdir(secretsDir);
      const secretFiles = files.filter(f => f.endsWith('.secret'));
      
      if (secretFiles.length === 0) {
        console.log(chalk.yellow('No secret files found'));
        console.log(chalk.cyan('Run "blueprint secrets setup" to initialize secrets'));
        return;
      }

      console.log(chalk.blue('🔐 Current Secrets:'));
      
      for (const file of secretFiles.sort()) {
        const secretName = file.replace('.secret', '').toUpperCase();
        try {
          const value = await fs.readFile(path.join(secretsDir, file), 'utf8');
          const trimmedValue = value.trim();
          const maskedValue = trimmedValue.length > 8 ? 
            trimmedValue.substring(0, 4) + '*'.repeat(Math.max(4, trimmedValue.length - 8)) + trimmedValue.substring(trimmedValue.length - 4) :
            '*'.repeat(trimmedValue.length);
          console.log(`  ${chalk.cyan(secretName)}: ${maskedValue}`);
        } catch (error) {
          console.log(`  ${chalk.cyan(secretName)}: ${chalk.red('Error reading file')}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error reading secrets directory:'), error);
      console.log(chalk.yellow('Run "blueprint secrets setup" to initialize secrets'));
    }
  });

secretsCommand
  .command('list-podman')
  .description('List podman secrets')
  .action(async () => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('podman secret list --format "{{.Name}}"');
      const secrets = stdout.trim().split('\n').filter(s => s);
      
      if (secrets.length === 0) {
        console.log(chalk.yellow('No podman secrets found'));
        return;
      }
      
      console.log(chalk.blue('🔐 Podman secrets:'));
      secrets.forEach(secret => {
        console.log(`  ${chalk.green('✓')} ${secret}`);
      });
    } catch (error) {
      console.error(chalk.red('Error listing podman secrets:'), error);
    }
  });

secretsCommand
  .command('create-podman')
  .description('Create podman secrets from filesystem secrets')
  .action(async () => {
    const secretsDir = path.join(process.cwd(), 'secrets');
    
    try {
      await fs.access(secretsDir);
    } catch {
      console.error(chalk.red('No secrets directory found. Run `blueprint secrets setup` first.'));
      return;
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const files = await fs.readdir(secretsDir);
      const secretFiles = files.filter(f => !f.includes('.')); // No extension files
      
      if (secretFiles.length === 0) {
        console.log(chalk.yellow('No secret files found in secrets directory'));
        return;
      }

      console.log(chalk.blue('Creating podman secrets from filesystem...'));
      
      for (const secretName of secretFiles) {
        const secretPath = path.join(secretsDir, secretName);
        
        try {
          // Check if secret already exists and remove it
          try {
            await execAsync(`podman secret inspect ${secretName} >/dev/null 2>&1`);
            console.log(chalk.yellow(`Removing existing secret: ${secretName}`));
            await execAsync(`podman secret rm ${secretName}`);
          } catch {
            // Secret doesn't exist, which is fine
          }
          
          // Create podman secret
          await execAsync(`podman secret create ${secretName} ${secretPath}`);
          console.log(chalk.green(`✓ Created podman secret: ${secretName}`));
          
        } catch (error) {
          console.error(chalk.red(`✗ Failed to create secret ${secretName}:`), error);
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Error creating podman secrets:'), error);
    }
  });

secretsCommand
  .command('rotate <secret>')
  .description('Rotate a specific secret')
  .action(async (secretName) => {
    try {
      const secretsDir = path.join(process.cwd(), 'secrets');
      const secretFile = path.join(secretsDir, secretName); // No .secret extension
      
      try {
        await fs.access(secretFile);
      } catch {
        console.log(chalk.yellow(`Secret ${secretName} not found`));
        console.log(chalk.cyan('Available secrets:'));
        try {
          const files = await fs.readdir(secretsDir);
          const secretFiles = files.filter(f => !f.includes('.'));
          secretFiles.forEach(f => {
            console.log(`  ${f}`);
          });
        } catch {
          console.log('  No secrets found');
        }
        return;
      }

      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Rotate ${secretName}? This will generate a new value.`,
          default: false
        }
      ]);

      if (!confirm.confirmed) {
        console.log(chalk.yellow('Secret rotation cancelled'));
        return;
      }

      // Generate new secret based on type
      let newSecret: string;
      if (secretName.includes('PASSWORD') || 
          secretName.includes('SECRET') || 
          secretName.includes('KEY')) {
        newSecret = randomBytes(64).toString('hex');
      } else if (secretName.includes('DB') || secretName.includes('USER')) {
        // Keep database names and usernames unchanged for rotation
        const currentSecret = await fs.readFile(secretFile, 'utf8');
        newSecret = currentSecret.trim();
        console.log(chalk.yellow(`${secretName} is a configuration value, not rotating`));
        return;
      } else {
        newSecret = randomUUID();
      }

      await fs.writeFile(secretFile, newSecret, 'utf8');
      await fs.chmod(secretFile, 0o600);
      
      console.log(chalk.green(`✓ ${secretName} rotated successfully`));
      console.log(chalk.cyan('Remember to restart affected services to use the new secret'));
    } catch (error) {
      console.error(chalk.red('Error rotating secret:'), error);
    }
  });