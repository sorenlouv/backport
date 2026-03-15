import chalk from 'chalk';
import { flatten } from 'lodash-es';
import type { ValidConfigOptions } from '../../options/options.js';
import { getSourceBranchFromCommits } from '../get-source-branch-from-commits.js';
import {
  createBackportBranch,
  deleteBackportBranch,
  pushBackportBranch,
  getRepoForkOwner,
} from '../git.js';
import { addAssigneesToPullRequest } from '../github/v3/add-assignees-to-pull-request.js';
import { addLabelsToPullRequest } from '../github/v3/add-labels-to-pull-request.js';
import { addReviewersToPullRequest } from '../github/v3/add-reviewers-to-pull-request.js';
import type { PullRequestPayload } from '../github/v3/getPullRequest/create-pull-request.js';
import { createPullRequest } from '../github/v3/getPullRequest/create-pull-request.js';
import { getPullRequestBody } from '../github/v3/getPullRequest/get-pull-request-body.js';
import { getTitle } from '../github/v3/getPullRequest/get-title.js';
import { validateTargetBranch } from '../github/v4/validate-target-branch.js';
import { consoleLog } from '../logger.js';
import { sequentially } from '../sequentially.js';
import type { Commit } from '../sourceCommit/parse-source-commit.js';
import { autoMergeNowOrLater } from './auto-merge-now-or-later.js';
import { copySourcePullRequestReviewersToTargetPullRequest } from './copy-source-pull-request-reviewers-to-target-pull-request.js';
import { getBackportBranchName } from './get-backport-branch-name.js';
import { getMergeCommits } from './get-merge-commit.js';
import { getTargetPRLabels } from './getTargetPRLabels/get-target-prlabels.js';
import { waitForCherrypick } from './wait-for-cherrypick.js';

export async function cherrypickAndCreateTargetPullRequest({
  options,
  commits,
  targetBranch,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
}): Promise<{ url: string; number: number; didUpdate: boolean }> {
  const backportBranch = getBackportBranchName({
    options,
    targetBranch,
    commits,
  });
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
  const unresolvedFiles = cherrypickResults.flatMap((r) => r.unresolvedFiles);

  if (!options.dryRun) {
    await pushBackportBranch({ options, backportBranch });
    await deleteBackportBranch({ options, backportBranch });
  }

  const prPayload: PullRequestPayload = {
    owner: options.repoOwner,
    repo: options.repoName,
    title: getTitle({ options, commits, targetBranch }),
    body: getPullRequestBody({
      options,
      commits,
      targetBranch,
      hasAnyCommitWithConflicts,
      unresolvedFiles,
    }),
    head: `${repoForkOwner}:${backportBranch}`, // eg. sorenlouv:backport/7.x/pr-75007
    base: targetBranch, // eg. 7.x
    draft: options.draft,
  };

  const targetPullRequest = await createPullRequest({ options, prPayload });

  // add assignees to target pull request
  const assignees = options.autoAssign
    ? [options.authenticatedUsername]
    : options.assignees;

  if (assignees.length > 0) {
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
  if (options.copySourcePRReviewers) {
    await copySourcePullRequestReviewersToTargetPullRequest(
      options,
      commits,
      targetPullRequest.number,
    );
  }

  const targetPRLabels = getTargetPRLabels({
    interactive: options.interactive,
    targetPRLabels: options.targetPRLabels,
    copySourcePRLabels: options.copySourcePRLabels,
    commits,
    targetBranch,
  });

  // add labels to target pull request
  if (targetPRLabels.length > 0) {
    await addLabelsToPullRequest({
      ...options,
      pullNumber: targetPullRequest.number,
      labels: targetPRLabels,
    });
  }

  // make PR auto mergable
  if (options.autoMerge && !hasAnyCommitWithConflicts) {
    await autoMergeNowOrLater(options, targetPullRequest.number);
  }

  // add labels to source pull requests
  if (options.sourcePRLabels.length > 0) {
    await Promise.all(
      commits
        .filter((commit) => commit.sourcePullRequest)
        .map((commit) =>
          addLabelsToPullRequest({
            ...options,
            pullNumber: commit.sourcePullRequest!.number,
            labels: options.sourcePRLabels,
          }),
        ),
    );
  }

  consoleLog(`View pull request: ${targetPullRequest.url}`);

  return targetPullRequest;
}
