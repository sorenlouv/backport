import {
  addRemote,
  cloneRepo,
  deleteRemote,
  deleteRepo,
  repoExists
} from '../services/git';
import ora = require('ora');
import { BackportOptions } from '../options/options';
import { getRepoOwnerPath } from '../services/env';
import { mkdirp } from '../services/rpc';

export async function maybeSetupRepo(options: BackportOptions) {
  const isAlreadyCloned = await repoExists(options);

  // clone repo if folder does not already exists
  if (!isAlreadyCloned) {
    const spinner = ora().start();
    try {
      const spinnerCloneText = 'Cloning repository (one-time operation)';
      spinner.text = `0% ${spinnerCloneText}`;
      await mkdirp(getRepoOwnerPath(options));

      await cloneRepo(options, (progress: string) => {
        spinner.text = `${progress}% ${spinnerCloneText}`;
      });
      await deleteRemote(options, 'origin');
      spinner.succeed(`100% ${spinnerCloneText}`);
    } catch (e) {
      spinner.fail();
      await deleteRepo(options);
      throw e;
    }
  }

  // ensure remote are setup with latest accessToken
  await deleteRemote(options, options.username);
  await addRemote(options, options.username);

  if (options.username !== options.repoOwner) {
    await deleteRemote(options, options.repoOwner);
    await addRemote(options, options.repoOwner);
  }
}
