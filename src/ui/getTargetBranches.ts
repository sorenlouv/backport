import flatMap from 'lodash.flatmap';
import isEmpty from 'lodash.isempty';
import { BackportOptions } from '../options/options';
import { listTargetBranchesPrompt } from '../prompts/listTargetBranchesPrompt';
import { HandledError } from '../services/HandledError';
import { CommitSelected } from '../types/Commit';
import { filterEmpty } from '../utils/filterEmpty';

export function getTargetBranches(
  options: BackportOptions,
  commits: CommitSelected[]
) {
  // target branches specified via cli
  if (!isEmpty(options.targetBranches)) {
    return options.targetBranches;
  }

  // combine target branches from all commits
  const selectedTargetBranches = flatMap(
    commits,
    (commit) => commit.selectedTargetBranches
  ).filter(filterEmpty);

  const targetBranchChoices = getTargetBranchChoices(
    options,
    selectedTargetBranches
  );

  return listTargetBranchesPrompt({
    targetBranchChoices,
    isMultipleChoice: options.multipleBranches,
  });
}

function getTargetBranchChoices(
  options: BackportOptions,
  selectedTargetBranches: string[]
) {
  // exclude sourceBranch from targetBranchChoices
  const targetBranchChoices = options.targetBranchChoices?.filter(
    (choice) => choice.name !== options.sourceBranch
  );

  if (!targetBranchChoices || isEmpty(targetBranchChoices)) {
    throw new HandledError('Missing target branch choices');
  }

  // whether the selected target branches exists
  const hasSelectedTargetBranches = targetBranchChoices.some((c) =>
    selectedTargetBranches.includes(c.name)
  );

  // use default target branch selection
  if (!hasSelectedTargetBranches) {
    return targetBranchChoices;
  }

  // automatially select target branches based on pull request labels
  return targetBranchChoices.map((choice) => {
    const isChecked = selectedTargetBranches.includes(choice.name);
    return {
      ...choice,
      checked: isChecked,
    };
  });
}
