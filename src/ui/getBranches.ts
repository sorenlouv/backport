import isEmpty from 'lodash.isempty';
import { BackportOptions } from '../options/options';
import { consoleLog } from '../services/logger';
import { promptForTargetBranches } from '../services/prompts';
import { CommitSelected } from '../types/Commit';
import { BranchChoice } from '../types/Config';

export function getTargetBranches(
  options: BackportOptions,
  commits: CommitSelected[]
) {
  // target branches specified via cli
  if (!isEmpty(options.targetBranches)) {
    return options.targetBranches;
  }

  // target branches infered via pull request labels
  if (
    options.pullNumber &&
    commits.length === 1 &&
    commits[0].targetBranches?.length
  ) {
    consoleLog(
      `\nAutomatically backporting to the following branches based on PR labels: ${commits[0].targetBranches.join(
        ', '
      )}`
    );

    return commits[0].targetBranches;
  }

  return promptForTargetBranches({
    targetBranchChoices: options.targetBranchChoices as BranchChoice[],
    isMultipleChoice: options.multipleBranches,
  });
}
