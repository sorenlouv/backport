import {
  repoExists,
  deleteRepo,
  cloneRepo,
  addRemote,
  deleteRemote
} from '../services/git';
import ora = require('ora');
import { mkdirp } from '../services/rpc';
import { getRepoOwnerPath } from '../services/env';

export async function maybeSetupRepo({
  accessToken,
  owner,
  repoName,
  username
}: {
  accessToken: string;
  owner: string;
  repoName: string;
  username: string;
}) {
  const spinner = ora('').start();
  const isAlreadyCloned = await repoExists({ owner, repoName });

  try {
    // clone repo if folder does not already exists
    if (!isAlreadyCloned) {
      const spinnerCloneText = 'Cloning repository (one-time operation)';
      spinner.text = `0% ${spinnerCloneText}`;
      await mkdirp(getRepoOwnerPath(owner));

      await cloneRepo({
        owner,
        repoName,
        accessToken,
        callback: (progress: string) => {
          spinner.text = `${progress}% ${spinnerCloneText}`;
        }
      });
      spinner.text = `100% ${spinnerCloneText}`;
    } else {
      spinner.text = `Setup remotes for repository`;
    }

    // ensure remote are setup with latest accessToken
    await deleteRemote({ owner, repoName, username: owner });
    await deleteRemote({ owner, repoName, username });
    await addRemote({ owner, repoName, username: owner, accessToken });
    await addRemote({ owner, repoName, username, accessToken });

    spinner.succeed();
  } catch (e) {
    spinner.fail();
    await deleteRepo({ owner, repoName });
    throw e;
  }
}
