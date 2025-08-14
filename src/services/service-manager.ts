import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execCommand } from '../utils/exec.js';
import { logVerbose, logSuccess, logError, logInfo } from '../utils/logger.js';

export interface ServiceConfig {
  name: string;
  displayName: string;
  networks: string[];
  containers: string[];
  volumes?: string[];
  secrets?: Record<string, () => string> | Record<string, string>;
  dependencies?: string[];
  caddyfile?: (config: any) => string;
  templates: {
    containers: Record<string, (config?: any) => string>;
    volumes?: Record<string, string>;
    networks?: Record<string, string>;
  };
}

export class ServiceManager {
  private services: Map<string, ServiceConfig> = new Map();
  
  register(service: ServiceConfig) {
    this.services.set(service.name, service);
  }
  
  async install(serviceName: string, deployDir: string, config: any, options?: any) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    logInfo(`Installing ${service.displayName}...`);
    
    // Step 1: Setup secrets
    if (service.secrets && !options?.skipSecrets) {
      logVerbose('Creating secrets...');
      await this.setupSecrets(serviceName, service.secrets, options);
    }
    
    // Step 2: Create networks
    if (service.templates.networks) {
      logVerbose('Creating network configurations...');
      await this.createNetworks(deployDir, service.templates.networks);
    }
    
    // Step 3: Create volumes
    if (service.templates.volumes) {
      logVerbose('Creating volume configurations...');
      await this.createVolumes(deployDir, service.templates.volumes);
    }
    
    // Step 4: Create containers
    logVerbose('Creating container configurations...');
    await this.createContainers(deployDir, service.templates.containers, config);
    
    // Step 5: Create Caddyfile if needed
    if (service.caddyfile) {
      logVerbose('Creating Caddy configuration...');
      await this.createCaddyfile(deployDir, serviceName, service.caddyfile(config));
    }
    
    // Step 6: Reload systemd
    logVerbose('Reloading systemd...');
    await execCommand('systemctl --user daemon-reload');
    
    // Step 7: Start services
    logVerbose('Starting services...');
    await this.startServices(service);
    
    logSuccess(`${service.displayName} installed successfully!`);
  }
  
  async remove(serviceName: string, deployDir: string, options?: any) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    logInfo(`Removing ${service.displayName}...`);
    
    // Step 1: Stop services
    logVerbose('Stopping services...');
    await this.stopServices(service);
    
    // Step 2: Remove files
    logVerbose('Removing configuration files...');
    await this.removeFiles(deployDir, service);
    
    // Step 3: Remove secrets
    if (service.secrets) {
      logVerbose('Removing secrets...');
      await this.removeSecrets(serviceName, Object.keys(service.secrets));
    }
    
    // Step 4: Remove volumes if requested
    if (!options?.keepData && service.volumes) {
      logVerbose('Removing data volumes...');
      await this.removeVolumes(service.volumes);
    }
    
    // Step 5: Reload systemd
    logVerbose('Reloading systemd...');
    await execCommand('systemctl --user daemon-reload');
    
    // Step 6: Restart Caddy to pick up changes
    if (service.caddyfile) {
      logVerbose('Restarting Caddy...');
      await execCommand('systemctl --user restart caddy.container').catch(() => {});
    }
    
    logSuccess(`${service.displayName} removed successfully!`);
  }
  
  async isInstalled(serviceName: string, deployDir: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) return false;
    
    try {
      // Check if main container file exists
      const mainContainer = service.containers[0];
      await fs.access(path.join(deployDir, 'containers', `${mainContainer}.container`));
      return true;
    } catch {
      return false;
    }
  }
  
  async list(): Promise<string[]> {
    return Array.from(this.services.keys());
  }
  
  private async setupSecrets(serviceName: string, secrets: Record<string, () => string> | Record<string, string>, options?: any) {
    const prefix = serviceName.toUpperCase();
    
    for (const [key, valueOrGenerator] of Object.entries(secrets)) {
      const secretName = `${prefix}_${key}`;
      const value = typeof valueOrGenerator === 'function' ? valueOrGenerator() : valueOrGenerator;
      
      // Skip empty values
      if (!value) {
        logVerbose(`Skipping empty secret: ${secretName}`);
        continue;
      }
      
      // Remove existing secret if it exists
      try {
        await execCommand(`podman secret inspect ${secretName} >/dev/null 2>&1`);
        await execCommand(`podman secret rm ${secretName}`);
      } catch {
        // Secret doesn't exist
      }
      
      // Create new secret
      await execCommand(`echo -n "${value}" | podman secret create ${secretName} -`);
    }
  }
  
  // Public method to setup secrets from resolved values
  async setupSecretsFromConfig(serviceName: string, secretsConfig: Record<string, string>) {
    return this.setupSecrets(serviceName, secretsConfig);
  }
  
  private async removeSecrets(serviceName: string, secretKeys: string[]) {
    const prefix = serviceName.toUpperCase();
    
    for (const key of secretKeys) {
      const secretName = `${prefix}_${key}`;
      await execCommand(`podman secret rm ${secretName}`).catch(() => {});
    }
  }
  
  private async createNetworks(deployDir: string, networks: Record<string, string>) {
    const containersDir = path.join(deployDir, 'containers');
    
    for (const [name, content] of Object.entries(networks)) {
      await fs.writeFile(path.join(containersDir, `${name}.network`), content);
    }
  }
  
  private async createVolumes(deployDir: string, volumes: Record<string, string>) {
    const containersDir = path.join(deployDir, 'containers');
    
    for (const [name, content] of Object.entries(volumes)) {
      await fs.writeFile(path.join(containersDir, `${name}.volume`), content);
    }
  }
  
  private async createContainers(deployDir: string, containers: Record<string, (config?: any) => string>, config: any) {
    const containersDir = path.join(deployDir, 'containers');
    
    for (const [name, template] of Object.entries(containers)) {
      await fs.writeFile(path.join(containersDir, `${name}.container`), template(config));
    }
  }
  
  private async createCaddyfile(deployDir: string, serviceName: string, content: string) {
    const caddyfilesDir = path.join(deployDir, 'containers', 'caddyfiles');
    await fs.mkdir(caddyfilesDir, { recursive: true });
    await fs.writeFile(path.join(caddyfilesDir, `${serviceName}.caddy`), content);
  }
  
  private async removeFiles(deployDir: string, service: ServiceConfig) {
    const containersDir = path.join(deployDir, 'containers');
    
    // Remove container files
    for (const container of service.containers) {
      try {
        await fs.unlink(path.join(containersDir, `${container}.container`));
      } catch {}
    }
    
    // Remove volume files
    if (service.volumes) {
      for (const volume of service.volumes) {
        try {
          await fs.unlink(path.join(containersDir, `${volume}.volume`));
        } catch {}
      }
    }
    
    // Remove network files
    for (const network of service.networks) {
      // Only remove if it's service-specific
      if (network !== 'core' && network !== 'addon') {
        try {
          await fs.unlink(path.join(containersDir, `${network}.network`));
        } catch {}
      }
    }
    
    // Remove Caddyfile
    if (service.caddyfile) {
      try {
        await fs.unlink(path.join(containersDir, 'caddyfiles', `${service.name}.caddy`));
      } catch {}
    }
  }
  
  private async removeVolumes(volumes: string[]) {
    for (const volume of volumes) {
      await execCommand(`podman volume rm ${volume}`).catch(() => {});
    }
  }
  
  private async startServices(service: ServiceConfig) {
    // Start networks first
    for (const network of service.networks) {
      if (network !== 'core' && network !== 'addon') {
        await execCommand(`systemctl --user start ${network}-network.service`).catch(() => {});
      }
    }
    
    // Start containers in order
    for (const container of service.containers) {
      await execCommand(`systemctl --user start ${container}.container`);
    }
    
    // Restart Caddy if we added a Caddyfile
    if (service.caddyfile) {
      await execCommand('systemctl --user restart caddy.container');
    }
  }
  
  private async stopServices(service: ServiceConfig) {
    // Stop containers in reverse order
    for (const container of [...service.containers].reverse()) {
      await execCommand(`systemctl --user stop ${container}.container`).catch(() => {});
      await execCommand(`systemctl --user disable ${container}.container`).catch(() => {});
    }
    
    // Stop networks
    for (const network of service.networks) {
      if (network !== 'core' && network !== 'addon') {
        await execCommand(`systemctl --user stop ${network}-network.service`).catch(() => {});
        await execCommand(`systemctl --user disable ${network}-network.service`).catch(() => {});
      }
    }
  }
}

// Create singleton instance
export const serviceManager = new ServiceManager();

// Helper function to generate random passwords
export function generatePassword(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, length);
}

export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}