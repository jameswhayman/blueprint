import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export const domainCommand = new Command('domain')
  .description('Manage domain routing and configuration');

domainCommand
  .command('add')
  .description('Add a new domain/route to Caddy')
  .option('-d, --domain <domain>', 'Domain name')
  .option('-t, --target <target>', 'Target service or URL')
  .option('-p, --path <path>', 'Path prefix', '/')
  .action(async (options) => {
    let config: any = {
      domain: options.domain,
      target: options.target,
      path: options.path
    };

    if (!options.domain || !options.target) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'domain',
          message: 'Domain name (e.g., app.example.com):',
          when: !options.domain,
          validate: (input) => input.length > 0 || 'Domain is required'
        },
        {
          type: 'list',
          name: 'targetType',
          message: 'Target type:',
          choices: [
            { name: 'Static files', value: 'static' },
            { name: 'Reverse proxy (HTTP service)', value: 'proxy' },
            { name: 'Container service', value: 'container' },
            { name: 'Custom response', value: 'custom' }
          ]
        },
        {
          type: 'input',
          name: 'target',
          message: 'Target (e.g., http://localhost:3000, /var/www/html):',
          when: (answers) => answers.targetType !== 'custom' && !options.target
        },
        {
          type: 'input',
          name: 'customResponse',
          message: 'Custom response text:',
          when: (answers) => answers.targetType === 'custom'
        },
        {
          type: 'input',
          name: 'path',
          message: 'Path prefix:',
          default: '/',
          when: !options.path
        },
        {
          type: 'confirm',
          name: 'requireAuth',
          message: 'Require Authelia authentication?',
          default: false
        }
      ]);

      config = { ...config, ...answers };
      if (answers.targetType === 'custom') {
        config.target = `respond "${answers.customResponse}"`;
      }
    }

    try {
      const caddyFile = path.join(process.cwd(), 'containers', 'Caddyfile');
      const content = await fs.readFile(caddyFile, 'utf8');
      
      let newRoute = `\n${config.domain} {\n`;
      
      if (config.requireAuth) {
        newRoute += `    forward_auth authelia:9091 {\n`;
        newRoute += `        uri /api/verify?rd=https://${config.domain}\n`;
        newRoute += `        copy_headers Remote-User Remote-Groups Remote-Name Remote-Email\n`;
        newRoute += `    }\n\n`;
      }

      if (config.path !== '/') {
        newRoute += `    handle ${config.path}* {\n`;
      }

      if (config.target.startsWith('http')) {
        newRoute += `        reverse_proxy ${config.target}\n`;
      } else if (config.target.startsWith('/')) {
        newRoute += `        file_server {\n`;
        newRoute += `            root ${config.target}\n`;
        newRoute += `        }\n`;
      } else if (config.target.startsWith('respond')) {
        newRoute += `        ${config.target}\n`;
      } else {
        newRoute += `        reverse_proxy ${config.target}\n`;
      }

      if (config.path !== '/') {
        newRoute += `    }\n`;
      }

      newRoute += `}\n`;

      const updatedContent = content + newRoute;
      await fs.writeFile(caddyFile, updatedContent, 'utf8');

      console.log(chalk.green(`✓ Domain ${config.domain} added to Caddy configuration`));
      console.log(chalk.cyan('Restart Caddy to apply changes:'));
      console.log('  systemctl --user restart caddy.container');
    } catch (error) {
      console.error(chalk.red('Error adding domain:'), error);
    }
  });

domainCommand
  .command('list')
  .description('List configured domains')
  .action(async () => {
    try {
      const caddyFile = path.join(process.cwd(), 'containers', 'Caddyfile');
      const content = await fs.readFile(caddyFile, 'utf8');

      console.log(chalk.blue('🌐 Configured Domains:'));
      
      // Simple regex to extract domain blocks
      const domainBlocks = content.match(/^[^\s{]+\s*{[^}]*}/gm);
      
      if (domainBlocks) {
        domainBlocks.forEach(block => {
          const lines = block.split('\n');
          const domain = lines[0].replace(/\s*{.*/, '').trim();
          
          if (domain && !domain.startsWith('admin') && !domain.startsWith(':')) {
            console.log(`\n  ${chalk.green(domain)}`);
            
            // Extract some basic info
            if (block.includes('reverse_proxy')) {
              const proxyMatch = block.match(/reverse_proxy\s+([^\n\r]+)/);
              if (proxyMatch) {
                console.log(`    → ${chalk.cyan(proxyMatch[1].trim())}`);
              }
            }
            
            if (block.includes('forward_auth')) {
              console.log(`    🔒 ${chalk.yellow('Authentication required')}`);
            }
            
            if (block.includes('file_server')) {
              const rootMatch = block.match(/root\s+([^\n\r}]+)/);
              if (rootMatch) {
                console.log(`    📁 ${chalk.cyan(rootMatch[1].trim())}`);
              }
            }
          }
        });
      } else {
        console.log(chalk.yellow('  No domains configured'));
      }
    } catch (error) {
      console.error(chalk.red('Error reading Caddy configuration:'), error);
    }
  });

domainCommand
  .command('remove <domain>')
  .description('Remove a domain from Caddy configuration')
  .action(async (domain) => {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Remove domain ${domain} from Caddy configuration?`,
        default: false
      }
    ]);

    if (!confirm.confirmed) {
      console.log(chalk.yellow('Domain removal cancelled'));
      return;
    }

    try {
      const caddyFile = path.join(process.cwd(), 'containers', 'Caddyfile');
      const content = await fs.readFile(caddyFile, 'utf8');

      // Remove the domain block
      const regex = new RegExp(`^${domain.replace('.', '\\.')}\\s*\\{[^}]*\\}\\n?`, 'gm');
      const updatedContent = content.replace(regex, '');

      if (updatedContent === content) {
        console.log(chalk.yellow(`Domain ${domain} not found in configuration`));
        return;
      }

      await fs.writeFile(caddyFile, updatedContent, 'utf8');

      console.log(chalk.green(`✓ Domain ${domain} removed from Caddy configuration`));
      console.log(chalk.cyan('Restart Caddy to apply changes:'));
      console.log('  systemctl --user restart caddy.container');
    } catch (error) {
      console.error(chalk.red('Error removing domain:'), error);
    }
  });