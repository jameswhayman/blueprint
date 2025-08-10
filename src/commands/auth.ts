import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import argon2 from 'argon2';
import { generateTOTPSecret } from '../utils/totp.js';

export const authCommand = new Command('auth')
  .description('Manage Authelia authentication');

authCommand
  .command('add-user')
  .description('Add a new user to Authelia')
  .option('-u, --username <username>', 'Username')
  .option('-p, --password <password>', 'Password')
  .option('-e, --email <email>', 'Email address')
  .option('-g, --groups <groups>', 'Comma-separated list of groups', 'users')
  .action(async (options) => {
    let config = {
      username: options.username,
      password: options.password,
      email: options.email,
      groups: options.groups.split(',').map((g: string) => g.trim())
    };

    if (!options.username || !options.password || !options.email) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Username:',
          when: !options.username,
          validate: (input) => input.length > 0 || 'Username is required'
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          when: !options.password,
          validate: (input) => input.length >= 8 || 'Password must be at least 8 characters'
        },
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          when: !options.email,
          validate: (input) => input.includes('@') || 'Valid email is required'
        },
        {
          type: 'checkbox',
          name: 'groups',
          message: 'Select groups:',
          choices: [
            { name: 'users', value: 'users', checked: true },
            { name: 'admins', value: 'admins' },
            { name: 'dev', value: 'dev' }
          ]
        }
      ]);

      config = { ...config, ...answers };
    }

    try {
      const usersFile = path.join(process.cwd(), 'containers', 'authelia-config', 'users_database.yml');
      
      let users: any = { users: {} };
      try {
        const content = await fs.readFile(usersFile, 'utf8');
        users = yaml.parse(content) || { users: {} };
      } catch (error) {
        console.log(chalk.yellow('Creating new users database file...'));
      }

      const hashedPassword = await argon2.hash(config.password);
      
      users.users[config.username] = {
        displayname: config.username,
        password: hashedPassword,
        email: config.email,
        groups: config.groups
      };

      await fs.writeFile(usersFile, yaml.stringify(users), 'utf8');
      
      console.log(chalk.green(`✓ User ${config.username} added successfully`));
      console.log(chalk.cyan('Remember to restart Authelia to apply changes:'));
      console.log('  systemctl --user restart authelia.container');
    } catch (error) {
      console.error(chalk.red('Error adding user:'), error);
    }
  });

authCommand
  .command('remove-user <username>')
  .description('Remove a user from Authelia')
  .action(async (username) => {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Are you sure you want to remove user ${username}?`,
        default: false
      }
    ]);

    if (!confirm.confirmed) {
      console.log(chalk.yellow('User removal cancelled'));
      return;
    }

    try {
      const usersFile = path.join(process.cwd(), 'containers', 'authelia-config', 'users_database.yml');
      const content = await fs.readFile(usersFile, 'utf8');
      const users = yaml.parse(content);

      if (!users.users[username]) {
        console.log(chalk.yellow(`User ${username} not found`));
        return;
      }

      delete users.users[username];
      await fs.writeFile(usersFile, yaml.stringify(users), 'utf8');
      
      console.log(chalk.green(`✓ User ${username} removed successfully`));
      console.log(chalk.cyan('Remember to restart Authelia to apply changes:'));
      console.log('  systemctl --user restart authelia.container');
    } catch (error) {
      console.error(chalk.red('Error removing user:'), error);
    }
  });

authCommand
  .command('list-users')
  .description('List all Authelia users')
  .action(async () => {
    try {
      const usersFile = path.join(process.cwd(), 'containers', 'authelia-config', 'users_database.yml');
      const content = await fs.readFile(usersFile, 'utf8');
      const users = yaml.parse(content);

      console.log(chalk.blue('👥 Authelia Users:'));
      
      for (const [username, user] of Object.entries(users.users)) {
        const userData = user as any;
        console.log(`  ${chalk.green(username)} (${userData.email})`);
        console.log(`    Groups: ${userData.groups.join(', ')}`);
        console.log(`    Display Name: ${userData.displayname}`);
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('Error listing users:'), error);
    }
  });

authCommand
  .command('change-password <username>')
  .description('Change a user password')
  .option('-p, --password <password>', 'New password')
  .action(async (username, options) => {
    let password = options.password;

    if (!password) {
      const answer = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'New password:',
          validate: (input) => input.length >= 8 || 'Password must be at least 8 characters'
        }
      ]);
      password = answer.password;
    }

    try {
      const usersFile = path.join(process.cwd(), 'containers', 'authelia-config', 'users_database.yml');
      const content = await fs.readFile(usersFile, 'utf8');
      const users = yaml.parse(content);

      if (!users.users[username]) {
        console.log(chalk.yellow(`User ${username} not found`));
        return;
      }

      const hashedPassword = await argon2.hash(password);
      users.users[username].password = hashedPassword;

      await fs.writeFile(usersFile, yaml.stringify(users), 'utf8');
      
      console.log(chalk.green(`✓ Password changed for user ${username}`));
      console.log(chalk.cyan('Remember to restart Authelia to apply changes:'));
      console.log('  systemctl --user restart authelia.container');
    } catch (error) {
      console.error(chalk.red('Error changing password:'), error);
    }
  });