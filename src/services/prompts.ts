import chalk from 'chalk';
import inquirer, {
  CheckboxQuestion,
  ListQuestion,
  ConfirmQuestion,
} from 'inquirer';
import isEmpty from 'lodash.isempty';
import { BranchChoice } from '../options/ConfigOptions';
import { BackportCommit } from '../types/Commit';
import { getShortSha } from './github/commitFormatters';

type Question = CheckboxQuestion | ListQuestion | ConfirmQuestion;

async function prompt<T = unknown>(options: Question) {
  const { promptResult } = (await inquirer.prompt([
    { ...options, name: 'promptResult' },
  ])) as { promptResult: T };
  return promptResult;
}

export async function promptForCommits({
  CommitSelecteds,
  isMultipleChoice,
}: {
  CommitSelecteds: BackportCommit[];
  isMultipleChoice: boolean;
}): Promise<BackportCommit[]> {
  const choices = CommitSelecteds.map((c, i) => {
    const existingPRs = c.existingTargetPullRequests
      .map((item) => {
        const styling = item.state === 'MERGED' ? chalk.green : chalk.gray;
        return styling(item.branch);
      })
      .join(', ');

    const position = chalk.gray(`${i + 1}.`);

    return {
      name: `${position} ${c.formattedMessage} ${existingPRs}`,
      short: c.pullNumber
        ? `#${c.pullNumber} (${getShortSha(c.sha)})`
        : getShortSha(c.sha),
      value: c,
    };
  });

  const res = await prompt<BackportCommit[]>({
    loop: false,
    pageSize: 15,
    choices: choices,
    message: 'Select commit',
    type: isMultipleChoice ? 'checkbox' : 'list',
  });

  const selectedCommits = Array.isArray(res) ? res.reverse() : [res];
  return isEmpty(selectedCommits)
    ? promptForCommits({ CommitSelecteds: CommitSelecteds, isMultipleChoice })
    : selectedCommits;
}

export async function promptForTargetBranches({
  targetBranchChoices,
  isMultipleChoice,
}: {
  targetBranchChoices: BranchChoice[];
  isMultipleChoice: boolean;
}): Promise<string[]> {
  const res = await prompt<string | string[]>({
    loop: false,
    pageSize: 15,
    choices: targetBranchChoices,
    message: 'Select branch',
    type: isMultipleChoice ? 'checkbox' : 'list',
  });

  const selectedBranches = Array.isArray(res) ? res : [res];

  return isEmpty(selectedBranches)
    ? promptForTargetBranches({
        targetBranchChoices,
        isMultipleChoice,
      })
    : selectedBranches;
}

export function confirmPrompt(message: string) {
  return prompt<boolean>({ message, type: 'confirm' });
}
