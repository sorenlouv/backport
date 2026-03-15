import { spawnPromise } from '../child-process-promisified.js';
import { logger } from '../logger.js';

export async function getLocalConfigFileCommitDate({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise(
      'git',
      ['--no-pager', 'log', '-1', '--format=%cd', '.backportrc.json'],
      cwd,
    );

    const timestamp = Date.parse(stdout);
    if (timestamp > 0) {
      return timestamp;
    }
  } catch (e) {
    logger.debug(`Could not retrieve commit date for .backportrc.json: ${e}`);
    return;
  }
}

export async function isLocalConfigFileUntracked({ cwd }: { cwd: string }) {
  try {
    // list untracked files
    const { stdout } = await spawnPromise(
      'git',
      ['ls-files', '.backportrc.json', '--exclude-standard', '--others'],
      cwd,
    );

    return !!stdout;
  } catch (e) {
    logger.debug(`Could not check if .backportrc.json is untracked: ${e}`);
    return;
  }
}

export async function isLocalConfigFileModified({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise(
      'git',
      ['--no-pager', 'diff', 'HEAD', '--name-only', '.backportrc.json'],
      cwd,
    );

    return !!stdout;
  } catch (e) {
    logger.debug(`Could not check if .backportrc.json is modified: ${e}`);
    return false;
  }
}
