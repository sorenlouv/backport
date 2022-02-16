import del = require('del');
import ora = require('ora');
import { ValidConfigOptions } from '../options/options';
import { getRepoPath } from '../services/env';
import {
  addRemote,
  cloneRepo,
  deleteRemote,
  getGitProjectRoot,
  getSourceRepoPath,
} from '../services/git';

export async function maybeSetupRepo(options: ValidConfigOptions) {
  const repoPath = getRepoPath(options);
  const isAlreadyCloned = await getIsRepoCloned(options);

  // clone repo if folder does not already exists
  if (!isAlreadyCloned) {
    const spinner = ora().start();
    try {
      const sourcePath = await getSourceRepoPath(options);

      const sourcePathHumanReadable = sourcePath.includes(options.gitHostname)
        ? options.gitHostname
        : sourcePath;

      const spinnerCloneText = `Cloning repository from ${sourcePathHumanReadable} (one-time operation)`;
      spinner.text = `0% ${spinnerCloneText}`;

      await del(repoPath, { force: true });

      await cloneRepo(
        { sourcePath, targetPath: repoPath },
        (progress: number) => {
          spinner.text = `${progress}% ${spinnerCloneText}`;
        }
      );

      spinner.succeed(`100% ${spinnerCloneText}`);
    } catch (e) {
      spinner.fail();
      await del(repoPath, { force: true });
      throw e;
    }
  }

  // delete default "origin" remote to avoid confusion
  await deleteRemote(options, 'origin');

  // ensure remote are setup with latest accessToken
  await deleteRemote(options, options.authenticatedUsername);
  await addRemote(options, options.authenticatedUsername);

  // add remote for non-fork repo (if the above is a fork)
  if (options.authenticatedUsername !== options.repoOwner) {
    await deleteRemote(options, options.repoOwner);
    await addRemote(options, options.repoOwner);
  }
}

async function getIsRepoCloned(options: ValidConfigOptions): Promise<boolean> {
  const repoPath = getRepoPath(options);
  const projectRoot = await getGitProjectRoot(options);
  return repoPath === projectRoot;
}
