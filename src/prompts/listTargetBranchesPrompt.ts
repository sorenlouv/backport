import { BranchChoice } from '../types/Config';
import { selectPrompt } from './selectPrompt';

export async function listTargetBranchesPrompt({
  targetBranchChoices,
  isMultipleChoice,
}: {
  targetBranchChoices: BranchChoice[];
  isMultipleChoice: boolean;
}): Promise<string[]> {
  const choices = targetBranchChoices.map((c) => {
    return {
      name: c.name,
      displayShort: c.name,
      displayLong: c.name,
      enabled: c.checked,
      original: c,
    };
  });

  const targetBranches = await selectPrompt({
    message: 'Select branch',
    choices,
    isMultiple: isMultipleChoice,
  });

  return targetBranches.map((branch) => branch.name);
}
