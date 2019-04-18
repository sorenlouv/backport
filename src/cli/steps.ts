import isEmpty from 'lodash.isempty';
import { setAccessToken } from '../lib/github';

import {
  getCommitsByPrompt,
  getCommitBySha,
  getBranchesByPrompt,
  doBackportVersions,
  maybeSetupRepo
} from './cliService';
import { printHandledError } from '../lib/HandledError';
import { BranchChoice } from '../lib/options/config/projectConfig';
import { BackportOptions } from '../lib/options/options';

export async function initSteps(options: BackportOptions) {
  const [owner, repoName] = options.upstream.split('/');
  setAccessToken(options.accessToken);

  try {
    const author = options.all ? null : options.username;
    const commits = options.sha
      ? [await getCommitBySha(owner, repoName, options.sha)]
      : await getCommitsByPrompt(
          owner,
          repoName,
          author,
          options.multipleCommits
        );

    const branches = !isEmpty(options.branches)
      ? options.branches
      : await getBranchesByPrompt(
          options.branchChoices as BranchChoice[],
          options.multipleBranches
        );

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
    printHandledError(e);
  }
}
