import chalk from 'chalk';
import { getShortSha } from '../services/github/commitFormatters';
import { CommitChoice } from '../types/Commit';
import { selectPrompt } from './selectPrompt';

export async function listCommitsPrompt({
  commitChoices,
  isMultipleChoice,
}: {
  commitChoices: CommitChoice[];
  isMultipleChoice: boolean;
}): Promise<CommitChoice[]> {
  const choices = commitChoices.map((c) => {
    const existingPRs = c.existingTargetPullRequests
      .map((item) => {
        const styling = item.state === 'MERGED' ? chalk.green : chalk.gray;
        return styling(item.branch);
      })
      .join(', ');

    return {
      name: `${c.formattedMessage} ${existingPRs}`,
      displayLong: c.formattedMessage,
      displayShort: c.pullNumber ? `#${c.pullNumber}` : getShortSha(c.sha),
      original: c,
      enabled: false,
    };
  });

  const commits = await selectPrompt({
    message: 'Select commit',
    choices: choices,
    isMultiple: isMultipleChoice,
  });

  return commits;
}
