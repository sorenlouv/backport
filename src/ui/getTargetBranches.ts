import isEmpty from 'lodash.isempty';
import { TargetBranchChoice } from '../options/ConfigOptions';
import { ValidConfigOptions } from '../options/options';
import { HandledError } from '../services/HandledError';
import { promptForTargetBranches } from '../services/prompts';
import { Commit } from '../types/Commit';
import { getTargetBranchesFromLabels } from './getTargetBranchesFromLabels';

// TODO: Rename to: getSelectedTargetBranches
export function getTargetBranches(
  options: ValidConfigOptions,
  commits: Commit[]
): Promise<string[]> | string[] {
  // target branches already specified via cli eg. `backport --targetBranches 7.x`
  // (in contrast to letting the user choose from a list)
  if (!isEmpty(options.targetBranches)) {
    return options.targetBranches;
  }

  const targetBranchesFromLabels = getTargetBranchesFromLabels({
    options,
    commits,
  });

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
): TargetBranchChoice[] {
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
