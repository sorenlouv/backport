import path from 'path';
import { uniq } from 'lodash-es';
import type { ValidConfigOptions } from '../../options/options.js';
import { filterNil } from '../../utils/filter-empty.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import { logger } from '../logger.js';

export function getRemoteUrl(
  { repoName, accessToken, gitHostname = 'github.com' }: ValidConfigOptions,
  repoOwner: string,
) {
  return `https://x-access-token:${accessToken}@${gitHostname}/${repoOwner}/${repoName}.git`;
}

export async function deleteRemote(
  options: ValidConfigOptions,
  remoteName: string,
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise('git', ['remote', 'rm', remoteName], cwd);
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;

    // Swallow the "remote does not exist" failure.
    // Since git 2.30.0, this failure is indicated by the specific exit code 2.
    // In earlier versions, the exit code is 128 and only the error message can
    // tell the problems apart.
    if (
      isSpawnError &&
      (e.context.code == 2 ||
        (e.context.code == 128 && e.context.stderr.includes('No such remote')))
    ) {
      return;
    }

    // re-throw
    throw e;
  }
}

export async function addRemote(
  options: ValidConfigOptions,
  remoteName: string,
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise(
      'git',
      ['remote', 'add', remoteName, getRemoteUrl(options, remoteName)],
      cwd,
    );
  } catch (e) {
    logger.debug(`Could not add remote "${remoteName}": ${e}`);
    return;
  }
}

export async function getRepoInfoFromGitRemotes({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise('git', ['remote', '--verbose'], cwd);
    const remotes = stdout
      .split('\n')
      .map((line) => {
        const match = line.match(
          /github.com[/|:](.+?)(.git)? \((fetch|push)\)/,
        );
        return match?.[1];
      })
      .filter(filterNil);

    return uniq(remotes).map((remote) => {
      const [repoOwner, repoName] = remote.split('/');
      return { repoOwner, repoName };
    });
  } catch (e) {
    logger.debug(`An error occurred while retrieving git remotes: ${e}`);
    return [];
  }
}

/*
 * Returns the repo owner of the forked repo or the source repo
 */
export function getRepoForkOwner(options: ValidConfigOptions) {
  return options.fork ? options.repoForkOwner : options.repoOwner;
}

export async function getGitProjectRootPath(dir: string) {
  try {
    const cwd = dir;
    const { stdout } = await spawnPromise(
      'git',
      ['rev-parse', '--show-toplevel'],
      cwd,
    );
    return path.normalize(stdout.trim());
  } catch (e) {
    logger.error('An error occurred while retrieving git project root', e);
    return;
  }
}

// retrieve path to local repo (cwd) if it matches `repoName` / `repoOwner`
export async function getLocalSourceRepoPath(options: ValidConfigOptions) {
  const remotes = await getRepoInfoFromGitRemotes({ cwd: options.cwd });
  const hasMatchingGitRemote = remotes.some(
    (remote) =>
      remote.repoName === options.repoName &&
      remote.repoOwner === options.repoOwner,
  );

  return hasMatchingGitRemote ? getGitProjectRootPath(options.cwd) : undefined;
}
