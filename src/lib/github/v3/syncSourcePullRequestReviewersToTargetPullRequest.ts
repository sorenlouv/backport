import { ValidConfigOptions } from '../../../options/options';
import { filterNil } from '../../../utils/filterEmpty';
import { Commit } from '../../sourceCommit/parseSourceCommit';
import { addReviewersToPullRequest } from './addReviewersToPullRequest';
import { getReviewersFromPullRequests } from './getReviewersFromPullRequests';

export async function syncSourcePullRequestReviewersToTargetPullRequest(
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
