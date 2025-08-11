import type { ValidConfigOptions } from '../../options/options';
import { filterNil } from '../../utils/filter-empty';
import { addReviewersToPullRequest } from '../github/v3/add-reviewers-to-pull-request';
import { getReviewersFromPullRequests } from '../github/v3/get-reviewers-from-pull-requests';
import type { Commit } from '../sourceCommit/parse-source-commit';

export async function copySourcePullRequestReviewersToTargetPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const pullNumbers = commits
    .map((commit) => commit.sourcePullRequest?.number)
    .filter(filterNil);

  const reviewers = await getReviewersFromPullRequests({
    options,
    pullNumbers,
  });
  if (reviewers) {
    await addReviewersToPullRequest(options, pullNumber, reviewers);
  }
}
