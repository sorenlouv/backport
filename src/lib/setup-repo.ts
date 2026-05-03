import fs from 'node:fs/promises';
import type { ValidConfigOptions } from '../options/options.js';
import { BackportError } from './backport-error.js';
import { getRepoPath } from './env.js';
import {
  addRemote,
  cloneRepo,
  deleteRemote,
  getGitProjectRootPath,
  getLocalSourceRepoPath,
  getRemoteUrl,
} from './git/index.js';
import { logger } from './logger.js';
import { ora } from './ora.js';

export async function setupRepo(options: ValidConfigOptions) {
  const repoPath = getRepoPath(options);
  const isAlreadyCloned = await getIsRepoCloned(options);

  // clone repo if folder does not already exists
  if (!isAlreadyCloned) {
    if (options.cwd.includes(repoPath)) {
      throw new BackportError({
        code: 'clone-exception',
        message: `Refusing to clone repo into "${repoPath}" when current working directory is "${options.cwd}". Please change backport directory via \`--dir\` option or run backport from another location`,
      });
    }

    const spinner = ora(options.interactive).start();
    try {
      const localRepoPath = await getLocalSourceRepoPath(options);
      const remoteRepoPath = getRemoteUrl(options, options.repoOwner);
      const sourcePath = localRepoPath ?? remoteRepoPath;

      // show the full path for local repos, but only the host name for remote repos (to avoid showing the github token)
      const sourcePathHumanReadable = localRepoPath
        ? sourcePath
        : options.gitHostname;

      const spinnerCloneText = `Cloning repository from ${sourcePathHumanReadable} (one-time operation)`;
      spinner.text = `0% ${spinnerCloneText}`;

      await fs.rm(repoPath, { recursive: true, force: true });

      await cloneRepo(
        { sourcePath, targetPath: repoPath },
        (progress: number) => {
          spinner.text = `${progress}% ${spinnerCloneText}`;
        },
      );

      spinner.succeed(`100% ${spinnerCloneText}`);
    } catch (error) {
      spinner.fail();
      await fs.rm(repoPath, { recursive: true, force: true });
      throw error;
    }
  }

  // delete default "origin" remote to avoid confusion
  await deleteRemote(options, 'origin');

  // ensure remote are setup with latest githubToken
  await deleteRemote(options, options.repoForkOwner);
  await addRemote(options, options.repoForkOwner);

  // add remote for non-fork repo (if the above is a fork)
  if (options.repoForkOwner !== options.repoOwner) {
    await deleteRemote(options, options.repoOwner);
    await addRemote(options, options.repoOwner);
  }
}

async function getIsRepoCloned(options: ValidConfigOptions): Promise<boolean> {
  const repoPath = getRepoPath(options);
  const projectRoot = await getGitProjectRootPath(repoPath);
  logger.debug(`repoPath=${repoPath}, projectRoot=${projectRoot}`);
  return repoPath === projectRoot;
}
