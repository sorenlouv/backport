import chalk from 'chalk';
import { flatten } from 'lodash';
import { ValidConfigOptions } from '../../options/options';
import { getSourceBranchFromCommits } from '../getSourceBranchFromCommits';
import {
  createBackportBranch,
  deleteBackportBranch,
  pushBackportBranch,
  getRepoForkOwner,
} from '../git';
import { addAssigneesToPullRequest } from '../github/v3/addAssigneesToPullRequest';
import { addLabelsToPullRequest } from '../github/v3/addLabelsToPullRequest';
import { addReviewersToPullRequest } from '../github/v3/addReviewersToPullRequest';
import {
  createPullRequest,
  getTitle,
  getPullRequestBody,
  PullRequestPayload,
} from '../github/v3/createPullRequest';
import { syncSourcePullRequestReviewersToTargetPullRequest } from '../github/v3/syncSourcePullRequestReviewersToTargetPullRequest';
import { validateTargetBranch } from '../github/v4/validateTargetBranch';
import { consoleLog } from '../logger';
import { sequentially } from '../sequentially';
import { Commit } from '../sourceCommit/parseSourceCommit';
import { autoMergeNowOrLater } from './autoMergeNowOrLater';
import { getBackportBranchName } from './getBackportBranchName';
import { getMergeCommits } from './getMergeCommit';
import { getTargetPRLabels } from './getTargetPRLabels';
import { waitForCherrypick } from './waitForCherrypick';

export async function cherrypickAndCreateTargetPullRequest({
  options,
  commits,
  targetBranch,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
}): Promise<{ url: string; number: number; didUpdate: boolean }> {
  const backportBranch = getBackportBranchName(targetBranch, commits);
  const repoForkOwner = getRepoForkOwner(options);
  consoleLog(`\n${chalk.bold(`Backporting to ${targetBranch}:`)}`);

  await validateTargetBranch({ ...options, branchName: targetBranch });
  await createBackportBranch({
    options,
    sourceBranch: getSourceBranchFromCommits(commits),
    targetBranch,
    backportBranch,
  });

  const commitsFlattened = flatten(
    await Promise.all(commits.map((c) => getMergeCommits(options, c))),
  );

  const cherrypickResults = await sequentially(commitsFlattened, (commit) =>
    waitForCherrypick(options, commit, targetBranch),
  );
  const hasAnyCommitWithConflicts = cherrypickResults.some(
    (r) => r.hasCommitsWithConflicts,
  );

  if (!options.dryRun) {
    await pushBackportBranch({ options, backportBranch });
    await deleteBackportBranch({ options, backportBranch });
  }

  const prPayload: PullRequestPayload = {
    owner: options.repoOwner,
    repo: options.repoName,
    title: getTitle({ options, commits, targetBranch }),
    body: getPullRequestBody({ options, commits, targetBranch }),
    head: `${repoForkOwner}:${backportBranch}`, // eg. sqren:backport/7.x/pr-75007
    base: targetBranch, // eg. 7.x
  };

  const targetPullRequest = await createPullRequest({ options, prPayload });

  // add assignees to target pull request
  const assignees = options.autoAssign
    ? [options.authenticatedUsername]
    : options.assignees;

  if (options.assignees.length > 0) {
    await addAssigneesToPullRequest({
      ...options,
      pullNumber: targetPullRequest.number,
      assignees,
    });
  }

  // add reviewers to target pull request
  if (options.reviewers.length > 0) {
    await addReviewersToPullRequest(
      options,
      targetPullRequest.number,
      options.reviewers,
    );
  }

  // add reviewers of the original PRs to the target pull request
  if (options.addOriginalReviewers) {
    await syncSourcePullRequestReviewersToTargetPullRequest(
      options,
      commits,
      targetPullRequest.number,
    );
  }

  // add labels to target pull request
  if (options.targetPRLabels.length > 0) {
    const labels = getTargetPRLabels({
      interactive: options.interactive,
      targetPRLabels: options.targetPRLabels,
      commits,
      targetBranch,
    });
    await addLabelsToPullRequest({
      ...options,
      pullNumber: targetPullRequest.number,
      labels,
    });
  }

  // make PR auto mergable
  if (options.autoMerge && hasAnyCommitWithConflicts) {
    await autoMergeNowOrLater(options, targetPullRequest.number);
  }

  // add labels to source pull requests
  if (options.sourcePRLabels.length > 0) {
    const promises = commits.map((commit) => {
      if (commit.sourcePullRequest) {
        return addLabelsToPullRequest({
          ...options,
          pullNumber: commit.sourcePullRequest.number,
          labels: options.sourcePRLabels,
        });
      }
    });

    await Promise.all(promises);
  }

  consoleLog(`View pull request: ${targetPullRequest.url}`);

  return targetPullRequest;
}
