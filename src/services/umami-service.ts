import { serviceManager, ServiceConfig, generatePassword, generateSecret } from './service-manager.js';
import { 
  umamiContainerUnit, 
  umamiDataVolume
} from '../templates/systemd/umami.js';
import { 
  umamiPostgresContainerUnit,
  umamiPostgresDataVolume
} from '../templates/systemd/umami-postgres.js';
import { umamiNetworkUnit } from '../templates/systemd/umami-network.js';
import { umamiCaddyfileTemplate } from '../templates/config/umami.caddy.js';

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

// Register the service
serviceManager.register(umamiService);

// Export for backward compatibility and special handling
export async function setupUmamiSecrets() {
  const postgresPassword = generatePassword();
  const appSecret = generateSecret();
  const postgresDb = 'umami';
  const postgresUser = 'umami';
  
  // Create Podman secrets for Umami PostgreSQL
  const { execCommand } = await import('../utils/exec.js');
  
  await execCommand(`echo -n "${postgresDb}" | podman secret create UMAMI_POSTGRES_DB -`);
  await execCommand(`echo -n "${postgresUser}" | podman secret create UMAMI_POSTGRES_USER -`);
  await execCommand(`echo -n "${postgresPassword}" | podman secret create UMAMI_POSTGRES_PASSWORD -`);
  await execCommand(`echo -n "${appSecret}" | podman secret create UMAMI_APP_SECRET -`);
  
  // Create database URL secret
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