import Handlebars from 'handlebars';
import { Commit } from '../../entrypoint.api';
import { ValidConfigOptions } from '../../options/options';
import { getShortSha } from '../github/commitFormatters';

/*
 * Returns the name of the backport branch without remote name
 *
 * Examples:
 * For a single PR: `backport/7.x/pr-1234`
 * For a single commit: `backport/7.x/commit-abcdef`
 * For multiple: `backport/7.x/pr-1234_commit-abcdef`
 */
export function getBackportBranchName(
  options: ValidConfigOptions,
  targetBranch: string,
  commits: Commit[],
) {
  const refValues = commits
    .map((commit) =>
      commit.sourcePullRequest
        ? `pr-${commit.sourcePullRequest.number}`
        : `commit-${getShortSha(commit.sourceCommit.sha)}`,
    )
    .join('_')
    .slice(0, 200);
  const defaultBackportBranchName = 'backport/{{targetBranch}}/{{refValues}}';
  const template = Handlebars.compile(
    options.backportBranchName ?? defaultBackportBranchName,
  );

  return template({
    sourcePullRequest: commits[0].sourcePullRequest, // assume that all commits are from the same PR
    targetBranch,
    refValues,
  });
}
