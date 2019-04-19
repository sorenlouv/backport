import {
  verifyGithubSshAuth,
  repoExists,
  setupRepo,
  deleteRepo
} from '../services/git';
import ora = require('ora');

export async function maybeSetupRepo(
  owner: string,
  repoName: string,
  username: string
) {
  await verifyGithubSshAuth();

  if (await repoExists(owner, repoName)) {
    return;
  }

  const text = 'Cloning repository (only first time)';
  const spinner = ora(`0% ${text}`).start();

  try {
    await setupRepo(owner, repoName, username, (progress: string) => {
      spinner.text = `${progress}% ${text}`;
    });
    spinner.succeed();
  } catch (e) {
    spinner.stop();
    await deleteRepo(owner, repoName);
    throw e;
  }
}
