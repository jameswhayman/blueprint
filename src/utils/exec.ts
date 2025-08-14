import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export async function execCommand(command: string): Promise<string> {
  const { stdout } = await execAsync(command);
  return stdout;
}