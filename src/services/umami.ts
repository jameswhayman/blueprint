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

// Define Umami service configuration (without secrets)
const baseUmamiService: Omit<ServiceConfig, 'secrets'> = {
  name: 'umami',
  displayName: 'Umami Analytics',
  networks: ['umami'],
  containers: ['umami-postgres', 'umami'],
  volumes: ['umami-postgres-data', 'umami-data'],
  dependencies: ['caddy'],
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
      'umami': umamiNetworkUnit
    }
  }
};

// Generate Umami secrets configuration
export function generateUmamiSecretsConfig(): Record<string, string> {
  const postgresPassword = generatePassword();
  const appSecret = generateSecret();
  const postgresDb = 'umami';
  const postgresUser = 'umami';
  const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@umami-postgres:5432/${postgresDb}`;
  
  return {
    'POSTGRES_DB': postgresDb,
    'POSTGRES_USER': postgresUser,
    'POSTGRES_PASSWORD': postgresPassword,
    'APP_SECRET': appSecret,
    'DATABASE_URL': databaseUrl
  };
}

// Register the service with the service manager (secrets will be generated at install time)
const umamiService: ServiceConfig = {
  ...baseUmamiService,
  secrets: {} // Empty, will be populated at install time
};
serviceManager.register(umamiService);

// Custom setup function for Umami secrets (handles DATABASE_URL dependency)
export async function setupUmamiSecrets() {
  // Check for existing secrets first
  const secretKeys = ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'APP_SECRET', 'DATABASE_URL'];
  const existingSecrets: string[] = [];
  
  for (const key of secretKeys) {
    const secretName = `UMAMI_${key}`;
    try {
      await execCommand(`podman secret inspect ${secretName} >/dev/null 2>&1`);
      existingSecrets.push(secretName);
    } catch {
      // Secret doesn't exist
    }
  }
  
  if (existingSecrets.length > 0) {
    const { default: inquirer } = await import('inquirer');
    const { default: chalk } = await import('chalk');
    
    console.log(chalk.yellow(`\n⚠️  Found existing Umami secrets:`));
    for (const secret of existingSecrets) {
      console.log(`   - ${secret}`);
    }
    
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing secrets?',
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.blue('ℹ Keeping existing secrets. Service may not work properly if secrets are outdated.'));
      return;
    }
  }
  const postgresPassword = generatePassword();
  const appSecret = generateSecret();
  const postgresDb = 'umami';
  const postgresUser = 'umami';
  
  // List of secrets to create
  const secrets = [
    { name: 'UMAMI_POSTGRES_DB', value: postgresDb },
    { name: 'UMAMI_POSTGRES_USER', value: postgresUser },
    { name: 'UMAMI_POSTGRES_PASSWORD', value: postgresPassword },
    { name: 'UMAMI_APP_SECRET', value: appSecret }
  ];
  
  // Create database URL secret (depends on password)
  const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@umami-postgres:5432/${postgresDb}`;
  secrets.push({ name: 'UMAMI_DATABASE_URL', value: databaseUrl });
  
  // Create each secret, removing existing ones first
  for (const secret of secrets) {
    // Remove existing secret if it exists
    try {
      await execCommand(`podman secret inspect ${secret.name} >/dev/null 2>&1`);
      await execCommand(`podman secret rm ${secret.name}`);
    } catch {
      // Secret doesn't exist, which is fine
    }
    
    // Create new secret
    await execCommand(`echo -n "${secret.value}" | podman secret create ${secret.name} -`);
  }
  
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