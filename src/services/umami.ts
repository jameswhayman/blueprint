import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execCommand } from '../utils/exec.js';
import { serviceManager, ServiceConfig, generatePassword, generateSecret } from './service-manager.js';
import { umamiCaddyfileTemplate } from '../templates/config/umami.caddy.js';
import { 
  umamiContainerUnit, 
  umamiDataVolume
} from '../templates/systemd/umami.js';
import { 
  umamiPostgresContainerUnit,
  umamiPostgresDataVolume
} from '../templates/systemd/umami-postgres.js';
import { umamiNetworkUnit } from '../templates/systemd/umami-network.js';

// Define Umami service configuration
const umamiService: ServiceConfig = {
  name: 'umami',
  displayName: 'Umami Analytics',
  networks: ['umami'],
  containers: ['umami-postgres', 'umami'],
  volumes: ['umami-postgres-data', 'umami-data'],
  dependencies: ['caddy'],
  secrets: {
    'POSTGRES_DB': () => 'umami',
    'POSTGRES_USER': () => 'umami',
    'POSTGRES_PASSWORD': () => generatePassword(),
    'APP_SECRET': () => generateSecret(),
    'DATABASE_URL': function() {
      // This needs to reference the password generated above
      // We'll handle this specially in the install process
      return '';
    }
  },
  caddyfile: umamiCaddyfileTemplate,
  templates: {
    containers: {
      'umami-postgres': umamiPostgresContainerUnit,
      'umami': umamiContainerUnit
    },
    volumes: {
      'umami-postgres-data': umamiPostgresDataVolume,
      'umami-data': umamiDataVolume
    },
    networks: {
      'umami-network': umamiNetworkUnit
    }
  }
};

// Register the service with the service manager
serviceManager.register(umamiService);

// Custom setup function for Umami secrets (handles DATABASE_URL dependency)
export async function setupUmamiSecrets() {
  const postgresPassword = generatePassword();
  const appSecret = generateSecret();
  const postgresDb = 'umami';
  const postgresUser = 'umami';
  
  // Create Podman secrets for Umami PostgreSQL
  await execCommand(`echo -n "${postgresDb}" | podman secret create UMAMI_POSTGRES_DB -`);
  await execCommand(`echo -n "${postgresUser}" | podman secret create UMAMI_POSTGRES_USER -`);
  await execCommand(`echo -n "${postgresPassword}" | podman secret create UMAMI_POSTGRES_PASSWORD -`);
  await execCommand(`echo -n "${appSecret}" | podman secret create UMAMI_APP_SECRET -`);
  
  // Create database URL secret (depends on password)
  const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@umami-postgres:5432/${postgresDb}`;
  await execCommand(`echo -n "${databaseUrl}" | podman secret create UMAMI_DATABASE_URL -`);
  
  return {
    postgresDb,
    postgresUser,
    postgresPassword,
    appSecret,
    databaseUrl
  };
}

// Legacy functions for backward compatibility
export async function generateUmamiFiles(deployDir: string, config: any) {
  const containersDir = path.join(deployDir, 'containers');
  const caddyfilesDir = path.join(containersDir, 'caddyfiles');
  
  // Create caddyfiles directory
  await fs.mkdir(caddyfilesDir, { recursive: true });
  
  // Generate Umami Caddyfile
  const umamiCaddyfile = umamiCaddyfileTemplate(config);
  await fs.writeFile(path.join(caddyfilesDir, 'umami.caddy'), umamiCaddyfile);
  
  // Generate systemd units
  await fs.writeFile(path.join(containersDir, 'umami-network.network'), umamiNetworkUnit);
  await fs.writeFile(path.join(containersDir, 'umami-postgres.container'), umamiPostgresContainerUnit());
  await fs.writeFile(path.join(containersDir, 'umami-postgres-data.volume'), umamiPostgresDataVolume);
  await fs.writeFile(path.join(containersDir, 'umami.container'), umamiContainerUnit());
  await fs.writeFile(path.join(containersDir, 'umami-data.volume'), umamiDataVolume);
}

export async function isUmamiEnabled(deployDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(deployDir, 'containers', 'umami.container'));
    return true;
  } catch {
    return false;
  }
}