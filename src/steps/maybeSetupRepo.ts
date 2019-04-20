import {
  repoExists,
  deleteRepo,
  cloneRepo,
  addRemote,
  deleteRemote
} from '../services/git';
import ora = require('ora');
import { mkdirp } from '../services/rpc';
import * as env from '../services/env';

export async function maybeSetupRepo(
  accessToken: string,
  owner: string,
  repoName: string,
  username: string
) {
  const spinner = ora('').start();
  const isAlreadyCloned = await repoExists({ owner, repoName });

  try {
    // clone repo if folder does not already exists
    if (!isAlreadyCloned) {
      const spinnerCloneText = 'Cloning repository (only first time)';
      spinner.text = `0% ${spinnerCloneText}`;
      await mkdirp(env.getRepoOwnerPath(owner));

      await cloneRepo({
        owner,
        repoName,
        accessToken,
        callback: (progress: string) => {
          spinner.text = `${progress}% ${spinnerCloneText}`;
        }
      });
    } else {
      spinner.text = 'Cloning repo (skipping)';
    }

    // ensure remote are setup with latest accessToken
    await deleteRemote({ owner, repoName, username: owner });
    await deleteRemote({ owner, repoName, username });
    await addRemote({ owner, repoName, username: owner, accessToken });
    await addRemote({ owner, repoName, username, accessToken });

    spinner.succeed();
  } catch (e) {
    spinner.stop();
    await deleteRepo({ owner, repoName });
    throw e;
  }
}
