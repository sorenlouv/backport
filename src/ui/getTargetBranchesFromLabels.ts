import isEmpty from 'lodash.isempty';
import matcher from 'matcher';
import { ValidConfigOptions } from '../options/options';
import { Commit } from '../types/Commit';

export function getTargetBranchesFromLabels({
  options,
  commits,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
}): string[] {
  // don't infer target branches if multiple commits are selected
  if (commits.length != 1) {
    return [];
  }

  // use first (and only) commit
  const commit = commits[0];

  // commit must be related to a PR that contain labels
  if (!commit.sourcePRLabels) {
    return [];
  }

  const existingPRs = commit.existingTargetPullRequests.map((pr) => pr.branch);

  return (
    options.targetBranchChoices
      .filter((targetBranchChoice) => {
        // if there's no sourcePRLabels, it should match by the branch name
        if (
          targetBranchChoice.checked !== false &&
          isEmpty(targetBranchChoice.sourcePRLabels)
        ) {
          return commit.sourcePRLabels?.includes(targetBranchChoice.name);
        }

        // match by sourcePRLabels
        return targetBranchChoice.sourcePRLabels?.every((label) =>
          //@ts-expect-error
          matcher.isMatch(commit.sourcePRLabels, label)
        );
      })
      // remove target branch if a pr already exists for the given branch
      .filter((targetBranch) => !existingPRs.includes(targetBranch.name))

      // remove target branch if source branch is identical
      .filter((targetBranch) => commit.sourceBranch !== targetBranch.name)
      .map((targetBranch) => targetBranch.name)
  );
}
