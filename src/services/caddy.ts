import fs from 'fs/promises';
import path from 'path';
import { caddyfileTemplate } from '../templates/config/caddyfile.js';

export async function generateCaddyfile(deployDir: string, config: any) {
  const caddyConfig = caddyfileTemplate(config);
  await fs.writeFile(path.join(deployDir, 'containers', 'Caddyfile'), caddyConfig);
}
