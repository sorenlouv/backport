import isEmpty from 'lodash.isempty';
import { setAccessToken } from '../lib/github';

import {
  getCommitsByPrompt,
  getCommitBySha,
  getBranchesByPrompt,
  doBackportVersions,
  handleErrors,
  maybeSetupRepo,
  getCommitByPullNumber
} from './cliService';
import { BackportOptions } from '../types/types';

export async function initSteps(options: BackportOptions) {
  const [owner, repoName] = options.upstream.split('/');
  setAccessToken(options.accessToken);

  try {
    const commits = await getCommits(owner, repoName, options);
    const branches = await getBranches(options);

    await maybeSetupRepo(owner, repoName, options.username);
    await doBackportVersions(
      owner,
      repoName,
      commits,
      branches,
      options.username,
      options.labels
    );
  } catch (e) {
    handleErrors(e);
  }
}

async function getCommits(
  owner: string,
  repoName: string,
  options: BackportOptions
) {
  if (options.sha) {
    return [await getCommitBySha(owner, repoName, options.sha)];
  }

  if (options.pullNumber) {
    return [await getCommitByPullNumber(owner, repoName, options.pullNumber)];
  }

  const author = options.all ? null : options.username;
  return getCommitsByPrompt(owner, repoName, author, options.multipleCommits);
}

function getBranches(options: BackportOptions) {
  if (!isEmpty(options.branches)) {
    return options.branches!;
  }

  return getBranchesByPrompt(options.branchChoices!, options.multipleBranches);
}
