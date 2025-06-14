import { homedir } from 'os';
import path from 'path';
import type { ValidConfigOptions } from '../options/options';
import type { LogLevel } from './logger';

export function getBackportDirPath() {
  return path.join(homedir(), '.backport');
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
  return path.join(homedir(), '.backport', `backport.${logLevel}.log`);
}

export function getGlobalConfigPath(globalConfigFile: string | undefined) {
  if (globalConfigFile) {
    return path.resolve(globalConfigFile);
  }
  return path.join(homedir(), '.backport', 'config.json');
}

export function getRepoPath({ repoOwner, repoName, dir }: ValidConfigOptions) {
  if (dir) {
    return dir;
  }

  return path.join(homedir(), '.backport', 'repositories', repoOwner, repoName);
}
