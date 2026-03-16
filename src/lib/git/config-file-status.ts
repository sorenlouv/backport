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
  } catch (error) {
    logger.debug(
      `Could not retrieve commit date for .backportrc.json: ${error}`,
    );
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
  } catch (error) {
    logger.debug(`Could not check if .backportrc.json is untracked: ${error}`);
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
  } catch (error) {
    logger.debug(`Could not check if .backportrc.json is modified: ${error}`);
    return false;
  }
}
