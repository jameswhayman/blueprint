import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export function logVerbose(message: string, ...args: any[]): void {
  if (verboseMode) {
    console.log(chalk.gray('[DEBUG]'), message, ...args);
  }
}

export function logCommand(command: string): void {
  if (verboseMode) {
    console.log(chalk.gray('[CMD]'), chalk.cyan(command));
  }
}

export function logInfo(message: string, ...args: any[]): void {
  console.log(chalk.blue('ℹ'), message, ...args);
}

export function logSuccess(message: string, ...args: any[]): void {
  console.log(chalk.green('✓'), message, ...args);
}

export function logError(message: string, ...args: any[]): void {
  console.error(chalk.red('✗'), message, ...args);
}

export function logWarning(message: string, ...args: any[]): void {
  console.log(chalk.yellow('⚠'), message, ...args);
}