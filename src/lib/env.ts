import os from 'node:os';
import path from 'node:path';
import type { ValidConfigOptions } from '../options/options.js';
import type { LogLevel } from './logger.js';

export function getBackportDirPath() {
  return path.join(os.homedir(), '.backport');
}

export function getLogfilePath({
  logFilePath,
  logLevel,
}: {
  logFilePath?: string;
  logLevel: LogLevel;
}) {
  if (logFilePath) {
    return path.resolve(logFilePath);
  }
  return path.join(os.homedir(), '.backport', `backport.${logLevel}.log`);
}

export function getGlobalConfigPath(globalConfigFile?: string) {
  if (globalConfigFile) {
    return path.resolve(globalConfigFile);
  }
  return path.join(os.homedir(), '.backport', 'config.json');
}

export function getRepoPath({ repoOwner, repoName, dir }: ValidConfigOptions) {
  if (dir) {
    return dir;
  }

  return path.join(
    os.homedir(),
    '.backport',
    'repositories',
    repoOwner,
    repoName,
  );
}
