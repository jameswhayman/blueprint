import fs from 'fs/promises';
import path from 'path';
import { caddyContainerUnit, caddySocketUnit, caddyDataVolume, caddyConfigVolume } from '../templates/systemd/caddy.js';
import { autheliaContainerUnit, autheliaDataVolume } from '../templates/systemd/authelia.js';
import { autheliaPostgresContainerUnit, autheliaPostgresDataVolume } from '../templates/systemd/authelia-postgres.js';

export async function generateSystemdUnits(deployDir: string, service: string, config: any) {
  const containersDir = path.join(deployDir, 'containers');
  const userDir = path.join(deployDir, 'user');

  switch (service) {
    case 'caddy':
      await generateCaddySystemdUnits(containersDir, userDir, config);
      break;
    case 'authelia':
      await generateAutheliaSystemdUnits(containersDir, config);
      break;
    case 'authelia-postgres':
      await generateAutheliaPostgresSystemdUnits(containersDir, config);
      break;
  }
}

async function generateCaddySystemdUnits(containersDir: string, userDir: string, config: any) {
  await fs.writeFile(path.join(containersDir, 'caddy.container'), caddyContainerUnit(containersDir));
  await fs.writeFile(path.join(userDir, 'caddy.socket'), caddySocketUnit);
  await fs.writeFile(path.join(containersDir, 'caddy-data.volume'), caddyDataVolume);
  await fs.writeFile(path.join(containersDir, 'caddy-config.volume'), caddyConfigVolume);
}

async function generateAutheliaSystemdUnits(containersDir: string, config: any) {
  const secretsDir = path.dirname(containersDir) + '/secrets';
  
  await fs.writeFile(path.join(containersDir, 'authelia.container'), autheliaContainerUnit(containersDir, secretsDir));
  await fs.writeFile(path.join(containersDir, 'authelia-data.volume'), autheliaDataVolume);
}

async function generateAutheliaPostgresSystemdUnits(containersDir: string, config: any) {
  const secretsDir = path.dirname(containersDir) + '/secrets';
  
  await fs.writeFile(path.join(containersDir, 'authelia-postgres.container'), autheliaPostgresContainerUnit(secretsDir));
  await fs.writeFile(path.join(containersDir, 'authelia-postgres-data.volume'), autheliaPostgresDataVolume);
}

