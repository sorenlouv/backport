import intersection from 'lodash.intersection';
import isEmpty from 'lodash.isempty';
import matcher from 'matcher';
import { ValidConfigOptions } from '../options/options';
import { HandledError } from '../services/HandledError';
import { promptForTargetBranches } from '../services/prompts';
import { Commit } from '../types/Commit';
import { filterNil } from '../utils/filterEmpty';

export function getTargetBranches(
  options: ValidConfigOptions,
  commits: Commit[]
) {
  // target branches already specified (in contrast to letting the user choose from a list)
  if (!isEmpty(options.targetBranches)) {
    return options.targetBranches;
  }

  // intersection of target branches from the selected commits
  const targetBranchesFromLabels = intersection(
    ...commits.map((commit) => getTargetBranchesFromLabels({ options, commit }))
  ).filter(filterNil);

  // automatically backport to specified target branches
  if (options.ci) {
    if (isEmpty(targetBranchesFromLabels)) {
      throw new HandledError(`There are no branches to backport to. Aborting.`);
    }

    return targetBranchesFromLabels;
  }

  // sourceBranch should be the same for all commits, so picking `sourceBranch` from the first commit should be fine 🤞
  // this is specifically needed when backporting a PR like `backport --pr 123` and the source PR was merged to a non-default (aka non-master) branch.
  const { sourceBranch } = commits[0];

  const targetBranchChoices = getTargetBranchChoices(
    options,
    targetBranchesFromLabels,
    sourceBranch
  );

  // render interactive list of branches
  return promptForTargetBranches({
    targetBranchChoices,
    isMultipleChoice: options.multipleBranches,
  });
}

export function getTargetBranchChoices(
  options: ValidConfigOptions,
  targetBranchesFromLabels: string[],
  sourceBranch: string
) {
  // exclude sourceBranch from targetBranchChoices
  const targetBranchesChoices = options.targetBranchChoices.filter(
    (choice) => choice.name !== sourceBranch
  );

  if (isEmpty(targetBranchesChoices)) {
    throw new HandledError('Missing target branch choices');
  }

  if (isEmpty(targetBranchesFromLabels)) {
    return targetBranchesChoices;
  }

  // select target branches based on pull request labels
  return targetBranchesChoices.map((choice) => {
    const isChecked = targetBranchesFromLabels.includes(choice.name);
    return { ...choice, checked: isChecked };
  });
}

export function getTargetBranchesFromLabels({
  options,
  commit,
}: {
  options: ValidConfigOptions;
  commit: Commit;
}) {
  const labels = commit.sourcePRLabels;

  if (!labels) {
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
          matcher.isMatch(labels, label)
        );
      })
      // remove target branch if a pr already exists for the given branch
      .filter((targetBranch) => !existingPRs.includes(targetBranch.name))

      // remove target branch if source branch is identical
      .filter((targetBranch) => commit.sourceBranch !== targetBranch.name)
      .map((targetBranch) => targetBranch.name)
  );
}
