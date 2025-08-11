import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import argon2 from 'argon2';
import { autheliaConfigTemplate, autheliaUsersDatabaseTemplate } from '../templates/config/authelia.js';

export async function generateAutheliaConfig(deployDir: string, config: any) {
  const configDir = path.join(deployDir, 'containers', 'authelia-config');
  await fs.mkdir(configDir, { recursive: true });

  const autheliaConfig = autheliaConfigTemplate(config);

  // Generate admin user with provided details
  const adminPassword = await argon2.hash(config.adminPassword || 'changeme');
  const usersDatabase = autheliaUsersDatabaseTemplate(adminPassword, config);

  await fs.writeFile(
    path.join(configDir, 'configuration.yml'),
    yaml.stringify(autheliaConfig, { lineWidth: 0 })
  );

  await fs.writeFile(
    path.join(configDir, 'users_database.yml'),
    yaml.stringify(usersDatabase, { lineWidth: 0 })
  );
}