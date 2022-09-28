import { Commit } from '../../entrypoint.api';
import { getShortSha } from '../github/commitFormatters';

/*
 * Returns the name of the backport branch without remote name
 *
 * Examples:
 * For a single PR: `backport/7.x/pr-1234`
 * For a single commit: `backport/7.x/commit-abcdef`
 * For multiple: `backport/7.x/pr-1234_commit-abcdef`
 */
export function getBackportBranchName(targetBranch: string, commits: Commit[]) {
  const refValues = commits
    .map((commit) =>
      commit.sourcePullRequest
        ? `pr-${commit.sourcePullRequest.number}`
        : `commit-${getShortSha(commit.sourceCommit.sha)}`
    )
    .join('_')
    .slice(0, 200);
  return `backport/${targetBranch}/${refValues}`;
}
